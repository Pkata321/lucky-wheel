"use strict";

const PLAYER = {
  API_BASE: "/backend",
  DEMO: new URLSearchParams(location.search).get("demo") === "1",
  ACCESS_TOKEN: new URLSearchParams(location.search).get("access") || "",
  TEST_TOKEN: new URLSearchParams(location.search).get("token") || "",
  SOUND_KEY: "lucky77_player_sound_v6",
  REQUEST_TIMEOUT_MS: 15000,
};
PLAYER.TEST_MODE = Boolean(
  PLAYER.TEST_TOKEN
  || /^\/test(?:\.html|\/|$)/.test(location.pathname)
  || new URLSearchParams(location.search).get("test") === "1"
);

const state = {
  event: null,
  branding: null,
  counts: { registered: 0, winners: 0, prizes_left: 0 },
  recent: [],
  wheelPrizes: ["5,000 Ks", "10,000 Ks", "20,000 Ks", "30,000 Ks", "50,000 Ks", "100,000 Ks"],
  user: null,
  initData: "",
  channel: { joined: false },
  registered: false,
  preregistered: false,
  spun: false,
  result: null,
  access: { account_ready: false, promo_code: "", promo_sent_at: "" },
  rotation: 0,
  spinning: false,
  spinRequestKey: "",
  accessToken: PLAYER.ACCESS_TOKEN,
  testMode: PLAYER.TEST_MODE,
  sound: localStorage.getItem(PLAYER.SOUND_KEY) !== "off",
  supportLink: "",
};

const $ = (id) => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const safe = (value) => value == null ? "" : String(value);
const esc = (value) => safe(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

function formatPrize(value) {
  const text = safe(value).trim();
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toLocaleString("en-US")} Ks` : text || "Premium Prize";
}

function yangonDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not configured" : new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
}

function initials(user) {
  const text = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "77";
  const parts = text.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : text.slice(0, 2).toUpperCase();
}

function toast(message, type = "info") {
  const node = $("toast");
  node.textContent = safe(message);
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3400);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAYER.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${PLAYER.API_BASE}${path}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
  if (error?.name === "AbortError") throw new Error("áá»á­ááºáááºáá»á­ááº áá»á±á¬áºáá½ááºáá½á¬á¸áá«áá¼á®");
    throw error;
  } finally { clearTimeout(timer); }
}

function telegramIdentity() {
  if (PLAYER.TEST_MODE) {
    return {
      user: { id: "test-player", first_name: "Lucky77", last_name: "Test", username: "test_player" },
      initData: "",
      test: true,
    };
  }
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try { webApp.ready(); webApp.expand(); webApp.setHeaderColor("#eaf3ff"); webApp.setBackgroundColor("#f5f9ff"); } catch (_) {}
  }
  const user = webApp?.initDataUnsafe?.user || null;
  const initData = webApp?.initData || "";
  if (user?.id && initData) return { user, initData };
  if (PLAYER.DEMO) return { user: { id: "770077", first_name: "Lucky", last_name: "Preview", username: "previewmember" }, initData: "", demo: true };
  return { user: null, initData: "" };
}

function applyTheme(event) {
  document.body.dataset.theme = event?.theme || "sky-white";
  if (event?.accent) document.documentElement.style.setProperty("--accent", event.accent);
  if (event?.accent_2) document.documentElement.style.setProperty("--accent-2", event.accent_2);
}

function applyBranding(branding) {
  state.branding = branding || {};
  if (branding?.primary) document.documentElement.style.setProperty("--accent", branding.primary);
  if (branding?.secondary) document.documentElement.style.setProperty("--accent-2", branding.secondary);
  const rawLogo = branding?.member_logo_url || branding?.logo_url || "./assets/lucky77-logo.png";
  let logo = rawLogo;
  try {
    logo = new URL(rawLogo, `${location.origin}/`).href;
  } catch (_) {}
  document.querySelectorAll(".brand-seal img, #wheelLogo").forEach((image) => { image.src = logo; });
}

function renderHeader() {
  const name = state.user ? `${state.user.first_name || ""} ${state.user.last_name || ""}`.trim() || `@${state.user.username || "member"}` : "Lucky Member";
  $("memberName").textContent = name;
  $("memberAvatar").textContent = initials(state.user);
  $("memberStatus").textContent = state.testMode
    ? state.user ? "Test member" : "Connect Telegram"
    : state.spun ? "Spin completed" : state.registered ? state.access.account_ready ? "Event member" : "Account pending" : state.user ? "Verification required" : "Connect Telegram";
  const live = !!state.event?.event_live;
  $("liveBadge").classList.toggle("is-live", live);
  $("liveBadge").classList.toggle("is-waiting", !live);
  $("liveBadge").querySelector("span").textContent = live ? "EVENT LIVE" : `EVENT ${safe(state.event?.phase || "WAITING").toUpperCase()}`;
}

function renderEvent() {
  const event = state.event || {};
  $("eventTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("eventSubtitle").textContent = event.subtitle || "One member Â· One code Â· One premium spin";
  $("announcementText").textContent = event.announcement || "Register now. Your private code will arrive when the event starts.";
  $("eventStartText").textContent = `ááááºáá»á­ááº: ${yangonDate(event.starts_at)}`;
  $("eventEndText").textContent = `áá¼á®á¸áá¯á¶á¸áá»á­ááº: ${yangonDate(event.ends_at)}`;
  $("wheelEventId").textContent = safe(event.event_id || "EVENT");
  const phaseCopy = {
    registration: "áááºáá¾á­ááááº Event á¡áá½ááº Register áá¯ááºáá­á¯ááºáá«áá¼á®á",
    scheduled: "Register áá¬áááºá¸áá­ááºáá¼á®á¸ Event áá­á¯ á¡áá­á¯á¡áá»á±á¬ááºááááºáá«áááºá",
    live: "Event ááááºáá±áá«áá¼á®á á¡áááºááá·áºáá¼ááºáá±á¬ Member áá»á¬á¸ Promo Code áá¼áá·áº áááºáá¼á­ááº Spin áá¾áá·áºáá­á¯ááºáá«áááºá",
    ended: "áááºáá¾á­ Event áá¼á®á¸áá¯á¶á¸áá«áá¼á®á áá±á¬ááº Event á¡áá½ááº áá¼á­á¯áááº Register áá¯ááºáá­á¯ááºáá«áááºá",
    blocked: event.lifecycle_error || "Event áááááºáá® Admin áá¾ áááºáá±á¸áááºáá­á¯á¡ááºáá«áááºá",
  };
  $("phaseNotice").textContent = phaseCopy[event.phase] || event.lifecycle_error || "Waiting for event settings.";
  applyTheme(event);
  renderHeader();
}

function revealGate(id) {
  ["browserGate", "joinGate", "registerGate", "accountGate", "readyGate"].forEach((gate) => $(gate).classList.toggle("hidden", gate !== id));
}

function renderAccess() {
  const spinBtn = $("spinBtn");
  if (!state.user) {
    $("accessTitle").textContent = "Telegram áá¾ áá½áá·áºáá«"; revealGate("browserGate");
    spinBtn.disabled = true; $("spinHint").textContent = "Telegram áá¾ áá¯á¶áá¼á¯á¶áá½á¬ á¡áááºáá¼á¯áááºáá­á¯á¡ááºáááº"; return;
  }
  if (!state.channel?.joined) {
    $("accessTitle").textContent = "Channel á¡áááºáá¼á¯áááº"; revealGate("joinGate");
    spinBtn.disabled = true; $("spinHint").textContent = "áááºáá¯ááºáááº Channel Join áá¼á®á¸ á¡áááºáá¼á¯áá«"; return;
  }
  if (state.testMode) {
    if (!state.access.account_ready) {
      $("accessTitle").textContent = "Test Game Account";
      $("accountPhoneField").classList.add("hidden");
      revealGate("accountGate");
      spinBtn.disabled = true;
      $("spinHint").textContent = "Promo Code áá¾áá·áº áá­ááºá¸á¡áá±á¬áá·áº Name ááá·áºáá¼á®á¸ Confirm áá¯ááºáá«";
      return;
    }
    $("accessTitle").textContent = "â Verified Game Account";
    revealGate("readyGate");
    $("spinCodeField").classList.remove("hidden");
    $("readyText").textContent = "Test Mode áá¼ááºááá¼áá·áº á¡áá¼á­ááºáá¼á­ááº Spin áá¾áá·áºáá­á¯ááºáá¼á®á¸ Real Data áááºááá·áºá¡áá¬áá­á¯áá»á¾ ááá­ááºá¸áá«á";
    const testCodeReady = $("spinCodeInput").value.trim().length > 0;
    spinBtn.disabled = state.spinning || !testCodeReady;
    $("spinHint").textContent = "Unlimited Test Spin Â· Result áá­á¯ ááá­ááºá¸áá«";
    return;
  }
  if (!state.registered) {
    const open = !!state.event?.registration_open;
    $("accessTitle").textContent = open ? "Monthly registration" : state.event?.next_event_id ? "Next-event pre-registration" : "Registration closed";
    $("registerCopy").textContent = open
      ? "áá® Event á¡áá½ááº Register áá¯ááºáá«á Event ááá»á­ááºáá½ááº ááá·áº Promo Code áá­á¯ áá®á¸ááá·áºáá­á¯á·áá«áááºá"
      : state.event?.next_event_id
        ? `áááºáá¾á­ Event áá­ááºáá¬á¸áá«áá¼á®á ${state.event.next_event_id} á¡áá½ááº áá¼á­á¯áááº Register áá¯ááºáá­á¯ááºáá«áááºá`
        : "Register áá­ááºáá¬á¸áá¼á®á¸ áá±á¬ááº Event áá­á¯ ááááºáá¾ááºááá±á¸áá«á";
    $("registerBtn").textContent = open ? "áááºáá¾á­ Event áá­á¯ Register áá¯ááºáááº" : "áá±á¬ááº Event áá­á¯ áá¼á­á¯áááº Register áá¯ááºáááº";
    $("registerBtn").disabled = !open && !state.event?.next_event_id;
    revealGate("registerGate"); spinBtn.disabled = true; $("spinHint").textContent = "ááááº Event Register áá­á¯ á¡áááºáá¼á®á¸á¡á±á¬ááºáá¯ááºáá«"; return;
  }
  if (state.event?.require_account && !state.access.account_ready) {
    $("accessTitle").textContent = "Game Account Verification";
    $("accountPhoneField").classList.remove("hidden");
    $("accountPromoInput").value = state.access.promo_code || $("accountPromoInput").value || "";
    $("accountNameInput").value = state.access.account_name || "";
    $("accountPhoneInput").value = state.access.phone || "";
    revealGate("accountGate"); spinBtn.disabled = true; $("spinHint").textContent = "áá­ááºá¸á¡áá±á¬áá·áº Name ááá·áºáá¼á®á¸ Confirm áá¯ááºáá«"; return;
  }
  $("accessTitle").textContent = state.spun ? "Spin Completed" : "â Verified Game Account";
  revealGate("readyGate");
  $("spinCodeField").classList.toggle("hidden", !state.event?.require_unique_code);
  if (state.access.promo_code && !$("spinCodeInput").value) $("spinCodeInput").value = state.access.promo_code;
  $("readyText").textContent = state.spun
      ? `Result áá­ááºá¸áá¼á®á¸: ${formatPrize(state.result?.prize)}`
    : state.event?.event_live
      ? state.access.promo_sent_at ? "Promo Code áá­á¯ Telegram áá¾áá­á¯á·áá¼á®á¸áá«áá¼á®á Code ááá·áºáá¼á®á¸ áááºáá¼á­ááº Spin áá¾áá·áºáá«á" : "Promo Code á¡ááá·áºáá¼ááºáá«áá¼á®á Code ááá·áºáá¼á®á¸ áááºáá¼á­ááº Spin áá¾áá·áºáá«á"
      : "Register á¡áááºáá¼á¯áá¼á®á¸áá«áá¼á®á Event ááááºáá»á­ááºáá­á¯ áá±á¬áá·áºáá±á¸áá«á";
  const codeReady = !state.event?.require_unique_code || $("spinCodeInput").value.trim().length >= 8;
  spinBtn.disabled = state.spun || !state.event?.event_live || state.spinning || !codeReady;
  $("spinHint").textContent = state.spun ? "Result áá¾áá·áº á¡áá¯á¶á¸áá¼á¯áá¼á®á¸ Code áá­á¯ á¡áá¼á²áááºá¸áá­ááºá¸áá¬á¸áá«áááº" : state.event?.event_live ? "áá¯á¶áá¼á¯á¶áá±á¬ Spin áááºáá¼á­ááº ááá¾á­áá«áááº" : "Event Live áá­á¯ áá±á¬áá·áºáá±áá«áááº";
}

function renderMetrics() {
  $("metricMembers").textContent = formatNumber(state.counts.registered);
  $("metricWinners").textContent = formatNumber(state.counts.winners);
  $("metricPrizes").textContent = formatNumber(state.counts.prizes_left);
}

function renderPrizes() {
  const counts = new Map();
  state.wheelPrizes.forEach((prize) => counts.set(formatPrize(prize), (counts.get(formatPrize(prize)) || 0) + 1));
  $("prizePool").innerHTML = counts.size ? Array.from(counts.entries()).slice(0, 5).map(([prize, count], index) => `<article class="prize-row"><span class="prize-medal">${index === 0 ? "77" : "â¦"}</span><div><strong>${esc(prize)}</strong><small>${index === 0 ? "Featured reward" : "Configured prize type"}</small></div><b>${count}</b></article>`).join("") : `<div class="empty-copy">Prize list appears after admin configuration.</div>`;
}

function timeAgo(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}

function renderWinners() {
  $("recentWinners").innerHTML = state.recent.length ? state.recent.slice(0, 4).map((item) => `<article class="recent-row"><span>${esc(initials({ first_name: item.display || "77" }))}</span><div><strong>${esc(item.display || "Lucky Member")}</strong><small>${esc(timeAgo(item.at))}</small></div><b>${esc(formatPrize(item.prize))}</b></article>`).join("") : `<div class="empty-copy">Waiting for the first live winner.</div>`;
}

function drawWheel() {
  const canvas = $("wheelCanvas"), ctx = canvas.getContext("2d"), size = canvas.width, center = size / 2, radius = center - 28;
  const prizes = state.wheelPrizes.length ? state.wheelPrizes : ["Lucky77"];
  const colors = state.event?.wheel_colors?.length ? state.event.wheel_colors : ["#3578f6", "#77a7ff", "#e8f2ff", "#174ea6", "#a8c9ff", "#4f8cff"];
  const slice = Math.PI * 2 / prizes.length;
  ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(center, center); ctx.rotate(-Math.PI / 2);
  prizes.forEach((prize, index) => {
    const start = index * slice, end = start + slice;
    const gradient = ctx.createRadialGradient(0, 0, radius * .18, 0, 0, radius);
    gradient.addColorStop(0, colors[(index + 1) % colors.length]); gradient.addColorStop(1, colors[index % colors.length]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, start, end); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.stroke();
    ctx.save(); ctx.rotate(start + slice / 2); ctx.translate(radius * .69, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = index % 3 === 2 ? "#16345f" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = formatPrize(prize).replace(" Ks", ""); ctx.font = `800 ${prizes.length > 10 ? 20 : 25}px system-ui, sans-serif`;
    ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}â¦` : label, 0, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(0, 0, radius - 4, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke(); ctx.restore();
}

function simpleTone(frequency, duration = .08, volume = .04) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
  const context = simpleTone.context || (simpleTone.context = new AudioContext());
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
}

function targetRotation(prize) {
  const needle = safe(prize).replace(/[^\w\d]/g, "").toLowerCase();
  let index = state.wheelPrizes.findIndex((item) => safe(item).replace(/[^\w\d]/g, "").toLowerCase() === needle);
  if (index < 0) index = Math.floor(Math.random() * state.wheelPrizes.length);
  const slice = 360 / state.wheelPrizes.length, center = index * slice + slice / 2, turns = Math.ceil(state.rotation / 360);
  return (turns + 7) * 360 + (360 - center);
}

function confetti() {
  const layer = $("confettiLayer"); layer.innerHTML = "";
  for (let i = 0; i < 42; i += 1) {
    const bit = document.createElement("i"); bit.style.setProperty("--x", `${Math.random() * 100}%`);
    bit.style.setProperty("--delay", `${Math.random() * .7}s`); bit.style.setProperty("--fall", `${80 + Math.random() * 180}px`);
    bit.style.setProperty("--color", ["#3478f6", "#86b5ff", "#f7c94b", "#f06aa6"][i % 4]); layer.appendChild(bit);
  }
}

function showResult(result) {
  state.result = result; state.spun = !state.testMode;
  $("resultName").textContent = `${state.user?.first_name || ""} ${state.user?.last_name || ""}`.trim() || state.user?.username || "Lucky Member";
  $("resultPrize").textContent = formatPrize(result?.prize);
  $("resultSaveLabel").textContent = state.testMode ? "TEST RESULT Â· NOT SAVED" : "Lucky77 Result áá­ááºá¸áá¼á®á¸áá«áá¼á®";
  $("resultCopy").textContent = state.testMode
    ? "Test Mode Result áá¼ááºáá¼á®á¸ Memberá Promoá Prize Stocká Winnerá Report áá­á¯á·ááá¯ááº Spin Count áááºáá¯áá»á¾ ááá­ááºá¸áá«á"
    : "Promo Code áá­á¯ á¡áá¯á¶á¸áá¼á¯áá¼á®á¸áá«áá¼á®á áá¯áá¯ááºáá°áááº Lucky77 Customer Service áá­á¯á· áááºáá½ááºáá«á";
  $("resultModal").classList.remove("hidden");
  confetti(); [523, 659, 784, 1046].forEach((note, i) => setTimeout(() => simpleTone(note, .34, .06), i * 150));
  renderAccess(); renderHeader();
}

async function refreshPlayerStatus() {
  if (!state.user || PLAYER.DEMO || state.testMode) return;
  const data = await api("/api/player/status", {
    method: "POST",
    body: { init_data: state.initData, access_token: state.accessToken },
  });
  state.channel = data.channel || { joined: false }; state.registered = !!data.registered; state.preregistered = !!data.preregistered;
  state.spun = !!data.spun; state.result = data.result || null; state.event = { ...state.event, ...(data.event || {}) };
  state.access = { ...state.access, ...(data.access || {}) };
}

async function registerPlayer() {
  const button = $("registerBtn"); button.disabled = true;
  try {
    if (PLAYER.DEMO) { state.channel = { joined: true }; state.registered = true; state.access = { account_ready: false, promo_code: "L77-DEMO-2026", promo_sent_at: new Date().toISOString() }; }
    else {
      const data = await api("/api/player/register", { method: "POST", body: { init_data: state.initData } });
      state.registered = !!data.registered; state.preregistered = !!data.preregistered; await refreshPlayerStatus();
      toast(data.message || "Register áá¯ááºáá¼á®á¸áá«áá¼á®", "success");
    }
    renderAll();
  } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

async function saveAccount(event) {
  event.preventDefault();
  const promoCode = $("accountPromoInput").value.trim();
  const body = { account_name: $("accountNameInput").value.trim(), phone: $("accountPhoneInput").value.trim() };
  if (!promoCode || !body.account_name) return toast("Promo Code áá¾áá·áº áá­ááºá¸á¡áá±á¬áá·áº Name ááá·áºáá±á¸áá«", "error");
  try {
    if (PLAYER.DEMO || state.testMode) {
      state.access = {
        ...state.access,
        ...body,
        account_ready: true,
        promo_code: promoCode,
        account_verified_at: new Date().toISOString(),
        test_member: state.testMode,
      };
    }
    else {
      const data = await api("/api/player/account", { method: "POST", body: { init_data: state.initData, ...body } });
      state.access = { ...state.access, ...(data.access || {}) };
      if (!state.access.promo_code) state.access.promo_code = promoCode;
    }
    $("spinCodeInput").value = promoCode;
    toast("áá­ááºá¸á¡áá±á¬áá·áº á¡áááºáá¼á¯áá¼á®á¸áá«áá¼á®", "success"); renderAll();
  } catch (error) { toast(error.message, "error"); }
}

async function verifyPlayer() {
  try {
    if (PLAYER.DEMO) state.channel = { joined: true }; else await refreshPlayerStatus();
    renderAll(); toast(state.channel?.joined ? "Channel á¡áááºáá¼á¯áá¼á®á¸áá«áá¼á®" : "Channel áá­á¯ á¡áááº Join áá±á¸áá«", state.channel?.joined ? "success" : "error");
  } catch (error) { toast(error.message, "error"); }
}

async function spin() {
  if (state.spinning || $("spinBtn").disabled) return;
  state.spinning = true; $("spinBtn").disabled = true; $("spinBtn").classList.add("is-spinning"); $("spinBtn").querySelector("span").textContent = "SPINNING";
  try {
    let winner;
    if (PLAYER.DEMO || state.testMode) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      winner = {
        prize: state.wheelPrizes[Math.floor(Math.random() * state.wheelPrizes.length)],
        at: new Date().toISOString(),
        test: true,
        persisted: false,
      };
    } else {
      if (!state.spinRequestKey) {
        state.spinRequestKey = window.crypto?.randomUUID?.()
          || `spin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const data = await api("/api/player/spin", {
        method: "POST",
        headers: { "X-Idempotency-Key": state.spinRequestKey },
        body: {
          init_data: state.initData,
          promo_code: $("spinCodeInput").value.trim(),
          access_token: state.accessToken,
        },
      });
      winner = data.winner;
      state.spinRequestKey = "";
    }
    state.rotation = targetRotation(winner?.prize);
    q(".wheel-frame").style.transition = "transform 5.6s cubic-bezier(.12,.72,.08,1)";
    q(".wheel-frame").style.transform = `rotate(${state.rotation}deg)`;
    await new Promise((resolve) => setTimeout(resolve, 5750)); showResult(winner);
    if (!winner?.test) {
      state.counts.prizes_left = Math.max(0, Number(state.counts.prizes_left || 0) - 1);
      state.counts.winners = Number(state.counts.winners || 0) + 1;
    }
  } catch (error) { toast(error.message, "error"); }
  finally { state.spinning = false; $("spinBtn").classList.remove("is-spinning"); $("spinBtn").querySelector("span").textContent = "SPIN"; renderAccess(); renderMetrics(); }
}

function renderCountdown() {
  const live = !!state.event?.event_live;
  const target = new Date(live ? state.event?.ends_at || "" : state.event?.starts_at || "");
  $("countdownLabel").textContent = live ? "Event ends in" : state.event?.phase === "ended" ? "Event ended" : "Event starts in";
  let remaining = Number.isNaN(target.getTime()) ? 0 : Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(remaining / 86400000); remaining %= 86400000;
  const hours = Math.floor(remaining / 3600000); remaining %= 3600000;
  const minutes = Math.floor(remaining / 60000), seconds = Math.floor((remaining % 60000) / 1000);
  [["countDays", days], ["countHours", hours], ["countMinutes", minutes], ["countSeconds", seconds]].forEach(([id, value]) => $(id).textContent = String(value).padStart(2, "0"));
}

function renderAll() { renderEvent(); renderAccess(); renderMetrics(); renderPrizes(); renderWinners(); drawWheel(); renderCountdown(); }

function bind() {
  $("verifyBtn").addEventListener("click", verifyPlayer);
  $("registerBtn").addEventListener("click", registerPlayer);
  $("accountGate").addEventListener("submit", saveAccount);
  $("spinBtn").addEventListener("click", spin);
  $("spinCodeInput").addEventListener("input", renderAccess);
  $("resultCloseBtn").addEventListener("click", () => $("resultModal").classList.add("hidden"));
  q(".result-backdrop").addEventListener("click", () => $("resultModal").classList.add("hidden"));
  $("soundToggle").addEventListener("click", () => { state.sound = !state.sound; localStorage.setItem(PLAYER.SOUND_KEY, state.sound ? "on" : "off"); toast(state.sound ? "Sound on" : "Sound off"); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("resultModal").classList.add("hidden"); });
}

async function boot() {
  bind();
  const identity = telegramIdentity(); state.user = identity.user; state.initData = identity.initData;
  try {
    const [data, brandingPack] = await Promise.all([
      api("/api/player/event"),
      api("/api/public/branding").catch(() => ({ branding: null })),
    ]);
    applyBranding(brandingPack.branding);
    state.event = data.event || {}; state.counts = { registered: data.counts?.registered || 0, winners: data.counts?.winners || 0, prizes_left: data.counts?.prizes_left || 0 };
    state.recent = data.recent_winners || []; if (data.wheel_prizes?.length) state.wheelPrizes = data.wheel_prizes;
    state.supportLink = state.event.cs_link || data.support_link || data.channel_link || "https://t.me/Lucky77autoSpin_bot";
    $("joinChannelBtn").href = data.channel_link || "#"; $("openTelegramBtn").href = data.support_link || data.channel_link || "#";
    $("selfSignupBtn").href = state.event.self_signup_link || "#";
    $("contactCsBtn").href = state.supportLink;
    $("playerSupportLink").href = state.supportLink; $("resultSupportLink").href = state.supportLink;
    if (state.testMode) {
      state.channel = { joined: true };
      state.registered = true;
      state.access = { account_ready: false, promo_code: "", test_member: true };
      state.event = { ...state.event, event_live: true, registration_open: true, phase: "live" };
    } else if (PLAYER.DEMO) {
      state.channel = { joined: true }; state.registered = true; state.access = { account_ready: true, promo_code: "L77-DEMO-2026", promo_sent_at: new Date().toISOString(), test_member: true };
    } else if (state.user) await refreshPlayerStatus();
  } catch (error) {
    state.event = { title: "Lucky77 Grand Spin", subtitle: "Connection unavailable", registration_open: false, event_live: false, phase: "blocked", lifecycle_error: "Event data could not be loaded.", theme: "sky-white" };
    toast(error.message, "error");
  }
  renderAll();
  setInterval(renderCountdown, 1000);
  if (!PLAYER.DEMO && !state.testMode) {
    setInterval(() => api("/api/player/event").then((data) => {
      state.event = data.event || state.event;
      state.counts = { ...state.counts, ...(data.counts || {}) };
      renderAll();
    }).catch(() => {}), 30000);
  }
}

boot();
