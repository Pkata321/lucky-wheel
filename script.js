"use strict";

/* ===========================
   CLEAN SCRIPT (V2) — PART 1/7
   BASE + DOM + LOADING + MUSIC + UTILS
=========================== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";
const TAU = Math.PI * 2;

/* ---------- DOM (match your HTML ids) ---------- */
const wheelCanvas = document.getElementById("wheel");
const ctx = wheelCanvas ? wheelCanvas.getContext("2d") : null;

const spinBtn  = document.getElementById("spinBtn");
const poolText = document.getElementById("poolText");

const drawer            = document.getElementById("drawer");
const settingsBtn       = document.getElementById("settingsBtn");
const closeSettingsBtn  = document.getElementById("closeSettingsBtn");
const saveBtn           = document.getElementById("saveBtn");
const resetBtn          = document.getElementById("resetBtn");

const apiBaseInput = document.getElementById("apiBaseInput");
const apiKeyInput  = document.getElementById("apiKeyInput");

const prizeBuilder      = document.getElementById("prizeBuilder");
const uiColorInput      = document.getElementById("uiColorInput");
const wheelAccentInput  = document.getElementById("wheelAccentInput");
const wheelColorsInput  = document.getElementById("wheelColorsInput");

const pageBgFile     = document.getElementById("pageBgFile");
const wheelBgFile    = document.getElementById("wheelBgFile");
const topBannerFile  = document.getElementById("topBannerFile");
const bottomBannerFile = document.getElementById("bottomBannerFile");
const wheelBannerFile  = document.getElementById("wheelBannerFile");
const bgSongFile       = document.getElementById("bgSongFile");

const topBannerImg      = document.getElementById("topBannerImg");
const bottomBannerImg   = document.getElementById("bottomBannerImg");
const topBannerFallback = document.getElementById("topBannerFallback");
const bottomBannerFallback = document.getElementById("bottomBannerFallback");

const wheelBannerImg      = document.getElementById("wheelBannerImg");
const wheelBannerFallback = document.getElementById("wheelBannerFallback");

const bgLayer   = document.getElementById("bgLayer");
const wheelWrap = document.getElementById("wheelWrap");

const restartSpinBtn = document.getElementById("restartSpinBtn");
const membersBtn     = document.getElementById("membersBtn");
const winnerListBtn  = document.getElementById("winnerListBtn");

const membersPanel     = document.getElementById("membersPanel");
const membersCloseBtn  = document.getElementById("membersCloseBtn");
const membersTable     = document.getElementById("membersTable");
const membersTotalText = document.getElementById("membersTotalText");

const winnerListPanel      = document.getElementById("winnerListPanel");
const winnerListCloseBtn   = document.getElementById("winnerListCloseBtn");
const winnerListBody       = document.getElementById("winnerListBody");
const winnerListTotalText  = document.getElementById("winnerListTotalText");

/* Winner Modal */
const winnerModal      = document.getElementById("winnerModal");
const winnerBackdrop   = document.getElementById("winnerBackdrop");
const winnerPrizeTitle = document.getElementById("winnerPrizeTitle");
const winnerTitleText  = document.getElementById("winnerTitleText");
const winnerNameText   = document.getElementById("winnerNameText");
const contactBtn       = document.getElementById("contactBtn");
const noticeBtn        = document.getElementById("noticeBtn");
const winnerCloseBtn   = document.getElementById("winnerCloseBtn");
const winnerHint       = document.getElementById("winnerHint");

/* Test Mode */
const testModeBtn         = document.getElementById("testModeBtn");
const clearTestHistoryBtn = document.getElementById("clearTestHistoryBtn");

/* Event History */
const refreshEventHistoryBtn = document.getElementById("refreshEventHistoryBtn");
const exportEventHistoryBtn  = document.getElementById("exportEventHistoryBtn");
const clearEventHistoryBtn   = document.getElementById("clearEventHistoryBtn");
const eventHistoryViewer     = document.getElementById("eventHistoryViewer");

const refreshMembersInSettingsBtn = document.getElementById("refreshMembersInSettingsBtn");
const membersInSettings           = document.getElementById("membersInSettings");

/* ---------- Loading Overlay ---------- */
let activeAbort = null;

function showLoading(text = "Loading...") {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  el.classList.remove("hidden");
  const t = document.getElementById("loadingText");
  if (t) t.textContent = text;
}
function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  el.classList.add("hidden");
  if (activeAbort) {
    try { activeAbort.abort(); } catch {}
  }
  activeAbort = null;
}
document.getElementById("loadingCancelBtn")?.addEventListener("click", hideLoading);

/* ---------- Music ---------- */
const musicBtn = document.getElementById("musicBtn");
const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.55;
let musicOn = false;

function updateMusicBtn() {
  if (!musicBtn) return;
  musicBtn.textContent = musicOn ? "🎵 Music: ON" : "🎵 Music: OFF";
  musicBtn.classList.toggle("primary", musicOn);
}
musicBtn?.addEventListener("click", async () => {
  musicOn = !musicOn;
  if (musicOn) {
    if (!bgMusic.src) {
      alert("Settings ထဲမှာ MP3 Upload လုပ်ပါ");
      musicOn = false;
    } else {
      try { await bgMusic.play(); } catch {}
    }
  } else {
    bgMusic.pause();
  }
  updateMusicBtn();
});

/* tick sound (WebAudio) */
let audioCtx = null;
function tickSound(freq = 900, dur = 0.02, gain = 0.06) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {}
}
function winChime() {
  tickSound(880, 0.05, 0.08);
  setTimeout(() => tickSound(1320, 0.06, 0.08), 80);
  setTimeout(() => tickSound(1760, 0.08, 0.08), 180);
}

/* ---------- Utils ---------- */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateKeyNow(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

/* Drawer */
function openSettings() { drawer?.classList.add("open"); }
function closeSettings() { drawer?.classList.remove("open"); }
settingsBtn?.addEventListener("click", openSettings);
closeSettingsBtn?.addEventListener("click", closeSettings);
/* ===========================
   CLEAN SCRIPT (V2) — PART 2/7
   STORAGE + CACHE + TEST MODE + SESSIONS + THEME + IMAGES
=========================== */

/* ---------- Storage Keys ---------- */
const STORAGE_KEY = "lucky77_vercel_v2_clean";
const CACHE_MEMBERS_KEY = "lucky77_cache_members";

/* quick map (id => {prize, done, at}) */
const LS_WINNERS_KEY = "lucky77_winner_prize_map_v1";
const LS_TEST_MODE   = "lucky77_test_mode_v1";

/* Sessions */
const LS_EVENT_HISTORY   = "lucky77_event_sessions_v1";   // saved sessions
const LS_CURRENT_SESSION = "lucky77_current_session_v1";  // current session
const LS_LAST_DATEKEY    = "lucky77_last_datekey_v1";     // for day-change detect

/* ---------- Default Settings ---------- */
const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey:  DEFAULT_API_KEY,

  uiColor: "#ffffff",
  wheelAccent: "#d6b25e",
  wheelColorsText: "#ffffff\n#f1f5ff\n#fff4d6\n#e9eefc",

  prizes: [
    { name: "10000Ks", times: 4 },
    { name: "5000Ks",  times: 2 },
    { name: "3000Ks",  times: 3 },
    { name: "2000Ks",  times: 5 },
    { name: "1000Ks",  times: 10 },
  ],

  pageBgDataUrl: "",
  wheelBgDataUrl: "",
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",
};

/* ---------- Clone ---------- */
function clone(x) {
  try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); }
}

/* ---------- Settings Load/Save ---------- */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(defaultSettings);
    const data = JSON.parse(raw);
    return { ...clone(defaultSettings), ...data };
  } catch {
    return clone(defaultSettings);
  }
}
function saveSettingsLocal(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/* ---------- Cache (members) ---------- */
function saveCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); } catch {}
}
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.value ?? null;
  } catch { return null; }
}
function clearCache() {
  try { localStorage.removeItem(CACHE_MEMBERS_KEY); } catch {}
}

/* ===========================
   Test Mode
=========================== */
function isTestMode() {
  return localStorage.getItem(LS_TEST_MODE) === "1";
}
function setTestMode(v) {
  try { localStorage.setItem(LS_TEST_MODE, v ? "1" : "0"); } catch {}
  if (testModeBtn) testModeBtn.textContent = v ? "Test: ON" : "Test: OFF";
}

testModeBtn?.addEventListener("click", () => {
  const next = !isTestMode();
  setTestMode(next);
  alert(next ? "Test Mode ON (မသိမ်းပါ)" : "Test Mode OFF (အတည် သိမ်းမယ်)");
  renderEventHistoryViewer?.();
  renderWinnerListPanel?.();
});

clearTestHistoryBtn?.addEventListener("click", () => {
  if (!confirm("Clear winner prize map (local) လုပ်မလား?")) return;
  localStorage.removeItem(LS_WINNERS_KEY);
  alert("Cleared ✅");
  renderWinnerListPanel?.();
});

/* ===========================
   Winner Prize Map (Quick)
=========================== */
function loadWinnerPrizeMap() {
  try { return JSON.parse(localStorage.getItem(LS_WINNERS_KEY) || "{}"); }
  catch { return {}; }
}
function saveWinnerPrizeMap(map) {
  try { localStorage.setItem(LS_WINNERS_KEY, JSON.stringify(map || {})); } catch {}
}
function setWinnerPrize(id, prizeText) {
  const map = loadWinnerPrizeMap();
  map[String(id)] = { prize: String(prizeText || "-"), done: false, at: Date.now() };
  saveWinnerPrizeMap(map);
}
function togglePrizeDone(id) {
  const map = loadWinnerPrizeMap();
  const k = String(id);
  map[k] = map[k] || { prize: "-", done: false, at: Date.now() };
  map[k].done = !map[k].done;
  map[k].at = Date.now();
  saveWinnerPrizeMap(map);
  return map[k].done;
}

/* ===========================
   Sessions (Real Mode only)
=========================== */
function loadEventSessions() {
  try { return JSON.parse(localStorage.getItem(LS_EVENT_HISTORY) || "[]"); }
  catch { return []; }
}
function saveEventSessions(arr) {
  try { localStorage.setItem(LS_EVENT_HISTORY, JSON.stringify(arr || [])); } catch {}
}
function loadCurrentSession() {
  try { return JSON.parse(localStorage.getItem(LS_CURRENT_SESSION) || "null"); }
  catch { return null; }
}
function saveCurrentSession(obj) {
  try { localStorage.setItem(LS_CURRENT_SESSION, JSON.stringify(obj || null)); } catch {}
}

function startNewSession() {
  const now = Date.now();
  const dateKey = dateKeyNow(now);
  const sid = `${dateKey}_${now}`;
  const session = {
    id: sid,
    dateKey,
    startedAt: now,
    endedAt: null,
    completed: false,
    autoSaved: false,
    winners: [] // {at, order, id, display, username, prize, done}
  };
  saveCurrentSession(session);
  return session;
}
function ensureSession() {
  if (isTestMode()) return null;
  let s = loadCurrentSession();
  if (!s) s = startNewSession();
  return s;
}

/* pool 0 => completed mark only */
function markSessionCompletedIfPoolEmpty(poolCount) {
  if (isTestMode()) return;
  if (Number(poolCount) !== 0) return;

  const s = loadCurrentSession();
  if (!s || s.completed) return;

  s.completed = true;
  s.endedAt = Date.now();
  saveCurrentSession(s);
}

/* day change => auto-save yesterday session into history */
function autoSaveSessionOnDayChange() {
  if (isTestMode()) return;

  const nowKey  = dateKeyNow();
  const lastKey = localStorage.getItem(LS_LAST_DATEKEY) || nowKey;

  if (lastKey !== nowKey) {
    const s = loadCurrentSession();

    if (s && !s.autoSaved) {
      const shouldSave = (s.completed === true) || ((s.winners || []).length > 0);
      if (shouldSave) {
        s.autoSaved = true;
        if (!s.endedAt) s.endedAt = Date.now();

        const all = loadEventSessions();
        all.push(s);
        saveEventSessions(all);
      }
    }

    // start fresh for today
    startNewSession();

    localStorage.setItem(LS_LAST_DATEKEY, nowKey);
    renderEventHistoryViewer?.();
    renderWinnerListPanel?.();
    return;
  }

  localStorage.setItem(LS_LAST_DATEKEY, nowKey);
}
setInterval(autoSaveSessionOnDayChange, 20000);

/* ===========================
   Theme + Images
=========================== */
function applyThemeUI(uiColor, wheelAccent) {
  document.documentElement.style.setProperty("--ui", uiColor);
  document.documentElement.style.setProperty("--bg", uiColor);
  document.documentElement.style.setProperty("--gold", wheelAccent);
  document.documentElement.style.setProperty("--text", "#101318");
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function applyBanner(dataUrl, imgEl, fallbackEl) {
  if (!imgEl || !fallbackEl) return;
  if (dataUrl) {
    imgEl.src = dataUrl;
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    fallbackEl.style.display = "block";
  }
}
function applyPageBg(dataUrl) {
  if (!bgLayer) return;
  if (dataUrl) {
    bgLayer.classList.add("has-img");
    bgLayer.style.backgroundImage = `url("${dataUrl}")`;
  } else {
    bgLayer.classList.remove("has-img");
    bgLayer.style.backgroundImage = "";
  }
}
function applyWheelBg(dataUrl) {
  if (!wheelWrap) return;
  if (dataUrl) {
    wheelWrap.classList.add("has-img");
    wheelWrap.style.backgroundImage = `url("${dataUrl}")`;
  } else {
    wheelWrap.classList.remove("has-img");
    wheelWrap.style.backgroundImage = "";
  }
}
function applyWheelBanner(dataUrl) {
  if (!wheelBannerImg || !wheelBannerFallback) return;
  if (dataUrl) {
    wheelBannerImg.src = dataUrl;
    wheelBannerImg.style.display = "block";
    wheelBannerFallback.style.display = "none";
  } else {
    wheelBannerImg.style.display = "none";
    wheelBannerFallback.style.display = "block";
  }
}
/* ===========================
   CLEAN SCRIPT (V2) — PART 3/7
   API HELPERS + PRIZE BUILDER
=========================== */

/* ===========================
   API helpers
=========================== */
function getApiBase() {
  const s = loadSettings();
  return (s.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}
function getApiKey() {
  const s = loadSettings();
  return s.apiKey || DEFAULT_API_KEY;
}

async function fetchJsonWithTimeout(url, opt = {}, timeoutMs = 9000) {
  const ctrl = new AbortController();
  activeAbort = ctrl;
  const id = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, { ...opt, signal: ctrl.signal });
    const text = await r.text();
    let json = null;

    try { json = JSON.parse(text); }
    catch { json = { ok:false, error:"Invalid JSON", raw:String(text||"").slice(0,250) }; }

    if (!r.ok && json && json.ok !== true) {
      return { ok:false, error: json?.error || `HTTP ${r.status}` };
    }
    return json;
  } catch (e) {
    return { ok:false, error: e?.name==="AbortError" ? "Timeout/Cancelled" : (e?.message||String(e)) };
  } finally {
    clearTimeout(id);
    activeAbort = null;
  }
}

async function apiGet(path, timeoutMs = 9000) {
  const base = getApiBase();
  const key = getApiKey();
  const url = `${base}${path}?key=${encodeURIComponent(key)}`;
  return fetchJsonWithTimeout(url, {}, timeoutMs);
}

async function apiPost(path, body, timeoutMs = 12000) {
  const base = getApiBase();
  const key = getApiKey();
  const url = `${base}${path}?key=${encodeURIComponent(key)}`;
  return fetchJsonWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-api-key": key },
    body: JSON.stringify(body || {}),
  }, timeoutMs);
}

/* ===========================
   Prize Builder
=========================== */
function buildPrizeText(prizesArr) {
  return (prizesArr || [])
    .filter((p) => p && String(p.name || "").trim())
    .map((p) => `${String(p.name).trim()} ${clamp(Number(p.times || 1), 1, 9999)}time`)
    .join("\n");
}

function parseWheelColors(text) {
  const colors = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  return colors.length ? colors : ["#ffffff", "#f1f5ff"];
}

/* unique prizes for wheel display only */
function uniquePrizesFromPrizeText(prizeText) {
  const lines = String(prizeText || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();

  for (const line of lines) {
    let m = line.match(/^(.+?)\s+(\d+)\s*time$/i);
    if (!m) m = line.match(/^(.+?)\s+(\d+)$/i);
    if (!m) continue;

    const prize = m[1].trim();
    if (!prize || seen.has(prize)) continue;

    seen.add(prize);
    out.push(prize);
  }
  return out;
}

function renderPrizeBuilder(prizesArr) {
  if (!prizeBuilder) return;
  prizeBuilder.innerHTML = "";

  (prizesArr || []).forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "prize-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="pname">Prize</div>
      <input data-k="name" data-i="${idx}" value="${esc(p.name || "")}" placeholder="10000Ks">
    `;

    const right = document.createElement("div");
    right.className = "stepper";
    right.innerHTML = `
      <button data-act="dec" data-i="${idx}" title="-1">-</button>
      <input data-k="times" data-i="${idx}" type="number" min="1" max="9999"
             value="${clamp(Number(p.times || 1), 1, 9999)}">
      <button data-act="inc" data-i="${idx}" title="+1">+</button>
      <button class="btn mini danger" data-act="remove" data-i="${idx}" title="Remove Prize">Remove</button>
    `;

    row.appendChild(left);
    row.appendChild(right);
    prizeBuilder.appendChild(row);
  });

  /* Add */
  const addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.textContent = "+ Add Prize";
  addBtn.addEventListener("click", () => {
    const s = loadSettings();
    s.prizes = Array.isArray(s.prizes) ? s.prizes : [];
    s.prizes.push({ name: "", times: 1 });
    saveSettingsLocal(s);
    renderPrizeBuilder(s.prizes);
  });
  prizeBuilder.appendChild(addBtn);

  /* Stepper buttons */
  prizeBuilder.querySelectorAll("button[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      const s = loadSettings();

      s.prizes = Array.isArray(s.prizes) ? s.prizes : [];
      if (!s.prizes[i]) return;

      if (act === "remove") {
        s.prizes.splice(i, 1);
        if (s.prizes.length === 0) s.prizes.push({ name:"", times:1 });
        saveSettingsLocal(s);
        renderPrizeBuilder(s.prizes);
        return;
      }

      const cur = clamp(Number(s.prizes[i]?.times || 1), 1, 9999);
      s.prizes[i].times = clamp(cur + (act === "inc" ? 1 : -1), 1, 9999);

      saveSettingsLocal(s);
      renderPrizeBuilder(s.prizes);
    });
  });

  /* Inputs */
  prizeBuilder.querySelectorAll("input[data-k]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = Number(inp.dataset.i);
      const k = String(inp.dataset.k);
      const s = loadSettings();

      s.prizes = Array.isArray(s.prizes) ? s.prizes : [];
      if (!s.prizes[i]) return;

      if (k === "times") s.prizes[i].times = clamp(Number(inp.value || 1), 1, 9999);
      if (k === "name") s.prizes[i].name = String(inp.value || "");

      saveSettingsLocal(s);
    });
  });
}

/* Push prizes to Render */
async function pushPrizeConfigToRender(prizeText) {
  const r = await apiPost("/config/prizes", { prizeText }, 12000);
  if (!r?.ok) throw new Error(r?.error || "config/prizes error");
  return r;
}
/* ===========================
   CLEAN SCRIPT (V2) — PART 4/7
   WHEEL DRAW + PRIZE LANDING
=========================== */

let wheelPrizes = [];
let sliceColors = [];
let currentAngle = 0;
let spinning = false;

/* pointer is TOP */
const POINTER_ANGLE = -Math.PI / 2;

function normalizePrizeName(x) {
  return String(x || "").trim();
}

function drawWheel() {
  if (!wheelCanvas || !ctx) return;

  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const radius = Math.min(cx, cy) - 12;

  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  if (wheelPrizes.length < 2) {
    ctx.fillStyle = "#101318";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Add Prize List in Settings", cx, cy);
    return;
  }

  const slice = TAU / wheelPrizes.length;

  /* outer ring */
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, TAU);
  ctx.strokeStyle = "rgba(214,178,94,0.45)";
  ctx.lineWidth = 10;
  ctx.stroke();

  for (let i = 0; i < wheelPrizes.length; i++) {
    const start = currentAngle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();

    ctx.fillStyle = sliceColors[i % sliceColors.length] || "#fff";
    ctx.fill();

    ctx.strokeStyle = "rgba(16,19,24,0.06)";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* text */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#101318";
    ctx.font = "900 18px sans-serif";
    ctx.fillText(String(wheelPrizes[i] || ""), radius - 18, 6);
    ctx.restore();
  }

  /* center cap */
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(214,178,94,0.45)";
  ctx.lineWidth = 5;
  ctx.stroke();
}

/* calculate angle to land prize at POINTER_ANGLE */
function calcAngleToLandOnPrize(prize) {
  const p = normalizePrizeName(prize);
  const idx = wheelPrizes.findIndex((x) => normalizePrizeName(x) === p);
  if (idx < 0 || wheelPrizes.length < 2) return null;

  const slice = TAU / wheelPrizes.length;

  /* want: center of idx slice at pointer */
  let target = POINTER_ANGLE - (idx + 0.5) * slice;

  /* small jitter */
  const jitter = (Math.random() * 0.6 - 0.3) * (slice * 0.55);
  target += jitter;

  /* normalize */
  target = ((target % TAU) + TAU) % TAU;
  return target;
}
/* ===========================
   CLEAN SCRIPT (V2) — PART 5/7
   WINNER MODAL + PANELS
=========================== */

let lastWinner = null;

/* ===========================
   WINNER MODAL
=========================== */

function showWinnerModal(prize, winnerObj) {

  lastWinner = { prize, winner: winnerObj };

  const username = String(winnerObj.username || "").replace("@","").trim();
  const hasUsername = !!username;

  const name = String(winnerObj.name || "").trim();

  const display = String(
    winnerObj.display ||
    name ||
    (username ? `@${username}` : String(winnerObj.id || "-"))
  );

  winnerPrizeTitle.textContent = "WINNER";
  winnerTitleText.textContent  = prize;
  winnerNameText.textContent   = display;

  contactBtn.style.display = hasUsername ? "inline-flex" : "none";
  noticeBtn.style.display  = hasUsername ? "none" : "inline-flex";

  winnerHint.textContent = hasUsername
    ? "Username ရှိပါတယ် — Telegram နှိပ်ပါ"
    : "Username မရှိပါ — Notice နှိပ်ပါ";

  winnerModal.classList.remove("hidden");
  winChime();
}

function hideWinnerModal() {

  winnerModal.classList.add("hidden");
  lastWinner = null;

}

winnerCloseBtn?.addEventListener("click", hideWinnerModal);
winnerBackdrop?.addEventListener("click", hideWinnerModal);

/* Telegram contact */
contactBtn?.addEventListener("click", () => {

  if (!lastWinner) return;

  const u = String(lastWinner.winner.username || "")
    .replace("@","")
    .trim();

  if (!u) return;

  window.open(`https://t.me/${u}`, "_blank");

});

/* Notice DM */
noticeBtn?.addEventListener("click", async () => {

  if (!lastWinner) return;

  const w = lastWinner.winner;
  const prize = lastWinner.prize;

  showLoading("Sending DM...");

  try {

    const r = await apiPost("/notice", {
      user_id: w.id,
      prize
    },12000);

    if (r?.dm_ok) {
      alert("DM sent ✅");
    } else {
      alert("User hasn't started bot");
    }

  } catch(e) {

    alert("Notice error");

  } finally {

    hideLoading();

  }

});

/* ===========================
   PANELS
=========================== */

function showMembersPanel(){
  membersPanel?.classList.remove("hidden");
}

function hideMembersPanel(){
  membersPanel?.classList.add("hidden");
}

membersCloseBtn?.addEventListener("click", hideMembersPanel);

function showWinnerListPanel(){
  winnerListPanel?.classList.remove("hidden");
}

function hideWinnerListPanel(){
  winnerListPanel?.classList.add("hidden");
}

winnerListBtn?.addEventListener("click", () => {

  showWinnerListPanel();
  renderWinnerListPanel();

});

winnerListCloseBtn?.addEventListener("click", hideWinnerListPanel);

/* ===========================
   WINNER LIST RENDER
=========================== */

function btnDoneStyle(done){

  return done
    ? `style="background:#16a34a;color:#fff;border-color:#16a34a"`
    : "";

}

function renderWinnerListPanel(){

  if (!winnerListBody) return;

  if (isTestMode()){

    winnerListBody.innerHTML =
      `<div class="small">Test Mode ON</div>`;

    return;

  }

  const s = loadCurrentSession();

  const winners = Array.isArray(s?.winners)
    ? s.winners
    : [];

  if (!winners.length){

    winnerListBody.innerHTML =
      `<div class="small">Winner List empty</div>`;

    return;

  }

  const rows = winners.map((w,i)=>{

    const done = !!w.done;

    return `<tr>

      <td>${i+1}</td>

      <td><b>Spin #${i+1}</b> - ${esc(w.prize)}</td>

      <td>${esc(w.display)}</td>

      <td>${esc(w.id)}</td>

      <td>
      <button
      class="btn mini js-prize-done"
      data-id="${esc(w.id)}"
      ${btnDoneStyle(done)}
      >
      ${done ? "Done" : "Prize Done"}
      </button>
      </td>

    </tr>`;

  }).join("");

  winnerListBody.innerHTML = `

  <div class="small" style="margin-bottom:8px">

  Winner List • Total: <b>${winners.length}</b>

  </div>

  <table class="table">

  <thead>

  <tr>

  <th>No</th>
  <th>Spin</th>
  <th>Name</th>
  <th>ID</th>
  <th>Done</th>

  </tr>

  </thead>

  <tbody>

  ${rows}

  </tbody>

  </table>
  `;

}
/* ===========================
   CLEAN SCRIPT (V2) — PART 6/7
   MEMBERS + BUTTONS + SPIN
=========================== */

/* ===========================
   MEMBERS TABLE
=========================== */

function contactButtonHTML(m){

  const username = m.username
    ? String(m.username).replace("@","").trim()
    : "";

  const id = String(m.id || "");

  if (username){

    return `<button class="btn mini js-telegram"
    data-user="${esc(username)}">
    Telegram
    </button>`;

  }

  return `<button class="btn mini js-notice"
  data-id="${esc(id)}">
  Notice
  </button>`;

}

async function loadMembersUI(){

  showMembersPanel();

  membersTable.innerHTML = "Loading...";

  try{

    const data = await apiGet("/members",15000);

    if (!data?.ok) throw new Error();

    const list = data.members || [];

    membersTotalText.textContent =
      ` • Total: ${list.length}`;

    const rows = list.map((m,i)=>{

      const username = m.username
        ? "@"+m.username
        : "-";

      return `<tr>

      <td>${i+1}</td>

      <td>${esc(m.display||"-")}</td>

      <td>${esc(username)}</td>

      <td>${esc(m.id)}</td>

      <td>${contactButtonHTML(m)}</td>

      </tr>`;

    }).join("");

    membersTable.innerHTML = `

    <table class="table">

    <thead>

    <tr>
    <th>No</th>
    <th>Name</th>
    <th>Username</th>
    <th>ID</th>
    <th>Action</th>
    </tr>

    </thead>

    <tbody>

    ${rows}

    </tbody>

    </table>`;

  }catch{

    membersTable.innerHTML = "Error loading members";

  }

}

membersBtn?.addEventListener("click", loadMembersUI);


/* ===========================
   BUTTON DELEGATION
=========================== */

document.addEventListener("click", async (e)=>{

  const btn = e.target.closest("button");

  if(!btn) return;

  /* Telegram */
  if (btn.classList.contains("js-telegram")){

    const user = btn.dataset.user;

    window.open(`https://t.me/${user}`,"_blank");

    return;

  }

  /* Notice */
  if (btn.classList.contains("js-notice")){

    const id = btn.dataset.id;

    showLoading("Sending DM...");

    try{

      const r = await apiPost("/notice",{user_id:id},12000);

      if (r?.dm_ok){
        alert("DM sent");
      }else{
        alert("User didn't start bot");
      }

    }catch{

      alert("DM error");

    }finally{

      hideLoading();

    }

    return;

  }

  /* Prize Done */
  if (btn.classList.contains("js-prize-done")){

    const id = btn.dataset.id;

    const doneNow = togglePrizeDone(id);

    if(doneNow){

      btn.textContent="Done";
      btn.style.background="#16a34a";
      btn.style.color="#fff";

    }else{

      btn.textContent="Prize Done";
      btn.style.background="";
      btn.style.color="";

    }

    renderWinnerListPanel();

  }

});


/* ===========================
   RESTART SPIN
=========================== */

restartSpinBtn?.addEventListener("click", async ()=>{

  showLoading("Restarting...");

  try{

    const r = await apiPost("/restart-spin",{},12000);

    if (!r?.ok) throw new Error();

    hideWinnerModal();

    if (!isTestMode()) startNewSession();

    await refreshPoolUI();

    renderWinnerListPanel();

    alert("Restart Done");

  }catch{

    alert("Restart Error");

  }finally{

    hideLoading();

  }

});


/* ===========================
   SPIN SYSTEM
=========================== */

async function spin(){

  if(spinning) return;

  if(wheelPrizes.length<2){

    alert("Add prize first");

    return;

  }

  spinning=true;

  spinBtn.disabled=true;

  spinBtn.textContent="SPIN...";

  showLoading("Spinning...");

  let result;

  try{

    result = await apiPost("/spin",{},12000);

    if(!result?.ok) throw new Error();

  }catch{

    spinning=false;

    spinBtn.disabled=false;

    spinBtn.textContent="SPIN";

    hideLoading();

    alert("Spin error");

    return;

  }

  hideLoading();

  const prize = result.prize;

  const winner = result.winner || {};

  let targetAngle = calcAngleToLandOnPrize(prize);

  if(targetAngle===null){

    targetAngle = Math.random()*TAU;

  }

  const extraSpins = 7 + Math.random()*6;

  const currentNorm =
    ((currentAngle % TAU)+TAU)%TAU;

  const delta =
    ((targetAngle-currentNorm)+TAU)%TAU;

  const finalAngle =
    currentAngle + extraSpins*TAU + delta;

  const duration=3200;

  const startTime=performance.now();

  const startAngle=currentAngle;

  function ease(t){

    return 1-Math.pow(1-t,3);

  }

  function animate(now){

    const elapsed=now-startTime;

    const t=Math.min(elapsed/duration,1);

    const eased=ease(t);

    currentAngle =
      startAngle+(finalAngle-startAngle)*eased;

    drawWheel();

    if(t<1){

      requestAnimationFrame(animate);

    }else{

      showWinnerModal(prize,winner);

      spinning=false;

      spinBtn.disabled=false;

      spinBtn.textContent="SPIN";

    }

  }

  requestAnimationFrame(animate);

}

spinBtn?.addEventListener("click", spin);
/* ===========================
   CLEAN SCRIPT (V2) — PART 7/7 (FINAL)
   POOL + SETTINGS + HISTORY + INIT
=========================== */

/* ===========================
   POOL UI
=========================== */
async function refreshPoolUI(){

  try{

    const data = await apiGet("/pool",7000);

    if(!data?.ok) throw new Error();

    poolText.textContent =
      `${data.count||0} people in pool`;

    // pool 0 => mark completed
    markSessionCompletedIfPoolEmpty(data.count||0);

    // day change autosave
    autoSaveSessionOnDayChange();

    renderWinnerListPanel();
    renderEventHistoryViewer();

  }catch{

    poolText.textContent = "Pool: error";

  }

}


/* ===========================
   SETTINGS SAVE
=========================== */
saveBtn?.addEventListener("click", async ()=>{

  const s = loadSettings();

  s.apiBase = (apiBaseInput.value||DEFAULT_API_BASE).trim();
  s.apiKey  = (apiKeyInput.value||DEFAULT_API_KEY).trim();

  s.uiColor      = uiColorInput.value || "#ffffff";
  s.wheelAccent  = wheelAccentInput.value || "#d6b25e";
  s.wheelColorsText = wheelColorsInput.value || defaultSettings.wheelColorsText;

  saveSettingsLocal(s);

  applyThemeUI(s.uiColor,s.wheelAccent);

  sliceColors = parseWheelColors(s.wheelColorsText);

  const prizeText = buildPrizeText(s.prizes);

  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  drawWheel();

  showLoading("Saving...");

  try{

    // Real mode only => push prizes
    if(!isTestMode()){

      await pushPrizeConfigToRender(prizeText);

      await refreshPoolUI();

    }

    closeSettings();

    alert("Save ✅");

  }catch{

    alert("Save Error");

  }finally{

    hideLoading();

  }

});


/* ===========================
   RESET
=========================== */
resetBtn?.addEventListener("click", ()=>{

  if(!confirm("Reset settings?")) return;

  saveSettingsLocal(clone(defaultSettings));

  clearCache();

  localStorage.removeItem(LS_WINNERS_KEY);

  init();

  alert("Reset Done ✅");

});


/* ===========================
   FILE INPUTS
=========================== */
pageBgFile?.addEventListener("change", async (e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  const s=loadSettings();

  s.pageBgDataUrl=await fileToDataURL(f);

  saveSettingsLocal(s);

  applyPageBg(s.pageBgDataUrl);

});

wheelBgFile?.addEventListener("change", async (e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  const s=loadSettings();

  s.wheelBgDataUrl=await fileToDataURL(f);

  saveSettingsLocal(s);

  applyWheelBg(s.wheelBgDataUrl);

});

topBannerFile?.addEventListener("change", async (e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  const s=loadSettings();

  s.topBannerDataUrl=await fileToDataURL(f);

  saveSettingsLocal(s);

  applyBanner(s.topBannerDataUrl,topBannerImg,topBannerFallback);

});

bottomBannerFile?.addEventListener("change", async (e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  const s=loadSettings();

  s.bottomBannerDataUrl=await fileToDataURL(f);

  saveSettingsLocal(s);

  applyBanner(s.bottomBannerDataUrl,bottomBannerImg,bottomBannerFallback);

});

wheelBannerFile?.addEventListener("change", async (e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  const s=loadSettings();

  s.wheelBannerDataUrl=await fileToDataURL(f);

  saveSettingsLocal(s);

  applyWheelBanner(s.wheelBannerDataUrl);

});

bgSongFile?.addEventListener("change",(e)=>{

  const f=e.target.files?.[0];

  if(!f) return;

  bgMusic.src = URL.createObjectURL(f);

  if(musicOn) bgMusic.play().catch(()=>{});

});


/* ===========================
   EVENT HISTORY BUTTONS
=========================== */
refreshEventHistoryBtn?.addEventListener("click", ()=>{

  autoSaveSessionOnDayChange();

  renderEventHistoryViewer();

  renderWinnerListPanel();

});

exportEventHistoryBtn?.addEventListener("click", ()=>{

  const data = {

    saved: loadEventSessions(),

    current: loadCurrentSession()

  };

  const blob = new Blob(
    [JSON.stringify(data,null,2)],
    {type:"application/json"}
  );

  const url = URL.createObjectURL(blob);

  const a=document.createElement("a");

  a.href=url;

  a.download="lucky77_event_history.json";

  a.click();

  setTimeout(()=>URL.revokeObjectURL(url),1000);

});

clearEventHistoryBtn?.addEventListener("click", ()=>{

  if(!confirm("Clear ALL history?")) return;

  localStorage.removeItem(LS_EVENT_HISTORY);

  localStorage.removeItem(LS_CURRENT_SESSION);

  renderEventHistoryViewer();

  renderWinnerListPanel();

  alert("Cleared ✅");

});


/* ===========================
   INIT
=========================== */
function init(){

  const s = loadSettings();

  apiBaseInput.value = s.apiBase || DEFAULT_API_BASE;

  apiKeyInput.value  = s.apiKey  || DEFAULT_API_KEY;

  uiColorInput.value = s.uiColor || "#ffffff";

  wheelAccentInput.value =
    s.wheelAccent || "#d6b25e";

  wheelColorsInput.value =
    s.wheelColorsText || defaultSettings.wheelColorsText;

  applyThemeUI(s.uiColor,s.wheelAccent);

  applyPageBg(s.pageBgDataUrl||"");

  applyWheelBg(s.wheelBgDataUrl||"");

  applyBanner(s.topBannerDataUrl||"",topBannerImg,topBannerFallback);

  applyBanner(s.bottomBannerDataUrl||"",bottomBannerImg,bottomBannerFallback);

  applyWheelBanner(s.wheelBannerDataUrl||"");

  renderPrizeBuilder(s.prizes||clone(defaultSettings.prizes));

  sliceColors = parseWheelColors(s.wheelColorsText);

  const prizeText = buildPrizeText(s.prizes||[]);

  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  drawWheel();

  updateMusicBtn();

  setTestMode(isTestMode());

  localStorage.setItem(LS_LAST_DATEKEY,dateKeyNow());

  if(!isTestMode()) ensureSession();

  refreshPoolUI();

  renderEventHistoryViewer();

  renderWinnerListPanel();

}

init();