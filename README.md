# Taxi Boat Helena — backend

Backend (REST API) za web aplikaciju "Taxi Boat Helena".
Izrađen u Node.js / Express, koristi MySQL bazu.

Frontend (Vue.js) je u zasebnom repozitoriju.

## Tehnologije

- Node.js + Express
- MySQL (mysql2)
- JWT autentifikacija (admin)
- Resend (slanje email potvrda)

## 1. Postavljanje baze

U MySQL-u uvest priloženu datoteku `baza.sql` (kreira bazu `taxi_boat_helena_booking`
s tablicama i primjerima podataka):

## 2. Postavljanje okruženja (.env)

U korijenu backend mape napravit datoteku `.env` s ovim varijablama:

```
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tvoja_mysql_lozinka
DB_NAME=taxi_boat_helena_booking

JWT_SECRET=neki_dugacak_nasumican_niz
RESEND_API_KEY=tvoj_resend_api_kljuc

# Adresa frontenda (za link za otkazivanje u emailu)
FRONTEND_URL=http://localhost:5173
```

> `RESEND_API_KEY` je potreban samo za slanje email potvrda; bez njega
> rezervacija i dalje radi, samo se email ne pošalje.

## 4. Kreiranje administratora

Admin se ne seeda u bazu (lozinke su kriptirane), nego se kreira skriptom:

```
node createAdmin.js "Ime Prezime" admin@email.hr lozinka admin
```

Tim podacima (email + lozinka) prijavljuje se u admin dio aplikacije.

## Glavne rute (API)

- `POST /auth/login` — prijava admina (vraća JWT token)
- `GET /line-departures` — popis polazaka (javno)
- `POST /line-reservations` — nova rezervacija (javno)
- `POST /line-reservations/cancel-by-code` — otkazivanje preko koda (javno)
- `GET /line-reservations` — popis rezervacija (samo admin)
- `POST|PUT|DELETE /line-departures` — upravljanje polascima (samo admin)
- `POST /line-departures/generate` — generiranje polazaka (samo admin)
- `GET /locations`, `GET /boats` — pomoćni podaci za admin formu
