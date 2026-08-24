import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
});

// Vremena polazaka zapisana su kao lokalno vrijeme, a poslužitelj baze u oblaku
// najčešće radi u UTC-u. Bez ovoga NOW() kasni dva sata, pa bi se polasci koji
// su već otišli i dalje nudili za rezervaciju.
const VREMENSKA_ZONA = process.env.DB_TIMEZONE || "+02:00";

pool.on("connection", (veza) => {
  veza.query(`SET time_zone = '${VREMENSKA_ZONA}'`, (greska) => {
    if (greska) {
      console.error(
        "Nije uspjelo postavljanje vremenske zone baze:",
        greska.message,
      );
    }
  });
});
