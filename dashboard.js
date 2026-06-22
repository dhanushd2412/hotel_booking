const API_BASE_URL = "http://localhost:4000/api";

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const state = {
  bookings: [],
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth()
};

const calendarGrid = document.querySelector("#calendarGrid");
const calendarTitle = document.querySelector("#calendarTitle");
const bookingTable = document.querySelector("#bookingTable");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const roomFilter = document.querySelector("#roomFilter");
const dateFrom = document.querySelector("#dateFrom");
const dateTo = document.querySelector("#dateTo");
const modalOverlay = document.querySelector("#modalOverlay");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const toast = document.querySelector("#toast");

function toISO(d) { return d.toISOString().slice(0, 10); }

function today() { return toISO(new Date()); }

function normalize(b) {
  return {
    id: b.id,
    name: b.name || b.guest_name,
    phone: b.phone || b.guest_phone,
    checkIn: String(b.checkIn || b.check_in || "").slice(0, 10),
    checkOut: String(b.checkOut || b.check_out || "").slice(0, 10),
    guests: Number(b.guests),
    roomId: b.roomId || b.room_id,
    roomName: b.roomName || b.room_name,
    rooms: Number(b.rooms),
    nights: Number(b.nights),
    subtotal: Number(b.subtotal),
    tax: Number(b.tax),
    total: Number(b.total),
    status: b.status || "Confirmed",
    createdAt: b.createdAt || b.created_at
  };
}

function escapeHtml(v) {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function statusClass(status) {
  return "status-" + status.toLowerCase().replace(/\s+/g, "-");
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

async function loadBookings() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAhead = new Date();
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

    const url = `${API_BASE_URL}/bookings?from=${toISO(oneYearAgo)}&to=${toISO(oneYearAhead)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load bookings");
    const data = await res.json();
    state.bookings = data.map(normalize);
  } catch (e) {
    console.error("Could not load bookings from backend:", e);
    state.bookings = [];
  }
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Update failed");
    }
    const updated = normalize(await res.json());
    const idx = state.bookings.findIndex(b => b.id === id);
    if (idx >= 0) state.bookings[idx] = updated;
    renderAll();
    showToast(`Booking status changed to "${newStatus}".`);
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

function renderStats() {
  const t = today();
  const todayCheckIns = state.bookings.filter(b => b.checkIn === t && b.status !== "Cancelled").length;
  const todayCheckOuts = state.bookings.filter(b => b.checkOut === t && b.status !== "Cancelled").length;
  const active = state.bookings.filter(b => b.status === "Confirmed" || b.status === "Checked in").length;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = toISO(nextMonth);
  const revenue = state.bookings
    .filter(b => b.checkIn >= monthStart && b.checkIn < monthEnd && b.status !== "Cancelled")
    .reduce((sum, b) => sum + b.total, 0);

  document.querySelector("#statCheckIns").textContent = todayCheckIns;
  document.querySelector("#statCheckOuts").textContent = todayCheckOuts;
  document.querySelector("#statActive").textContent = active;
  document.querySelector("#statRevenue").textContent = formatter.format(revenue);
}

function renderCalendar() {
  const { calendarYear: year, calendarMonth: month } = state;
  calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const t = today();

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const bookingsByDay = {};
  for (const b of state.bookings) {
    const start = new Date(b.checkIn);
    const end = new Date(b.checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const ds = toISO(d);
      if (ds.startsWith(monthStr)) {
        const day = d.getDate();
        if (!bookingsByDay[day]) bookingsByDay[day] = [];
        bookingsByDay[day].push(b);
      }
    }
  }

  let html = DAY_NAMES.map(d => `<div class="cal-head">${d}</div>`).join("");

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
    const isToday = dateStr === t;
    const dayBookings = bookingsByDay[day] || [];
    const maxShow = 3;

    let inner = `<div class="cal-day-num">${day}</div>`;
    for (let i = 0; i < Math.min(dayBookings.length, maxShow); i++) {
      const b = dayBookings[i];
      inner += `<span class="cal-booking ${statusClass(b.status)}" data-id="${b.id}" title="${escapeHtml(b.name)} - ${b.roomName}">${escapeHtml(b.name)}</span>`;
    }
    if (dayBookings.length > maxShow) {
      inner += `<span class="cal-more">+${dayBookings.length - maxShow} more</span>`;
    }

    html += `<div class="cal-day${isToday ? " today" : ""}">${inner}</div>`;
  }

  calendarGrid.innerHTML = html;
}

function getFilteredBookings() {
  let list = state.bookings;
  const q = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const room = roomFilter.value;
  const from = dateFrom.value;
  const to = dateTo.value;

  if (q) list = list.filter(b => b.name.toLowerCase().includes(q) || b.phone.includes(q));
  if (status) list = list.filter(b => b.status === status);
  if (room) list = list.filter(b => b.roomId === room);
  if (from) list = list.filter(b => b.checkOut >= from);
  if (to) list = list.filter(b => b.checkIn <= to);

  return list;
}

function renderBookings() {
  const list = getFilteredBookings();

  if (!list.length) {
    bookingTable.innerHTML = `<tr><td colspan="10" class="empty-table">No bookings found.</td></tr>`;
    return;
  }

  bookingTable.innerHTML = list.map(b => {
    const actions = getActions(b);
    return `<tr>
      <td>${escapeHtml(b.name)}</td>
      <td>${escapeHtml(b.phone)}</td>
      <td>${b.checkIn}</td>
      <td>${b.checkOut}</td>
      <td>${b.roomName}</td>
      <td>${b.rooms}</td>
      <td>${b.nights}</td>
      <td>${formatter.format(b.total)}</td>
      <td><span class="status-pill ${statusClass(b.status)}">${b.status}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
}

function getActions(b) {
  let html = `<button class="action-btn" data-action="view" data-id="${b.id}">View</button>`;
  if (b.status === "Confirmed") {
    html += `<button class="action-btn" data-action="checkin" data-id="${b.id}">Check in</button>`;
    html += `<button class="action-btn danger" data-action="cancel" data-id="${b.id}">Cancel</button>`;
  } else if (b.status === "Checked in") {
    html += `<button class="action-btn" data-action="complete" data-id="${b.id}">Complete</button>`;
  }
  return html;
}

function openModal(booking) {
  modalTitle.textContent = `Booking - ${booking.name}`;
  modalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Guest name</label><span>${escapeHtml(booking.name)}</span></div>
      <div class="detail-item"><label>Phone</label><span>${escapeHtml(booking.phone)}</span></div>
      <div class="detail-item"><label>Check-in</label><span>${booking.checkIn}</span></div>
      <div class="detail-item"><label>Check-out</label><span>${booking.checkOut}</span></div>
      <div class="detail-item"><label>Room type</label><span>${booking.roomName}</span></div>
      <div class="detail-item"><label>Guests</label><span>${booking.guests}</span></div>
      <div class="detail-item"><label>Rooms</label><span>${booking.rooms}</span></div>
      <div class="detail-item"><label>Nights</label><span>${booking.nights}</span></div>
      <div class="detail-item"><label>Room total</label><span>${formatter.format(booking.subtotal)}</span></div>
      <div class="detail-item"><label>Tax (12%)</label><span>${formatter.format(booking.tax)}</span></div>
      <div class="detail-item"><label>Grand total</label><span><strong>${formatter.format(booking.total)}</strong></span></div>
      <div class="detail-item"><label>Status</label><span class="status-pill ${statusClass(booking.status)}">${booking.status}</span></div>
      <div class="detail-item full"><label>Booked on</label><span>${new Date(booking.createdAt).toLocaleString("en-IN")}</span></div>
    </div>
    <div class="modal-actions">
      ${booking.status === "Confirmed" ? `<button class="action-btn" data-action="checkin" data-id="${booking.id}">Check in</button><button class="action-btn danger" data-action="cancel" data-id="${booking.id}">Cancel</button>` : ""}
      ${booking.status === "Checked in" ? `<button class="action-btn" data-action="complete" data-id="${booking.id}">Complete</button>` : ""}
    </div>
  `;
  modalOverlay.classList.add("open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
}

function renderAll() {
  renderStats();
  renderCalendar();
  renderBookings();
}

function handleAction(action, id) {
  const booking = state.bookings.find(b => b.id === id);
  if (!booking) return;

  if (action === "view") return openModal(booking);
  if (action === "checkin") return updateStatus(id, "Checked in");
  if (action === "complete") return updateStatus(id, "Completed");
  if (action === "cancel") {
    if (confirm(`Cancel booking for ${booking.name}?`)) {
      updateStatus(id, "Cancelled");
    }
  }
}

document.querySelector("#prevMonth").addEventListener("click", () => {
  state.calendarMonth--;
  if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
  renderCalendar();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  state.calendarMonth++;
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  renderCalendar();
});

document.querySelector("#todayBtn").addEventListener("click", () => {
  const now = new Date();
  state.calendarYear = now.getFullYear();
  state.calendarMonth = now.getMonth();
  renderCalendar();
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (btn) handleAction(btn.dataset.action, btn.dataset.id);
});

calendarGrid.addEventListener("click", (e) => {
  const chip = e.target.closest(".cal-booking");
  if (!chip) return;
  const booking = state.bookings.find(b => b.id === chip.dataset.id);
  if (booking) openModal(booking);
});

document.querySelector("#modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

searchInput.addEventListener("input", renderBookings);
statusFilter.addEventListener("change", renderBookings);
roomFilter.addEventListener("change", renderBookings);
dateFrom.addEventListener("change", renderBookings);
dateTo.addEventListener("change", renderBookings);

loadBookings().then(renderAll);
