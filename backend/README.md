# Hotel Vinayagam Backend

This backend stores Hotel Vinayagam booking data in PostgreSQL.

## Why PostgreSQL

PostgreSQL is a better choice than MySQL for this project because you said you are planning AI features later. PostgreSQL can support normal booking data now and AI/vector search later using `pgvector`.

## Setup

### Option A: Docker Setup

Docker is the easiest local setup for this project because the database can be started and stopped with commands.

Start PostgreSQL, Adminer, and the backend API:

```bash
docker compose up -d
```

PostgreSQL will run at:

```txt
localhost:5432
```

Adminer database UI will run at:

```txt
http://localhost:8080
```

Backend API will run at:

```txt
http://localhost:4000
```

Adminer login:

```txt
System: PostgreSQL
Server: postgres
Username: postgres
Password: hotelvinayagam123
Database: hotel_vinayagam
```

Stop the local services:

```bash
docker compose down
```

### Option B: Manual PostgreSQL Setup

1. Install PostgreSQL.
2. Create a database named `hotel_vinayagam`.
3. Copy `.env.example` to `.env`.
4. Update the password in `.env`.
5. Run the SQL from `schema.sql` in the `hotel_vinayagam` database.
6. Install dependencies:

```bash
npm install
```

7. Start the backend:

```bash
npm run dev
```

The API will run at:

```txt
http://localhost:4000
```

## API Routes

```txt
GET    /api/health
GET    /api/rooms
GET    /api/bookings
GET    /api/bookings?from=2025-06-19&to=2027-06-19
POST   /api/bookings
PATCH  /api/bookings/:id/status
```

## Future AI Ideas

- Ask AI to summarize bookings by date.
- Ask AI to predict busy days.
- Add chatbot booking assistance.
- Use PostgreSQL with `pgvector` for hotel FAQ search.
