# Hotel Vinayagam App Maintenance Guide

This app has two parts:

1. Frontend: `index.html`, `styles.css`, `app.js`
2. Backend: `backend/server.js` with PostgreSQL database

The frontend is what management sees in the browser. The backend is the service that stores booking data permanently in PostgreSQL.

## Recommended Local Setup

Use this setup while management maintains bookings from one computer:

- PostgreSQL stores booking data.
- Backend runs at `http://localhost:4000`.
- Frontend opens from `index.html`.
- The computer should be kept backed up because the booking database lives locally.

## Install PostgreSQL On Windows

1. Download PostgreSQL for Windows from the official site:
   `https://www.postgresql.org/download/windows/`
2. During installation, remember the password you set for the `postgres` user.
3. Keep the default port as `5432`.
4. Install pgAdmin when the installer asks.

## Create The Database

Open pgAdmin and create a database:

```txt
hotel_vinayagam
```

Then open the Query Tool for that database and run:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL CHECK (guests > 0),
  room_id text NOT NULL,
  room_name text NOT NULL,
  rooms integer NOT NULL CHECK (rooms > 0),
  nights integer NOT NULL CHECK (nights > 0),
  subtotal numeric(10, 2) NOT NULL,
  tax numeric(10, 2) NOT NULL,
  total numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'Confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_date_room_idx
  ON bookings (room_id, check_in, check_out);
```

The same SQL is also saved in:

```txt
backend/schema.sql
```

## Connect Backend To Database

In the `backend` folder, copy `.env.example` and rename the copy to `.env`.

Edit `.env`:

```txt
PORT=4000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/hotel_vinayagam
```

Replace `YOUR_PASSWORD` with the PostgreSQL password you created during installation.

## Install Backend Packages

Open PowerShell in:

```txt
C:\Users\dhanu\OneDrive\Documents\hotel-booking-app\backend
```

Run:

```bash
npm install
```

This downloads the backend packages listed in `package.json`.

## Start The Application

Simple way:

Double-click:

```txt
start-app.bat
```

This starts PostgreSQL, starts the backend API, and opens the booking page.

Manual way:

Start the database and backend API:

```bash
docker compose up -d
```

This starts:

```txt
PostgreSQL database: localhost:5432
Backend API: http://localhost:4000
Adminer DB UI: http://localhost:8080
```

Then open the frontend:

```txt
C:\Users\dhanu\OneDrive\Documents\hotel-booking-app\index.html
```

## Stop The Application

Simple way:

Double-click:

```txt
stop-app.bat
```

Manual way:

To stop the database and backend:

```bash
docker compose down
```

The frontend does not need stopping because it is just an HTML page in the browser.

## Test Backend Connection

Open this in the browser:

```txt
http://localhost:4000/api/health
```

Expected result:

```json
{"ok":true,"service":"Hotel Vinayagam API"}
```

## Booking Data

Bookings are saved in the PostgreSQL `bookings` table.

The app can ask for all bookings:

```txt
http://localhost:4000/api/bookings
```

The backend also supports date range filtering for a management calendar:

```txt
http://localhost:4000/api/bookings?from=2025-06-19&to=2027-06-19
```

That range means one year past and one year future from June 19, 2026.

## One-Year Booking Calendar Plan

For management, the next screen should be an admin calendar that shows:

- Past one year bookings
- Future one year bookings
- Room type
- Guest name and phone
- Booking status
- Check-in and check-out
- Total amount

The backend is now ready for that calendar because `/api/bookings` accepts `from` and `to` dates.

## Backup Advice

Because this is on a local computer, back up the PostgreSQL database regularly.

Simple manual backup idea:

1. Open pgAdmin.
2. Right-click `hotel_vinayagam`.
3. Choose Backup.
4. Save the backup file to an external drive or cloud folder.

For real hotel use, do a backup at least once per week.

## Later When Sharing With Customers

Before sharing publicly, add:

- Admin login
- Customer booking page
- Online hosting
- Online PostgreSQL database
- Payment gateway if needed
- HTTPS domain
- Daily automated backups

Until then, treat this as a local management application.
