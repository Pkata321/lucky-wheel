"use strict";

/* ===========================
   PART 1/6 — BASE + DOM + LOADING + MUSIC + UTILS
=========================== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";
const TAU = Math.PI * 2;

/* ---------- DOM ---------- */
const wheelCanvas = document.getElementById("wheel");
const ctx = wheelCanvas?.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const poolText = document.getElementById("poolText");

const drawer = document.getElementById("drawer");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

const apiBaseInput = document.getElementById("apiBaseInput");
const apiKeyInput  = document.getElementById("apiKeyInput");

const prizeBuilder = document.getElementById("prizeBuilder");
const uiColorInput = document.getElementById("uiColorInput");
const wheelAccentInput = document.getElementById("wheelAccentInput");
const wheelColorsInput = document.getElementById("wheelColorsInput");

const topBannerFile = document.getElementById("topBannerFile");
const bottomBannerFile = document.getElementById("bottomBannerFile");
const pageBgFile = document.getElementById("pageBgFile");
const wheelBgFile = document.getElementById("wheelBgFile");
const bgSongFile = document.getElementById("bgSongFile");
const wheelBannerFile = document.getElementById("wheelBannerFile");

const topBannerImg = document.getElementById("topBannerImg");
const bottomBannerImg = document.getElementById("bottomBannerImg");
const topBannerFallback = document.getElementById("topBannerFallback");
const bottomBannerFallback = document.getElementById("bottomBannerFallback");

const wheelBannerImg = document.getElementById("wheelBannerImg");
const wheelBannerFallback = document.getElementById("wheelBannerFallback");

const bgLayer = document.getElementById("bgLayer");
const wheelWrap = document.getElementById("wheelWrap");

const restartSpinBtn = document.getElementById("restartSpinBtn");
const membersBtn = document.getElementById("membersBtn");
const winnerListBtn = document.getElementById("winnerListBtn");

const membersPanel = document.getElementById("membersPanel");
const membersCloseBtn = document.getElementById("membersCloseBtn");
const membersTable = document.getElementById("membersTable");
const membersTotalText = document.getElementById("membersTotalText");

const winnerListPanel = document.getElementById("winnerListPanel");
const winnerListCloseBtn = document.getElementById("winnerListCloseBtn");
const winnerListBody = document.getElementById("winnerListBody");
const winnerListTotalText = document.getElementById("winnerListTotalText");

const refreshMembersInSettingsBtn = document.getElementById("refreshMembersInSettingsBtn");
const membersInSettings = document.getElementById("membersInSettings");

/* Winner Modal */
const winnerModal = document.getElementById("winnerModal");
const winnerBackdrop = document.getElementById("winnerBackdrop");
const winnerPrizeTitle = document.getElementById("winnerPrizeTitle");
const winnerTitleText = document.getElementById("winnerTitleText");
const winnerNameText = document.getElementById("winnerNameText");
const contactBtn = document.getElementById("contactBtn");
const noticeBtn = document.getElementById("noticeBtn");
const winnerCloseBtn = document.getElementById("winnerCloseBtn");
const winnerHint = document.getElementById("winnerHint");

/* Test Mode UI */
const testModeBtn = document.getElementById("testModeBtn");
const clearTestHistoryBtn = document.getElementById("clearTestHistoryBtn");

/* Event History Viewer UI */
const refreshEventHistoryBtn = document.getElementById("refreshEventHistoryBtn");
const exportEventHistoryBtn  = document.getElementById("exportEventHistoryBtn");
const clearEventHistoryBtn   = document.getElementById("clearEventHistoryBtn");
const eventHistoryViewer     = document.getElementById("eventHistoryViewer");

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
const loadingCancelBtn = document.getElementById("loadingCancelBtn");
loadingCancelBtn?.addEventListener("click", hideLoading);

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
    if (bgMusic.src) {
      try { await bgMusic.play(); } catch {}
    } else {
      alert("Settings ထဲမှာ MP3 Upload လုပ်ပါ");
      musicOn = false;
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

/* ---------- Settings Drawer ---------- */
function openSettings() { drawer?.classList.add("open"); }
function closeSettings() { drawer?.classList.remove("open"); }
settingsBtn?.addEventListener("click", openSettings);
closeSettingsBtn?.addEventListener("click", closeSettings);
/* ===========================
   PART 2/6 — STORAGE + TEST MODE + SESSION SYSTEM
=========================== */

/* ---------- Storage Keys ---------- */
const STORAGE_KEY = "lucky77_vercel_v2";
const CACHE_MEMBERS_KEY = "lucky77_cache_members";

const LS_WINNERS_KEY = "lucky77_winner_prize_map_v1";
const LS_TEST_MODE = "lucky77_test_mode_v1";

const LS_EVENT_HISTORY   = "lucky77_event_sessions_v1";
const LS_CURRENT_SESSION = "lucky77_current_session_v1";
const LS_LAST_DATEKEY    = "lucky77_last_datekey_v1";

/* ---------- Default Settings ---------- */
const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey: DEFAULT_API_KEY,

  uiColor: "#ffffff",
  wheelAccent: "#d6b25e",
  wheelColorsText: "#ffffff\n#f1f5ff\n#fff4d6\n#e9eefc",

  prizes: [
    { name: "10000Ks", times: 4 },
    { name: "5000Ks", times: 2 },
    { name: "3000Ks", times: 3 },
    { name: "2000Ks", times: 5 },
    { name: "1000Ks", times: 10 }
  ],

  pageBgDataUrl: "",
  wheelBgDataUrl: "",
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: ""
};

/* ---------- Clone ---------- */
function clone(x) {
  try { return structuredClone(x); }
  catch { return JSON.parse(JSON.stringify(x)); }
}

/* ---------- Settings Load ---------- */
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ---------- Cache (members) ---------- */
function saveCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({
      at: Date.now(),
      value
    }));
  } catch {}
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    return obj?.value ?? null;

  } catch {
    return null;
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_MEMBERS_KEY);
  } catch {}
}

/* ===========================
   TEST MODE
=========================== */

function isTestMode() {
  return localStorage.getItem(LS_TEST_MODE) === "1";
}

function setTestMode(v) {
  localStorage.setItem(LS_TEST_MODE, v ? "1" : "0");

  if (testModeBtn) {
    testModeBtn.textContent = v ? "Test: ON" : "Test: OFF";
  }
}

testModeBtn?.addEventListener("click", () => {

  const next = !isTestMode();
  setTestMode(next);

  alert(
    next
      ? "Test Mode ON (Winner မသိမ်းပါ)"
      : "Test Mode OFF (Winner အတည် သိမ်းမယ်)"
  );

  renderWinnerListPanel();
  renderEventHistoryViewer();
});

clearTestHistoryBtn?.addEventListener("click", () => {

  if (!confirm("Clear Test Winner Map လုပ်မလား?")) return;

  localStorage.removeItem(LS_WINNERS_KEY);

  alert("Cleared ✅");

  renderWinnerListPanel();
});

/* ===========================
   WINNER QUICK MAP
=========================== */

function loadWinnerPrizeMap() {
  try {
    return JSON.parse(localStorage.getItem(LS_WINNERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveWinnerPrizeMap(map) {
  try {
    localStorage.setItem(LS_WINNERS_KEY, JSON.stringify(map || {}));
  } catch {}
}

function setWinnerPrize(id, prizeText) {

  const map = loadWinnerPrizeMap();

  map[String(id)] = {
    prize: String(prizeText || "-"),
    done: false,
    at: Date.now()
  };

  saveWinnerPrizeMap(map);
}

function togglePrizeDone(id) {

  const map = loadWinnerPrizeMap();
  const k = String(id);

  map[k] = map[k] || {
    prize: "-",
    done: false,
    at: Date.now()
  };

  map[k].done = !map[k].done;
  map[k].at = Date.now();

  saveWinnerPrizeMap(map);

  return map[k].done;
}

/* ===========================
   SESSION SYSTEM
=========================== */

function loadEventSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_EVENT_HISTORY) || "[]");
  } catch {
    return [];
  }
}

function saveEventSessions(arr) {
  try {
    localStorage.setItem(LS_EVENT_HISTORY, JSON.stringify(arr || []));
  } catch {}
}

function loadCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_CURRENT_SESSION) || "null");
  } catch {
    return null;
  }
}

function saveCurrentSession(obj) {
  try {
    localStorage.setItem(LS_CURRENT_SESSION, JSON.stringify(obj || null));
  } catch {}
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
    winners: []
  };

  saveCurrentSession(session);

  return session;
}

function ensureSession() {

  if (isTestMode()) return null;

  let s = loadCurrentSession();

  if (!s) {
    s = startNewSession();
  }

  return s;
}
/* ===========================
   PART 3/6 — THEME + IMAGES + API + PRIZE BUILDER
=========================== */

/* ===========================
   THEME
=========================== */
function applyThemeUI(uiColor, wheelAccent) {
  document.documentElement.style.setProperty("--ui", uiColor);
  document.documentElement.style.setProperty("--bg", uiColor);
  document.documentElement.style.setProperty("--gold", wheelAccent);
  document.documentElement.style.setProperty("--text", "#101318");
}

/* ===========================
   IMAGE HELPERS
=========================== */

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
   API HELPERS
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

    const r = await fetch(url, {
      ...opt,
      signal: ctrl.signal
    });

    const text = await r.text();

    let json = null;

    try {
      json = JSON.parse(text);
    } catch {
      json = {
        ok: false,
        error: "Invalid JSON"
      };
    }

    if (!r.ok && json && json.ok !== true) {

      return {
        ok: false,
        error: json?.error || `HTTP ${r.status}`
      };

    }

    return json;

  } catch (e) {

    return {
      ok: false,
      error: e?.name === "AbortError"
        ? "Timeout/Cancelled"
        : (e?.message || String(e))
    };

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

  return fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key
      },
      body: JSON.stringify(body || {})
    },
    timeoutMs
  );
}

/* ===========================
   PRIZE BUILDER
=========================== */

function buildPrizeText(prizesArr) {

  return (prizesArr || [])
    .filter((p) => p && String(p.name || "").trim())
    .map((p) =>
      `${String(p.name).trim()} ${clamp(Number(p.times || 1), 1, 9999)}time`
    )
    .join("\n");
}

function parseWheelColors(text) {

  const colors = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  return colors.length ? colors : ["#ffffff", "#f1f5ff"];
}

function uniquePrizesFromPrizeText(prizeText) {

  const lines = String(prizeText || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const line of lines) {

    let m = line.match(/^(.+?)\s+(\d+)\s*time$/i);

    if (!m) {
      m = line.match(/^(.+?)\s+(\d+)$/i);
    }

    if (!m) continue;

    const prize = m[1].trim();

    if (!prize || seen.has(prize)) continue;

    seen.add(prize);
    out.push(prize);
  }

  return out;
}
/* ===========================
   PART 4/6 — WHEEL DRAW + SPIN + WINNER MODAL
=========================== */

/* ===========================
   WHEEL DRAW (Prize Match)
=========================== */

let wheelPrizes = [];
let sliceColors = [];
let currentAngle = 0;
let spinning = false;

/* pointer selection point at TOP (CSS pointer is TOP)
   Canvas: -90deg = top => POINTER_ANGLE = -PI/2 */
const POINTER_ANGLE = -Math.PI / 2;

function normalizePrizeName(x) {
  return String(x || "").trim();
}

function drawWheel() {

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

  // outer ring
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

    // text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#101318";
    ctx.font = "900 18px sans-serif";
    ctx.fillText(wheelPrizes[i], radius - 18, 6);
    ctx.restore();
  }

  // center cap
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

  // want: center of idx slice at POINTER_ANGLE
  let target = POINTER_ANGLE - (idx + 0.5) * slice;

  // jitter small
  const jitter = (Math.random() * 0.6 - 0.3) * (slice * 0.55);
  target += jitter;

  // normalize [0,TAU)
  target = ((target % TAU) + TAU) % TAU;

  return target;
}

/* ===========================
   WINNER MODAL
=========================== */

let lastWinner = null;

function showWinnerModal(prize, winnerObj) {

  lastWinner = { prize, winner: winnerObj };

  const username = String(winnerObj.username || "").replace("@", "").trim();
  const hasUsername = !!username;

  const name = String(winnerObj.name || "").trim();

  const display = String(
    winnerObj.display ||
    name ||
    (username ? `@${username}` : String(winnerObj.id || "-"))
  );

  winnerPrizeTitle.textContent = "WINNER";
  winnerTitleText.textContent = String(prize || "—");
  winnerNameText.textContent = display;

  contactBtn.style.display = hasUsername ? "inline-flex" : "none";
  noticeBtn.style.display = hasUsername ? "none" : "inline-flex";

  winnerHint.textContent = hasUsername
    ? "✅ Username ရှိလို့ Telegram အကောင့်ကို တန်းဖွင့်နိုင်ပါတယ်"
    : "✅ Username မရှိလို့ Notice နှိပ်ရင် Bot က DM ပို့မယ်";

  winnerModal.classList.remove("hidden");
  winnerModal.setAttribute("aria-hidden", "false");

  winChime();
}

function hideWinnerModal() {

  winnerModal.classList.add("hidden");
  winnerModal.setAttribute("aria-hidden", "true");

  lastWinner = null;
}

winnerCloseBtn?.addEventListener("click", hideWinnerModal);
winnerBackdrop?.addEventListener("click", hideWinnerModal);

contactBtn?.addEventListener("click", () => {

  if (!lastWinner) return;

  const u = String(lastWinner.winner.username || "")
    .replace("@", "")
    .trim();

  if (!u) return;

  window.open(`https://t.me/${u}`, "_blank");
});

noticeBtn?.addEventListener("click", async () => {

  if (!lastWinner) return;

  const w = lastWinner.winner;
  const prize = lastWinner.prize;

  const username = String(w.username || "").replace("@", "").trim();

  if (username) {
    window.open(`https://t.me/${username}`, "_blank");
    return;
  }

  showLoading("Sending Notice (DM)...");

  try {

    const r = await apiPost("/notice", { user_id: w.id, prize }, 12000);

    if (!r?.ok) throw new Error(r?.error || "notice failed");

    if (r.dm_ok) {
      alert("✅ DM ပို့ပြီးပါပြီ");
    } else {
      alert("⚠️ DM မပို့နိုင်သေးပါ။ User က Bot ကို Start မလုပ်သေးနိုင်ပါတယ်");
    }

  } catch (e) {

    alert("Notice error: " + (e.message || e));

  } finally {

    hideLoading();

  }
});

/* ===========================
   SPIN (Prize match 100%)
=========================== */

async function spin() {

  if (spinning) return;

  if (wheelPrizes.length < 2) {
    alert("Settings ထဲမှာ Prize (အနည်းဆုံး 2 ခု) ထည့်ပါ");
    return;
  }

  spinning = true;

  spinBtn.disabled = true;

  const oldText = spinBtn.textContent;
  spinBtn.textContent = "SPIN...";

  showLoading("Spinning...");

  let result;

  try {

    result = await apiPost("/spin", {}, 12000);

    if (!result?.ok) throw new Error(result?.error || "spin error");

  } catch (e) {

    spinning = false;
    spinBtn.disabled = false;
    spinBtn.textContent = oldText;

    hideLoading();

    alert("Spin error: " + (e.message || e));

    return;

  } finally {

    hideLoading();

  }

  const prize = String(result.prize || "-");
  const winner = result.winner || {};

  let targetAngle = calcAngleToLandOnPrize(prize);

  if (targetAngle === null) targetAngle = Math.random() * TAU;

  if (musicOn && bgMusic.src) {
    bgMusic.play().catch(() => {});
  }

  const extraSpins = 7 + Math.random() * 6;

  const currentNorm = ((currentAngle % TAU) + TAU) % TAU;
  const delta = ((targetAngle - currentNorm) + TAU) % TAU;

  const finalAngle = currentAngle + extraSpins * TAU + delta;

  const duration = 3200;

  const startTime = performance.now();
  const startAngle = currentAngle;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  let tickT = 0;

  function animate(now) {

    const elapsed = now - startTime;

    const t = Math.min(elapsed / duration, 1);

    const eased = easeOutCubic(t);

    currentAngle = startAngle + (finalAngle - startAngle) * eased;

    drawWheel();

    const nt = Math.floor(eased * 60);

    if (nt !== tickT) {
      tickT = nt;
      tickSound(600 + nt * 10, 0.015, 0.04);
    }

    if (t < 1) {

      requestAnimationFrame(animate);

    } else {

      const landedPrize = prize;

      const wid = winner?.id ?? winner?.user_id ?? winner?.winner_id;

      if (wid) setWinnerPrize(wid, landedPrize);

      // save into current session (Test OFF)
      if (!isTestMode()) {

        const s = ensureSession();

        if (s) {

          const username = String(winner?.username || "").replace("@", "").trim();

          const display = String(
            winner?.display ||
            winner?.name ||
            (username ? `@${username}` : String(wid || "-"))
          );

          const order = (s.winners?.length || 0) + 1;

          s.winners = Array.isArray(s.winners) ? s.winners : [];

          s.winners.push({
            at: Date.now(),
            order,
            id: String(wid || "-"),
            display,
            username,
            prize: landedPrize,
            done: false
          });

          saveCurrentSession(s);

        }
      }

      showWinnerModal(landedPrize, winner);

      // update UI
      renderWinnerListPanel();
      refreshPoolUI();

      spinning = false;

      spinBtn.disabled = false;
      spinBtn.textContent = oldText;

    }
  }

  requestAnimationFrame(animate);
}

spinBtn?.addEventListener("click", spin);
/* ===========================
   PART 5/6 — MEMBERS + WINNER LIST PANELS
=========================== */

/* ===========================
   PANELS
=========================== */

function showMembersPanel() {
  membersPanel?.classList.remove("hidden");
}

function hideMembersPanel() {
  membersPanel?.classList.add("hidden");
}

membersCloseBtn?.addEventListener("click", hideMembersPanel);

function showWinnerListPanel() {
  winnerListPanel?.classList.remove("hidden");
}

function hideWinnerListPanel() {
  winnerListPanel?.classList.add("hidden");
}

winnerListBtn?.addEventListener("click", () => {
  showWinnerListPanel();
  renderWinnerListPanel();
});

winnerListCloseBtn?.addEventListener("click", hideWinnerListPanel);

/* ===========================
   MEMBERS UI
=========================== */

function contactButtonHTML(m) {

  const username = m.username ? String(m.username).replace("@", "").trim() : "";
  const id = String(m.id || "");
  const name = String(m.display || m.name || "-");

  if (m.active === false) {
    return `<span class="small">inactive</span>`;
  }

  if (username) {
    return `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`;
  }

  return `<button class="btn mini js-notice"
    data-id="${esc(id)}"
    data-prize=""
    data-name="${esc(name)}"
  >Notice</button>`;
}

async function loadMembersUI() {

  showMembersPanel();

  membersTotalText.textContent = "";

  const cached = readCache(CACHE_MEMBERS_KEY);

  if (Array.isArray(cached)) {

    membersTotalText.textContent = ` • Total: ${cached.length} (cached)`;

    renderMembersTable(cached);

  } else {

    membersTable.innerHTML = `<div class="small">Loading...</div>`;

  }

  showLoading("Loading Members...");

  try {

    const data = await apiGet("/members", 15000);

    if (!data?.ok) throw new Error(data?.error || "members error");

    const list = Array.isArray(data.members) ? data.members : [];

    membersTotalText.textContent = ` • Total: ${list.length}`;

    renderMembersTable(list);

    saveCache(CACHE_MEMBERS_KEY, list);

  } catch (e) {

    membersTable.insertAdjacentHTML(
      "afterbegin",
      `<div class="small">⚠️ ${esc(e.message || e)}</div>`
    );

  } finally {

    hideLoading();

  }
}

function renderMembersTable(list) {

  const rows = (list || []).map((m, i) => {

    const username = m.username ? `@${String(m.username).replace("@", "")}` : "-";

    const won = m.isWinner ? "✅" : "";

    const status = (m.active === false) ? "❌ INACTIVE" : "✅ ACTIVE";

    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(m.display || "-")}</td>
      <td>${esc(username)}</td>
      <td>${esc(String(m.id || "-"))}</td>
      <td>${won}</td>
      <td>${status}</td>
      <td>${contactButtonHTML(m)}</td>
    </tr>`;

  }).join("");

  membersTable.innerHTML = `
  <table class="table">
  <thead>
  <tr>
  <th>No.</th>
  <th>Name</th>
  <th>Username</th>
  <th>ID</th>
  <th>Won</th>
  <th>Status</th>
  <th>Action</th>
  </tr>
  </thead>
  <tbody>
  ${rows || `<tr><td colspan="7">No members yet</td></tr>`}
  </tbody>
  </table>`;
}

/* ===========================
   WINNER LIST PANEL
=========================== */

function btnDoneStyle(done) {

  if (done) {
    return `style="background:#16a34a;color:#fff;border-color:#16a34a;"`;
  }

  return "";
}

function actionBtnForWinner(w) {

  const username = String(w.username || "").replace("@", "").trim();
  const id = String(w.id || "");
  const name = String(w.display || "-");

  if (username) {

    return `<button class="btn mini js-telegram"
      data-user="${esc(username)}"
    >Telegram</button>`;

  }

  return `<button class="btn mini js-notice"
    data-id="${esc(id)}"
    data-prize="${esc(String(w.prize||""))}"
    data-name="${esc(name)}"
  >Notice</button>`;
}

function renderWinnerListPanel() {

  if (!winnerListBody) return;

  if (isTestMode()) {

    winnerListBody.innerHTML =
      `<div class="small">Test Mode ON → Winner List မသိမ်းပါ</div>`;

    return;
  }

  const s = loadCurrentSession();

  const winners = Array.isArray(s?.winners) ? s.winners : [];

  if (!winners.length) {

    winnerListBody.innerHTML =
      `<div class="small">Winner List: (empty)</div>`;

    return;
  }

  const rows = winners.map((w, idx) => {

    const done = !!w.done;

    const doneBtn = `
      <button
        class="btn mini js-prize-done"
        data-id="${esc(String(w.id||""))}"
        ${btnDoneStyle(done)}
      >
      ${done ? "Done ✅" : "Prize Done"}
      </button>`;

    return `<tr>
      <td>${idx + 1}</td>
      <td><b>Spin #${idx + 1}</b> - ${esc(String(w.prize || "-"))}</td>
      <td>${esc(String(w.display || "-"))}</td>
      <td>${esc(String(w.id || "-"))}</td>
      <td>${doneBtn}</td>
      <td>${actionBtnForWinner(w)}</td>
    </tr>`;

  }).join("");

  winnerListBody.innerHTML = `
  <div class="small" style="margin-bottom:8px;">
  Winner List • Total: <b>${winners.length}</b>
  </div>

  <table class="table">
  <thead>
  <tr>
  <th>No.</th>
  <th>Spin</th>
  <th>Name</th>
  <th>ID</th>
  <th>Prize Done</th>
  <th>Action</th>
  </tr>
  </thead>

  <tbody>
  ${rows}
  </tbody>
  </table>
  `;
}

/* ===========================
   BUTTON DELEGATION
=========================== */

document.addEventListener("click", async (e) => {

  const btn = e.target.closest("button");

  if (!btn) return;

  /* Telegram button */

  if (btn.classList.contains("js-telegram")) {

    const user = (btn.dataset.user || "").replace("@", "").trim();

    if (!user) return;

    window.open(`https://t.me/${user}`, "_blank");

    return;
  }

  /* Notice button */

  if (btn.classList.contains("js-notice")) {

    const userId = btn.dataset.id;
    const prize = btn.dataset.prize || "";

    if (!userId) return;

    showLoading("Sending Notice...");

    try {

      const r = await apiPost("/notice", {
        user_id: userId,
        prize
      }, 12000);

      if (r?.dm_ok) {
        alert("✅ DM ပို့ပြီးပါပြီ");
      } else {
        alert("⚠️ DM မပို့နိုင်သေးပါ");
      }

    } catch (err) {

      alert("Notice error: " + (err.message || err));

    } finally {

      hideLoading();

    }

    return;
  }

  /* Prize Done button */

  if (btn.classList.contains("js-prize-done")) {

    const id = btn.dataset.id;

    if (!id) return;

    const doneNow = togglePrizeDone(id);

    if (doneNow) {

      btn.textContent = "Done ✅";
      btn.style.background = "#16a34a";
      btn.style.color = "#fff";

    } else {

      btn.textContent = "Prize Done";
      btn.style.background = "";
      btn.style.color = "";

    }

    if (!isTestMode()) {

      const s = loadCurrentSession();

      if (s && Array.isArray(s.winners)) {

        const rec = s.winners.find((x) => String(x.id) === String(id));

        if (rec) {

          rec.done = doneNow;
          rec.at = Date.now();

          saveCurrentSession(s);

        }
      }
    }

    renderWinnerListPanel();

  }

});
/* ===========================
   PART 6/6 — POOL + RESTART + HISTORY + INIT
=========================== */

/* ===========================
   POOL
=========================== */

async function refreshPoolUI() {

  try {

    const data = await apiGet("/pool", 7000);

    if (!data?.ok) throw new Error(data?.error || "pool error");

    poolText.textContent = `${data.count || 0} people in pool`;

  } catch {

    poolText.textContent = "Pool: error";

  }

}

/* ===========================
   RESTART SPIN
=========================== */

restartSpinBtn?.addEventListener("click", async () => {

  showLoading("Restarting Spin...");

  restartSpinBtn.disabled = true;

  try {

    const data = await apiPost("/restart-spin", {}, 12000);

    if (!data?.ok) throw new Error(data?.error || "restart error");

    hideWinnerModal();

    if (!isTestMode()) startNewSession();

    await refreshPoolUI();

    renderWinnerListPanel();

    alert("Restart Spin ✅");

  } catch (e) {

    alert("Restart error: " + (e.message || e));

  } finally {

    restartSpinBtn.disabled = false;

    hideLoading();

  }

});

/* ===========================
   MEMBERS SETTINGS VIEW
=========================== */

async function loadMembersInSettings() {

  if (!membersInSettings) return;

  membersInSettings.innerHTML = "Loading...";

  try {

    const data = await apiGet("/members", 15000);

    if (!data?.ok) throw new Error(data?.error || "members error");

    const list = Array.isArray(data.members) ? data.members : [];

    membersInSettings.innerHTML = list.length

      ? list.map((m, i) => {

        const u = m.username ? `@${String(m.username).replace("@", "")}` : "-";

        const st = (m.active === false) ? "INACTIVE" : "ACTIVE";

        return `${i + 1}. ${esc(m.display || "-")} (${esc(u)}) [${esc(String(m.id || "-"))}] • ${st}`;

      }).join("<br>")

      : "No members yet";

    saveCache(CACHE_MEMBERS_KEY, list);

  } catch (e) {

    membersInSettings.innerHTML = `Error: ${esc(e.message || e)}`;

  }

}

/* ===========================
   EVENT HISTORY VIEWER
=========================== */

function fmtTime(ts) {

  try {

    return new Date(ts).toLocaleString();

  } catch {

    return String(ts || "");

  }

}

function renderEventHistoryViewer() {

  if (!eventHistoryViewer) return;

  if (isTestMode()) {

    eventHistoryViewer.innerHTML = "Test Mode ON → မသိမ်းပါ";

    return;

  }

  const sessions = loadEventSessions();

  const cur = loadCurrentSession();

  let html = "";

  if (cur && !cur.autoSaved) {

    html += `<div style="margin-bottom:10px;">
      <b>Current Session</b><br>
      Date: ${esc(cur.dateKey)}<br>
      Started: ${esc(fmtTime(cur.startedAt))}<br>
      Completed(Pool0): <b>${cur.completed ? "✅" : "❌"}</b><br>
      Winners: <b>${(cur.winners||[]).length}</b>
      <hr style="border:0;border-top:1px solid rgba(16,19,24,0.1);margin:8px 0;">
    </div>`;

    html += (cur.winners||[]).map(w =>
      `${w.order}. <b>${esc(w.prize)}</b> • ${esc(w.display)} • ${esc(w.id)} • Done: ${w.done ? "✅" : "❌"}`
    ).join("<br>") || "—";

    html += `<hr style="border:0;border-top:2px solid rgba(16,19,24,0.12);margin:10px 0;">`;

  }

  if (!sessions.length) {

    html += "Saved Sessions: (empty)";

    eventHistoryViewer.innerHTML = html;

    return;

  }

  html += `<b>Saved Sessions (By Date)</b><br><br>`;

  html += sessions.slice().reverse().map((s) => {

    const total = (s.winners || []).length;

    const doneCount = (s.winners || []).filter(x => x.done).length;

    return `
      <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(16,19,24,0.1);">
        <b>${esc(s.dateKey)}</b> • Winners: <b>${total}</b> • Done: <b>${doneCount}</b><br>
        <span style="opacity:.8">Start: ${esc(fmtTime(s.startedAt))}</span><br>
        <span style="opacity:.8">End: ${esc(fmtTime(s.endedAt || ""))}</span><br>
        <div style="margin-top:6px;">
          ${(s.winners||[]).map(w =>
            `${w.order}. <b>${esc(w.prize)}</b> • ${esc(w.display)} • ${esc(w.id)} • Done: ${w.done ? "✅" : "❌"}`
          ).join("<br>")}
        </div>
      </div>
    `;

  }).join("");

  eventHistoryViewer.innerHTML = html;

}

/* ===========================
   INIT
=========================== */

function init() {

  const s = loadSettings();

  apiBaseInput.value = s.apiBase || DEFAULT_API_BASE;
  apiKeyInput.value = s.apiKey || DEFAULT_API_KEY;

  uiColorInput.value = s.uiColor || "#ffffff";
  wheelAccentInput.value = s.wheelAccent || "#d6b25e";
  wheelColorsInput.value = s.wheelColorsText || defaultSettings.wheelColorsText;

  applyThemeUI(s.uiColor, s.wheelAccent);

  applyPageBg(s.pageBgDataUrl || "");
  applyWheelBg(s.wheelBgDataUrl || "");
  applyBanner(s.topBannerDataUrl || "", topBannerImg, topBannerFallback);
  applyBanner(s.bottomBannerDataUrl || "", bottomBannerImg, bottomBannerFallback);
  applyWheelBanner(s.wheelBannerDataUrl || "");

  renderPrizeBuilder(s.prizes || clone(defaultSettings.prizes));

  sliceColors = parseWheelColors(s.wheelColorsText);

  const prizeText = buildPrizeText(s.prizes || []);

  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  drawWheel();

  updateMusicBtn();

  setTestMode(isTestMode());

  localStorage.setItem(LS_LAST_DATEKEY, dateKeyNow());

  if (!isTestMode()) ensureSession();

  refreshPoolUI();

  renderEventHistoryViewer();

  renderWinnerListPanel();

}

init();