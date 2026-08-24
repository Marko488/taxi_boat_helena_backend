import express from "express";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
const router = express.Router();

import { Resend } from "resend";
import buildReservationEmail from "../email.js";

// Resend se inicijalizira samo ako je ključ postavljen. Bez njega aplikacija
// normalno radi — rezervacija se uredno zapiše, samo se potvrda ne šalje.
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Cjenik (u eurima). Držati na jednom mjestu.
const CIJENA_ODRASLI = 4;
const CIJENA_DIJETE = 2;

// Kod rezervacije: 6 znakova iz abecede bez vizualno sličnih znakova (bez I, O, 0, 1).
// Koristi se kriptografski izvor slučajnosti umjesto Math.random().
const ABECEDA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generirajKod = () => {
  const bajtovi = crypto.randomBytes(6);
  let kod = "";
  for (const bajt of bajtovi) kod += ABECEDA[bajt % ABECEDA.length];
  return `RES-${kod}`;
};

// Pronađi korisnika po e-mailu ili ga stvori. Vraća id.
// LAST_INSERT_ID(id) osigurava da insertId sadrži id postojećeg retka kad e-mail već postoji.
const nadjiIliStvoriKorisnika = async (veza, ime, email) => {
  const [rezultat] = await veza.query(
    `INSERT INTO users (full_name, email, phone)
     VALUES (?, ?, '')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), full_name = ?`,
    [ime, email, ime],
  );
  return rezultat.insertId;
};

// Pošalji potvrdu. Poziva se izvan transakcije i nikad ne baca — neuspjeh
// slanja ne smije poništiti već zapisanu rezervaciju.
const posaljiPotvrdu = async (primatelj, sadrzaj) => {
  if (!resend) {
    console.warn(
      "RESEND_API_KEY nije postavljen — potvrda rezervacije nije poslana.",
    );
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM || "Taxi Boat Helena <onboarding@resend.dev>",
      to: primatelj,
      subject: "Potvrda rezervacije",
      html: sadrzaj,
    });
    if (error) {
      console.error("Greška kod slanja emaila:", error);
    } else {
      console.log("Email uspješno poslan:", data?.id ?? data);
    }
  } catch (greska) {
    console.error("Email servis error:", greska);
  }
};

// ---------------------------------------------------------------------------
// NOVA REZERVACIJA (javno)
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  const { line_departure_id, adults_count, children_count, name, email } =
    req.body;

  const adults = Number(adults_count);
  const children = Number(children_count);
  const seats_count = adults + children;

  // --- validacija ulaza ---
  if (!line_departure_id || !email) {
    return res
      .status(400)
      .json({ message: "Nedostaju obavezni podaci za rezervaciju!" });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: "Unesite ime i prezime." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Email adresa nije ispravna." });
  }

  if (Number.isNaN(adults) || adults < 1) {
    return res
      .status(400)
      .json({ message: "Potrebno je odabrati barem 1 odraslu osobu." });
  }

  if (Number.isNaN(children) || children < 0) {
    return res.status(400).json({ message: "Broj djece nije ispravan." });
  }

  if (seats_count < 1) {
    return res
      .status(400)
      .json({ message: "Ukupan broj mjesta mora biti barem 1." });
  }

  const imeGosta = name.trim();
  const emailGosta = email.trim();

  const veza = await pool.getConnection();
  let podaciZaEmail = null;

  try {
    await veza.beginTransaction();

    // Redak polaska se zaključava do kraja transakcije. Time dvije istovremene
    // rezervacije ne mogu obje pročitati isti broj slobodnih mjesta.
    const [polasci] = await veza.query(
      `SELECT id, capacity, reserved_seats, status,
              DATE_FORMAT(departure_date, '%Y-%m-%d') AS departure_date,
              departure_time,
              (TIMESTAMP(departure_date, departure_time) < NOW()) AS je_proslost
         FROM line_departures
        WHERE id = ?
          FOR UPDATE`,
      [line_departure_id],
    );

    if (polasci.length === 0) {
      await veza.rollback();
      return res
        .status(404)
        .json({ message: `Ne postoji polazak sa ID-em ${line_departure_id}!` });
    }

    const polazak = polasci[0];

    if (Number(polazak.je_proslost) === 1) {
      await veza.rollback();
      return res
        .status(400)
        .json({ message: "Nije moguće rezervirati polazak u prošlosti." });
    }

    if (polazak.status !== "scheduled") {
      await veza.rollback();
      return res
        .status(400)
        .json({ message: "Nije moguće rezervirati taj polazak!" });
    }

    const slobodnaMjesta = polazak.capacity - polazak.reserved_seats;
    if (slobodnaMjesta < seats_count) {
      await veza.rollback();
      return res.status(400).json({
        message: `Rezervirali biste ${seats_count} mjesta, a trenutno je dostupno najviše ${slobodnaMjesta}.`,
      });
    }

    // Naziv rute uzima se iz baze, a ne iz tijela zahtjeva.
    const [rute] = await veza.query(
      `SELECT fl.name AS from_location, tl.name AS to_location
         FROM line_departures ld
         JOIN locations fl ON ld.from_location_id = fl.id
         JOIN locations tl ON ld.to_location_id = tl.id
        WHERE ld.id = ?`,
      [line_departure_id],
    );
    const ruta = rute[0] || { from_location: "", to_location: "" };

    const userId = await nadjiIliStvoriKorisnika(veza, imeGosta, emailGosta);

    // Kod je jedinstven u bazi; u malo vjerojatnom slučaju kolizije pokušaj ponovno.
    let reservationCode = null;
    for (let pokusaj = 1; pokusaj <= 5; pokusaj++) {
      const kandidat = generirajKod();
      try {
        await veza.query(
          `INSERT INTO line_reservations
             (line_departure_id, user_id, adults_count, children_count, seats_count,
              status, reservation_code, guest_name, guest_email)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          [
            line_departure_id,
            userId,
            adults,
            children,
            seats_count,
            kandidat,
            imeGosta,
            emailGosta,
          ],
        );
        reservationCode = kandidat;
        break;
      } catch (greska) {
        if (greska.code === "ER_DUP_ENTRY" && pokusaj < 5) continue;
        throw greska;
      }
    }

    const noviBrojMjesta = polazak.reserved_seats + seats_count;

    await veza.query(
      "UPDATE line_departures SET reserved_seats = ? WHERE id = ?",
      [noviBrojMjesta, line_departure_id],
    );

    // Ako je polazak sada popunjen, automatski ga označi kao 'full'.
    if (noviBrojMjesta >= polazak.capacity) {
      await veza.query(
        "UPDATE line_departures SET status = 'full' WHERE id = ? AND status = 'scheduled'",
        [line_departure_id],
      );
    }

    await veza.commit();

    const totalPrice = adults * CIJENA_ODRASLI + children * CIJENA_DIJETE;

    podaciZaEmail = {
      primatelj: emailGosta,
      sadrzaj: buildReservationEmail({
        reservationCode,
        departure: {
          departure_date: polazak.departure_date,
          departure_time: polazak.departure_time,
        },
        routeText: `${ruta.from_location} → ${ruta.to_location}`,
        seatsCount: seats_count,
        adults,
        children,
        totalPrice,
      }),
    };

    res.status(201).json({
      message: `Uspješno ste rezervirali ${seats_count} mjesta.`,
      reservationCode,
      totalSeats: seats_count,
      adultsCount: adults,
      childrenCount: children,
      totalPrice,
    });
  } catch (greska) {
    await veza.rollback().catch(() => {});
    console.error("GRESKA:", greska.message);
    return res
      .status(500)
      .json({ message: "Greška u radu sa bazom podataka!" });
  } finally {
    veza.release();
  }

  // Slanje pošte tek nakon što je odgovor poslan i transakcija zatvorena.
  if (podaciZaEmail) {
    await posaljiPotvrdu(podaciZaEmail.primatelj, podaciZaEmail.sadrzaj);
  }
});

// ---------------------------------------------------------------------------
// POPIS REZERVACIJA (admin)
// ---------------------------------------------------------------------------
router.get("/", requireAdmin, async (req, res) => {
  try {
    const [rezervacije] = await pool.query(`SELECT
        lr.id,
        lr.reservation_code,
        lr.guest_name,
        lr.guest_email,
        lr.adults_count,
        lr.children_count,
        lr.seats_count,
        lr.status,
        DATE_FORMAT(ld.departure_date, '%Y-%m-%d') AS departure_date,
        ld.departure_time,
        fl.name AS from_location,
        tl.name AS to_location,
        b.name AS boat_name
      FROM line_reservations lr
      JOIN line_departures ld ON lr.line_departure_id = ld.id
      JOIN locations fl ON ld.from_location_id = fl.id
      JOIN locations tl ON ld.to_location_id = tl.id
      JOIN boats b ON ld.boat_id = b.id
      ORDER BY ld.departure_date DESC, ld.departure_time ASC`);

    return res.status(200).json(rezervacije);
  } catch (greska) {
    console.error("GRESKA:", greska.message);
    return res
      .status(500)
      .json({ message: "Greska u radu sa bazom podataka!" });
  }
});

// ---------------------------------------------------------------------------
// Zajednička logika otkazivanja. Vraća { status, message }.
// ---------------------------------------------------------------------------
const otkaziRezervaciju = async ({ id, kod }) => {
  const veza = await pool.getConnection();
  try {
    await veza.beginTransaction();

    const [rezervacije] = await veza.query(
      id
        ? "SELECT id, line_departure_id, seats_count, status FROM line_reservations WHERE id = ? FOR UPDATE"
        : "SELECT id, line_departure_id, seats_count, status FROM line_reservations WHERE reservation_code = ? FOR UPDATE",
      [id ?? kod],
    );

    if (rezervacije.length === 0) {
      await veza.rollback();
      return {
        status: 404,
        message: id
          ? "Rezervaciju nije moguće pronaći!"
          : "Rezervacija s tim kodom nije pronađena.",
      };
    }

    const rezervacija = rezervacije[0];

    if (rezervacija.status !== "active") {
      await veza.rollback();
      return { status: 400, message: "Ova rezervacija je već otkazana." };
    }

    // Zaključaj i polazak kako bi umanjenje brojača bilo sigurno.
    const [polasci] = await veza.query(
      "SELECT id, capacity, reserved_seats, status FROM line_departures WHERE id = ? FOR UPDATE",
      [rezervacija.line_departure_id],
    );

    await veza.query(
      "UPDATE line_reservations SET status = 'cancelled' WHERE id = ?",
      [rezervacija.id],
    );

    if (polasci.length > 0) {
      const polazak = polasci[0];
      // GREATEST sprječava da brojač padne ispod nule ako podaci ikad odstupe.
      const noviBrojMjesta = Math.max(
        0,
        polazak.reserved_seats - rezervacija.seats_count,
      );

      await veza.query(
        "UPDATE line_departures SET reserved_seats = ? WHERE id = ?",
        [noviBrojMjesta, polazak.id],
      );

      // Oslobodilo se mjesto — ako je polazak bio popunjen, vrati ga na aktivan.
      if (noviBrojMjesta < polazak.capacity && polazak.status === "full") {
        await veza.query(
          "UPDATE line_departures SET status = 'scheduled' WHERE id = ?",
          [polazak.id],
        );
      }
    }

    await veza.commit();
    return { status: 200, message: "Rezervacija je uspješno otkazana." };
  } catch (greska) {
    await veza.rollback().catch(() => {});
    console.error("GRESKA:", greska.message);
    return { status: 500, message: "Greška kod otkazivanja rezervacije." };
  } finally {
    veza.release();
  }
};

// ---------------------------------------------------------------------------
// OTKAZIVANJE (admin)
// ---------------------------------------------------------------------------
router.delete("/:id", requireAdmin, async (req, res) => {
  const ishod = await otkaziRezervaciju({ id: req.params.id });
  const poruka =
    ishod.status === 200 ? "Uspjesno ste otkazali rezervaciju!" : ishod.message;
  return res.status(ishod.status).json({ message: poruka });
});

// ---------------------------------------------------------------------------
// OTKAZIVANJE OD STRANE GOSTA (preko koda rezervacije) — javno
// ---------------------------------------------------------------------------
router.post("/cancel-by-code", async (req, res) => {
  const { reservation_code } = req.body;

  if (!reservation_code) {
    return res.status(400).json({ message: "Unesite kod rezervacije." });
  }

  const ishod = await otkaziRezervaciju({
    kod: String(reservation_code).trim().toUpperCase(),
  });
  return res.status(ishod.status).json({ message: ishod.message });
});

export default router;
