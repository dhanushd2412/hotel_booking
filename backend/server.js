import crypto from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { query } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "hotel123";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const activeSessions = new Map();

const roomTypes = [
  {
    id: "mini-standard",
    name: "Mini Standard",
    price: 1500,
    capacity: 1
  },
  {
    id: "standard",
    name: "Standard Room",
    price: 2200,
    capacity: 2
  },
  {
    id: "deluxe",
    name: "Deluxe Room",
    price: 3200,
    capacity: 3
  },
  {
    id: "family",
    name: "Family Room",
    price: 4600,
    capacity: 4
  }
];

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Hotel Vinayagam API" });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = crypto.randomUUID();
    activeSessions.set(token, { createdAt: Date.now() });
    return res.json({ token });
  }

  res.status(401).json({ message: "Invalid username or password." });
});

app.get("/api/admin/verify", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const session = activeSessions.get(token);

  if (!session || Date.now() - session.createdAt > TOKEN_TTL_MS) {
    if (session) activeSessions.delete(token);
    return res.status(401).json({ valid: false });
  }

  res.json({ valid: true });
});

app.post("/api/admin/logout", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  activeSessions.delete(token);
  res.json({ ok: true });
});

app.delete("/api/admin/bookings", async (req, res, next) => {
  try {
    await query("DELETE FROM bookings");
    res.json({ ok: true, message: "All bookings deleted." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rooms", (req, res) => {
  res.json(roomTypes);
});

app.get("/api/bookings", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const where = [];

    if (from) {
      params.push(from);
      where.push(`check_out >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      where.push(`check_in <= $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT id, guest_name, guest_phone, check_in, check_out, guests,
              room_id, room_name, rooms, nights, subtotal, tax, total,
              status, group_id, created_at
       FROM bookings
       ${whereSql}
       ORDER BY check_in DESC, created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings/booked-dates", async (req, res, next) => {
  try {
    const { roomId, from, to } = req.query;

    if (!roomId || !from || !to) {
      return res.status(400).json({ message: "roomId, from, and to are required." });
    }

    const result = await query(
      `SELECT check_in, check_out
       FROM bookings
       WHERE room_id = $1
         AND status != 'Cancelled'
         AND check_in < $3
         AND check_out > $2
       ORDER BY check_in`,
      [roomId, from, to]
    );

    const ranges = result.rows.map(row => ({
      checkIn: row.check_in.toISOString().slice(0, 10),
      checkOut: row.check_out.toISOString().slice(0, 10)
    }));

    res.json(ranges);
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", async (req, res, next) => {
  try {
    const booking = validateBooking(req.body);
    const overlap = await hasOverlappingBooking(booking.roomId, booking.checkIn, booking.checkOut);

    if (overlap) {
      return res.status(409).json({
        message: "Sorry, this room is already booked for the selected dates. Please choose different dates or another room type."
      });
    }

    const result = await query(
      `INSERT INTO bookings (
        guest_name, guest_phone, check_in, check_out, guests,
        room_id, room_name, rooms, nights, subtotal, tax, total, status, group_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Confirmed', $13)
      RETURNING *`,
      [
        booking.name,
        booking.phone,
        booking.checkIn,
        booking.checkOut,
        booking.guests,
        booking.roomId,
        booking.roomName,
        booking.rooms,
        booking.nights,
        booking.subtotal,
        booking.tax,
        booking.total,
        booking.groupId || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/bookings/:id/status", async (req, res, next) => {
  try {
    const allowedStatuses = ["Confirmed", "Checked in", "Completed", "Cancelled"];
    const status = String(req.body.status || "");

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid booking status." });
    }

    const result = await query(
      "UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.message || "Something went wrong."
  });
});

app.listen(port, () => {
  console.log(`Hotel Vinayagam API running on http://localhost:${port}`);
});

function validateBooking(body) {
  const required = ["name", "phone", "checkIn", "checkOut", "roomId", "roomName"];
  const missing = required.filter((key) => !body[key]);

  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const checkIn = new Date(body.checkIn);
  const checkOut = new Date(body.checkOut);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    const error = new Error("Check-out date must be after check-in date.");
    error.status = 400;
    throw error;
  }

  return {
    name: String(body.name).trim(),
    phone: String(body.phone).trim(),
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    guests: Number(body.guests || 1),
    roomId: String(body.roomId),
    roomName: String(body.roomName),
    rooms: Number(body.rooms || 1),
    nights: Number(body.nights || 1),
    subtotal: Number(body.subtotal || 0),
    tax: Number(body.tax || 0),
    total: Number(body.total || 0),
    groupId: body.groupId || null
  };
}

async function hasOverlappingBooking(roomId, checkIn, checkOut) {
  const result = await query(
    `SELECT id
     FROM bookings
     WHERE room_id = $1
       AND status != 'Cancelled'
       AND check_in < $3
       AND check_out > $2
     LIMIT 1`,
    [roomId, checkIn, checkOut]
  );

  return result.rowCount > 0;
}
