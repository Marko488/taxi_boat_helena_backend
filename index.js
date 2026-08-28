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

// CORS: dopusteni su samo klijentski origini navedeni u varijabli okruzenja
// FRONTEND_URL (moze ih biti vise, odvojeni zarezom) te lokalne razvojne adrese.
function uOrigin(vrijednost) {
  try {
    return new URL(vrijednost).origin; // odbacuje putanju i zavrsnu kosu crtu
  } catch {
    return null;
  }
}

const dopusteniOrigini = [
  ...(process.env.FRONTEND_URL || "").split(",").map((o) => uOrigin(o.trim())),
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
].filter(Boolean);

console.log("CORS dopusta origine:", dopusteniOrigini.join(", "));
if (!dopusteniOrigini.some((o) => !o.includes("localhost") && !o.includes("127.0.0.1"))) {
  console.warn(
    "UPOZORENJE: FRONTEND_URL nije postavljen na javnu adresu klijenta. " +
      "U produkciji ce preglednik blokirati pozive prema API-ju, a poveznica za " +
      "otkazivanje u potvrdnoj e-poruci vodit ce na localhost.",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // zahtjevi bez Origin zaglavlja (Postman, curl, provjere stanja) prolaze
      if (!origin) return callback(null, true);
      callback(null, dopusteniOrigini.includes(origin));
    },
  }),
);
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
