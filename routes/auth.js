import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email i lozinka su obavezni." });
    }

    const [rows] = await pool.query(
      "SELECT * FROM admins WHERE email = ?",
      [email],
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Neispravan email ili lozinka." });
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      return res
        .status(401)
        .json({ message: "Neispravan email ili lozinka." });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    return res.status(200).json({
      message: "Uspješna prijava.",
      token,
      admin: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("GRESKA:", error.message);
    return res.status(500).json({ message: "Greška na poslužitelju." });
  }
});

export default router;
