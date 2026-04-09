import express from "express";
import { pool } from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [podaci_iz_baze] = await pool.query(`SELECT 
  ld.id,
  ld.departure_date,
  ld.departure_time,
  fl.name AS from_location,
  tl.name AS to_location,
  b.name AS boat,
  ld.capacity,
  ld.reserved_seats,
  (ld.capacity - ld.reserved_seats) AS available_seats
FROM line_departures ld
JOIN locations fl ON ld.from_location_id = fl.id
JOIN locations tl ON ld.to_location_id = tl.id
JOIN boats b ON ld.boat_id = b.id
ORDER BY ld.departure_time ASC`);
    res.status(200).json(podaci_iz_baze);
  } catch (error) {
    console.log("Greska u dohvatu podataka sa baze:", error.message);
    res.status(500).json({ message: "Greska u dohvatu podataka sa baze!" });
  }
});

export default router;
