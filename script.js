"use strict";

/* ===========================
  PART 1/7 — CORE + DOM + LOADING + API + POOL FIX
  - Safe DOM getters
  - Loading overlay safe
  - API helpers (GET/POST) with timeout + abort
  - Pool UI FIX: data.pool (not data.count)
  - Restart endpoint fallback: /restart then /restart-spin
=========================== */

const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";
const TAU = Math.PI * 2;

/* ---------- Safe DOM helpers ---------- */
const $ = (id) => document.getElementById(id);

/* Required elements from your HTML */
const wheelCanvas = $("wheel");
const ctx = wheelCanvas ? wheelCanvas.getContext("2d") : null;

const spinBtn = $("spinBtn");
const poolText = $("poolText");

const drawer = $("drawer");
const settingsBtn = $("settingsBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const saveBtn = $("saveBtn");
const resetBtn = $("resetBtn");

const apiBaseInput = $("apiBaseInput");
const apiKeyInput  = $("apiKeyInput");

const prizeBuilder = $("prizeBuilder");
const uiColorInput = $("uiColorInput");
const wheelAccentInput = $("wheelAccentInput");
const wheelColorsInput = $("wheelColorsInput");

const topBannerFile = $("topBannerFile");
const bottomBannerFile = $("bottomBannerFile");
const pageBgFile = $("pageBgFile");
const wheelBgFile = $("wheelBgFile");
const bgSongFile = $("bgSongFile");
const wheelBannerFile = $("wheelBannerFile"); // ✅ only once

const topBannerImg = $("topBannerImg");
const bottomBannerImg = $("bottomBannerImg");
const topBannerFallback = $("topBannerFallback");
const bottomBannerFallback = $("bottomBannerFallback");

const wheelBannerImg = $("wheelBannerImg");
const wheelBannerFallback = $("wheelBannerFallback");

const bgLayer = $("bgLayer");
const wheelWrap = $("wheelWrap");

const restartSpinBtn = $("restartSpinBtn");
const membersBtn = $("membersBtn");
const winnerListBtn = $("winnerListBtn");

const membersPanel = $("membersPanel");
const membersCloseBtn = $("membersCloseBtn");
const membersTable = $("membersTable");
const membersTotalText = $("membersTotalText");

const winnerListPanel = $("winnerListPanel");
const winnerListCloseBtn = $("winnerListCloseBtn");
const winnerListBody = $("winnerListBody");
const winnerListTotalText = $("winnerListTotalText");

const refreshMembersInSettingsBtn = $("refreshMembersInSettingsBtn");
const membersInSettings = $("membersInSettings");

/* Winner Modal */
const winnerModal = $("winnerModal");
const winnerBackdrop = $("winnerBackdrop");
const winnerPrizeTitle = $("winnerPrizeTitle");
const winnerTitleText = $("winnerTitleText");
const winnerNameText = $("winnerNameText");
const contactBtn = $("contactBtn");
const noticeBtn = $("noticeBtn");
const winnerCloseBtn = $("winnerCloseBtn");
const winnerHint = $("winnerHint");

/* Music */
const musicBtn = $("musicBtn");

/* Loading Overlay */
const loadingOverlay = $("loadingOverlay");
const loadingText = $("loadingText");
const loadingCancelBtn = $("loadingCancelBtn");

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

/* ---------- Drawer open/close ---------- */
function openSettings() { drawer?.classList.add("open"); }
function closeSettings() { drawer?.classList.remove("open"); }
settingsBtn?.addEventListener("click", openSettings);
closeSettingsBtn?.addEventListener("click", closeSettings);

/* ---------- Loading overlay ---------- */
let activeAbort = null;

function showLoading(text = "Loading...") {
  if (!loadingOverlay) return;
  loadingOverlay.classList.remove("hidden");
  if (loadingText) loadingText.textContent = text;
}
function hideLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add("hidden");
  if (activeAbort) {
    try { activeAbort.abort(); } catch {}
  }
  activeAbort = null;
}
loadingCancelBtn?.addEventListener("click", hideLoading);

/* ===========================
   API Helpers (timeout + abort)
=========================== */
function getApiBase() {
  const raw = (apiBaseInput?.value || DEFAULT_API_BASE).trim();
  return raw.replace(/\/+$/, "");
}
function getApiKey() {
  return (apiKeyInput?.value || DEFAULT_API_KEY).trim();
}

async function fetchJsonWithTimeout(url, opt = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  activeAbort = ctrl;
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, { ...opt, signal: ctrl.signal });
    const text = await r.text();

    let json;
    try { json = JSON.parse(text); }
    catch { json = { ok: false, error: "Invalid JSON", raw: String(text || "").slice(0, 250) }; }

    // normalize error
    if (!r.ok && json?.ok !== true) {
      return { ok: false, error: json?.error || `HTTP ${r.status}` , status: r.status };
    }
    // some endpoints might return ok true without HTTP 200 check
    return json;
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "Timeout/Cancelled" : (e?.message || String(e)) };
  } finally {
    clearTimeout(t);
    activeAbort = null;
  }
}

async function apiGet(path, timeoutMs = 12000) {
  const base = getApiBase();
  const key  = getApiKey();
  const url  = `${base}${path}?key=${encodeURIComponent(key)}`;
  return fetchJsonWithTimeout(url, {}, timeoutMs);
}

async function apiPost(path, body, timeoutMs = 12000) {
  const base = getApiBase();
  const key  = getApiKey();
  const url  = `${base}${path}?key=${encodeURIComponent(key)}`;

  return fetchJsonWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key
    },
    body: JSON.stringify(body || {})
  }, timeoutMs);
}

/* ===========================
   POOL UI (FIXED)
   - Render returns: { ok:true, pool:168, ids:[...] }
   - Old code used data.count (wrong)
=========================== */
async function refreshPoolUI() {
  try {
    const data = await apiGet("/pool", 12000);
    if (!data?.ok) throw new Error(data?.error || "pool error");

    const poolCount = Number(data.pool ?? data.count ?? 0); // ✅ support both
    if (poolText) poolText.textContent = `${poolCount} people in pool`;

    // (Part 3+ will call winner list render here safely)
  } catch (e) {
    if (poolText) poolText.textContent = "Pool: error";
  }
}

/* ===========================
   RESTART (endpoint fallback)
   - Some servers: POST /restart
   - Some servers: POST /restart-spin
=========================== */
async function restartSpinRequest() {
  // try /restart first
  let r = await apiPost("/restart", {}, 12000);
  if (r?.ok) return r;

  // if 404 or not found, fallback
  r = await apiPost("/restart-spin", {}, 12000);
  return r;
}

/* Bind restart button (safe) */
restartSpinBtn?.addEventListener("click", async () => {
  showLoading("Restarting Spin...");
  restartSpinBtn.disabled = true;

  try {
    const r = await restartSpinRequest();
    if (!r?.ok) throw new Error(r?.error || "restart error");

    alert("Restart Spin ✅");
    await refreshPoolUI();
  } catch (e) {
    alert("Restart error: " + (e?.message || e));
  } finally {
    restartSpinBtn.disabled = false;
    hideLoading();
  }
});

/* ===========================
   INIT (only safe things in Part 1)
=========================== */
(function initPart1() {
  // Set defaults into inputs if empty
  if (apiBaseInput && !apiBaseInput.value) apiBaseInput.value = DEFAULT_API_BASE;
  if (apiKeyInput && !apiKeyInput.value) apiKeyInput.value = DEFAULT_API_KEY;

  refreshPoolUI();
})();
/* ===========================
  PART 2/7 — STORAGE + THEME + IMAGES + MUSIC + SETTINGS SAVE/RESET
=========================== */

/* ---------- Storage Keys ---------- */
const STORAGE_KEY = "lucky77_vercel_clean_v1";

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
    { name: "1000Ks", times: 10 },
  ],

  pageBgDataUrl: "",
  wheelBgDataUrl: "",
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",

  // music: only stored as "enabled" flag; mp3 file must be re-picked (browser security)
  musicOn: false,
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

/* ===========================
  THEME
=========================== */
function applyThemeUI(uiColor, wheelAccent) {
  document.documentElement.style.setProperty("--ui", uiColor || "#ffffff");
  document.documentElement.style.setProperty("--bg", uiColor || "#ffffff");
  document.documentElement.style.setProperty("--gold", wheelAccent || "#d6b25e");
  document.documentElement.style.setProperty("--text", "#101318");
}

/* ===========================
  IMAGES
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
  MUSIC
=========================== */
const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.55;

function updateMusicBtnUI(on) {
  if (!musicBtn) return;
  musicBtn.textContent = on ? "🎵 Music: ON" : "🎵 Music: OFF";
  musicBtn.classList.toggle("primary", !!on);
}

/* In-memory only MP3 URL */
let musicOn = false;

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

  updateMusicBtnUI(musicOn);

  // store flag
  const s = loadSettings();
  s.musicOn = !!musicOn;
  saveSettingsLocal(s);
});

bgSongFile?.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  bgMusic.src = url;
  if (musicOn) bgMusic.play().catch(() => {});
});

/* ===========================
  SETTINGS: Save/Reset bindings
=========================== */

/* This is used later in PART 3/4 */
function readSettingsFromUIAndSave() {
  const s = loadSettings();

  s.apiBase = (apiBaseInput?.value || DEFAULT_API_BASE).trim();
  s.apiKey  = (apiKeyInput?.value  || DEFAULT_API_KEY).trim();

  s.uiColor = uiColorInput?.value || "#ffffff";
  s.wheelAccent = wheelAccentInput?.value || "#d6b25e";
  s.wheelColorsText = wheelColorsInput?.value || defaultSettings.wheelColorsText;

  // prizes will be updated by prize builder (PART 3)
  // images updated by file inputs (here)

  saveSettingsLocal(s);
  return s;
}

saveBtn?.addEventListener("click", async () => {
  // In clean build: Save settings locally now,
  // and Part 4 will push prizes to Render.
  const s = readSettingsFromUIAndSave();

  applyThemeUI(s.uiColor, s.wheelAccent);

  // Do NOT call renderPrizeBuilder here (Part 3 provides it)
  alert("Saved (Local) ✅\n(Prizes push to Render will run after Part 4)");
  closeSettings();
});

resetBtn?.addEventListener("click", () => {
  if (!confirm("Reset settings လုပ်မလား?")) return;

  saveSettingsLocal(clone(defaultSettings));

  // clear images + theme immediately
  const s = loadSettings();
  applyThemeUI(s.uiColor, s.wheelAccent);
  applyPageBg("");
  applyWheelBg("");
  applyBanner("", topBannerImg, topBannerFallback);
  applyBanner("", bottomBannerImg, bottomBannerFallback);
  applyWheelBanner("");

  // reset UI inputs (safe)
  if (apiBaseInput) apiBaseInput.value = s.apiBase;
  if (apiKeyInput)  apiKeyInput.value  = s.apiKey;
  if (uiColorInput) uiColorInput.value = s.uiColor;
  if (wheelAccentInput) wheelAccentInput.value = s.wheelAccent;
  if (wheelColorsInput) wheelColorsInput.value = s.wheelColorsText;

  musicOn = false;
  bgMusic.pause();
  updateMusicBtnUI(false);

  alert("Reset done ✅");
});

/* ===========================
  IMAGE upload bindings
=========================== */
pageBgFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.pageBgDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyPageBg(s.pageBgDataUrl);
});

wheelBgFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.wheelBgDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyWheelBg(s.wheelBgDataUrl);
});

topBannerFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.topBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyBanner(s.topBannerDataUrl, topBannerImg, topBannerFallback);
});

bottomBannerFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.bottomBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyBanner(s.bottomBannerDataUrl, bottomBannerImg, bottomBannerFallback);
});

wheelBannerFile?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.wheelBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyWheelBanner(s.wheelBannerDataUrl);
});

/* ===========================
  PART 2 INIT (do NOT auto-run yet)
  - Part 7 will run initAll() once everything exists
=========================== */
function initPart2() {
  const s = loadSettings();

  // Inputs
  if (apiBaseInput) apiBaseInput.value = s.apiBase || DEFAULT_API_BASE;
  if (apiKeyInput)  apiKeyInput.value  = s.apiKey  || DEFAULT_API_KEY;

  if (uiColorInput) uiColorInput.value = s.uiColor || "#ffffff";
  if (wheelAccentInput) wheelAccentInput.value = s.wheelAccent || "#d6b25e";
  if (wheelColorsInput) wheelColorsInput.value = s.wheelColorsText || defaultSettings.wheelColorsText;

  // Theme + images
  applyThemeUI(s.uiColor, s.wheelAccent);

  applyPageBg(s.pageBgDataUrl || "");
  applyWheelBg(s.wheelBgDataUrl || "");
  applyBanner(s.topBannerDataUrl || "", topBannerImg, topBannerFallback);
  applyBanner(s.bottomBannerDataUrl || "", bottomBannerImg, bottomBannerFallback);
  applyWheelBanner(s.wheelBannerDataUrl || "");

  // music flag
  musicOn = !!s.musicOn;
  updateMusicBtnUI(musicOn);
}
/* ===========================
  PART 3/7 — PRIZE BUILDER + WHEEL DRAW CORE
=========================== */

/* ===========================
  PRIZE HELPERS
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

/* ===========================
  PRIZE BUILDER UI
=========================== */
function renderPrizeBuilder(prizesArr) {
  if (!prizeBuilder) return;

  const s0 = loadSettings();
  const prizes = Array.isArray(prizesArr) ? prizesArr : (Array.isArray(s0.prizes) ? s0.prizes : []);

  prizeBuilder.innerHTML = "";

  prizes.forEach((p, idx) => {
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

  // stepper buttons
  prizeBuilder.querySelectorAll("button[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      const act = String(b.dataset.act || "");
      const s = loadSettings();
      s.prizes = Array.isArray(s.prizes) ? s.prizes : [];
      if (!s.prizes[i]) return;

      if (act === "remove") {
        s.prizes.splice(i, 1);
        if (s.prizes.length === 0) s.prizes.push({ name: "", times: 1 });
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

  // inputs
  prizeBuilder.querySelectorAll("input[data-k]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = Number(inp.dataset.i);
      const k = String(inp.dataset.k || "");
      const s = loadSettings();
      s.prizes = Array.isArray(s.prizes) ? s.prizes : [];
      if (!s.prizes[i]) return;

      if (k === "times") s.prizes[i].times = clamp(Number(inp.value || 1), 1, 9999);
      if (k === "name") s.prizes[i].name = String(inp.value || "");
      saveSettingsLocal(s);

      // live update wheel preview (safe)
      try {
        const prizeText = buildPrizeText(s.prizes);
        wheelPrizes = uniquePrizesFromPrizeText(prizeText);
        drawWheel();
      } catch {}
    });
  });
}

/* ===========================
  WHEEL DRAW CORE
=========================== */
let wheelPrizes = [];
let sliceColors = [];
let currentAngle = 0;

/* pointer at TOP */
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

function calcAngleToLandOnPrize(prize) {
  const p = normalizePrizeName(prize);
  const idx = wheelPrizes.findIndex((x) => normalizePrizeName(x) === p);
  if (idx < 0 || wheelPrizes.length < 2) return null;

  const slice = TAU / wheelPrizes.length;

  // center of idx slice at POINTER_ANGLE
  let target = POINTER_ANGLE - (idx + 0.5) * slice;

  // small jitter so it looks natural
  const jitter = (Math.random() * 0.6 - 0.3) * (slice * 0.55);
  target += jitter;

  // normalize [0, TAU)
  target = ((target % TAU) + TAU) % TAU;
  return target;
}

/* ===========================
  PART 3 INIT (do NOT auto-run yet)
=========================== */
function initPart3() {
  const s = loadSettings();

  // colors
  sliceColors = parseWheelColors(s.wheelColorsText);

  // prizes -> wheel
  const prizeText = buildPrizeText(s.prizes || []);
  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  // builder UI
  renderPrizeBuilder(s.prizes || clone(defaultSettings.prizes));

  // draw preview
  currentAngle = 0;
  drawWheel();
}
/* ===========================
PART 4/7 — API + MEMBERS + SPIN + RESTART
=========================== */

async function apiPool(){
  return apiGet("/pool");
}

async function apiMembers(){
  return apiGet("/members");
}

async function apiSpin(){
  return apiPost("/spin", {});
}

/* restart fallback */
async function apiRestart(){
  let r = await apiPost("/restart", {});
  if(r?.ok) return r;

  r = await apiPost("/restart-spin", {});
  return r;
}

/* ===========================
MEMBERS
=========================== */

async function loadMembersUI(){
  showLoading("Loading members...");

  try{

    const data = await apiMembers();

    if(!data?.ok) throw new Error(data?.error || "members error");

    const list = data.members || [];

    if(membersTotalText)
      membersTotalText.textContent = `(${list.length})`;

    if(membersTable){

      membersTable.innerHTML = list.map((m,i)=>{

        const name = esc(m.name || m.username || m.id);

        return `
        <div class="member-row">
          <div class="member-no">${i+1}</div>
          <div class="member-name">${name}</div>
        </div>
        `;

      }).join("");

    }

  }catch(e){

    if(membersTable)
      membersTable.innerHTML = `<div class="small">Load error</div>`;

  }finally{
    hideLoading();
  }
}

membersBtn?.addEventListener("click", ()=>{
  membersPanel?.classList.remove("hidden");
  loadMembersUI();
});

membersCloseBtn?.addEventListener("click", ()=>{
  membersPanel?.classList.add("hidden");
});


/* ===========================
SPIN
=========================== */

let spinning = false;

spinBtn?.addEventListener("click", async ()=>{

  if(spinning) return;
  spinning = true;

  showLoading("Spinning...");

  try{

    const r = await apiSpin();

    if(!r?.ok) throw new Error(r?.error || "spin error");

    const winner = r.winner;
    const prize = r.prize;

    /* wheel landing */
    const target = calcAngleToLandOnPrize(prize);

    if(target===null) throw new Error("prize not on wheel");

    const start = currentAngle;
    const spins = TAU * (4 + Math.random()*2);

    const end = spins + target;

    const duration = 5200;

    const startTime = performance.now();

    function animate(now){

      const t = clamp((now-startTime)/duration,0,1);

      const ease = 1 - Math.pow(1-t,3);

      currentAngle = start + (end-start)*ease;

      drawWheel();

      if(t<1){
        requestAnimationFrame(animate);
      }else{
        spinning=false;
        hideLoading();

        showWinnerModal(winner, prize);
        refreshPoolUI();
      }

    }

    requestAnimationFrame(animate);

  }catch(e){

    spinning=false;
    hideLoading();
    alert("Spin error: "+(e.message||e));

  }

});


/* ===========================
RESTART BUTTON
=========================== */

restartSpinBtn?.addEventListener("click", async ()=>{

  if(!confirm("Restart Spin ?")) return;

  showLoading("Restarting...");

  try{

    const r = await apiRestart();

    if(!r?.ok) throw new Error(r?.error || "restart error");

    alert("Restart Done");

    refreshPoolUI();

  }catch(e){

    alert("Restart error: "+(e.message||e));

  }finally{

    hideLoading();

  }

});
/* ===========================
PART 5/7 — WINNER MODAL + WINNER LIST
=========================== */

let winnerList = [];

/* ===========================
WINNER MODAL
=========================== */

function showWinnerModal(winner, prize){

  if(!winnerModal) return;

  const username = String(winner?.username || "").replace("@","").trim();

  const display =
    winner?.display ||
    winner?.name ||
    (username ? "@"+username : winner?.id || "-");

  if(winnerTitleText)
    winnerTitleText.textContent = prize;

  if(winnerNameText)
    winnerNameText.textContent = display;

  if(contactBtn)
    contactBtn.style.display = username ? "inline-flex" : "none";

  if(noticeBtn)
    noticeBtn.style.display = username ? "none" : "inline-flex";

  winnerModal.classList.remove("hidden");

  /* add to winner list */

  winnerList.push({
    id: winner.id,
    username: username,
    display: display,
    prize: prize,
    done:false
  });

  renderWinnerListPanel();
}

/* close */

winnerCloseBtn?.addEventListener("click", ()=>{
  winnerModal?.classList.add("hidden");
});

winnerBackdrop?.addEventListener("click", ()=>{
  winnerModal?.classList.add("hidden");
});

/* ===========================
CONTACT BUTTON
=========================== */

contactBtn?.addEventListener("click", ()=>{

  const last = winnerList[winnerList.length-1];

  if(!last?.username) return;

  window.open(
    "https://t.me/"+last.username,
    "_blank"
  );

});


/* ===========================
NOTICE BUTTON
=========================== */

noticeBtn?.addEventListener("click", async ()=>{

  const last = winnerList[winnerList.length-1];

  if(!last?.id) return;

  showLoading("Sending notice...");

  try{

    const r = await apiPost("/notice",{
      user_id:last.id,
      prize:last.prize
    });

    if(r?.dm_ok)
      alert("DM sent");

    else
      alert("User didn't start bot");

  }catch(e){

    alert("Notice error");

  }finally{

    hideLoading();

  }

});


/* ===========================
WINNER LIST PANEL
=========================== */

function showWinnerListPanel(){
  winnerListPanel?.classList.remove("hidden");
}

function hideWinnerListPanel(){
  winnerListPanel?.classList.add("hidden");
}

winnerListBtn?.addEventListener("click", ()=>{
  showWinnerListPanel();
  renderWinnerListPanel();
});

winnerListCloseBtn?.addEventListener("click", hideWinnerListPanel);


/* ===========================
RENDER WINNER LIST
=========================== */

function renderWinnerListPanel(){

  if(!winnerListBody) return;

  if(!winnerList.length){

    winnerListBody.innerHTML =
      `<div class="small">Winner list empty</div>`;

    return;
  }

  const rows = winnerList.map((w,i)=>{

    const telegramBtn = w.username
      ? `<button class="btn mini js-telegram" data-user="${esc(w.username)}">Telegram</button>`
      : `<button class="btn mini js-notice2" data-id="${esc(w.id)}" data-prize="${esc(w.prize)}">Notice</button>`;

    const doneBtn = `
      <button class="btn mini js-done" data-i="${i}"
        ${w.done ? `style="background:#16a34a;color:#fff;"` : ""}>
        ${w.done ? "Done" : "Prize Done"}
      </button>
    `;

    return `
    <tr>
      <td>${i+1}</td>
      <td>Spin #${i+1} - ${esc(w.prize)}</td>
      <td>${esc(w.display)}</td>
      <td>${esc(w.id)}</td>
      <td>${doneBtn}</td>
      <td>${telegramBtn}</td>
    </tr>
    `;

  }).join("");

  winnerListBody.innerHTML = `
  <table class="table">
    <thead>
      <tr>
        <th>No</th>
        <th>Spin</th>
        <th>Name</th>
        <th>ID</th>
        <th>Prize</th>
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
DONE BUTTON
=========================== */

document.addEventListener("click",(e)=>{

  const btn = e.target.closest(".js-done");

  if(!btn) return;

  const i = Number(btn.dataset.i);

  if(!winnerList[i]) return;

  winnerList[i].done = !winnerList[i].done;

  renderWinnerListPanel();

});


/* ===========================
TELEGRAM BUTTON
=========================== */

document.addEventListener("click",(e)=>{

  const btn = e.target.closest(".js-telegram");

  if(!btn) return;

  const u = btn.dataset.user;

  window.open("https://t.me/"+u,"_blank");

});
/* ===========================
PART 6/7 — EVENT HISTORY SYSTEM
=========================== */

/* storage keys */

const LS_EVENT_HISTORY = "lucky77_event_history_v1";
const LS_CURRENT_SESSION = "lucky77_current_session_v1";
const LS_LAST_DATE = "lucky77_last_date_v1";


/* ===========================
SESSION HELPERS
=========================== */

function loadEventHistory(){
  try{
    return JSON.parse(localStorage.getItem(LS_EVENT_HISTORY) || "[]");
  }catch{
    return [];
  }
}

function saveEventHistory(arr){
  localStorage.setItem(
    LS_EVENT_HISTORY,
    JSON.stringify(arr || [])
  );
}

function loadCurrentSession(){
  try{
    return JSON.parse(localStorage.getItem(LS_CURRENT_SESSION) || "null");
  }catch{
    return null;
  }
}

function saveCurrentSession(s){
  localStorage.setItem(
    LS_CURRENT_SESSION,
    JSON.stringify(s || null)
  );
}

/* ===========================
NEW SESSION
=========================== */

function startNewSession(){

  const now = new Date();

  const dateKey =
    now.getFullYear()+"-"+
    String(now.getMonth()+1).padStart(2,"0")+"-"+
    String(now.getDate()).padStart(2,"0");

  const session = {
    date:dateKey,
    start:Date.now(),
    completed:false,
    winners:[]
  };

  saveCurrentSession(session);

  return session;
}


/* ===========================
ADD WINNER TO SESSION
=========================== */

function addWinnerToSession(w){

  let s = loadCurrentSession();

  if(!s){
    s = startNewSession();
  }

  s.winners.push({
    id:w.id,
    display:w.display,
    username:w.username,
    prize:w.prize,
    done:w.done,
    at:Date.now()
  });

  saveCurrentSession(s);

}


/* ===========================
POOL 0 → COMPLETE
=========================== */

function markSessionComplete(){

  const s = loadCurrentSession();

  if(!s) return;

  s.completed = true;
  s.end = Date.now();

  saveCurrentSession(s);
}


/* ===========================
AUTO SAVE AT DAY CHANGE
=========================== */

function checkDayChange(){

  const today =
    new Date().toISOString().slice(0,10);

  const last =
    localStorage.getItem(LS_LAST_DATE) || today;

  if(today !== last){

    const s = loadCurrentSession();

    if(s && s.winners.length){

      const history = loadEventHistory();

      history.push(s);

      saveEventHistory(history);

    }

    startNewSession();

    localStorage.setItem(
      LS_LAST_DATE,
      today
    );

  }

}

/* check every 30 sec */

setInterval(checkDayChange,30000);


/* ===========================
EXPORT HISTORY
=========================== */

function exportHistory(){

  const history = loadEventHistory();

  const blob = new Blob(
    [JSON.stringify(history,null,2)],
    {type:"application/json"}
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "winner-history.json";

  a.click();

  setTimeout(()=>URL.revokeObjectURL(url),1000);

}


/* ===========================
CLEAR HISTORY
=========================== */

function clearHistory(){

  if(!confirm("Clear history?")) return;

  localStorage.removeItem(LS_EVENT_HISTORY);
  localStorage.removeItem(LS_CURRENT_SESSION);

  alert("History cleared");

}
/* ===========================
PART 7/7 — INIT + FINAL SYSTEM START
=========================== */

/* ===========================
INIT SYSTEM
=========================== */

function initSystem(){

  const s = loadSettings();

  /* load API inputs */

  if(apiBaseInput)
    apiBaseInput.value = s.apiBase || DEFAULT_API_BASE;

  if(apiKeyInput)
    apiKeyInput.value = s.apiKey || DEFAULT_API_KEY;

  /* theme */

  applyThemeUI(
    s.uiColor,
    s.wheelAccent
  );

  /* banners */

  applyPageBg(s.pageBgDataUrl || "");
  applyWheelBg(s.wheelBgDataUrl || "");

  applyBanner(
    s.topBannerDataUrl || "",
    topBannerImg,
    topBannerFallback
  );

  applyBanner(
    s.bottomBannerDataUrl || "",
    bottomBannerImg,
    bottomBannerFallback
  );

  applyWheelBanner(
    s.wheelBannerDataUrl || ""
  );

  /* wheel colors */

  sliceColors = parseWheelColors(
    s.wheelColorsText
  );

  /* prizes */

  const prizeText =
    buildPrizeText(s.prizes || []);

  wheelPrizes =
    uniquePrizesFromPrizeText(prizeText);

  /* draw wheel */

  drawWheel();

  /* music */

  musicOn = !!s.musicOn;

  updateMusicBtnUI(musicOn);

  /* session */

  if(!loadCurrentSession())
    startNewSession();

  /* pool */

  refreshPoolUI();

}


/* ===========================
START SYSTEM
=========================== */

document.addEventListener(
  "DOMContentLoaded",
  ()=>{

    try{

      initPart2();
      initPart3();
      initSystem();

    }catch(e){

      console.error("Init error",e);

    }

  }
);


/* ===========================
SPIN → SAVE TO SESSION
=========================== */

function afterSpinSave(winner){

  addWinnerToSession({
    id:winner.id,
    display:winner.display,
    username:winner.username,
    prize:winner.prize,
    done:false
  });

}


/* ===========================
POOL CHECK
=========================== */

async function refreshPoolUI(){

  try{

    const data = await apiPool();

    if(!data?.ok)
      throw new Error(data?.error);

    const count =
      Number(data.pool ?? 0);

    if(poolText)
      poolText.textContent =
        count + " people in pool";

    /* pool empty → event complete */

    if(count===0)
      markSessionComplete();

  }catch{

    if(poolText)
      poolText.textContent="Pool error";

  }

}