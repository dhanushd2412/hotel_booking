import json
import os
from datetime import date

import psycopg2
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "dbname": os.environ.get("DB_NAME", "hotel_vinayagam"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "hotelvinayagam123"),
}

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

NEARBY_ATTRACTIONS = [
    {"name": "Perumal Temple", "distance": "2 km"},
    {"name": "Turaiyur Market", "distance": "1 km"},
    {"name": "Bus Stand", "distance": "0.5 km"},
]

HOTEL_INFO = """
Hotel Name: Hotel Vinayagam
Location: Main Road, Turaiyur, Tamil Nadu, India
Phone: +91 90470 55262
Check-in: 12:00 PM | Check-out: 11:00 AM
Rating: 4.6 stars

Room Types:
- Mini Standard: Max 1 adult, Rs.1,500/night, 2 rooms available
- Standard Room: Max 2 adults, Rs.2,200/night, 5 rooms available
- Deluxe Room: Max 3 adults, Rs.3,200/night, 2 rooms available
- Family Room: Max 4 adults, Rs.4,600/night, 2 rooms available

All prices are subject to 12% tax.

Amenities: Complimentary Breakfast, Air Conditioning, Free Wi-Fi, Free Parking, Room Service
"""


def fetch_room_data(check_in=None, check_out=None):
    rooms = [
        {"id": "mini-standard", "name": "Mini Standard", "price": 1500, "capacity": 1, "total": 2},
        {"id": "standard", "name": "Standard Room", "price": 2200, "capacity": 2, "total": 5},
        {"id": "deluxe", "name": "Deluxe Room", "price": 3200, "capacity": 3, "total": 2},
        {"id": "family", "name": "Family Room", "price": 4600, "capacity": 4, "total": 2},
    ]

    if not check_in or not check_out:
        return "\n".join(
            f"- {r['name']}: Rs.{r['price']:,}/night, {r['total']} rooms total"
            for r in rooms
        )

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        lines = []
        for r in rooms:
            cur.execute(
                """SELECT COUNT(*) FROM bookings
                   WHERE room_id = %s AND status != 'Cancelled'
                     AND check_in < %s AND check_out > %s""",
                (r["id"], check_out, check_in),
            )
            booked = cur.fetchone()[0]
            available = r["total"] - booked
            lines.append(
                f"- {r['name']}: Rs.{r['price']:,}/night, "
                f"{available}/{r['total']} rooms available for {check_in} to {check_out}"
            )
        cur.close()
        conn.close()
        return "\n".join(lines)
    except Exception:
        return "\n".join(
            f"- {r['name']}: Rs.{r['price']:,}/night, {r['total']} rooms total (live availability unavailable)"
            for r in rooms
        )


def fetch_weather():
    try:
        resp = requests.get("https://wttr.in/Turaiyur?format=j1", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            current = data.get("current_condition", [{}])[0]
            temp = current.get("temp_C", "?")
            desc = current.get("weatherDesc", [{}])[0].get("value", "")
            humidity = current.get("humidity", "?")
            return f"Current weather in Turaiyur: {temp}°C, {desc}, Humidity {humidity}%"
    except Exception:
        pass
    return "Weather information is currently unavailable."


def fetch_weather_for_date(date_str):
    try:
        resp = requests.get("https://wttr.in/Turaiyur?format=j1", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            for day in data.get("weather", []):
                if day.get("date") == date_str:
                    avg_temp = day.get("avgtempC", "?")
                    hourly = day.get("hourly", [])
                    noon = hourly[4] if len(hourly) > 4 else (hourly[0] if hourly else {})
                    desc = noon.get("weatherDesc", [{}])[0].get("value", "pleasant")
                    humidity = noon.get("humidity", "?")
                    return f"Expected weather in Turaiyur on {date_str}: around {avg_temp}°C, {desc}, Humidity ~{humidity}%"
            current = data.get("current_condition", [{}])[0]
            temp = current.get("temp_C", "?")
            desc = current.get("weatherDesc", [{}])[0].get("value", "")
            humidity = current.get("humidity", "?")
            return f"Current weather in Turaiyur: {temp}°C, {desc}, Humidity {humidity}%"
    except Exception:
        pass
    return "Weather information is currently unavailable."


def generate_booking_summary(guest_name, room_type, check_in, check_out, guests, total, nights):
    weather = fetch_weather_for_date(check_in)
    attractions = "\n".join(
        f"- {a['name']}: {a['distance']} from hotel" for a in NEARBY_ATTRACTIONS
    )
    night_label = "night" if nights == 1 else "nights"
    prompt = f"""You are a warm and professional booking assistant for Hotel Vinayagam in Turaiyur, Tamil Nadu.
Write a friendly booking confirmation message for the following booking.

Booking Details:
- Guest Name: {guest_name}
- Room Type: {room_type}
- Check-in: {check_in} (12:00 PM)
- Check-out: {check_out} (11:00 AM)
- Number of Guests: {guests}
- Duration: {nights} {night_label}
- Total Amount: Rs. {total:,.0f} (including 12% tax)

{weather}

Nearby Attractions:
{attractions}

Hotel: Hotel Vinayagam, Main Road, Turaiyur, Tamil Nadu
Phone: +91 90470 55262

Write a warm, personal confirmation message of 3-4 sentences. Address the guest by name, confirm the key booking details, briefly mention the weather, and suggest one nearby attraction. End with a warm welcome."""
    return call_ollama(prompt)


def build_prompt(guest_message, room_data, weather):
    return f"""You are the friendly and helpful virtual assistant for Hotel Vinayagam, a hotel in Turaiyur, Tamil Nadu, India. Answer the guest's question using only the hotel information provided below. Be concise, warm, and professional. If you don't know something, say so politely and suggest they call the hotel.

{HOTEL_INFO}

Current Room Availability:
{room_data}

{weather}

Guest's question: {guest_message}

Reply in 2-3 sentences maximum. Be helpful and direct."""


def call_ollama(prompt):
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=60,
        )
        if resp.status_code == 200:
            return resp.json().get("response", "").strip()
        return None
    except Exception:
        return None


@app.route("/chat", methods=["POST"])
def chat():
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    check_in = body.get("checkIn")
    check_out = body.get("checkOut")

    if not message:
        return jsonify({"error": "Message is required."}), 400

    room_data = fetch_room_data(check_in, check_out)
    weather = fetch_weather()
    prompt = build_prompt(message, room_data, weather)

    reply = call_ollama(prompt)
    if reply is None:
        return jsonify({
            "error": "AI service is not available. Please make sure Ollama is running with llama3.2 model."
        }), 503

    return jsonify({"reply": reply})


@app.route("/booking-summary", methods=["POST"])
def booking_summary():
    body = request.get_json(silent=True) or {}
    required = ["guestName", "roomType", "checkIn", "checkOut", "guests", "total", "nights"]
    missing = [k for k in required if body.get(k) is None]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    summary = generate_booking_summary(
        guest_name=str(body["guestName"]),
        room_type=str(body["roomType"]),
        check_in=str(body["checkIn"]),
        check_out=str(body["checkOut"]),
        guests=int(body["guests"]),
        total=float(body["total"]),
        nights=int(body["nights"]),
    )

    if summary is None:
        return jsonify({"error": "AI service is not available. Please make sure Ollama is running with llama3.2 model."}), 503

    return jsonify({"summary": summary})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
