import express from "express";

const app = express();

const PORT = 3000;

app.listen(PORT, (error) => {
  if (error) {
    console.error("Greska u pokretanjuu posluzitelja!");
  } else {
    console.log(
      `Posluzitelj uspjesno pokrenut i slusa dolazne zahtjeve na adresi http://localhost:${PORT}`,
    );
  }
});
