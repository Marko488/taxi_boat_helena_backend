import express from "express";
import { pool } from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { date, from } = req.query;

    console.log(req.query.date);

    let sql = `
      SELECT 
        ld.id,
DATE_FORMAT(ld.departure_date, '%Y-%m-%d') AS departure_date,
        ld.departure_time,
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

    let conditions = [];
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

export default router;
