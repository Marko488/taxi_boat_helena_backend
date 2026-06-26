import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, type FROM locations ORDER BY name ASC",
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška kod dohvaćanja lokacija!" });
  }
});

export default router;
