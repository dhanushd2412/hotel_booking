const hotel = {
  name: "Hotel Vinayagam",
  city: "Tamil Nadu",
  area: "Main Road",
  rating: 4.6,
  amenities: ["Breakfast", "AC rooms", "Wi-Fi", "Parking", "Room service"],
  rooms: [
    {
      id: "standard",
      name: "Standard Room",
      price: 2200,
      capacity: 2,
      description: "Comfortable AC room for solo travelers or couples."
    },
    {
      id: "deluxe",
      name: "Deluxe Room",
      price: 3200,
      capacity: 3,
      description: "Larger room with extra seating and premium bedding."
    },
    {
      id: "family",
      name: "Family Room",
      price: 4600,
      capacity: 4,
      description: "Spacious room for families with added sleeping space."
    }
  ]
};

const state = {
  selectedRoomId: "standard",
  bookings: []
};

const STORAGE_KEY = "hotelVinayagamBookings";
const API_BASE_URL = "http://localhost:4000/api";

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const bookingForm = document.querySelector("#bookingForm");
const guestName = document.querySelector("#guestName");
const guestPhone = document.querySelector("#guestPhone");
const checkIn = document.querySelector("#checkIn");
const checkOut = document.querySelector("#checkOut");
const guests = document.querySelector("#guests");
const roomType = document.querySelector("#roomType");
const roomGrid = document.querySelector("#roomGrid");
const selectedHotel = document.querySelector("#selectedHotel");
const roomTotal = document.querySelector("#roomTotal");
const taxTotal = document.querySelector("#taxTotal");
const grandTotal = document.querySelector("#grandTotal");
const nightCount = document.querySelector("#nightCount");
const roomCount = document.querySelector("#roomCount");
const bookingTable = document.querySelector("#bookingTable");
const clearBookings = document.querySelector("#clearBookings");
const toast = document.querySelector("#toast");

function setInitialDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  checkIn.value = toDateInput(tomorrow);
  checkOut.value = toDateInput(dayAfter);
  checkIn.min = toDateInput(today);
  checkOut.min = toDateInput(dayAfter);
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getNights() {
  const start = new Date(checkIn.value);
  const end = new Date(checkOut.value);
  const diff = Math.round((end - start) / 86400000);
  return Math.max(diff, 1);
}

function getSelectedRoom() {
  return hotel.rooms.find((room) => room.id === state.selectedRoomId) || hotel.rooms[0];
}

function getRoomsNeeded(room) {
  return Math.max(1, Math.ceil(Number(guests.value || 1) / room.capacity));
}

function getBookingTotal() {
  const room = getSelectedRoom();
  const nights = getNights();
  const rooms = getRoomsNeeded(room);
  const subtotal = room.price * nights * rooms;
  const tax = Math.round(subtotal * 0.12);

  return {
    room,
    nights,
    rooms,
    subtotal,
    tax,
    total: subtotal + tax
  };
}

function renderRoomOptions() {
  roomType.innerHTML = hotel.rooms
    .map((room) => `<option value="${room.id}">${room.name} - ${formatter.format(room.price)} / night</option>`)
    .join("");
  roomType.value = state.selectedRoomId;

  roomGrid.innerHTML = hotel.rooms
    .map((room) => {
      const isSelected = room.id === state.selectedRoomId;
      return `
        <button class="room-card ${isSelected ? "active" : ""}" type="button" data-room-id="${room.id}">
          <span>${room.name}</span>
          <strong>${formatter.format(room.price)}</strong>
          <small>Up to ${room.capacity} guests · ${room.description}</small>
        </button>
      `;
    })
    .join("");
}

function renderBookingSummary() {
  const summary = getBookingTotal();

  nightCount.textContent = `${summary.nights} ${summary.nights === 1 ? "night" : "nights"}`;
  roomCount.textContent = `${summary.rooms} ${summary.rooms === 1 ? "room" : "rooms"}`;
  selectedHotel.innerHTML = `
    <strong>${hotel.name}</strong><br />
    ${summary.room.name} · ${guests.value} ${Number(guests.value) === 1 ? "guest" : "guests"} · ${summary.rooms} ${summary.rooms === 1 ? "room" : "rooms"}
  `;
  roomTotal.textContent = formatter.format(summary.subtotal);
  taxTotal.textContent = formatter.format(summary.tax);
  grandTotal.textContent = formatter.format(summary.total);
}

function normalizeBooking(booking) {
  return {
    id: booking.id,
    name: booking.name || booking.guest_name,
    phone: booking.phone || booking.guest_phone,
    checkIn: formatDateOnly(booking.checkIn || booking.check_in),
    checkOut: formatDateOnly(booking.checkOut || booking.check_out),
    guests: Number(booking.guests),
    roomId: booking.roomId || booking.room_id,
    roomName: booking.roomName || booking.room_name,
    rooms: Number(booking.rooms),
    nights: Number(booking.nights),
    subtotal: Number(booking.subtotal),
    tax: Number(booking.tax),
    total: Number(booking.total),
    status: booking.status || "Confirmed",
    createdAt: booking.createdAt || booking.created_at
  };
}

function formatDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function renderSavedBookings() {
  if (!state.bookings.length) {
    bookingTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table">No bookings saved yet.</td>
      </tr>
    `;
    return;
  }

  bookingTable.innerHTML = state.bookings
    .map((booking) => {
      return `
        <tr>
          <td>${escapeHtml(booking.name)}</td>
          <td>${escapeHtml(booking.phone)}</td>
          <td>${booking.checkIn} to ${booking.checkOut}</td>
          <td>${booking.roomName}</td>
          <td>${formatter.format(booking.total)}</td>
          <td><span class="status-pill">${booking.status}</span></td>
        </tr>
      `;
    })
    .join("");
}

async function loadBookings() {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings`);
    if (!response.ok) throw new Error("Backend bookings could not be loaded.");
    const bookings = await response.json();
    state.bookings = bookings.map(normalizeBooking);
    saveBookings();
    return;
  } catch (error) {
    console.info("Using local bookings because backend is unavailable.", error);
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  state.bookings = saved ? JSON.parse(saved) : [];
}

function saveBookings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookings));
}

function updateDateLimits() {
  const start = new Date(checkIn.value);
  const nextDay = new Date(start);
  nextDay.setDate(start.getDate() + 1);
  checkOut.min = toDateInput(nextDay);
  if (new Date(checkOut.value) <= start) {
    checkOut.value = toDateInput(nextDay);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sync() {
  renderRoomOptions();
  renderBookingSummary();
  renderSavedBookings();
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const summary = getBookingTotal();
  const booking = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    hotelName: hotel.name,
    name: guestName.value.trim(),
    phone: guestPhone.value.trim(),
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guests: Number(guests.value),
    roomId: summary.room.id,
    roomName: summary.room.name,
    rooms: summary.rooms,
    nights: summary.nights,
    subtotal: summary.subtotal,
    tax: summary.tax,
    total: summary.total,
    status: "Confirmed",
    createdAt: new Date().toISOString()
  };

  const savedBooking = await saveBookingToBackend(booking);
  state.bookings.unshift(savedBooking);
  saveBookings();
  bookingForm.reset();
  setInitialDates();
  state.selectedRoomId = "standard";
  guests.value = "2";
  sync();
  showToast(`Booking confirmed for ${savedBooking.name} at ${hotel.name}.`);
});

async function saveBookingToBackend(booking) {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(booking)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Backend booking failed.");
    }

    return normalizeBooking(await response.json());
  } catch (error) {
    console.info("Saved booking locally because backend is unavailable.", error);
    return booking;
  }
}

roomGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-room-id]");
  if (!button) return;
  state.selectedRoomId = button.dataset.roomId;
  roomType.value = state.selectedRoomId;
  sync();
});

roomType.addEventListener("change", (event) => {
  state.selectedRoomId = event.target.value;
  sync();
});

checkIn.addEventListener("change", () => {
  updateDateLimits();
  renderBookingSummary();
});

checkOut.addEventListener("change", renderBookingSummary);
guests.addEventListener("input", renderBookingSummary);

clearBookings.addEventListener("click", () => {
  state.bookings = [];
  saveBookings();
  renderSavedBookings();
  showToast("Saved booking data cleared.");
});

setInitialDates();
loadBookings().finally(sync);
