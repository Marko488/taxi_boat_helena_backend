const buildReservationEmail = ({
  reservationCode,
  departure,
  routeText,
  seatsCount,
  adults,
  children,
  totalPrice,
}) => {
  const ruta =
    departure?.from_location && departure?.to_location
      ? `${departure.from_location} → ${departure.to_location}`
      : "Ruta nije dostupna";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 24px;">

      <!-- HEADER -->
      <div style="background: linear-gradient(90deg, #0369a1, #0ea5e9); border-radius: 16px; padding: 24px; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Potvrda rezervacije</h1>
        <p style="margin: 8px 0 0 0;">Vaša rezervacija za taxi line je uspješno zaprimljena.</p>
      </div>

      <!-- DETALJI -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-top: 20px;">
        <h2 style="margin-top: 0; font-size: 20px;">Detalji rezervacije</h2>

        <div style="margin-top: 12px;">
          <p><strong>Kod rezervacije:</strong> ${reservationCode}</p>
<p><strong>Datum:</strong> ${String(departure.departure_date).split("00")[0]}</p>          <p><strong>Vrijeme:</strong> ${departure?.departure_time || "-"}</p>
          <p><strong>Ruta:</strong> ${routeText}</p>
        </div>

        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <p><strong>Ukupno mjesta:</strong> ${seatsCount}</p>
          <p><strong>Odrasli:</strong> ${adults}</p>
          <p><strong>Djeca:</strong> ${children}</p>
          <p><strong>Ukupna cijena:</strong> ${totalPrice} €</p>
        </div>
      </div>

      <!-- NAPOMENA -->
      <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 16px; padding: 16px; margin-top: 20px;">
        <p style="margin: 0; font-size: 14px;">
          💡 <strong>Napomena:</strong> Plaćanje se vrši gotovinom prilikom dolaska na polazak.
        </p>
      </div>

      <!-- FOOTER -->
      <p style="margin-top: 24px; font-size: 14px; color: #475569;">
        Hvala vam na rezervaciji i vidimo se na polasku.
      </p>

    </div>
  `;
};

export default buildReservationEmail;
