-- =========================================================
-- Taxi Boat Helena — baza podataka (schema + početni podaci)
-- Pokretanje: uvezi ovu datoteku u MySQL (npr. preko MySQL Workbencha
-- ili naredbom:  mysql -u root -p < baza.sql)
-- Napomena: skripta briše i ponovno kreira bazu taxi_boat_helena_booking.
-- =========================================================

DROP DATABASE IF EXISTS taxi_boat_helena_booking;

CREATE DATABASE taxi_boat_helena_booking
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE taxi_boat_helena_booking;

-- =========================================================
-- 1. USERS
-- =========================================================
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================================================
-- 2. ADMINS
-- Administratori se NE seedaju ovdje (lozinke moraju biti kriptirane).
-- Admina kreiraj skriptom:  node createAdmin.js "Ime Prezime" email lozinka admin
-- =========================================================
CREATE TABLE admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'operator') NOT NULL DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================================================
-- 3. LOCATIONS
-- =========================================================
CREATE TABLE locations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type ENUM('city', 'camp', 'tour_destination', 'other') NOT NULL DEFAULT 'other',
    description TEXT NULL
);

-- =========================================================
-- 4. BOATS
-- =========================================================
CREATE TABLE boats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    boat_type ENUM('taxi_boat', 'speedboat') NOT NULL,
    capacity INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_boats_capacity CHECK (capacity > 0)
);

-- =========================================================
-- 5. LINE DEPARTURES (večernja linija)
-- =========================================================
CREATE TABLE line_departures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    boat_id BIGINT UNSIGNED NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    from_location_id BIGINT UNSIGNED NOT NULL,
    to_location_id BIGINT UNSIGNED NOT NULL,
    capacity INT UNSIGNED NOT NULL,
    reserved_seats INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('scheduled', 'full', 'cancelled') NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_line_departures_boat
        FOREIGN KEY (boat_id) REFERENCES boats(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_line_departures_from_location
        FOREIGN KEY (from_location_id) REFERENCES locations(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_line_departures_to_location
        FOREIGN KEY (to_location_id) REFERENCES locations(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT chk_line_departures_capacity CHECK (capacity > 0),
    CONSTRAINT chk_line_departures_reserved_seats CHECK (reserved_seats <= capacity)
);

ALTER TABLE line_departures
ADD CONSTRAINT uq_line_departure_boat_datetime
UNIQUE (boat_id, departure_date, departure_time);

-- =========================================================
-- 6. LINE RESERVATIONS (rezervacije za liniju)
-- =========================================================
CREATE TABLE line_reservations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    line_departure_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    adults_count INT UNSIGNED NOT NULL DEFAULT 1,
    children_count INT UNSIGNED NOT NULL DEFAULT 0,
    seats_count INT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('active', 'cancelled', 'completed') NOT NULL DEFAULT 'active',
    reservation_code VARCHAR(50) NOT NULL UNIQUE,
    guest_name VARCHAR(120) NULL,
    guest_email VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_line_reservations_departure
        FOREIGN KEY (line_departure_id) REFERENCES line_departures(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_line_reservations_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT chk_line_reservations_seats CHECK (seats_count > 0)
);

-- =========================================================
-- 7. TOURS (izleti — model pripremljen za buduće proširenje)
-- =========================================================
CREATE TABLE tours (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT NULL,
    default_from_location_id BIGINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tours_default_from_location
        FOREIGN KEY (default_from_location_id) REFERENCES locations(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =========================================================
-- 8. TOUR DEPARTURES
-- =========================================================
CREATE TABLE tour_departures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tour_id BIGINT UNSIGNED NOT NULL,
    boat_id BIGINT UNSIGNED NOT NULL,
    departure_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    from_location_id BIGINT UNSIGNED NOT NULL,
    capacity INT UNSIGNED NOT NULL,
    reserved_seats INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('scheduled', 'full', 'finished', 'cancelled') NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tour_departures_tour
        FOREIGN KEY (tour_id) REFERENCES tours(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_tour_departures_boat
        FOREIGN KEY (boat_id) REFERENCES boats(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_tour_departures_from_location
        FOREIGN KEY (from_location_id) REFERENCES locations(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT chk_tour_departures_capacity CHECK (capacity > 0),
    CONSTRAINT chk_tour_departures_reserved_seats CHECK (reserved_seats <= capacity),
    CONSTRAINT chk_tour_departures_time_range CHECK (start_time < end_time)
);

-- =========================================================
-- 9. TOUR RESERVATIONS
-- =========================================================
CREATE TABLE tour_reservations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tour_departure_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    seats_count INT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('active', 'cancelled', 'completed') NOT NULL DEFAULT 'active',
    reservation_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tour_reservations_departure
        FOREIGN KEY (tour_departure_id) REFERENCES tour_departures(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_tour_reservations_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT chk_tour_reservations_seats CHECK (seats_count > 0)
);

-- =========================================================
-- SEED: LOCATIONS
-- =========================================================
INSERT INTO locations (name, type, description) VALUES
('Cres', 'city', 'Grad Cres - glavna polazna lokacija'),
('Kamp Kovačine', 'camp', 'Kamp Kovačine - druga lokacija taxi boat linije'),
('Valun', 'tour_destination', 'Turistička destinacija Valun'),
('Lubenice', 'tour_destination', 'Turistička destinacija Lubenice'),
('Plava grota', 'tour_destination', 'Turistička destinacija Plava grota');

-- =========================================================
-- SEED: BOATS
-- =========================================================
INSERT INTO boats (name, boat_type, capacity, is_active, notes) VALUES
('Taxi Boat Helena 1', 'taxi_boat', 20, TRUE, 'Prva taxi barka za večernju liniju'),
('Taxi Boat Helena 2', 'taxi_boat', 20, TRUE, 'Druga taxi barka za večernju liniju'),
('Gliser Helena', 'speedboat', 8, TRUE, 'Gliser za dnevne turističke izlete');

-- =========================================================
-- SEED: USERS
-- =========================================================
INSERT INTO users (full_name, email, phone, password_hash) VALUES
('Marko Horvat', 'marko@example.com', '+385911111111', NULL),
('Ana Marić', 'ana@example.com', '+385922222222', NULL),
('Ivana Novak', 'ivana@example.com', '+385933333333', NULL);

-- =========================================================
-- SEED: TOURS
-- =========================================================
INSERT INTO tours (name, description, default_from_location_id, is_active)
VALUES
(
    'Lubenice i Plava grota',
    'Turistički izlet gliserom s polaskom iz Cresa, uključuje posjet Lubenicama i Plavoj groti.',
    (SELECT id FROM locations WHERE name = 'Cres'),
    TRUE
),
(
    'Valun',
    'Turistički izlet gliserom s polaskom iz Cresa i posjetom Valunu.',
    (SELECT id FROM locations WHERE name = 'Cres'),
    TRUE
);

-- =========================================================
-- SEED: TOUR DEPARTURES
-- =========================================================
INSERT INTO tour_departures (
    tour_id, boat_id, departure_date, start_time, end_time,
    from_location_id, capacity, reserved_seats, status
)
VALUES
(
    (SELECT id FROM tours WHERE name = 'Lubenice i Plava grota'),
    (SELECT id FROM boats WHERE name = 'Gliser Helena'),
    DATE_ADD(CURDATE(), INTERVAL 1 DAY), '09:00:00', '13:00:00',
    (SELECT id FROM locations WHERE name = 'Cres'), 8, 0, 'scheduled'
),
(
    (SELECT id FROM tours WHERE name = 'Lubenice i Plava grota'),
    (SELECT id FROM boats WHERE name = 'Gliser Helena'),
    DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:00:00', '19:00:00',
    (SELECT id FROM locations WHERE name = 'Cres'), 8, 0, 'scheduled'
),
(
    (SELECT id FROM tours WHERE name = 'Valun'),
    (SELECT id FROM boats WHERE name = 'Gliser Helena'),
    DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:00:00', '13:00:00',
    (SELECT id FROM locations WHERE name = 'Cres'), 8, 0, 'scheduled'
);

-- =========================================================
-- SEED: LINE DEPARTURES
-- Generira polaske od danas do idućih 5 dana,
-- svakih 10 minuta od 18:00 do 00:00 (smjer se izmjenjuje).
-- =========================================================
INSERT INTO line_departures (
    boat_id, departure_date, departure_time,
    from_location_id, to_location_id, capacity, reserved_seats, status
)
WITH RECURSIVE
dates AS (
    SELECT CURDATE() AS departure_date
    UNION ALL
    SELECT DATE_ADD(departure_date, INTERVAL 1 DAY)
    FROM dates
    WHERE departure_date < DATE_ADD(CURDATE(), INTERVAL 5 DAY)
),
slots AS (
    SELECT 0 AS slot_index, TIME('18:00:00') AS departure_time
    UNION ALL
    SELECT slot_index + 1, ADDTIME(TIME('18:00:00'), SEC_TO_TIME((slot_index + 1) * 600))
    FROM slots
    WHERE slot_index < 36
)
SELECT
    CASE
        WHEN MOD(s.slot_index, 2) = 0 THEN (SELECT id FROM boats WHERE name = 'Taxi Boat Helena 1')
        ELSE (SELECT id FROM boats WHERE name = 'Taxi Boat Helena 2')
    END AS boat_id,
    d.departure_date,
    s.departure_time,
    CASE
        WHEN MOD(s.slot_index, 2) = 0 THEN (SELECT id FROM locations WHERE name = 'Cres')
        ELSE (SELECT id FROM locations WHERE name = 'Kamp Kovačine')
    END AS from_location_id,
    CASE
        WHEN MOD(s.slot_index, 2) = 0 THEN (SELECT id FROM locations WHERE name = 'Kamp Kovačine')
        ELSE (SELECT id FROM locations WHERE name = 'Cres')
    END AS to_location_id,
    20 AS capacity,
    0 AS reserved_seats,
    'scheduled' AS status
FROM dates d
CROSS JOIN slots s
ORDER BY d.departure_date, s.departure_time;

-- =========================================================
-- SEED: TESTNE LINE RESERVATIONS
-- =========================================================
INSERT INTO line_reservations (
    line_departure_id, user_id, adults_count, children_count,
    seats_count, status, reservation_code, guest_name, guest_email
)
VALUES
(
    (SELECT id FROM line_departures
       WHERE departure_date = CURDATE() AND departure_time = '18:00:00' LIMIT 1),
    1, 2, 0, 2, 'active', 'LB-TEST-0001', 'Marko Horvat', 'marko@example.com'
),
(
    (SELECT id FROM line_departures
       WHERE departure_date = CURDATE() AND departure_time = '18:10:00' LIMIT 1),
    2, 1, 0, 1, 'active', 'LB-TEST-0002', 'Ana Marić', 'ana@example.com'
),
(
    (SELECT id FROM line_departures
       WHERE departure_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND departure_time = '19:00:00' LIMIT 1),
    3, 2, 1, 3, 'active', 'LB-TEST-0003', 'Ivana Novak', 'ivana@example.com'
);

-- =========================================================
-- SEED: TESTNE TOUR RESERVATIONS
-- =========================================================
INSERT INTO tour_reservations (
    tour_departure_id, user_id, seats_count, status, reservation_code
)
VALUES
(1, 1, 2, 'active', 'TR-TEST-0001'),
(3, 3, 1, 'active', 'TR-TEST-0002');

-- =========================================================
-- Uskladi reserved_seats s upisanim aktivnim rezervacijama
-- =========================================================
UPDATE line_departures
SET reserved_seats = (
    SELECT COALESCE(SUM(lr.seats_count), 0)
    FROM line_reservations lr
    WHERE lr.line_departure_id = line_departures.id
      AND lr.status = 'active'
);

UPDATE tour_departures
SET reserved_seats = (
    SELECT COALESCE(SUM(tr.seats_count), 0)
    FROM tour_reservations tr
    WHERE tr.tour_departure_id = tour_departures.id
      AND tr.status = 'active'
);
