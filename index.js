import dotenv from "dotenv";
dotenv.config();
import cors from "cors";

import express from "express";
import { pool } from "./db.js";
import departuresRouter from "./routes/departures.js";
import reservationsRouter from "./routes/reservations.js";
const app = express();
app.use(express.json());
app.use(cors());
app.use("/line-departures", departuresRouter);
app.use("/line-reservations", reservationsRouter);

app.get("/test-db", async (req, res) => {
  try {
    let [rows] = await pool.query("SELECT 1");
    res.status(200).json({ message: "Baza radi", rows });
  } catch (error) {
    console.error("Greska u spajanju na bazi!", error.message);
    res.status(500).json({ message: "Greska u spajanju na bazi!" });
  }
});

app.listen(process.env.PORT, (error) => {
  if (error) {
    console.error("Greska u pokretanjuu posluzitelja!");
  } else {
    console.log(
      `Posluzitelj uspjesno pokrenut i slusa dolazne zahtjeve na adresi http://localhost:${process.env.PORT}`,
    );
  }
});
