"use strict";

const ADMIN = {
  API_BASE: window.LUCKY77_API_BASE || "/backend",
  ACCOUNT: "lucky77_dashboard_account",
  SIDEBAR: "lucky77_sidebar_expanded_v6",
  YANGON_OFFSET_MINUTES: 390,
  REQUEST_TIMEOUT_MS: 20000,
};

const state = {
  account: localStorage.getItem(ADMIN.ACCOUNT) || "lucky77autospin",
  overview: null,
  event: null,
  posts: null,
  health: null,
  promos: [],
  branding: null,
  audit: [],
  claims: [],
  winners: [],
  historySearch: "",
  historyFilter: "all",
  testLinks: [],
  section: "overview",
};

const $ = (id) => document.getElementById(id);
const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const safe = (value) => value == null ? "" : String(value);
const number = (value) => Number(value || 0).toLocaleString("en-US");
function prizeNumber(value) {
  const n = Number(safe(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(value) {
  return `${Number(value || 0).toLocaleString("en-US")} Ks`;
}
function statusOfWinner(item) {
  return safe(item.cs_status || item.status || item.cs?.status || "pending") === "done" ? "done" : "pending";
}
function winnerAmount(item) {
  return prizeNumber(item.amount || item.prize || item.data?.amount);
}
function flattenWinner(item = {}) {
  const uid = safe(item.user_id || item.id || item.telegram_id);
  return {
    ...item,
    user_id: uid,
    id: uid,
    display: item.display || item.name || item.username || uid,
    cs_status: statusOfWinner(item),
    amount: winnerAmount(item),
  };
}
const esc = (value) => safe(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function cleanLoginValue(value, kind) {
  const text = safe(value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
  const label = kind === "account"
    ? /^(?:account)\s*[-:=]\s*/i
    : /^(?:api\s*pass|apipass|password)\s*[-:=]\s*/i;
  const matchingLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => label.test(line));
  return safe(matchingLine || text).replace(label, "").trim();
}

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isoToYangonInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + ADMIN.YANGON_OFFSET_MINUTES * 60000)
    .toISOString().slice(0, 16);
}

function yangonInputToIso(value) {
  const match = safe(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, y, m, d, hh, mm] = match;
  return new Date(
    Date.UTC(+y, +m - 1, +d, +hh, +mm) - ADMIN.YANGON_OFFSET_MINUTES * 60000
  ).toISOString();
}

function toast(message, type = "info") {
  const node = $("adminToast");
  node.textContent = safe(message);
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3400);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN.REQUEST_TIMEOUT_MS);
  const isFormData = options.body instanceof FormData;
  const headers = { ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}) };
  try {
    const response = await fetch(`${ADMIN.API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? isFormData ? options.body : JSON.stringify(options.body) : undefined,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      logout(false);
      throw new Error("Session expired. Please log in again.");
    }
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Backend connection timed out. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Backend connection failed. Redeploy the Vercel frontend proxy.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function login(account, pass) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${ADMIN.API_BASE}/auth/login`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, api_pass: pass }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || "Login failed");
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Login connection timed out.");
    if (error instanceof TypeError) {
      throw new Error("Login backend connection failed. Redeploy the complete Vercel folder.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function showApp(show) {
  $("adminLogin").classList.toggle("hidden", show);
  $("adminApp").classList.toggle("hidden", !show);
}

async function logout(showMessage = true) {
  try {
    await fetch(`${ADMIN.API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch (_) {}
  showApp(false);
  if (showMessage) toast("Logged out");
}

async function checkSession() {
  try { await api("/auth/check"); return true; } catch (_) { return false; }
}

function setSidebar(expanded) {
  const app = $("adminApp");
  app.classList.toggle("sidebar-expanded", expanded);
  localStorage.setItem(ADMIN.SIDEBAR, expanded ? "1" : "0");
  if (window.innerWidth < 860) {
    app.classList.toggle("mobile-sidebar-open", expanded);
  }
}

function switchSection(section) {
  state.section = section;
  qa(".admin-section").forEach((node) =>
    node.classList.toggle("hidden", node.id !== `adminSection-${section}`));
  qa(".admin-nav-btn").forEach((button) =>
    button.classList.toggle("is-active", button.dataset.section === section));
  const titles = {
    overview: "Event Overview",
    event: "Event Timeline",
    prizes: "Prize Inventory",
    members: "Registered Members",
    promo: "Promo Codes",
    test: "Test Event",
    branding: "Branding & Media",
    inbox: "CS Inbox",
    posts: "Channel Posts",
    history: "Winner History",
    reports: "Reports & Claims",
    command: "Bot Command Box",
    system: "System Health",
  };
  $("adminPageTitle").textContent = titles[section] || "Lucky77 Control";
  if (section === "inbox") {
    const frame = $("csInboxFrame");
    if (frame && !frame.dataset.loaded) {
      frame.src = frame.dataset.src;
      frame.dataset.loaded = "1";
    }
  }
  if (window.innerWidth < 860) setSidebar(false);
}

function applyTheme(event) {
  document.body.dataset.theme = event?.theme || "sky-white";
  if (event?.accent) document.documentElement.style.setProperty("--accent", event.accent);
  if (event?.accent_2) document.documentElement.style.setProperty("--accent-2", event.accent_2);
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
  applyTheme(event);
  $("overviewTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("overviewSubtitle").textContent = `${event.subtitle || ""} · ${safe(event.phase || "registration").toUpperCase()}`;
  const live = !!event.event_live;
  $("overviewLive").classList.toggle("is-live", live);
  $("overviewLive").classList.toggle("is-waiting", !live);
  $("overviewLive").querySelector("span").textContent = live ? "EVENT LIVE" : `EVENT ${safe(event.phase || "waiting").toUpperCase()}`;
  $("overviewIssue").textContent = event.lifecycle_error || "";
  $("overviewIssue").classList.toggle("hidden", !event.lifecycle_error);

  $("adminMetricRegistered").textContent = number(counts.registered);
  $("adminMetricLive").textContent = number(counts.live_registered);
  $("adminMetricPending").textContent = number(counts.pending_accounts);
  $("adminMetricCodes").textContent = number(counts.codes_sent);
  $("adminMetricSpun").textContent = number(counts.spun);
  $("adminMetricPrizes").textContent = number(counts.prizes_left);

  const history = data.recent_history || [];
  $("overviewWinners").innerHTML = history.length
    ? history.slice(0, 6).map((item) => `<article>
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
    ? `${number(left)} of ${number(total)} prize slots remain. Live registration requires ${number(counts.live_registered)} exact slots.`
    : "Add one prize line for each live registered member.";
}

function renderEventForm() {
  const event = state.event || {};
  $("eventRegistrationOpen").checked = !!event.registration_open;
  $("eventLive").checked = !!event.event_live;
  $("eventAutoStart").checked = event.auto_start !== false;
  $("eventAutoEnd").checked = event.auto_end !== false;
  $("eventRequireAccount").checked = event.require_account !== false;
  $("eventRequireCode").checked = event.require_unique_code !== false;
  $("eventId").value = safe(event.event_id);
  $("nextEventId").value = safe(event.next_event_id);
  $("eventStartsAt").value = isoToYangonInput(event.starts_at);
  $("eventEndsAt").value = isoToYangonInput(event.ends_at);
  $("nextEventStartsAt").value = isoToYangonInput(event.next_starts_at);
  $("nextEventEndsAt").value = isoToYangonInput(event.next_ends_at);
  $("eventGameLink").value = safe(event.game_link);
  $("eventTestLink").value = safe(event.test_link || `${location.origin}/test/preview`);
  $("eventSelfSignupLink").value = safe(event.self_signup_link);
  $("eventCsLink").value = safe(event.cs_link);
  const testLink = safe(event.test_link || `${location.origin}/test/preview`);
  $("testLinkUrl").value = testLink;
  $("testOpenLink").href = testLink;
  $("eventTitleInput").value = safe(event.title);
  $("eventSubtitleInput").value = safe(event.subtitle);
  $("eventAnnouncement").value = safe(event.announcement);
  $("eventBannerUrl").value = safe(event.banner_image_url);
  $("eventTheme").value = safe(event.theme || "sky-white");
  $("eventAccent").value = safe(event.accent || "#3478f6");
  $("eventAccent2").value = safe(event.accent_2 || "#86b5ff");
  $("eventWheelColors").value = Array.isArray(event.wheel_colors) ? event.wheel_colors.join(", ") : "";
  $("eventSpinSound").value = safe(event.spin_sound_url);
  $("eventWinSound").value = safe(event.win_sound_url);
  $("eventPhaseText").textContent = `Phase: ${safe(event.phase || "registration")} · Timezone: Asia/Yangon`;
  $("eventLifecycleError").textContent = event.lifecycle_error || "";
  $("eventLifecycleError").classList.toggle("hidden", !event.lifecycle_error);
}

function renderPrizes() {
  const prizes = state.overview?.prizes || {};
  const counts = state.overview?.counts || {};
  const configured = prizes.source?.length || 0;
  const required = counts.live_registered || 0;
  $("prizeEditor").value = Array.isArray(prizes.source) ? prizes.source.join("\n") : "";
  $("prizeSourceCount").textContent = number(configured);
  $("prizeRequiredCount").textContent = number(required);
  $("prizeBagCount").textContent = number(prizes.bag?.length || 0);
  const matched = configured === required && required > 0;
  $("prizeMatchStatus").className = `inventory-match-card ${matched ? "is-good" : "is-warning"}`;
  $("prizeMatchStatus").innerHTML = matched
    ? `<strong>Ready to freeze</strong><span>${number(configured)} prize slots match ${number(required)} live members.</span>`
    : `<strong>Action required</strong><span>${number(configured)} prize slots configured; ${number(required)} required. Pending-account members count. Test members do not.</span>`;
}

function renderMembers() {
  const term = $("memberSearch").value.trim().toLowerCase();
  const members = (state.overview?.members || []).filter((member) =>
    !term || [member.display, member.name, member.username, member.user_id, member.access?.account_name, member.access?.phone]
      .join(" ").toLowerCase().includes(term));
  $("memberTable").innerHTML = members.length ? members.map((member) => {
    const access = member.access || {};
    const uid = member.user_id || member.id || "";
    return `<tr>
      <td><div class="table-person"><span>${esc((member.display || member.name || "77").slice(0, 2).toUpperCase())}</span><div><strong>${esc(member.display || member.name || "Member")}</strong><small>${member.username ? `@${esc(safe(member.username).replace(/^@/, ""))}` : esc(uid)}</small></div></div></td>
      <td><strong>${esc(access.account_name || "Pending")}</strong><small class="table-sub">${esc(access.phone || "No phone")}</small></td>
      <td><span class="table-status ${access.promo_sent_at ? "is-good" : "is-waiting"}">${access.code_redeemed ? "Used" : access.promo_sent_at ? "Sent" : "Waiting"}</span></td>
      <td><button class="table-mode-btn ${access.test_member ? "is-test" : ""}" data-action="test" data-user-id="${esc(uid)}" data-test="${access.test_member ? "0" : "1"}">${access.test_member ? "Test" : "Live"}</button></td>
      <td><span class="table-status ${access.account_ready ? "is-good" : "is-waiting"}">${access.account_ready ? "Ready" : "Account pending"}</span></td>
      <td><button class="table-remove-btn" data-action="remove" data-user-id="${esc(uid)}">Remove</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty-copy">No registered member matches this search.</div></td></tr>`;
}

function filteredHistory() {
  const term = safe(state.historySearch).trim().toLowerCase();
  const filter = state.historyFilter || "all";
  let list = [...(state.winners || [])];
  if (!list.length) list = (state.overview?.recent_history || []).map(flattenWinner);
  if (filter === "done") list = list.filter((item) => statusOfWinner(item) === "done");
  if (filter === "undone") list = list.filter((item) => statusOfWinner(item) !== "done");
  if (term) {
    list = list.filter((item) => [
      item.name, item.display, item.username, item.user_id, item.telegram_id,
      item.prize, item.amount, item.turn
    ].map(safe).join(" ").toLowerCase().includes(term));
  }
  return list.sort((a, b) => {
    const at = safe(a.last_message_at || a.at || a.created_at);
    const bt = safe(b.last_message_at || b.at || b.created_at);
    if (bt !== at) return bt.localeCompare(at);
    return Number(b.turn || 0) - Number(a.turn || 0);
  });
}

function renderHistorySummary() {
  const all = state.winners || [];
  const done = all.filter((item) => statusOfWinner(item) === "done");
  setText("historySummaryTotal", all.length);
  setText("historySummaryDone", done.length);
  setText("historySummaryUndone", Math.max(0, all.length - done.length));
  setText("historySummaryAmount", money(done.reduce((sum, item) => sum + winnerAmount(item), 0)));
}

function renderHistory() {
  const history = filteredHistory();
  renderHistorySummary();
  $("historyTable").innerHTML = history.length ? history.map((item) => {
    const done = statusOfWinner(item) === "done";
    const uid = safe(item.user_id || item.id || item.telegram_id);
    return `<tr>
      <td class="mono">#${esc(item.turn || "-")}</td>
      <td><div class="table-person"><span>${esc((item.display || item.name || "77").slice(0, 2).toUpperCase())}</span><div><strong>${esc(item.display || item.name || "Lucky Member")}</strong><small>${esc(uid)}</small></div></div></td>
      <td><strong class="prize-text">${esc(item.prize || "-")}</strong></td>
      <td>${item.username ? `@${esc(safe(item.username).replace(/^@/, ""))}` : "-"}</td>
      <td><span class="table-status ${done ? "is-good" : "is-waiting"}">${done ? "Done" : "Undone"}</span></td>
      <td>${esc(dateText(item.at || item.created_at || item.last_message_at))}</td>
      <td><button class="table-mode-btn ${done ? "" : "is-test"}" data-history-status="${done ? "pending" : "done"}" data-user-id="${esc(uid)}">${done ? "Undone ပြန်လုပ်မည်" : "ယူနစ်ဖြည့်ပြီး Done"}</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty-copy">No winner history yet.</div></td></tr>`;
}

async function updateWinnerStatusFromHistory(button) {
  const uid = safe(button.dataset.userId).trim();
  const status = button.dataset.historyStatus === "done" ? "done" : "pending";
  if (!uid) return;
  button.disabled = true;
  try {
    await api("/winner/status", { method: "POST", body: { user_id: uid, status } });
    state.winners = state.winners.map((item) => safe(item.user_id) === uid ? { ...item, cs_status: status, status } : item);
    renderHistory();
    toast(status === "done" ? "ယူနစ်ဖြည့်ပြီး Done" : "Undone ပြန်လုပ်ပြီး", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function renderPosts() {
  const posts = state.posts?.settings || state.posts || {};
  $("registerCaption").value = safe(posts.register_caption);
  $("registerButton").value = safe(posts.register_button || "Register");
  $("channelCaption").value = safe(posts.channel_caption);
  $("channelButton").value = safe(posts.channel_button || "Join Now");
  const staged = state.posts?.staged || {};
  $("channelStageStatus").innerHTML = `<strong>Staged media: ${staged.file?.file_id ? "Ready" : "None"}</strong><span>Use the existing Telegram owner command to stage media, then upload the channel post.</span>`;
}

function renderSystem() {
  const health = state.health || {};
  const redis = health.redis || {};
  const supabase = health.supabase || {};
  $("systemHealthCards").innerHTML = [
    ["Backend", health.ok ? "Online" : "Offline"],
    ["Version", health.version || "6.4.4"],
    ["Redis slot", redis.slot || health.redis_slot || "-"],
    ["Supabase", supabase.ready ? "Ready" : supabase.configured ? "Configured" : "Not configured"],
    ["Timezone", "Asia/Yangon"],
    ["Lifecycle", "30-second runner"],
  ].map(([label, value]) => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
}

function renderPromo() {
  const promos = Array.isArray(state.promos) ? state.promos : [];
  $("promoCount").textContent = number(promos.length);
  $("promoTable").innerHTML = promos.length ? promos.map((promo) => `<tr>
    <td><strong>${esc(promo.name || promo.username || promo.user_id || "-")}</strong><small class="table-sub">${esc(promo.user_id || "")}</small></td>
    <td class="mono">${esc(promo.code || "Not generated")}</td>
    <td><span class="table-status ${promo.status === "used" ? "is-good" : "is-waiting"}">${esc(promo.status || "draft")}</span></td>
    <td>${number(promo.spin_used)} / ${number(promo.spin_total)}</td>
    <td>${esc(dateText(promo.expires_at))}</td>
  </tr>`).join("") : `<tr><td colspan="5"><div class="empty-copy">No promo codes generated yet.</div></td></tr>`;
}

function renderBranding() {
  const branding = state.branding?.draft || state.branding?.published || {};
  $("brandingLogoUrl").value = safe(branding.logo_url || "./assets/lucky77-logo.png");
  $("brandingPrimary").value = safe(branding.primary || "#087eea");
  $("brandingSecondary").value = safe(branding.secondary || "#04c7f2");
  $("brandingText").value = safe(branding.text || "#06233a");
  $("brandingPreview").src = $("brandingLogoUrl").value || "./assets/lucky77-logo.png";
}

function renderReports() {
  $("auditTable").innerHTML = state.audit.length ? state.audit.map((item) => `<tr>
    <td>${esc(dateText(item.created_at || item.at))}</td>
    <td>${esc(item.actor || "-")}</td>
    <td>${esc(item.action || "-")}</td>
    <td>${esc(item.target || "-")}</td>
  </tr>`).join("") : `<tr><td colspan="4"><div class="empty-copy">No audit records yet.</div></td></tr>`;
  $("claimsTable").innerHTML = state.claims.length ? state.claims.map((item) => `<tr>
    <td class="mono">${esc(item.id || "-")}</td>
    <td>${esc(item.user_id || "-")}</td>
    <td>${esc(item.prize || item.data?.prize || "-")}</td>
    <td><span class="table-status ${item.status === "paid" ? "is-good" : "is-waiting"}">${esc(item.status || "pending")}</span></td>
  </tr>`).join("") : `<tr><td colspan="4"><div class="empty-copy">No claims yet.</div></td></tr>`;
}

function renderAll() {
  renderOverview();
  renderEventForm();
  renderPrizes();
  renderMembers();
  renderHistory();
  renderPosts();
  renderPromo();
  renderBranding();
  renderReports();
  renderSystem();
}

async function safeApi(path, fallback = {}) {
  try {
    return { ok: true, data: await api(path), path };
  } catch (error) {
    console.warn(`[Lucky77 Admin] ${path} failed`, error);
    return { ok: false, data: fallback, path, error };
  }
}

async function refresh() {
  $("adminRefresh").disabled = true;
  try {
    const [overviewRes, eventRes, postsRes, stagedRes, healthRes, promoRes, brandingRes, auditRes, claimsRes, winnersRes] = await Promise.all([
      safeApi("/admin/overview", state.overview || {}),
      safeApi("/admin/event", { event: state.event || {} }),
      safeApi("/settings/posts", state.posts?.settings || {}),
      safeApi("/channel/post/staged", state.posts?.staged || {}),
      safeApi("/health/full", state.health || { ok: false }),
      safeApi("/admin/promos", { promos: state.promos || [] }),
      safeApi("/admin/branding", state.branding || {}),
      safeApi("/admin/audit?limit=100", { logs: state.audit || [] }),
      safeApi("/admin/claims?limit=200", { claims: state.claims || [] }),
      safeApi("/winners/cs", { winners: state.winners || [] }),
    ]);

    const overview = overviewRes.data || {};
    const eventPack = eventRes.data || {};
    const posts = postsRes.data || {};
    const staged = stagedRes.data || {};
    const health = healthRes.data || {};
    const promoPack = promoRes.data || {};
    const branding = brandingRes.data || {};
    const auditPack = auditRes.data || {};
    const claimsPack = claimsRes.data || {};
    const winnersPack = winnersRes.data || {};

    state.overview = overview;
    state.event = eventPack.event || state.event || {};
    state.posts = { settings: posts.settings || posts || state.posts?.settings || {}, staged: staged.staged || staged || state.posts?.staged || {} };
    state.health = health;
    state.promos = promoPack.promos || state.promos || [];
    state.branding = branding || state.branding || {};
    state.audit = auditPack.logs || state.audit || [];
    state.claims = claimsPack.claims || state.claims || [];
    state.winners = (winnersPack.winners || state.winners || []).map(flattenWinner);

    const backendOnline = !!(healthRes.ok && (health.ok || health.version || health.mode));
    const usefulDataLoaded = [overviewRes, eventRes, winnersRes, promoRes].some((r) => r.ok);
    renderHealth(backendOnline || usefulDataLoaded);
    renderAll();

    const failed = [overviewRes, eventRes, postsRes, stagedRes, healthRes, promoRes, brandingRes, auditRes, claimsRes, winnersRes].filter((r) => !r.ok);
    if (failed.length) toast(`Partial refresh: ${failed.length} endpoint(s) retrying. Old data kept.`, "info");
  } finally {
    $("adminRefresh").disabled = false;
  }
}

function eventPayload() {
  return {
    registration_open: $("eventRegistrationOpen").checked,
    event_live: $("eventLive").checked,
    auto_start: $("eventAutoStart").checked,
    auto_end: $("eventAutoEnd").checked,
    require_account: $("eventRequireAccount").checked,
    require_unique_code: $("eventRequireCode").checked,
    event_id: $("eventId").value.trim(),
    next_event_id: $("nextEventId").value.trim(),
    starts_at: yangonInputToIso($("eventStartsAt").value),
    ends_at: yangonInputToIso($("eventEndsAt").value),
    next_starts_at: yangonInputToIso($("nextEventStartsAt").value),
    next_ends_at: yangonInputToIso($("nextEventEndsAt").value),
    game_link: $("eventGameLink").value.trim(),
    test_link: $("eventTestLink").value.trim(),
    self_signup_link: $("eventSelfSignupLink").value.trim(),
    cs_link: $("eventCsLink").value.trim(),
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
}

async function saveEvent(event) {
  event.preventDefault();
  try {
    const data = await api("/admin/event", { method: "POST", body: eventPayload() });
    state.event = data.event;
    toast("Event settings saved in Asia/Yangon time", "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function eventAction(path, success, body = {}) {
  try {
    await api(path, { method: "POST", body });
    toast(success, "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); await refresh(); }
}

async function savePrizes() {
  const items = $("prizeEditor").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!items.length) return toast("Add at least one prize line", "error");
  try {
    await api("/api/prizes/set", { method: "POST", body: { items } });
    toast(`${items.length} prize slots saved`, "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function savePostSettings(event) {
  event.preventDefault();
  try {
    await api("/settings/posts", { method: "POST", body: {
      register_caption: $("registerCaption").value,
      register_button: $("registerButton").value,
      channel_caption: $("channelCaption").value,
      channel_button: $("channelButton").value,
    }});
    toast("Post settings saved", "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

function commaIds(value) {
  return safe(value).split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
}

async function generatePromos() {
  try {
    const target = $("promoTarget").value;
    const data = await api("/admin/promos/generate", {
      method: "POST",
      body: {
        event_id: state.event?.event_id,
        target,
        user_ids: commaIds($("promoUserIds").value),
        spin_total: Number($("promoSpinTotal").value || 1),
        starts_at: yangonInputToIso($("promoStartsAt").value),
        expires_at: yangonInputToIso($("promoExpiresAt").value),
      },
    });
    toast(`${number(data.generated)} promo codes generated`, "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function sendPromos() {
  try {
    const selected = $("promoTarget").value === "selected"
      ? commaIds($("promoUserIds").value)
      : undefined;
    const data = await api("/admin/promos/send", {
      method: "POST",
      body: { event_id: state.event?.event_id, user_ids: selected },
    });
    toast(`${number(data.delivered)} delivered · ${number(data.failed)} failed`, data.failed ? "info" : "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function copyTestLink() {
  try {
    const link = $("testLinkUrl").value.trim() || `${location.origin}/test/preview`;
    await navigator.clipboard.writeText(link);
    toast("Test Link ကို ကူးယူပြီးပါပြီ", "success");
  } catch (error) { toast(error.message, "error"); }
}

function brandingPayload() {
  return {
    logo_url: $("brandingLogoUrl").value.trim(),
    login_logo_url: $("brandingLogoUrl").value.trim(),
    member_logo_url: $("brandingLogoUrl").value.trim(),
    inbox_logo_url: $("brandingLogoUrl").value.trim(),
    wheel_center_logo_url: $("brandingLogoUrl").value.trim(),
    primary: $("brandingPrimary").value,
    secondary: $("brandingSecondary").value,
    text: $("brandingText").value,
  };
}

async function uploadBrandingAsset() {
  const file = $("brandingFile").files?.[0];
  if (!file) return toast("Choose an asset first", "error");
  const form = new FormData();
  form.append("file", file);
  form.append("kind", file.type.split("/")[0] || "file");
  try {
    const data = await api("/admin/assets/upload", { method: "POST", body: form });
    $("brandingLogoUrl").value = data.asset?.url || "";
    $("brandingPreview").src = data.asset?.url || "./assets/lucky77-logo.png";
    toast("Asset uploaded", "success");
  } catch (error) { toast(error.message, "error"); }
}

async function saveBrandingDraft() {
  try {
    await api("/admin/branding/draft", { method: "POST", body: { branding: brandingPayload() } });
    toast("Branding draft saved", "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function publishBranding() {
  try {
    await api("/admin/branding/draft", { method: "POST", body: { branding: brandingPayload() } });
    await api("/admin/branding/publish", { method: "POST", body: {} });
    toast("Branding published", "success");
    await refresh();
  } catch (error) { toast(error.message, "error"); }
}

async function memberAction(button) {
  const uid = button.dataset.userId;
  if (button.dataset.action === "remove") {
    if (!confirm("Remove this member from current/next event registration? Permanent member memory will be kept.")) return;
    await eventAction("/admin/member/remove", "Member removed from event", { user_id: uid });
  } else if (button.dataset.action === "test") {
    await eventAction("/admin/member/test", "Member mode updated", {
      user_id: uid,
      test_member: button.dataset.test === "1",
    });
  }
}


function commandRoleFor(text) {
  const raw = safe(text).toLowerCase();
  if (/token|secret|database|restore|mass delete|delete all|owner/i.test(raw)) return "owner";
  if (/publish|send|post|broadcast|invite|register.*send|close|open|lock|start/i.test(raw)) return "confirm";
  return "read";
}

function appendCommandMessage(kind, html) {
  const log = $("commandChatLog");
  if (!log) return;
  const node = document.createElement("article");
  node.className = `command-message is-${kind}`;
  node.innerHTML = html;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
}

function renderCommandWelcome() {
  const log = $("commandChatLog");
  if (!log || log.dataset.ready) return;
  log.dataset.ready = "1";
  appendCommandMessage("system", `
    <strong>Lucky77 Safe Command Box</strong>
    <p>AI မပါသေးသော Non-AI Base ဖြစ်သည်။ Dashboard Login ဝင်ထားသော Admin command များသာ Preview/Confirm flow သုံးနိုင်သည်။ Member-facing Telegram Bot မှ Admin command မလုပ်နိုင်ပါ။</p>
  `);
}

function commandMockReply(text, file) {
  const role = commandRoleFor(text);
  const members = state.overview?.counts || {};
  if (/regstatus|register|member/i.test(text)) {
    return {
      role,
      title: "Registration status checked",
      body: `လက်ရှိ Event Registered ${number(members.registered)} · Live ${number(members.live_registered)} · Spin ပြီး ${number(members.spun)} · Account pending ${number(members.pending_account)} ဖြစ်သည်။`,
      action: role === "confirm" ? "Registration invite preview ready. Confirm လုပ်မှ Telegram ပို့မည်။" : "Read-only status only.",
    };
  }
  if (/health|error|system/i.test(text)) {
    const status = state.health?.status || "partial";
    return {
      role: "read",
      title: "System diagnosis",
      body: `Health status: ${esc(status)}. Bot/Webhook/Supabase/Redis/Storage တစ်ခုချင်းစီကို System page တွင်စစ်ပါ။ Secret values မပြပါ။`,
      action: "Retry/Recheck action only; destructive action မလုပ်ပါ။",
    };
  }
  if (/post|channel|caption|button|link|broadcast/i.test(text)) {
    return {
      role: "confirm",
      title: "Channel post draft ready",
      body: `Caption draft + Spin Now button ကို Preview ပြထားသည်${file ? ` · attachment: ${esc(file.name)}` : ""}. Confirm & Publish မနှိပ်မချင်း main channel သို့မပို့ပါ။`,
      action: "Preview → Confirm & Publish → Telegram message id + audit log.",
      buttons: ["Spin Now", "Join Channel"],
    };
  }
  return {
    role,
    title: "Command parsed",
    body: `ဒီ request ကို safe preview အဖြစ်ဖတ်ပြီးထားသည်: “${esc(text)}”${file ? ` · attachment: ${esc(file.name)}` : ""}`,
    action: role === "read" ? "No write action required." : "Admin confirmation required before any write action.",
  };
}

function showPendingAction(reply) {
  const card = $("pendingActionCard");
  if (!card) return;
  card.classList.toggle("hidden", reply.role !== "confirm");
  if (reply.role !== "confirm") return;
  $("pendingActionTitle").textContent = reply.title;
  $("pendingActionCopy").textContent = reply.body;
  $("pendingActionButtons").innerHTML = (reply.buttons || ["Confirm"])
    .map((item) => `<span>${esc(item)}</span>`).join("");
}

function submitCommandBox(event) {
  event.preventDefault();
  const input = $("commandInput");
  const file = $("commandFile")?.files?.[0] || null;
  const text = input.value.trim();
  if (!text && !file) return toast("Command သို့ attachment ထည့်ပါ", "error");
  appendCommandMessage("admin", `<strong>Admin</strong><p>${esc(text || "[Attachment only]")}</p>${file ? `<small>Attached: ${esc(file.name)}</small>` : ""}`);
  const reply = commandMockReply(text, file);
  const badge = reply.role === "read" ? "READ" : reply.role === "confirm" ? "CONFIRM REQUIRED" : "OWNER ONLY";
  appendCommandMessage("bot", `<strong>${esc(reply.title)} <em>${badge}</em></strong><p>${reply.body}</p><small>${esc(reply.action)}</small>`);
  showPendingAction(reply);
  input.value = "";
  $("commandFile").value = "";
  $("commandAttachmentPreview").classList.add("hidden");
}

function bindCommandBox() {
  renderCommandWelcome();
  qa(".command-template").forEach((button) => button.addEventListener("click", () => {
    $("commandInput").value = button.dataset.template || "";
    $("commandInput").focus();
  }));
  $("commandForm")?.addEventListener("submit", submitCommandBox);
  $("commandFile")?.addEventListener("change", () => {
    const file = $("commandFile").files?.[0];
    const node = $("commandAttachmentPreview");
    if (!file) return node.classList.add("hidden");
    node.textContent = `${file.name} · ${Math.ceil(file.size / 1024)} KB staged for preview`;
    node.classList.remove("hidden");
  });
  $("confirmMockAction")?.addEventListener("click", () => {
    appendCommandMessage("system", `<strong>Mock publish blocked</strong><p>Production တွင် Backend confirmation endpoint နှင့် audit log ချိတ်ပြီးမှ Telegram သို့ပို့မည်။ ယခု Non-AI Base preview တွင် real post မပို့ပါ။</p>`);
    $("pendingActionCard").classList.add("hidden");
    toast("Preview confirmed · real send disabled in base build", "success");
  });
  $("cancelMockAction")?.addEventListener("click", () => {
    $("pendingActionCard").classList.add("hidden");
    appendCommandMessage("system", `<strong>Action cancelled</strong><p>Pending channel/broadcast action ကိုဖျက်လိုက်သည်။</p>`);
  });
}

function bind() {
  $("adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("adminLoginButton");
    button.disabled = true;
    $("adminLoginError").classList.add("hidden");
    try {
      const account = cleanLoginValue($("adminAccount").value, "account");
      const pass = cleanLoginValue($("adminPass").value, "pass");
      const data = await login(account, pass);
      state.account = data.account || account;
      localStorage.setItem(ADMIN.ACCOUNT, state.account);
      $("adminAccountName").textContent = state.account;
      showApp(true);
      await refresh();
    } catch (error) {
      $("adminLoginError").textContent = error.message;
      $("adminLoginError").classList.remove("hidden");
    } finally { button.disabled = false; }
  });
  $("showAdminPass").addEventListener("click", () => {
    const input = $("adminPass");
    input.type = input.type === "password" ? "text" : "password";
    $("showAdminPass").textContent = input.type === "password" ? "ပြမည်" : "ဖျောက်မည်";
  });
  qa(".admin-nav-btn").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.section)));
  qa(".nav-shortcut").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.target)));
  $("sidebarToggle").addEventListener("click", () => setSidebar(!$("adminApp").classList.contains("sidebar-expanded")));
  $("sidebarCollapse").addEventListener("click", () => setSidebar(false));
  $("sidebarOverlay").addEventListener("click", () => setSidebar(false));
  $("adminRefresh").addEventListener("click", refresh);
  $("adminLogout").addEventListener("click", () => logout());
  $("eventForm").addEventListener("submit", saveEvent);
  $("savePrizes").addEventListener("click", savePrizes);
  $("postSettingsForm").addEventListener("submit", savePostSettings);
  $("promoGenerate").addEventListener("click", generatePromos);
  $("promoSend").addEventListener("click", sendPromos);
  $("testCopyLink").addEventListener("click", copyTestLink);
  $("reloadInboxFrame").addEventListener("click", () => {
    const frame = $("csInboxFrame");
    frame.src = frame.dataset.src;
    frame.dataset.loaded = "1";
  });
  $("brandingUpload").addEventListener("click", uploadBrandingAsset);
  $("brandingSaveDraft").addEventListener("click", saveBrandingDraft);
  $("brandingPublish").addEventListener("click", publishBranding);
  $("brandingLogoUrl").addEventListener("input", () => {
    $("brandingPreview").src = $("brandingLogoUrl").value || "./assets/lucky77-logo.png";
  });
  $("historySearch")?.addEventListener("input", (event) => { state.historySearch = event.target.value; renderHistory(); });
  $("historyStatusFilter")?.addEventListener("change", (event) => { state.historyFilter = event.target.value || "all"; renderHistory(); });
  $("historyTable")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-status]");
    if (button) updateWinnerStatusFromHistory(button);
  });
  $("memberSearch").addEventListener("input", renderMembers);
  $("memberTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) memberAction(button).catch((error) => toast(error.message, "error"));
  });
  $("reconcileMembers").addEventListener("click", () => eventAction("/admin/members/reconcile", "Channel membership checked"));
  $("freezeStartEvent").addEventListener("click", () => {
    if (confirm("Freeze registration, verify channel membership, match prizes and start now?")) {
      eventAction("/admin/event/freeze", "Event started");
    }
  });
  $("endEventNow").addEventListener("click", () => {
    if (confirm("End the current event now?")) eventAction("/admin/event/end", "Event ended");
  });
  $("rolloverEventNow").addEventListener("click", () => {
    if (confirm("Archive current event and promote next-event pre-registrations?")) {
      eventAction("/admin/event/rollover", "Next event promoted");
    }
  });
  $("eventTheme").addEventListener("change", () => applyTheme({ ...state.event, theme: $("eventTheme").value }));
  bindCommandBox();
}

async function boot() {
  bind();
  $("adminAccount").value = state.account;
  $("adminAccountName").textContent = state.account;
  setSidebar(localStorage.getItem(ADMIN.SIDEBAR) === "1");
  const valid = await checkSession();
  showApp(valid);
  if (valid) await refresh();
}

boot();
