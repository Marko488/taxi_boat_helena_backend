import dotenv from "dotenv";
dotenv.config();
import cors from "cors";

import express from "express";
import departuresRouter from "./routes/departures.js";
import reservationsRouter from "./routes/reservations.js";
import authRouter from "./routes/auth.js";
import locationsRouter from "./routes/locations.js";
import boatsRouter from "./routes/boats.js";
const app = express();
app.use(express.json());
app.use(cors());
app.use("/auth", authRouter);
app.use("/line-departures", departuresRouter);
app.use("/line-reservations", reservationsRouter);
app.use("/locations", locationsRouter);
app.use("/boats", boatsRouter);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `Posluzitelj uspjesno pokrenut i slusa dolazne zahtjeve na adresi http://localhost:${PORT}`,
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} je već zauzet — backend vjerojatno već radi u drugom terminalu. Zatvori taj prozor ili oslobodi port pa pokreni ponovno.`,
    );
  } else {
    console.error("Greska u pokretanju posluzitelja:", error.message);
  }
});
