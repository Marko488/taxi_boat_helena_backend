import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

// Pokretanje:
//   node createAdmin.js "<ime i prezime>" <email> <lozinka> [role]
// Primjer:
//   node createAdmin.js "Marko D" marko@helena.hr Pantera1#@ admin
const fullName = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const role = process.argv[5] || "admin";

const run = async () => {
  if (!fullName || !email || !password) {
    console.log(
      'Upotreba: node createAdmin.js "<ime i prezime>" <email> <lozinka> [role]',
    );
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [fullName, email, hash, role],
    );
    console.log(`Korisnik '${email}' (${role}) uspješno kreiran.`);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.error(`Korisnik s emailom '${email}' već postoji.`);
    } else {
      console.error("Greška:", error.message);
    }
  } finally {
    await pool.end();
  }
};

run();
