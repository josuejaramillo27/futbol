/* ==========================================================================
   CANCHA HUB — app.js
   Shared logic for index.html, cancha.html and admin.html.
   Everything is vanilla JS. There is no real backend: DB below is the
   mocked "database" you can later swap for real API calls (fetch/Supabase/
   Firebase/etc). Keep the shape of the objects the same and the rest of the
   app keeps working.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. MOCK DATABASE
   -------------------------------------------------------------------------- */
const DB = {
  /* Affiliated tenants (football field businesses paying the monthly SaaS fee) */
  fields: [
    {
      id: "maracana",
      name: "Complejo Maracaná",
      type: "Fútbol 7",
      location: "San Isidro, Lima",
      pricePerHour: 120,
      currency: "S/",
      accent: "#22c55e", // turf green
      accent2: "#0d3b21",
      whatsapp: "51999111222",
      services: ["Balones oficiales", "Petos numerados", "Estacionamiento", "Duchas"],
      description:
        "Cancha de grass sintético de última generación con iluminación LED profesional, ideal para partidos nocturnos.",
      slots: buildDaySlots(["18:00", "19:00", "20:00", "21:00", "22:00"], ["19:00"]),
    },
    {
      id: "bombonera-five",
      name: "La Bombonera Five",
      type: "Fútbol 5",
      location: "Surco, Lima",
      pricePerHour: 90,
      currency: "S/",
      accent: "#38bdf8", // sky blue variant, still reads as "turf under lights"
      accent2: "#0b2a3d",
      whatsapp: "51999333444",
      services: ["Balones", "Petos", "Bar de hidratación", "Vestidores"],
      description:
        "Cancha techada de 5, superficie de última generación, perfecta para partidos rápidos entre semana.",
      slots: buildDaySlots(["17:00", "18:00", "19:00", "20:00", "21:00", "22:00"], ["18:00", "20:00"]),
    },
  ],

  /* Community social feed posts */
  posts: [
    {
      id: "p3",
      author: "Renzo Q.",
      initials: "RQ",
      type: "need-player",
      text: "Somos 9, falta 1 arquero para hoy 8pm en Complejo Maracaná. ¡Se paga la cancha entre todos!",
      time: "Hace 12 min",
      spotsLeft: 1,
    },
    {
      id: "p2",
      author: "Equipo Halcones",
      initials: "EH",
      type: "challenge",
      text: "Reto a cualquier equipo de nivel intermedio este sábado 5pm. La Bombonera Five, ¡el que pierde invita las bebidas!",
      time: "Hace 40 min",
      spotsLeft: null,
    },
    {
      id: "p1",
      author: "Micaela T.",
      initials: "MT",
      type: "need-player",
      text: "Necesitamos 2 jugadoras para completar equipo mixto el domingo a las 11am.",
      time: "Hace 2 h",
      spotsLeft: 2,
    },
  ],

  /* Admin: today's reservations for the currently managed tenant */
  reservations: [
    { time: "18:00", client: "Renzo Quispe", duration: "1h", amount: 120, status: "paid" },
    { time: "19:00", client: "Grupo Halcones", duration: "1h", amount: 120, status: "deposit" },
    { time: "20:00", client: "Sin reservar", duration: "—", amount: 0, status: "pending" },
    { time: "21:00", client: "Mica & amigas", duration: "2h", amount: 240, status: "paid" },
  ],

  /* Admin: recurring weekly "fixed clients" */
  fixedClients: [
    { day: "Lunes", time: "19:00", client: "Los Tigres FC", plan: "Fijo semanal · 7v7" },
    { day: "Miércoles", time: "20:00", client: "Oficina TechCorp", plan: "Fijo quincenal · 7v7" },
    { day: "Viernes", time: "21:00", client: "Barrio San Martín", plan: "Fijo semanal · 7v7" },
  ],

  stats: {
    monthlyBookings: 186,
    monthlyBookingsDelta: "+14% vs. mes anterior",
    estimatedRevenue: 16240,
    estimatedRevenueDelta: "+9% vs. mes anterior",
    occupancy: 78,
    occupancyDelta: "+5 pts vs. mes anterior",
    activeFixedClients: 3,
  },
};

/** Builds a day's worth of slot objects, marking a few as booked. */
function buildDaySlots(hours, bookedHours) {
  return hours.map((h) => ({ time: h, booked: bookedHours.includes(h) }));
}

/* --------------------------------------------------------------------------
   2. HELPERS
   -------------------------------------------------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function formatMoney(amount, currency = "S/") {
  return `${currency} ${amount.toLocaleString("es-PE")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* --------------------------------------------------------------------------
   3. INDEX.HTML — Community feed + field directory
   -------------------------------------------------------------------------- */
function initIndexPage() {
  renderFeed();
  renderFieldDirectory();

  // New-post composer
  const form = $("#post-form");
  if (form) {
    let selectedType = "need-player";

    $$(".chip", form).forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".chip", form).forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        selectedType = chip.dataset.type;
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const textarea = $("#post-text", form);
      const text = textarea.value.trim();
      if (!text) return;

      DB.posts.unshift({
        id: "p" + Date.now(),
        author: "Tú",
        initials: "TU",
        type: selectedType,
        text,
        time: "Ahora mismo",
        spotsLeft: selectedType === "need-player" ? 1 : null,
      });

      textarea.value = "";
      renderFeed();
    });
  }
}

function renderFeed() {
  const feed = $("#feed-grid");
  if (!feed) return;

  feed.innerHTML = DB.posts
    .map((post) => {
      const badge =
        post.type === "need-player"
          ? `<span class="badge badge-need">Falta jugador</span>`
          : `<span class="badge badge-challenge">Reto de equipo</span>`;

      const spots =
        post.spotsLeft != null
          ? `<span class="spots">${post.spotsLeft} cupo${post.spotsLeft === 1 ? "" : "s"} disponible${post.spotsLeft === 1 ? "" : "s"}</span>`
          : `<span class="spots">Abierto a retos</span>`;

      return `
        <article class="card post">
          <div class="avatar">${escapeHtml(post.initials)}</div>
          <div>
            <div class="post-head">
              <span class="name">${escapeHtml(post.author)}</span>
              ${badge}
              <span class="time">${escapeHtml(post.time)}</span>
            </div>
            <p class="mt-0">${escapeHtml(post.text)}</p>
            <div class="post-foot">
              ${spots}
              <button class="btn btn-sm btn-ghost" type="button" data-respond>
                ${post.type === "need-player" ? "Sumarme" : "Aceptar reto"}
              </button>
            </div>
          </div>
        </article>`;
    })
    .join("");

  // Mock "respond" interaction — no backend, just user feedback
  $$("[data-respond]", feed).forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.textContent = "¡Listo! ✓";
      btn.disabled = true;
    });
  });
}

function renderFieldDirectory() {
  const grid = $("#field-grid");
  if (!grid) return;

  grid.innerHTML = DB.fields
    .map((field) => {
      const services = field.services
        .slice(0, 3)
        .map((s) => `<span>${escapeHtml(s)}</span>`)
        .join("");

      return `
        <article class="card field-card" data-id="${field.id}" tabindex="0" role="button"
                  aria-label="Ver disponibilidad de ${escapeHtml(field.name)}">
          <div class="field-banner" style="background: linear-gradient(135deg, ${field.accent}, ${field.accent2});">
            <span class="field-type">${escapeHtml(field.type)}</span>
          </div>
          <div class="field-body">
            <h3>${escapeHtml(field.name)}</h3>
            <span class="field-loc">📍 ${escapeHtml(field.location)}</span>
            <div class="field-services">${services}</div>
            <div class="field-foot">
              <span class="field-price">${formatMoney(field.pricePerHour, field.currency)} <small>/ hora</small></span>
              <span class="btn btn-sm btn-primary">Reservar →</span>
            </div>
          </div>
        </article>`;
    })
    .join("");

  // Clicking (or pressing Enter on) a field card routes to its dynamic booking page
  $$(".field-card", grid).forEach((card) => {
    const goToField = () => (window.location.href = `cancha.html?id=${card.dataset.id}`);
    card.addEventListener("click", goToField);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goToField();
      }
    });
  });
}

/* --------------------------------------------------------------------------
   4. CANCHA.HTML — Dynamic single-tenant booking page
   -------------------------------------------------------------------------- */
function initCanchaPage() {
  const params = new URLSearchParams(window.location.search);
  const fieldId = params.get("id");
  const field = DB.fields.find((f) => f.id === fieldId) || DB.fields[0];

  if (!field) return; // no fields configured at all

  // Theme the page with the tenant's own accent color
  document.documentElement.style.setProperty("--tenant-accent", field.accent);

  // Hero / header info
  $("#tenant-name").textContent = field.name;
  $("#tenant-type").textContent = field.type;
  $("#tenant-location").textContent = field.location;
  $("#tenant-description").textContent = field.description;
  $("#tenant-price").textContent = formatMoney(field.pricePerHour, field.currency);
  $("#summary-price").textContent = formatMoney(field.pricePerHour, field.currency);
  document.title = `${field.name} — Reserva tu cancha | Cancha Hub`;

  // Included services
  const servicesList = $("#services-list");
  servicesList.innerHTML = field.services.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  // Slots
  renderSlots(field);

  // WhatsApp contact shortcut
  const waBtn = $("#whatsapp-btn");
  if (waBtn && field.whatsapp) {
    waBtn.href = `https://wa.me/${field.whatsapp}?text=${encodeURIComponent(
      `Hola, quisiera más información sobre ${field.name}`
    )}`;
  }

  let selectedSlot = null;

  function renderSlots(field) {
    const grid = $("#slot-grid");
    grid.innerHTML = field.slots
      .map(
        (slot) => `
        <button type="button" class="slot ${slot.booked ? "booked" : ""}" data-time="${slot.time}"
                ${slot.booked ? "disabled" : ""} aria-pressed="false">
          ${slot.time}
        </button>`
      )
      .join("");

    $$(".slot", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".slot.selected", grid).forEach((s) => {
          s.classList.remove("selected");
          s.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
        selectedSlot = btn.dataset.time;
        updateSummary(field);
      });
    });
  }

  function updateSummary(field) {
    const summaryTime = $("#summary-time");
    const confirmBtn = $("#confirm-btn");
    if (selectedSlot) {
      summaryTime.textContent = selectedSlot;
      confirmBtn.disabled = false;
    } else {
      summaryTime.textContent = "—";
      confirmBtn.disabled = true;
    }
  }

  // Day tabs (mock — both tabs use the same slot template for this demo)
  $$(".day-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".day-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      selectedSlot = null;
      renderSlots(field);
      updateSummary(field);
      $("#confirm-banner").classList.remove("show");
    });
  });

  // Confirm booking
  const confirmBtn = $("#confirm-btn");
  confirmBtn.addEventListener("click", () => {
    if (!selectedSlot) return;

    // Mark the slot as booked in our mock DB and re-render
    const slotObj = field.slots.find((s) => s.time === selectedSlot);
    if (slotObj) slotObj.booked = true;
    selectedSlot = null;
    renderSlots(field);
    updateSummary(field);

    const banner = $("#confirm-banner");
    banner.textContent = `✓ ¡Reserva confirmada! Te contactaremos por WhatsApp para coordinar el pago.`;
    banner.classList.add("show");
  });

  updateSummary(field);
}

/* --------------------------------------------------------------------------
   5. ADMIN.HTML — Owner dashboard
   -------------------------------------------------------------------------- */
function initAdminPage() {
  // Topbar tenant switcher label (this admin session manages the first field)
  const tenantLabel = $("#admin-tenant-name");
  if (tenantLabel) tenantLabel.textContent = DB.fields[0].name;

  // KPI cards
  const s = DB.stats;
  $("#kpi-bookings").textContent = s.monthlyBookings;
  $("#kpi-bookings-delta").textContent = s.monthlyBookingsDelta;
  $("#kpi-revenue").textContent = formatMoney(s.estimatedRevenue);
  $("#kpi-revenue-delta").textContent = s.estimatedRevenueDelta;
  $("#kpi-occupancy").textContent = `${s.occupancy}%`;
  $("#kpi-occupancy-delta").textContent = s.occupancyDelta;
  $("#kpi-fixed").textContent = s.activeFixedClients;

  // Today's reservations table
  const statusLabel = { paid: "Pagado", deposit: "Depósito 50%", pending: "Pendiente" };
  const tbody = $("#reservations-body");
  tbody.innerHTML = DB.reservations
    .map(
      (r) => `
      <tr>
        <td class="mono">${r.time}</td>
        <td>${escapeHtml(r.client)}</td>
        <td>${r.duration}</td>
        <td class="mono">${r.amount ? formatMoney(r.amount) : "—"}</td>
        <td><span class="status-pill status-${r.status}">${statusLabel[r.status]}</span></td>
      </tr>`
    )
    .join("");

  // Fixed (recurring) clients
  const fixedGrid = $("#fixed-grid");
  fixedGrid.innerHTML = DB.fixedClients
    .map(
      (c) => `
      <div class="card fixed-card">
        <div class="fixed-day">${escapeHtml(c.day)}</div>
        <h4>${escapeHtml(c.client)}</h4>
        <div class="fixed-time">🕒 ${c.time} · ${escapeHtml(c.plan)}</div>
      </div>`
    )
    .join("");
}

/* --------------------------------------------------------------------------
   6. ROUTER — decide which page's logic to run
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "index") initIndexPage();
  if (page === "cancha") initCanchaPage();
  if (page === "admin") initAdminPage();
});
