"use strict";

const ADMIN = {
  API_BASE: "https://lucky77-wheel-bot-548i.onrender.com",
  KEY: "lucky77_admin_api_key",
  ACCOUNT: "lucky77_dashboard_account",
};

const state = {
  apiKey: sessionStorage.getItem(ADMIN.KEY) || localStorage.getItem(ADMIN.KEY) || "",
  account: localStorage.getItem(ADMIN.ACCOUNT) || "lucky77autospin",
  overview: null,
  event: null,
  section: "overview",
};

const $ = (id) => document.getElementById(id);
const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function safe(value) {
  return value == null ? "" : String(value);
}

function esc(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toast(message, type = "info") {
  const node = $("adminToast");
  node.textContent = safe(message);
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}) };
  if (state.apiKey) headers["x-api-key"] = state.apiKey;

  const response = await fetch(`${ADMIN.API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    logout(false);
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function login(account, pass) {
  const response = await fetch(`${ADMIN.API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, api_pass: pass }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false || !data.api_key) {
    throw new Error(data.message || data.error || "Login failed");
  }
  return data;
}

function showApp(show) {
  $("adminLogin").classList.toggle("hidden", show);
  $("adminApp").classList.toggle("hidden", !show);
}

function logout(showMessage = true) {
  state.apiKey = "";
  sessionStorage.removeItem(ADMIN.KEY);
  localStorage.removeItem(ADMIN.KEY);
  showApp(false);
  if (showMessage) toast("Logged out");
}

async function checkSession() {
  if (!state.apiKey) return false;
  try {
    await api("/auth/check");
    return true;
  } catch (_) {
    return false;
  }
}

function switchSection(section) {
  state.section = section;
  qa(".admin-section").forEach((node) => {
    node.classList.toggle("hidden", node.id !== `adminSection-${section}`);
  });
  qa(".admin-nav-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.section === section);
  });
  const titles = {
    overview: "Event Overview",
    event: "Event Control",
    prizes: "Prize Inventory",
    members: "Registered Members",
    history: "Winner History",
  };
  $("adminPageTitle").textContent = titles[section] || "Lucky77 Control";
}

function renderHealth(online) {
  const node = $("adminHealth");
  node.classList.toggle("is-live", online);
  node.classList.toggle("is-waiting", !online);
  node.querySelector("span").textContent = online ? "SYSTEM ONLINE" : "OFFLINE";
}

function renderOverview() {
  const data = state.overview || {};
  const event = data.event || {};
  const counts = data.counts || {};
  $("overviewTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("overviewSubtitle").textContent = event.subtitle || "";
  const live = !!event.event_live;
  $("overviewLive").classList.toggle("is-live", live);
  $("overviewLive").classList.toggle("is-waiting", !live);
  $("overviewLive").querySelector("span").textContent = live ? "EVENT LIVE" : "EVENT WAITING";

  $("adminMetricRegistered").textContent = number(counts.registered);
  $("adminMetricSpun").textContent = number(counts.spun);
  $("adminMetricMembers").textContent = number(counts.members);
  $("adminMetricPrizes").textContent = number(counts.prizes_left);

  const history = data.recent_history || [];
  $("overviewWinners").innerHTML = history.length
    ? history.slice(0, 6).map((item) => `
      <article>
        <span class="activity-avatar">${esc((item.display || item.name || "77").slice(0, 2).toUpperCase())}</span>
        <div><strong>${esc(item.display || item.name || item.username || "Lucky Member")}</strong><small>${esc(dateText(item.at))}</small></div>
        <b>${esc(item.prize || "Premium Prize")}</b>
      </article>`).join("")
    : `<div class="empty-copy">No winner activity yet.</div>`;

  const total = Number(counts.prizes_total || 0);
  const left = Number(counts.prizes_left || 0);
  const percent = total ? Math.round((left / total) * 100) : 0;
  $("prizeHealthPercent").textContent = `${percent}%`;
  $("prizeHealthBar").style.width = `${percent}%`;
  $("prizeHealthCopy").textContent = total
    ? `${number(left)} of ${number(total)} prize slots remain in the live bag.`
    : "Add prizes to prepare the event.";
}

function toLocalDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function renderEventForm() {
  const event = state.event || {};
  $("eventRegistrationOpen").checked = !!event.registration_open;
  $("eventLive").checked = !!event.event_live;
  $("eventId").value = safe(event.event_id);
  $("nextEventId").value = safe(event.next_event_id);
  $("eventEndsAt").value = toLocalDateInput(event.ends_at);
  $("eventPromoCode").value = safe(event.promo_code);
  $("eventTitleInput").value = safe(event.title);
  $("eventSubtitleInput").value = safe(event.subtitle);
  $("eventAnnouncement").value = safe(event.announcement);
  $("eventBannerUrl").value = safe(event.banner_image_url);
  $("eventTheme").value = safe(event.theme || "obsidian-rose");
  $("eventAccent").value = safe(event.accent || "#d83b75");
  $("eventAccent2").value = safe(event.accent_2 || "#e5c58b");
  $("eventWheelColors").value = Array.isArray(event.wheel_colors) ? event.wheel_colors.join(", ") : "";
  $("eventSpinSound").value = safe(event.spin_sound_url);
  $("eventWinSound").value = safe(event.win_sound_url);
}

function renderPrizes() {
  const prizes = state.overview?.prizes || {};
  $("prizeEditor").value = Array.isArray(prizes.source) ? prizes.source.join("\n") : "";
  $("prizeSourceCount").textContent = number(prizes.source?.length || 0);
  $("prizeBagCount").textContent = number(prizes.bag?.length || 0);
}

function renderMembers() {
  const term = $("memberSearch").value.trim().toLowerCase();
  const members = (state.overview?.members || []).filter((member) => {
    const haystack = [
      member.display, member.name, member.username, member.user_id, member.id,
    ].join(" ").toLowerCase();
    return !term || haystack.includes(term);
  });

  $("memberTable").innerHTML = members.length
    ? members.map((member) => `
      <tr>
        <td><div class="table-person"><span>${esc((member.display || member.name || "77").slice(0, 2).toUpperCase())}</span><div><strong>${esc(member.display || member.name || "Member")}</strong><small>${esc(member.first_name || "")}</small></div></div></td>
        <td>${member.username ? `@${esc(safe(member.username).replace(/^@/, ""))}` : "-"}</td>
        <td class="mono">${esc(member.user_id || member.id || "-")}</td>
        <td>${esc(dateText(member.joined_at))}</td>
        <td><span class="table-status is-good">Registered</span></td>
      </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty-copy">No registered member matches this search.</div></td></tr>`;
}

function renderHistory() {
  const history = state.overview?.recent_history || [];
  $("historyTable").innerHTML = history.length
    ? history.map((item) => `
      <tr>
        <td class="mono">#${esc(item.turn || "-")}</td>
        <td><div class="table-person"><span>${esc((item.display || item.name || "77").slice(0, 2).toUpperCase())}</span><div><strong>${esc(item.display || item.name || "Lucky Member")}</strong><small>${esc(item.user_id || "")}</small></div></div></td>
        <td><strong class="prize-text">${esc(item.prize || "-")}</strong></td>
        <td>${item.username ? `@${esc(safe(item.username).replace(/^@/, ""))}` : "-"}</td>
        <td>${esc(dateText(item.at))}</td>
      </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty-copy">No winner history yet.</div></td></tr>`;
}

function renderAll() {
  renderOverview();
  renderEventForm();
  renderPrizes();
  renderMembers();
  renderHistory();
}

async function refresh() {
  $("adminRefresh").disabled = true;
  try {
    const [overview, eventPack] = await Promise.all([
      api("/admin/overview"),
      api("/admin/event"),
    ]);
    state.overview = overview;
    state.event = eventPack.event || {};
    renderHealth(true);
    renderAll();
  } catch (error) {
    renderHealth(false);
    toast(error.message, "error");
  } finally {
    $("adminRefresh").disabled = false;
  }
}

async function saveEvent(event) {
  event.preventDefault();
  const payload = {
    registration_open: $("eventRegistrationOpen").checked,
    event_live: $("eventLive").checked,
    event_id: $("eventId").value.trim(),
    next_event_id: $("nextEventId").value.trim(),
    ends_at: $("eventEndsAt").value
      ? new Date($("eventEndsAt").value).toISOString()
      : "",
    promo_code: $("eventPromoCode").value.trim(),
    title: $("eventTitleInput").value.trim(),
    subtitle: $("eventSubtitleInput").value.trim(),
    announcement: $("eventAnnouncement").value.trim(),
    banner_image_url: $("eventBannerUrl").value.trim(),
    theme: $("eventTheme").value,
    accent: $("eventAccent").value,
    accent_2: $("eventAccent2").value,
    wheel_colors: $("eventWheelColors").value.split(",").map((x) => x.trim()).filter(Boolean),
    spin_sound_url: $("eventSpinSound").value.trim(),
    win_sound_url: $("eventWinSound").value.trim(),
  };

  try {
    const data = await api("/admin/event", { method: "POST", body: payload });
    state.event = data.event;
    toast("Event settings saved", "success");
    await refresh();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function savePrizes() {
  const items = $("prizeEditor").value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!items.length) {
    toast("Add at least one prize line", "error");
    return;
  }
  try {
    await api("/api/prizes/set", { method: "POST", body: { items } });
    toast(`${items.length} prize slots saved and refilled`, "success");
    await refresh();
  } catch (error) {
    toast(error.message, "error");
  }
}

function bind() {
  $("adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("adminLoginButton");
    button.disabled = true;
    button.textContent = "Checking access…";
    $("adminLoginError").classList.add("hidden");
    try {
      const data = await login($("adminAccount").value.trim(), $("adminPass").value);
      state.apiKey = data.api_key;
      state.account = data.account || $("adminAccount").value.trim();
      sessionStorage.setItem(ADMIN.KEY, state.apiKey);
      localStorage.setItem(ADMIN.ACCOUNT, state.account);
      $("adminAccountName").textContent = state.account;
      showApp(true);
      await refresh();
    } catch (error) {
      $("adminLoginError").textContent = error.message;
      $("adminLoginError").classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.textContent = "Enter Control Room";
    }
  });

  $("showAdminPass").addEventListener("click", () => {
    const input = $("adminPass");
    input.type = input.type === "password" ? "text" : "password";
    $("showAdminPass").textContent = input.type === "password" ? "Show" : "Hide";
  });

  qa(".admin-nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });
  qa(".nav-shortcut").forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.target));
  });
  $("adminRefresh").addEventListener("click", refresh);
  $("adminLogout").addEventListener("click", () => logout());
  $("eventForm").addEventListener("submit", saveEvent);
  $("savePrizes").addEventListener("click", savePrizes);
  $("memberSearch").addEventListener("input", renderMembers);
}

async function boot() {
  bind();
  $("adminAccount").value = state.account;
  $("adminAccountName").textContent = state.account;
  const valid = await checkSession();
  showApp(valid);
  if (valid) {
    await refresh();
  }
}

boot();
