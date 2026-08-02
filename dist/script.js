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
  localPromoConfirmedCode: "",
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

function normalizePromoCode(value) {
  return safe(value)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function playerErrorMessage(error) {
  const code = safe(error?.data?.error || "");
  const messages = {
    registration_required: "ဒီ Event အတွက် Register လုပ်ထားမှ Spin လှည့်နိုင်ပါသည်။",
    invalid_unique_code: "Promo Code မမှန်ပါ။ Telegram Bot မှပို့ထားသော Code ကို ပြန်စစ်ပါ။",
    promo_not_started: "Promo Code ကို အသုံးပြုနိုင်သည့်အချိန် မရောက်သေးပါ။",
    promo_expired: "Promo Code သက်တမ်းကုန်ဆုံးသွားပါပြီ။",
    event_not_live: "Event မစတင်သေးပါ။ Event Live ဖြစ်သည့်အချိန် ပြန်လှည့်ပါ။",
    channel_membership_required: "Lucky77 Channel ကို Join ထားမှ Spin လှည့်နိုင်ပါသည်။",
    telegram_verification_required: "Official Telegram Bot မှ Player Link ကို ပြန်ဖွင့်ပါ။",
    spin_in_progress: "Spin လှည့်နေဆဲဖြစ်ပါသည်။ ခဏစောင့်ပါ။",
    no_prize_left: "ဒီ Event အတွက် ဆုများကုန်ဆုံးသွားပါပြီ။",
  };
  return messages[code] || safe(error?.message || "လုပ်ဆောင်မှုမအောင်မြင်ပါ။ ပြန်စမ်းပါ။");
}

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
  if (error?.name === "AbortError") throw new Error("ချိတ်ဆက်ချိန် ကျော်လွန်သွားပါပြီ");
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
    ? state.user ? "Test Member" : "Telegram ချိတ်ဆက်ရန်"
    : state.spun
      ? state.access.account_ready ? "ဆုရယူရန်အဆင်သင့်" : "Game Account ထည့်ရန်"
      : state.registered ? "Event Member" : state.user ? "အတည်ပြုရန်လိုအပ်သည်" : "Telegram ချိတ်ဆက်ရန်";
  const live = !!state.event?.event_live;
  $("liveBadge").classList.toggle("is-live", live);
  $("liveBadge").classList.toggle("is-waiting", !live);
  $("liveBadge").querySelector("span").textContent = live ? "EVENT LIVE" : `EVENT ${safe(state.event?.phase || "WAITING").toUpperCase()}`;
}

function renderEvent() {
  const event = state.event || {};
  $("eventTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("eventSubtitle").textContent = event.subtitle || "One member · One code · One premium spin";
  $("announcementText").textContent = event.announcement || "Register now. Your private code will arrive when the event starts.";
  $("eventStartText").textContent = `စတင်ချိန်: ${yangonDate(event.starts_at)}`;
  $("eventEndText").textContent = `ပြီးဆုံးချိန်: ${yangonDate(event.ends_at)}`;
  $("wheelEventId").textContent = safe(event.event_id || "EVENT");
  const phaseCopy = {
    registration: "လက်ရှိလစဉ် Event အတွက် Register လုပ်နိုင်ပါပြီ။",
    scheduled: "Register စာရင်းပိတ်ပြီး Event ကို အလိုအလျောက်စတင်ပါမည်။",
    live: "Event စတင်နေပါပြီ။ အဆင်သင့်ဖြစ်သော Member များ Promo Code ဖြင့် တစ်ကြိမ် Spin လှည့်နိုင်ပါသည်။",
    ended: "လက်ရှိ Event ပြီးဆုံးပါပြီ။ နောက် Event အတွက် ကြိုတင် Register လုပ်နိုင်ပါသည်။",
    blocked: event.lifecycle_error || "Event မစတင်မီ Admin မှ စစ်ဆေးရန်လိုအပ်ပါသည်။",
  };
  $("phaseNotice").textContent = phaseCopy[event.phase] || event.lifecycle_error || "Waiting for event settings.";
  applyTheme(event);
  renderHeader();
}

function revealGate(id) {
  ["browserGate", "joinGate", "registerGate", "accountGate", "readyGate"].forEach((gate) => $(gate).classList.toggle("hidden", gate !== id));
}


function setPromoConfirmUi(enteredCode, confirmed) {
  const btn = $("promoConfirmBtn");
  const msg = $("promoConfirmMsg");
  const line = $("promoReadyLine");
  if (!btn || !msg) return;
  const hasCode = enteredCode.length > 0;
  btn.disabled = !hasCode || confirmed || state.spinning || state.spun;
  btn.textContent = confirmed ? "Promo Code အတည်ပြုပြီး" : "Promo Code အတည်ပြုမည်";
  msg.textContent = !hasCode
    ? "Bot မှပို့ထားသော Promo Code ကိုထည့်ပါ။"
    : confirmed
      ? "Code အတည်ပြုပြီးပါပြီ။ အခု Spin လှည့်နိုင်ပါသည်။"
      : "Code ထည့်ပြီး အတည်ပြုမည်ကိုနှိပ်ပါ။";
  if (line) line.textContent = confirmed ? "Promo Code အတည်ပြုပြီးပါပြီ" : "Promo Code အတည်ပြုရန်လိုအပ်သည်";
}

function promoRequired() {
  return state.testMode || state.event?.require_unique_code !== false;
}

function promoConfirmedForCurrentInput(enteredCode) {
  if (!promoRequired()) return true;
  return enteredCode.length > 0 && state.localPromoConfirmedCode === enteredCode;
}

function renderAccess() {
  const spinBtn = $("spinBtn");
  const enteredCode = normalizePromoCode($("spinCodeInput").value);
  const promoConfirmed = promoConfirmedForCurrentInput(enteredCode);

  if (!state.user) {
    $("accessTitle").textContent = "Telegram မှ ဖွင့်ပါ";
    revealGate("browserGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Official Telegram Bot မှ Player Link ကို ဖွင့်ရန်လိုအပ်သည်";
    return;
  }

  if (!state.channel?.joined) {
    $("accessTitle").textContent = "Channel အတည်ပြုရန်";
    revealGate("joinGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Lucky77 Channel ကို Join ပြီး Member အတည်ပြုပါ";
    return;
  }

  if (state.testMode) {
    $("accessTitle").textContent = "Test Promo Code";
    revealGate("readyGate");
    $("spinCodeField").classList.remove("hidden");
    setPromoConfirmUi(enteredCode, promoConfirmed);
    $("readyText").textContent = "Unlimited Test Spin · Promo Code ထည့်ပြီး အတည်ပြုပါ။ Result ကို Real Data ထဲမသိမ်းပါ။";
    spinBtn.disabled = state.spinning || !promoConfirmed;
    $("spinHint").textContent = promoConfirmed
      ? "Test Spin လှည့်ရန် အသင့်ဖြစ်သည် · Result မသိမ်းပါ"
      : enteredCode.length ? "Promo Code အတည်ပြုမည်ကိုနှိပ်ပါ" : "စမ်းသပ်ရန် Promo Code တစ်ခုခုထည့်ပါ";
    return;
  }

  if (!state.registered) {
    const open = !!state.event?.registration_open;
    $("accessTitle").textContent = open
      ? "Event Register လုပ်ရန်"
      : state.event?.next_event_id ? "နောက် Event ကြိုတင် Register" : "Register ပိတ်ထားသည်";
    $("registerCopy").textContent = open
      ? "ဒီ Event အတွက် Register လုပ်ပါ။ Event စချိန်တွင် သင့် Promo Code ကို Telegram Bot မှ သီးသန့်ပို့ပါမည်။"
      : state.event?.next_event_id
        ? `လက်ရှိ Event ပိတ်ထားပါပြီ။ ${state.event.next_event_id} အတွက် ကြိုတင် Register လုပ်နိုင်ပါသည်။`
        : "Register ပိတ်ထားပြီး နောက် Event ကို မသတ်မှတ်ရသေးပါ။";
    $("registerBtn").textContent = open ? "လက်ရှိ Event ကို Register လုပ်မည်" : "နောက် Event ကို ကြိုတင် Register လုပ်မည်";
    $("registerBtn").disabled = !open && !state.event?.next_event_id;
    revealGate("registerGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Event Register လုပ်ပြီးမှ Promo Code ဖြင့် Spin လှည့်နိုင်ပါသည်";
    return;
  }

  // Confirmed flow: player spins with Promo Code first, then submits Game Account Name.
  if (state.spun && !state.access.account_ready) {
    $("accessTitle").textContent = "ဆုရယူရန် Game Account ထည့်ပါ";
    $("accountPhoneField").classList.remove("hidden");
    $("accountPromoInput").value = state.access.promo_code || enteredCode;
    $("accountNameInput").value = state.access.account_name || $("accountNameInput").value || "";
    $("accountPhoneInput").value = state.access.phone || $("accountPhoneInput").value || "";
    revealGate("accountGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "ကံထူးဆုရယူရန် Game Account Name ကို အတည်ပြုပါ";
    return;
  }

  $("accessTitle").textContent = state.spun ? "Spin လှည့်ပြီးပါပြီ" : "Promo Code အတည်ပြုရန်";
  revealGate("readyGate");
  $("spinCodeField").classList.toggle("hidden", !state.event?.require_unique_code);
  if (state.access.promo_code && !$("spinCodeInput").value) {
    $("spinCodeInput").value = state.access.promo_code;
  }

  $("readyText").textContent = state.spun
    ? `ကံထူးဆု: ${formatPrize(state.result?.prize)} · Game Account အတည်ပြုပြီးပါပြီ။`
    : state.event?.event_live
      ? state.access.promo_sent_at
        ? "Telegram Bot မှပို့ထားသော Promo Code ကို ထည့်ပြီး Spin လှည့်ပါ။"
        : "Promo Code ကို ထည့်ပြီး Spin လှည့်ပါ။"
      : "Register အတည်ပြုပြီးပါပြီ။ Event စတင်ချိန်ကို စောင့်ပေးပါ။";

  setPromoConfirmUi(enteredCode, promoConfirmed);
  const codeReady = promoConfirmed;
  spinBtn.disabled = state.spun || !state.event?.event_live || state.spinning || !codeReady;
  $("spinHint").textContent = state.spun
    ? "ဒီ Event အတွက် Spin လှည့်ပြီးပါပြီ"
    : state.event?.event_live
      ? codeReady ? "Spin လှည့်ရန် အသင့်ဖြစ်သည်" : enteredCode.length ? "Promo Code အတည်ပြုမည်ကိုနှိပ်ပါ" : "Promo Code ထည့်ပါ"
      : "Event Live ဖြစ်သည့်အချိန် ပြန်လှည့်ပါ";
}

function renderMetrics() {
  $("metricMembers").textContent = formatNumber(state.counts.registered);
  $("metricWinners").textContent = formatNumber(state.counts.winners);
  $("metricPrizes").textContent = formatNumber(state.counts.prizes_left);
}

function renderPrizes() {
  const counts = new Map();
  state.wheelPrizes.forEach((prize) => counts.set(formatPrize(prize), (counts.get(formatPrize(prize)) || 0) + 1));
  $("prizePool").innerHTML = counts.size ? Array.from(counts.entries()).slice(0, 5).map(([prize, count], index) => `<article class="prize-row"><span class="prize-medal">${index === 0 ? "77" : "✦"}</span><div><strong>${esc(prize)}</strong><small>${index === 0 ? "Featured reward" : "Configured prize type"}</small></div><b>${count}</b></article>`).join("") : `<div class="empty-copy">Prize list appears after admin configuration.</div>`;
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
    ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}…` : label, 0, 0); ctx.restore();
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
  $("resultSaveLabel").textContent = state.testMode ? "TEST RESULT · NOT SAVED" : "Lucky77 Result သိမ်းပြီးပါပြီ";
  $("resultCopy").textContent = state.testMode
    ? "Test Mode Result ဖြစ်ပြီး Member၊ Promo၊ Prize Stock၊ Winner၊ Report သို့မဟုတ် Spin Count တစ်ခုမျှ မသိမ်းပါ။"
    : "ဂုဏ်ယူပါတယ်ရှင့်။ ယူနစ်ဆုရယူရန် အောက်ပါခလုတ်ကိုနှိပ်ပြီး Game Account Name ကို ထည့်ပေးပါ။";
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
      toast(data.message || "Register လုပ်ပြီးပါပြီ", "success");
    }
    renderAll();
  } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

async function saveAccount(event) {
  event.preventDefault();
  const body = {
    account_name: $("accountNameInput").value.trim(),
    phone: $("accountPhoneInput").value.trim(),
  };
  if (!body.account_name) {
    return toast("Game Account Name ထည့်ပေးပါ။", "error");
  }
  try {
    if (PLAYER.DEMO || state.testMode) {
      state.access = {
        ...state.access,
        ...body,
        account_ready: true,
        account_verified_at: new Date().toISOString(),
        test_member: state.testMode,
      };
    } else {
      const data = await api("/api/player/account", {
        method: "POST",
        body: { init_data: state.initData, ...body },
      });
      state.access = { ...state.access, ...(data.access || {}) };
    }
    toast("Game Account Name အတည်ပြုပြီးပါပြီ။", "success");
    renderAll();
  } catch (error) {
    toast(playerErrorMessage(error), "error");
  }
}

async function verifyPlayer() {
  try {
    if (PLAYER.DEMO) state.channel = { joined: true }; else await refreshPlayerStatus();
    renderAll(); toast(state.channel?.joined ? "Channel အတည်ပြုပြီးပါပြီ" : "Channel ကို အရင် Join ပေးပါ", state.channel?.joined ? "success" : "error");
  } catch (error) { toast(error.message, "error"); }
}

async function spin() {
  const code = normalizePromoCode($("spinCodeInput").value);
  if (promoRequired() && !promoConfirmedForCurrentInput(code)) {
    return toast(code ? "Promo Code အတည်ပြုမည်ကို အရင်နှိပ်ပါ။" : "Promo Code ထည့်ပေးပါ။", "error");
  }
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
          promo_code: normalizePromoCode($("spinCodeInput").value),
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
  } catch (error) { toast(playerErrorMessage(error), "error"); }
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
  $("spinCodeInput").addEventListener("input", (event) => {
    const normalized = normalizePromoCode(event.target.value);
    if (event.target.value !== normalized) event.target.value = normalized;
    if (state.localPromoConfirmedCode && state.localPromoConfirmedCode !== normalized) state.localPromoConfirmedCode = "";
    renderAccess();
  });
  $("promoConfirmBtn")?.addEventListener("click", () => {
    const code = normalizePromoCode($("spinCodeInput").value);
    if (!code) return toast("Promo Code ထည့်ပေးပါ။", "error");
    state.localPromoConfirmedCode = code;
    toast("Promo Code အတည်ပြုပြီးပါပြီ။", "success");
    renderAccess();
  });
  $("resultCloseBtn").addEventListener("click", () => {
    $("resultModal").classList.add("hidden");
    renderAccess();
    $("accountNameInput")?.focus();
  });
  q(".result-backdrop").addEventListener("click", () => {
    if (state.testMode) $("resultModal").classList.add("hidden");
  });
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
      state.channel = { joined: true }; state.registered = true; state.access = { account_ready: false, promo_code: "L77-DEMO-2026", promo_sent_at: new Date().toISOString(), test_member: true };
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
