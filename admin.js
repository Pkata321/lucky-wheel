"use strict";

const API_BASE_META = document.querySelector('meta[name="lucky77-api-base"]')?.content || "";
const API_BASE = API_BASE_META.includes("%VITE_")
  ? location.origin
  : API_BASE_META.replace(/\/+$/, "") || location.origin;

const ADMIN = {
  API_BASE,
  ACCOUNT: "lucky77_dashboard_account",
  SIDEBAR: "lucky77_sidebar_expanded_v6",
  YANGON_OFFSET_MINUTES: 390,
  REQUEST_TIMEOUT_MS: 12_000,
};

const state = {
  apiKey: "",
  account: localStorage.getItem(ADMIN.ACCOUNT) || "lucky77autospin",
  overview: null,
  event: null,
  posts: null,
  health: null,
  promos: [],
  branding: null,
  audit: [],
  section: "overview",
};

const $ = (id) => document.getElementById(id);
const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const safe = (value) => value == null ? "" : String(value);
const number = (value) => Number(value || 0).toLocaleString("en-US");
const esc = (value) => safe(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN.REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please retry.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}) };
  const response = await fetchWithTimeout(`${ADMIN.API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
    cache: "no-store",
    credentials: "include",
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
}

async function login(account, pass) {
  const response = await fetchWithTimeout(`${ADMIN.API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, api_pass: pass }),
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "Login failed");
  return data;
}

function showApp(show) {
  $("adminLogin").classList.toggle("hidden", show);
  $("adminApp").classList.toggle("hidden", !show);
}

async function logout(showMessage = true) {
  try {
    await fetchWithTimeout(`${ADMIN.API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (_) {}
  state.apiKey = "";
  showApp(false);
  if (showMessage) toast("Logged out");
}

async function checkSession() {
  try {
    await api("/auth/check");
    state.apiKey = "secure-cookie";
    return true;
  } catch (_) {
    return false;
  }
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
    posts: "Channel Posts",
    history: "Winner History",
    audit: "Activity History",
    system: "System Health",
  };
  $("adminPageTitle").textContent = titles[section] || "Lucky77 Control";
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

function renderHistory() {
  const history = state.overview?.recent_history || [];
  $("historyTable").innerHTML = history.length ? history.map((item) => `<tr>
    <td class="mono">#${esc(item.turn || "-")}</td>
    <td><div class="table-person"><span>${esc((item.display || item.name || "77").slice(0, 2).toUpperCase())}</span><div><strong>${esc(item.display || item.name || "Lucky Member")}</strong><small>${esc(item.user_id || "")}</small></div></div></td>
    <td><strong class="prize-text">${esc(item.prize || "-")}</strong></td>
    <td>${item.username ? `@${esc(safe(item.username).replace(/^@/, ""))}` : "-"}</td>
    <td>${esc(dateText(item.at))}</td>
  </tr>`).join("") : `<tr><td colspan="5"><div class="empty-copy">No winner history yet.</div></td></tr>`;
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

function renderPromos() {
  const promos = state.promos || [];
  $("promoCount").textContent = number(promos.length);
  $("promoTable").innerHTML = promos.length ? promos.map((promo) => `<tr>
    <td><strong>${esc(promo.name || promo.username || promo.user_id)}</strong><small class="table-sub">${esc(promo.user_id)}</small></td>
    <td class="mono">${esc(promo.code || "Not generated")}</td>
    <td><span class="table-status ${promo.status === "used" ? "is-good" : "is-waiting"}">${esc(promo.status || "draft")}</span></td>
    <td>${esc(`${promo.spin_used || 0}/${promo.spin_total || 1}`)}</td>
    <td>${esc(dateText(promo.expires_at))}</td>
  </tr>`).join("") : `<tr><td colspan="5"><div class="empty-copy">Promo Code မရှိသေးပါ။</div></td></tr>`;
  if (!$("promoStartsAt").value) $("promoStartsAt").value = isoToYangonInput(new Date().toISOString());
  if (!$("promoExpiresAt").value) $("promoExpiresAt").value = isoToYangonInput(state.event?.ends_at);
}

function renderBranding() {
  const branding = state.branding?.draft || state.branding?.published || {};
  $("brandingPrimary").value = safe(branding.primary || "#087eea");
  $("brandingSecondary").value = safe(branding.secondary || "#04c7f2");
  $("brandingBackgroundAudio").value = safe(branding.audio?.background_url);
  $("brandingSpinAudio").value = safe(branding.audio?.spin_url);
  $("brandingWinnerAudio").value = safe(branding.audio?.winner_url);
  $("brandingVolume").value = Number(branding.audio?.volume ?? 0.65);
  const logo = branding.logo_url || "assets/lucky77-logo.png";
  const resolvedLogo = /^https?:\/\//i.test(logo)
    ? logo
    : new URL(`/${logo.replace(/^\/+/, "")}`, location.origin).href;
  $("brandingPreviewLogo").src = resolvedLogo;
  qa(".brand-logo").forEach((node) => { node.src = resolvedLogo; });
}

function renderAudit() {
  const logs = state.audit || [];
  $("auditTable").innerHTML = logs.length ? logs.map((item) => `<tr>
    <td>${esc(dateText(item.created_at))}</td>
    <td><strong>${esc(item.actor || "-")}</strong></td>
    <td>${esc(item.role || "-")}</td>
    <td class="mono">${esc(item.action || "-")}</td>
    <td>${esc(item.target || "-")}</td>
  </tr>`).join("") : `<tr><td colspan="5"><div class="empty-copy">Activity မရှိသေးပါ။</div></td></tr>`;
}

function renderSystem() {
  const health = state.health || {};
  const redis = health.redis || {};
  const supabase = health.supabase || {};
  $("systemHealthCards").innerHTML = [
    ["Backend", health.ok ? "Online" : "Offline"],
    ["Version", health.version || "6.1.0"],
    ["Redis slot", redis.slot || health.redis_slot || "-"],
    ["Supabase", supabase.ready ? "Ready" : supabase.configured ? "Configured" : "Not configured"],
    ["Timezone", "Asia/Yangon"],
    ["Lifecycle", "30-second runner"],
  ].map(([label, value]) => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
}

function renderAll() {
  renderOverview();
  renderEventForm();
  renderPrizes();
  renderMembers();
  renderHistory();
  renderPosts();
  renderPromos();
  renderBranding();
  renderAudit();
  renderSystem();
  if (!$("testExpiresAt").value) {
    $("testExpiresAt").value = isoToYangonInput(
      state.event?.ends_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    );
  }
  if (!$("testBaseUrl").value) $("testBaseUrl").value = location.origin;
}

async function refresh() {
  $("adminRefresh").disabled = true;
  try {
    const [overview, eventPack, posts, staged, health, promoPack, branding, auditPack] = await Promise.all([
      api("/admin/overview"), api("/admin/event"), api("/settings/posts"),
      api("/channel/post/staged"), api("/health/full"), api("/admin/promos"),
      api("/admin/branding"), api("/admin/audit?limit=100"),
    ]);
    state.overview = overview;
    state.event = eventPack.event || {};
    state.posts = { settings: posts.settings || posts, staged: staged.staged || staged };
    state.health = health;
    state.promos = promoPack.promos || [];
    state.branding = branding;
    state.audit = auditPack.logs || [];
    renderHealth(true);
    renderAll();
  } catch (error) {
    renderHealth(false);
    toast(error.message, "error");
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

async function generatePromos() {
  const data = await api("/admin/promos/generate", {
    method: "POST",
    body: {
      event_id: state.event?.event_id,
      target: "registered",
      spin_total: Number($("promoSpinTotal").value || 1),
      starts_at: yangonInputToIso($("promoStartsAt").value),
      expires_at: yangonInputToIso($("promoExpiresAt").value),
    },
  });
  toast(`${number(data.generated)} Promo Code ထုတ်ပြီးပါပြီ`, "success");
  await refresh();
}

async function sendPromos() {
  if (!confirm("Generated Promo Code အားလုံးကို Bot DM မှပို့မည်။ ဆက်လုပ်မလား?")) return;
  const data = await api("/admin/promos/send", {
    method: "POST",
    body: { event_id: state.event?.event_id },
  });
  toast(`Delivered ${number(data.delivered)} · Failed ${number(data.failed)}`, data.failed ? "info" : "success");
  await refresh();
}

async function createTestLinks() {
  const userIds = $("testMemberIds").value.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
  const data = await api("/admin/test-access", {
    method: "POST",
    body: {
      event_id: state.event?.event_id,
      user_ids: userIds,
      expires_at: yangonInputToIso($("testExpiresAt").value),
      test_base_url: $("testBaseUrl").value.trim() || location.origin,
    },
  });
  $("testLinks").innerHTML = (data.access || []).map((item) => `<article>
    <strong>User ID ${esc(item.user_id)}</strong>
    <a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.link)}</a>
    <small>Expire: ${esc(dateText(item.expires_at))}</small>
  </article>`).join("");
  toast(`${number(data.access?.length)} Test Link ထုတ်ပြီးပါပြီ`, "success");
}

function brandingPayload() {
  const current = state.branding?.draft || state.branding?.published || {};
  return {
    ...current,
    primary: $("brandingPrimary").value,
    secondary: $("brandingSecondary").value,
    audio: {
      ...(current.audio || {}),
      background_url: $("brandingBackgroundAudio").value.trim(),
      spin_url: $("brandingSpinAudio").value.trim(),
      winner_url: $("brandingWinnerAudio").value.trim(),
      volume: Number($("brandingVolume").value || 0.65),
      loop: true,
    },
  };
}

async function uploadBrandingAsset() {
  const file = $("brandingFile").files?.[0];
  if (!file) throw new Error("Upload file ရွေးပါ။");
  const form = new FormData();
  form.append("file", file);
  form.append("kind", $("assetKind").value);
  const data = await api("/admin/assets/upload", { method: "POST", body: form });
  const branding = brandingPayload();
  const kind = $("assetKind").value;
  if (kind === "audio") branding.audio.background_url = data.asset.url;
  else if (kind === "member-logo") branding.member_logo_url = data.asset.url;
  else if (kind === "wheel-logo") branding.wheel_center_logo_url = data.asset.url;
  else if (kind === "login-logo") branding.login_logo_url = data.asset.url;
  else if (kind === "inbox-logo") branding.inbox_logo_url = data.asset.url;
  else if (kind === "background") {
    branding.background_type = file.type.startsWith("video/") ? "video" : "image";
    branding.background_value = data.asset.url;
  } else branding.logo_url = data.asset.url;
  await api("/admin/branding/draft", { method: "POST", body: { branding } });
  state.branding = { ...(state.branding || {}), draft: branding };
  renderBranding();
  toast("Upload & Draft Preview အောင်မြင်သည်", "success");
}

async function saveBrandingDraft() {
  const data = await api("/admin/branding/draft", {
    method: "POST",
    body: { branding: brandingPayload() },
  });
  state.branding = { ...(state.branding || {}), draft: data.branding };
  toast("Branding Draft သိမ်းပြီးပါပြီ", "success");
}

async function publishBranding() {
  if (!confirm("လက်ရှိ Branding Draft ကို Member/Test/Admin Link အားလုံးသို့ Publish လုပ်မလား?")) return;
  await saveBrandingDraft();
  const data = await api("/admin/branding/publish", { method: "POST", body: {} });
  state.branding = { draft: data.branding, published: data.branding };
  renderBranding();
  toast("Branding Publish ပြီးပါပြီ", "success");
}

function bind() {
  $("adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("adminLoginButton");
    button.disabled = true;
    $("adminLoginError").classList.add("hidden");
    try {
      const data = await login($("adminAccount").value.trim(), $("adminPass").value);
      state.apiKey = "secure-cookie";
      state.account = data.account || $("adminAccount").value.trim();
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
    $("showAdminPass").textContent = input.type === "password" ? "Show" : "Hide";
  });
  qa(".admin-nav-btn").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.section)));
  qa(".nav-shortcut").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.target)));
  $("sidebarToggle").addEventListener("click", () => setSidebar(!$("adminApp").classList.contains("sidebar-expanded")));
  $("sidebarCollapse").addEventListener("click", () => setSidebar(false));
  $("sidebarOverlay").addEventListener("click", () => setSidebar(false));
  $("adminRefresh").addEventListener("click", refresh);
  $("adminLogout").addEventListener("click", () => logout());
  $("promoGenerate").addEventListener("click", () => generatePromos().catch((error) => toast(error.message, "error")));
  $("promoSend").addEventListener("click", () => sendPromos().catch((error) => toast(error.message, "error")));
  $("testCreateLinks").addEventListener("click", () => createTestLinks().catch((error) => toast(error.message, "error")));
  $("brandingUpload").addEventListener("click", () => uploadBrandingAsset().catch((error) => toast(error.message, "error")));
  $("brandingSaveDraft").addEventListener("click", () => saveBrandingDraft().catch((error) => toast(error.message, "error")));
  $("brandingPublish").addEventListener("click", () => publishBranding().catch((error) => toast(error.message, "error")));
  $("eventForm").addEventListener("submit", saveEvent);
  $("savePrizes").addEventListener("click", savePrizes);
  $("postSettingsForm").addEventListener("submit", savePostSettings);
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
