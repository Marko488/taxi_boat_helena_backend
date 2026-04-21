import express from "express";
import { pool } from "../db.js";
const router = express.Router();

import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

import buildReservationEmail from "../email.js";

router.post("/", async (req, res) => {
  try {
    const {
      line_departure_id,
      user_id,
      adults_count,
      children_count,
      email,
      from_location,
      to_location,
    } = req.body;

    const adults = Number(adults_count);
    const children = Number(children_count);
    const seats_count = adults + children;

    if (!line_departure_id || !user_id || !email) {
      return res.status(400).json({
        message: "Nedostaju obavezni podaci za rezervaciju!",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email adresa nije ispravna.",
      });
    }

    if (Number.isNaN(adults) || adults < 1) {
      return res.status(400).json({
        message: "Potrebno je odabrati barem 1 odraslu osobu.",
      });
    }

    if (Number.isNaN(children) || children < 0) {
      return res.status(400).json({
        message: "Broj djece nije ispravan.",
      });
    }

    if (seats_count < 1) {
      return res.status(400).json({
        message: "Ukupan broj mjesta mora biti barem 1.",
      });
    }

    const [departures] = await pool.query(
      `SELECT * FROM line_departures WHERE id = ?`,
      [line_departure_id],
    );

    if (departures.length === 0) {
      return res.status(404).json({
        message: `Ne postoji polazak sa ID-em ${line_departure_id}!`,
      });
    }

    const departure = departures[0];
    const availableSeats = departure.capacity - departure.reserved_seats;

    if (availableSeats < seats_count) {
      return res.status(400).json({
        message: `Rezervirali biste ${seats_count} mjesta, a trenutno je dostupno najviše ${availableSeats}.`,
      });
    }

    if (departure.status !== "scheduled") {
      return res.status(400).json({
        message: "Nije moguće rezervirati taj polazak!",
      });
    }

    const reservationCode =
      "RES-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    await pool.query(
      `INSERT INTO line_reservations 
      (line_departure_id, user_id, adults_count, children_count, seats_count, status, reservation_code)
      VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [
        line_departure_id,
        user_id,
        adults,
        children,
        seats_count,
        reservationCode,
      ],
    );

    await pool.query(
      `UPDATE line_departures 
       SET reserved_seats = reserved_seats + ? 
       WHERE id = ?`,
      [seats_count, line_departure_id],
    );

    const totalPrice = adults * 4 + children * 2;

    const emailHtml = buildReservationEmail({
      reservationCode,
      departure,
      routeText: `${from_location} → ${to_location}`,
      seatsCount: seats_count,
      adults,
      children,
      totalPrice,
    });

    try {
      const { data, error } = await resend.emails.send({
        from: "Taxi Line <onboarding@resend.dev>",
        to: email,
        subject: "Potvrda rezervacije",
        html: emailHtml,
      });

      if (error) {
        console.error("Greška kod slanja emaila:", error);
      } else {
        console.log("Email uspješno poslan:", data);
      }
    } catch (mailError) {
      console.error("Email servis error:", mailError);
    }

    return res.status(201).json({
      message: `Uspješno ste rezervirali ${seats_count} mjesta.`,
      reservationCode,
      totalSeats: seats_count,
      adultsCount: adults,
      childrenCount: children,
      totalPrice,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      message: "Greška u radu sa bazom podataka!",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const [rezervacije] = await pool.query(`SELECT
        lr.id,
        lr.reservation_code,
        lr.seats_count,
        lr.status,

        u.full_name AS user_name,

        ld.departure_date,
        ld.departure_time,

        fl.name AS from_location,
        tl.name AS to_location,

        b.name AS boat_name

      FROM line_reservations lr

      JOIN users u ON lr.user_id = u.id
      JOIN line_departures ld ON lr.line_departure_id = ld.id
      JOIN locations fl ON ld.from_location_id = fl.id
      JOIN locations tl ON ld.to_location_id = tl.id
      JOIN boats b ON ld.boat_id = b.id

      ORDER BY ld.departure_time ASC`);
    if (rezervacije.length > 0) {
      return res.status(200).json(rezervacije);
    } else {
      return res.status(404).json({
        message: "Nema rezervacija",
        data: [],
      });
    }
  } catch (error) {
    console.log("GRESKA: ", error.message);
    res.status(500).json({ message: "Greska u radu sa bazom podataka!" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ID_rez = req.params.id;

    const [reservations] = await pool.query(
      `SELECT * FROM line_reservations WHERE id=?`,
      [ID_rez],
    );

    if (reservations.length == 0) {
      return res
        .status(404)
        .json({ message: "Rezervaciju nije moguće pronaći!" });
    }

    const reservation = reservations[0];

    if (reservation.status != "active") {
      return res
        .status(400)
        .json({ message: "Nije moguce obrisati ovu rezervaciju!" });
    }

    await pool.query(
      `UPDATE line_reservations SET status="cancelled" WHERE id=?`,
      [ID_rez],
    );

    await pool.query(
      `UPDATE line_departures SET reserved_seats=reserved_seats-? WHERE id=?`,
      [reservation.seats_count, reservation.line_departure_id],
    );

    return res
      .status(200)
      .json({ message: "Uspjesno ste otkazali rezervaciju!" });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res
      .status(500)
      .json({ message: "Greska u radu sa bazom podataka!" });
  }
});

export default router;
