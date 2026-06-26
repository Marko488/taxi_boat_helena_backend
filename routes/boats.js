import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, boat_type, capacity, is_active FROM boats ORDER BY name ASC",
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod dohvaćanja barki!" });
  }
});

export default router;
