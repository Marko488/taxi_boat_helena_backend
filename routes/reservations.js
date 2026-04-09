import express from "express";
import { pool } from "../db.js";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { line_departure_id, user_id, seats_count } = req.body;

    const [departures] = await pool.query(
      `SELECT * FROM line_departures WHERE id=?`,
      [line_departure_id],
    );
    if (departures.length == 0) {
      return res
        .status(404)
        .json({ message: `Ne postoji polazak sa ID-em ${line_departure_id}!` });
    }
    let departure = departures[0];

    let availableSeats = departure.capacity - departure.reserved_seats;
    if (availableSeats < seats_count) {
      return res.status(400).json({
        message: `Rezervirali biste ${seats_count}, a najviše se trenutno može ${availableSeats} za taj polazak!`,
      });
    }

    if (departure.status !== "scheduled") {
      return res
        .status(400)
        .json({ message: "Nije moguce rezervitati taj polazak!" });
    }

    const reservationCode = "RES_" + Date.now();

    await pool.query(
      `INSERT INTO line_reservations 
   (line_departure_id, user_id, seats_count, status, reservation_code)
   VALUES (?, ?, ?, 'active', ?)`,
      [line_departure_id, user_id, seats_count, reservationCode],
    );

    await pool.query(
      `UPDATE line_departures SET reserved_seats=reserved_seats+? WHERE id=?`,
      [seats_count, line_departure_id],
    );
    return res.status(201).json({
      message: `Uspjesno ste rezervirali ${seats_count} mjesta za polazak ${line_departure_id}!`,
      reservationCode,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Greska u radu sa bazom podataka!" });
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

export default router;
