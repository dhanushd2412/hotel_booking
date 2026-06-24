# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hotel Vinayagam — a local hotel booking management app for a single hotel in Tamil Nadu, India. Currently used as an internal management tool on one computer (not publicly hosted). Prices are in INR with 12% tax.

## Architecture

**Frontend:** Vanilla HTML/CSS/JS (no build step, no framework). `index.html` is opened directly in the browser. `app.js` manages all UI state and renders DOM imperatively. Falls back to localStorage when the backend is unavailable.

**Backend:** Express.js (ESM modules) on Node 20, running at `localhost:4000`. Single `server.js` file with all routes. `db.js` exports a `pg` Pool wrapper. No ORM — raw parameterized SQL throughout.

**Database:** PostgreSQL 16. Single `bookings` table with UUID primary keys (via `pgcrypto`). Schema lives in `backend/schema.sql` and is auto-applied by Docker on first run.

**Data flow:** Frontend fetches from `/api/*` endpoints. Booking creation checks for date/room overlaps server-side before inserting. The frontend `normalizeBooking()` function maps between camelCase (JS) and snake_case (DB column names).

Room types (standard/deluxe/family) are hardcoded in both `app.js` and `server.js` — they must stay in sync.

## Running the App

### Docker (recommended)
```
cd backend
docker compose up -d
```
Starts PostgreSQL (:5432), Adminer UI (:8080), and the API (:4000). Then open `index.html` in a browser.

Alternatively, double-click `start-app.bat` / `stop-app.bat`.

### Manual
```
cd backend
cp .env.example .env   # set your PostgreSQL password
npm install
npm run dev             # uses --watch for auto-restart
```

## API Routes

```
GET    /api/health
GET    /api/rooms
GET    /api/bookings              # optional ?from=&to= date range filter
POST   /api/bookings
PATCH  /api/bookings/:id/status   # allowed: Confirmed, Checked in, Completed, Cancelled
```

## Key Constraints

- No test suite, no linter, no CI — changes should be verified manually against the running app.
- Backend uses ESM (`"type": "module"` in package.json) — use `import`/`export`, not `require`.
- The frontend has no bundler. All JS is in a single `app.js` loaded via `<script>` tag.
- Booking overlap detection uses a SQL range overlap query (`check_in < $checkOut AND check_out > $checkIn`) excluding cancelled bookings.
