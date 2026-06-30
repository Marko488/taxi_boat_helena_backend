import express from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { date, from } = req.query;

    let sql = `
      SELECT 
        ld.id,
DATE_FORMAT(ld.departure_date, '%Y-%m-%d') AS departure_date,
        ld.departure_time,
        ld.from_location_id,
        ld.to_location_id,
        ld.boat_id,
        fl.name AS from_location,
        tl.name AS to_location,
        b.name AS boat,
        ld.capacity,
        ld.reserved_seats,
        (ld.capacity - ld.reserved_seats) AS available_seats,
        ld.status
      FROM line_departures ld
      JOIN locations fl ON ld.from_location_id = fl.id
      JOIN locations tl ON ld.to_location_id = tl.id
      JOIN boats b ON ld.boat_id = b.id
    `;

    // Ne prikazuj prošle polaske (ni u javnom ni u admin dijelu).
    let conditions = ["TIMESTAMP(ld.departure_date, ld.departure_time) >= NOW()"];
    let values = [];

    if (date) {
      conditions.push(`ld.departure_date = ?`);
      values.push(date);
    }

    if (from) {
      conditions.push(`fl.name = ?`);
      values.push(from);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY ld.departure_date ASC, ld.departure_time ASC`;

    const [rows] = await pool.query(sql, values);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({
      message: "Greška kod dohvaćanja polazaka!",
    });
  }
});

// DODAJ POLAZAK (admin)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      boat_id,
      departure_date,
      departure_time,
      from_location_id,
      to_location_id,
      capacity,
      status,
    } = req.body;

    if (
      !boat_id ||
      !departure_date ||
      !departure_time ||
      !from_location_id ||
      !to_location_id ||
      !capacity
    ) {
      return res.status(400).json({ message: "Nedostaju obavezni podaci." });
    }

    if (String(from_location_id) === String(to_location_id)) {
      return res
        .status(400)
        .json({ message: "Polazište i odredište ne mogu biti isti." });
    }

    if (Number(capacity) < 1) {
      return res.status(400).json({ message: "Kapacitet mora biti barem 1." });
    }

    const [result] = await pool.query(
      `INSERT INTO line_departures
        (boat_id, departure_date, departure_time, from_location_id, to_location_id, capacity, reserved_seats, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        boat_id,
        departure_date,
        departure_time,
        from_location_id,
        to_location_id,
        capacity,
        status || "scheduled",
      ],
    );

    return res
      .status(201)
      .json({ message: "Polazak je dodan.", id: result.insertId });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod dodavanja polaska!" });
  }
});

// GENERIRAJ POLASKE PO RASPOREDU (admin)
router.post("/generate", requireAdmin, async (req, res) => {
  try {
    const {
      date_from,
      date_to,
      time_from,
      time_to,
      interval_minutes,
      location_a_id,
      location_b_id,
      boat_id,
      capacity,
    } = req.body;

    if (
      !date_from ||
      !date_to ||
      !time_from ||
      !time_to ||
      !interval_minutes ||
      !location_a_id ||
      !location_b_id ||
      !capacity
    ) {
      return res.status(400).json({ message: "Nedostaju obavezni podaci." });
    }

    if (String(location_a_id) === String(location_b_id)) {
      return res
        .status(400)
        .json({ message: "Dvije lokacije moraju biti različite." });
    }

    // Svaki smjer dobiva svoju barku (dvije barke voze paralelno).
    // Ista barka ne može biti na dva mjesta u isto vrijeme (baza to brani).
    const [aktivneBarke] = await pool.query(
      "SELECT id FROM boats WHERE is_active = 1 ORDER BY id ASC",
    );
    let boatPool = aktivneBarke.map((b) => b.id);
    if (boatPool.length === 0) {
      const [sveBarke] = await pool.query("SELECT id FROM boats ORDER BY id ASC");
      boatPool = sveBarke.map((b) => b.id);
    }
    if (boatPool.length === 0) {
      return res.status(400).json({ message: "Nema barki u bazi." });
    }
    if (boatPool.length < 2) {
      return res.status(400).json({
        message:
          "Za oba smjera u isto vrijeme potrebne su 2 barke (jedna za svaki smjer). Trenutno je dostupna samo 1.",
      });
    }

    const interval = Number(interval_minutes);
    if (interval < 1) {
      return res.status(400).json({ message: "Interval mora biti barem 1 minuta." });
    }

    const toMinutes = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const startMin = toMinutes(time_from);
    let endMin = toMinutes(time_to);

    // 00:00 (ili vrijeme <= polaznog) tretiramo kao ponoć / kraj dana.
    if (endMin <= startMin) {
      endMin = 24 * 60;
    }

    // lista vremena (ne prelazi u idući dan)
    const times = [];
    for (let m = startMin; m <= endMin && m < 24 * 60; m += interval) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      times.push(`${hh}:${mm}:00`);
    }

    // lista datuma
    const fmt = (dt) => {
      const y = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      const da = String(dt.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    };

    const start = new Date(date_from + "T00:00:00");
    const end = new Date(date_to + "T00:00:00");

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ message: "Neispravan raspon datuma." });
    }

    const dates = [];
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      dates.push(fmt(new Date(dt)));
    }

    const directions = [
      { from: location_a_id, to: location_b_id, boat: boatPool[0] },
      { from: location_b_id, to: location_a_id, boat: boatPool[1] },
    ];

    // postojeci polasci u rasponu (da ne dupliramo)
    const [existingRows] = await pool.query(
      "SELECT departure_date, departure_time, from_location_id, to_location_id FROM line_departures WHERE departure_date BETWEEN ? AND ?",
      [date_from, date_to],
    );

    const existingSet = new Set(
      existingRows.map(
        (r) =>
          `${fmt(new Date(r.departure_date))}|${r.departure_time}|${String(
            r.from_location_id,
          )}|${String(r.to_location_id)}`,
      ),
    );

    const values = [];
    let skipped = 0;

    for (const date of dates) {
      for (const time of times) {
        for (const dir of directions) {
          const key = `${date}|${time}|${String(dir.from)}|${String(dir.to)}`;
          if (existingSet.has(key)) {
            skipped++;
            continue;
          }
          existingSet.add(key);
          values.push([
            dir.boat,
            date,
            time,
            dir.from,
            dir.to,
            capacity,
            0,
            "scheduled",
          ]);
        }
      }
    }

    let created = 0;
    if (values.length > 0) {
      const [result] = await pool.query(
        `INSERT IGNORE INTO line_departures
          (boat_id, departure_date, departure_time, from_location_id, to_location_id, capacity, reserved_seats, status)
         VALUES ?`,
        [values],
      );
      created = result.affectedRows;
    }

    const totalSkipped = skipped + (values.length - created);

    return res.status(201).json({
      message: `Generirano ${created} polazaka. Preskočeno ${totalSkipped} (već postoje).`,
      created,
      skipped: totalSkipped,
    });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod generiranja polazaka!" });
  }
});

// UREDI POLAZAK (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      boat_id,
      departure_date,
      departure_time,
      from_location_id,
      to_location_id,
      capacity,
      status,
    } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM line_departures WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Polazak ne postoji." });
    }

    if (
      !boat_id ||
      !departure_date ||
      !departure_time ||
      !from_location_id ||
      !to_location_id ||
      !capacity
    ) {
      return res.status(400).json({ message: "Nedostaju obavezni podaci." });
    }

    if (String(from_location_id) === String(to_location_id)) {
      return res
        .status(400)
        .json({ message: "Polazište i odredište ne mogu biti isti." });
    }

    if (Number(capacity) < existing[0].reserved_seats) {
      return res.status(400).json({
        message: `Kapacitet ne može biti manji od broja rezerviranih mjesta (${existing[0].reserved_seats}).`,
      });
    }

    await pool.query(
      `UPDATE line_departures
       SET boat_id = ?, departure_date = ?, departure_time = ?, from_location_id = ?, to_location_id = ?, capacity = ?, status = ?
       WHERE id = ?`,
      [
        boat_id,
        departure_date,
        departure_time,
        from_location_id,
        to_location_id,
        capacity,
        status || existing[0].status,
        id,
      ],
    );

    return res.status(200).json({ message: "Polazak je ažuriran." });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod uređivanja polaska!" });
  }
});

// OBRISI POLAZAK (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM line_departures WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Polazak ne postoji." });
    }

    const [reservations] = await pool.query(
      "SELECT COUNT(*) AS broj FROM line_reservations WHERE line_departure_id = ?",
      [id],
    );

    if (reservations[0].broj > 0) {
      return res.status(400).json({
        message:
          "Polazak ima rezervacije pa se ne može obrisati. Umjesto toga ga otkaži (status: cancelled).",
      });
    }

    await pool.query("DELETE FROM line_departures WHERE id = ?", [id]);

    return res.status(200).json({ message: "Polazak je obrisan." });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod brisanja polaska!" });
  }
});

export default router;
