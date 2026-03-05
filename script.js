"use strict";

/* ===========================
  Lucky77 Vercel UI (CLEAN)
  - NO Event History Viewer
  - Winner List only (Today)
  - Members + Notice + Telegram + Prize Done
=========================== */

const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";
const TAU = Math.PI * 2;

/* ---------- DOM (match your HTML ids) ---------- */
const $ = (id) => document.getElementById(id);

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
const wheelBannerFile = $("wheelBannerFile"); // ✅ only ONCE (no duplicate)

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

/* Test Mode UI */
const testModeBtn = $("testModeBtn");
const clearTestHistoryBtn = $("clearTestHistoryBtn");

/* Loading Overlay */
let activeAbort = null;
function showLoading(text = "Loading...") {
  const el = $("loadingOverlay");
  if (!el) return;
  el.classList.remove("hidden");
  const t = $("loadingText");
  if (t) t.textContent = text;
}
function hideLoading() {
  const el = $("loadingOverlay");
  if (!el) return;
  el.classList.add("hidden");
  if (activeAbort) {
    try { activeAbort.abort(); } catch {}
  }
  activeAbort = null;
}
$("loadingCancelBtn")?.addEventListener("click", hideLoading);

/* ---------- Music ---------- */
const musicBtn = $("musicBtn");
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

function openSettings() { drawer?.classList.add("open"); }
function closeSettings() { drawer?.classList.remove("open"); }
settingsBtn?.addEventListener("click", openSettings);
closeSettingsBtn?.addEventListener("click", closeSettings);

/* ---------- Storage Keys ---------- */
const STORAGE_KEY = "lucky77_ui_clean_v1";
const CACHE_MEMBERS_KEY = "lucky77_cache_members_v1";
const LS_WINNERS_KEY = "lucky77_winner_prize_map_v1";
const LS_TEST_MODE = "lucky77_test_mode_v1";

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
};

/* ---------- Clone + Settings Load/Save ---------- */
function clone(x) {
  try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); }
}
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

/* ---------- Test Mode ---------- */
function isTestMode() {
  return localStorage.getItem(LS_TEST_MODE) === "1";
}
function setTestMode(v) {
  localStorage.setItem(LS_TEST_MODE, v ? "1" : "0");
  if (testModeBtn) testModeBtn.textContent = v ? "Test: ON" : "Test: OFF";
}

/* ---------- Winner Prize Map (Done status) ---------- */
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
 PART 2/7
 THEME + IMAGES + API + PRIZE BUILDER
=========================== */

/* ---------- Theme ---------- */
function applyThemeUI(uiColor, wheelAccent) {
  document.documentElement.style.setProperty("--ui", uiColor);
  document.documentElement.style.setProperty("--bg", uiColor);
  document.documentElement.style.setProperty("--gold", wheelAccent);
  document.documentElement.style.setProperty("--text", "#101318");
}

/* ---------- File → DataURL ---------- */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- Banner ---------- */
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

/* ---------- Page BG ---------- */
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

/* ---------- Wheel BG ---------- */
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

/* ---------- Wheel Banner ---------- */
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
 API Helpers
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

    try {
      json = JSON.parse(text);
    } catch {
      json = { ok:false, error:"Invalid JSON", raw:text };
    }

    if (!r.ok && json?.ok !== true) {
      return { ok:false, error: json?.error || `HTTP ${r.status}` };
    }

    return json;

  } catch (e) {

    return {
      ok:false,
      error: e?.name === "AbortError"
        ? "Timeout/Cancelled"
        : (e?.message || String(e))
    };

  } finally {
    clearTimeout(id);
    activeAbort = null;
  }
}

async function apiGet(path, timeout = 9000) {
  const url = `${getApiBase()}${path}?key=${encodeURIComponent(getApiKey())}`;
  return fetchJsonWithTimeout(url, {}, timeout);
}

async function apiPost(path, body, timeout = 12000) {
  const key = getApiKey();
  const url = `${getApiBase()}${path}?key=${encodeURIComponent(key)}`;

  return fetchJsonWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "x-api-key": key
    },
    body: JSON.stringify(body || {})
  }, timeout);
}

/* ===========================
 Prize Builder
=========================== */

function buildPrizeText(prizesArr) {
  return (prizesArr || [])
    .filter((p) => p && String(p.name || "").trim())
    .map((p) =>
      `${String(p.name).trim()} ${clamp(Number(p.times || 1),1,9999)}time`
    )
    .join("\n");
}

function parseWheelColors(text) {
  const colors = String(text || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  return colors.length
    ? colors
    : ["#ffffff","#f1f5ff"];
}

/* wheel only needs unique prize names */
function uniquePrizesFromPrizeText(prizeText) {

  const lines = String(prizeText || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

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

/* ---------- Render Prize Builder ---------- */
function renderPrizeBuilder(prizesArr) {

  if (!prizeBuilder) return;

  prizeBuilder.innerHTML = "";

  (prizesArr || []).forEach((p, idx) => {

    const row = document.createElement("div");
    row.className = "prize-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="pname">Prize</div>
      <input data-k="name" data-i="${idx}"
        value="${esc(p.name || "")}"
        placeholder="10000Ks">
    `;

    const right = document.createElement("div");
    right.className = "stepper";

    right.innerHTML = `
      <button data-act="dec" data-i="${idx}">-</button>

      <input data-k="times" data-i="${idx}"
        type="number" min="1" max="9999"
        value="${clamp(Number(p.times || 1),1,9999)}">

      <button data-act="inc" data-i="${idx}">+</button>

      <button class="btn mini danger"
        data-act="remove"
        data-i="${idx}">
        Remove
      </button>
    `;

    row.appendChild(left);
    row.appendChild(right);

    prizeBuilder.appendChild(row);
  });

  /* Add Prize button */

  const addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.textContent = "+ Add Prize";

  addBtn.addEventListener("click", () => {

    const s = loadSettings();

    s.prizes.push({
      name:"",
      times:1
    });

    saveSettingsLocal(s);

    renderPrizeBuilder(s.prizes);
  });

  prizeBuilder.appendChild(addBtn);
}
/* ===========================
 PART 3/7
 WHEEL + SPIN + WINNER MODAL
=========================== */

let wheelPrizes = [];
let sliceColors = [];
let currentAngle = 0;
let spinning = false;

/* pointer is TOP */
const POINTER_ANGLE = -Math.PI / 2;

function normalizePrizeName(x){
  return String(x || "").trim();
}

/* ---------- Draw Wheel ---------- */

function drawWheel(){

  if(!ctx) return;

  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const radius = Math.min(cx,cy) - 12;

  ctx.clearRect(0,0,wheelCanvas.width,wheelCanvas.height);

  if(wheelPrizes.length < 2){

    ctx.fillStyle = "#101318";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Add Prize List in Settings", cx, cy);

    return;
  }

  const slice = TAU / wheelPrizes.length;

  /* outer ring */

  ctx.beginPath();
  ctx.arc(cx,cy,radius+2,0,TAU);
  ctx.strokeStyle = "rgba(214,178,94,0.45)";
  ctx.lineWidth = 10;
  ctx.stroke();

  for(let i=0;i<wheelPrizes.length;i++){

    const start = currentAngle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,radius,start,end);
    ctx.closePath();

    ctx.fillStyle = sliceColors[i % sliceColors.length] || "#fff";
    ctx.fill();

    ctx.strokeStyle = "rgba(16,19,24,0.06)";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* text */

    ctx.save();

    ctx.translate(cx,cy);
    ctx.rotate(start + slice/2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#101318";
    ctx.font = "900 18px sans-serif";

    ctx.fillText(wheelPrizes[i], radius - 18, 6);

    ctx.restore();
  }

  /* center cap */

  ctx.beginPath();
  ctx.arc(cx,cy,80,0,TAU);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  ctx.strokeStyle = "rgba(214,178,94,0.45)";
  ctx.lineWidth = 5;
  ctx.stroke();
}

/* ---------- Target Angle ---------- */

function calcAngleToLandOnPrize(prize){

  const p = normalizePrizeName(prize);

  const idx = wheelPrizes.findIndex(
    x => normalizePrizeName(x) === p
  );

  if(idx < 0) return null;

  const slice = TAU / wheelPrizes.length;

  let target = POINTER_ANGLE - (idx + 0.5) * slice;

  const jitter = (Math.random()*0.6 - 0.3) * (slice*0.55);

  target += jitter;

  target = ((target % TAU) + TAU) % TAU;

  return target;
}

/* ===========================
 WINNER MODAL
=========================== */

let lastWinner = null;

function showWinnerModal(prize, winnerObj){

  lastWinner = {
    prize,
    winner: winnerObj
  };

  const username = String(
    winnerObj.username || ""
  ).replace("@","").trim();

  const name = String(
    winnerObj.name || ""
  ).trim();

  const display = String(
    winnerObj.display ||
    name ||
    (username ? `@${username}` : String(winnerObj.id || "-"))
  );

  winnerPrizeTitle.textContent = "WINNER";

  winnerTitleText.textContent = String(prize || "—");

  winnerNameText.textContent = display;

  const hasUsername = !!username;

  contactBtn.style.display = hasUsername
    ? "inline-flex"
    : "none";

  noticeBtn.style.display = hasUsername
    ? "none"
    : "inline-flex";

  winnerHint.textContent = hasUsername
    ? "Telegram username detected"
    : "Notice DM will be sent by bot";

  winnerModal.classList.remove("hidden");
  winnerModal.setAttribute("aria-hidden","false");

  winChime();
}

function hideWinnerModal(){

  winnerModal.classList.add("hidden");
  winnerModal.setAttribute("aria-hidden","true");

  lastWinner = null;
}

winnerCloseBtn?.addEventListener(
  "click",
  hideWinnerModal
);

winnerBackdrop?.addEventListener(
  "click",
  hideWinnerModal
);

/* Telegram button */

contactBtn?.addEventListener("click", () => {

  if(!lastWinner) return;

  const u = String(
    lastWinner.winner.username || ""
  ).replace("@","").trim();

  if(!u) return;

  window.open(`https://t.me/${u}`, "_blank");
});

/* Notice button */

noticeBtn?.addEventListener(
  "click",
  async () => {

    if(!lastWinner) return;

    const w = lastWinner.winner;

    const prize = lastWinner.prize;

    showLoading("Sending Notice...");

    try{

      const r = await apiPost(
        "/notice",
        {
          user_id: w.id,
          prize
        },
        12000
      );

      if(!r?.ok)
        throw new Error(
          r?.error || "notice failed"
        );

      if(r.dm_ok)
        alert("DM sent");

      else
        alert("User has not started bot");

    }catch(e){

      alert("Notice error: " + (e.message || e));

    }finally{

      hideLoading();
    }
  }
);
/* ===========================
 PART 4/7
 MEMBERS PANEL + MEMBERS API + TABLE + ACTIONS
=========================== */

/* ---------- Members Panel Open/Close ---------- */
function showMembersPanel(){
  membersPanel?.classList.remove("hidden");
}
function hideMembersPanel(){
  membersPanel?.classList.add("hidden");
}
membersCloseBtn?.addEventListener("click", hideMembersPanel);

/* ---------- Members Action Button HTML ---------- */
function contactButtonHTML(m){

  const username = m.username
    ? String(m.username).replace("@","").trim()
    : "";

  const id = String(m.id || "");

  const name = String(m.display || m.name || "-");

  if(m.active === false){
    return `<span class="small">inactive</span>`;
  }

  if(username){
    return `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`;
  }

  return `<button class="btn mini js-notice" data-id="${esc(id)}" data-prize="" data-name="${esc(name)}">Notice</button>`;
}

/* ---------- Render Members Table ---------- */
function renderMembersTable(list){

  const rows = (list || []).map((m,i) => {

    const username = m.username
      ? `@${String(m.username).replace("@","")}`
      : "-";

    const won = m.isWinner ? "✅" : "";

    const status = (m.active === false)
      ? "❌ INACTIVE"
      : "✅ ACTIVE";

    return `
      <tr>
        <td>${i+1}</td>
        <td>${esc(m.display || "-")}</td>
        <td>${esc(username)}</td>
        <td>${esc(String(m.id || "-"))}</td>
        <td>${won}</td>
        <td>${status}</td>
        <td>${contactButtonHTML(m)}</td>
      </tr>
    `;
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
    </table>
  `;
}

/* ---------- Load Members (Panel) ---------- */
async function loadMembersUI(){

  showMembersPanel();

  membersTotalText.textContent = "";

  /* cache first */
  const cached = readCache(CACHE_MEMBERS_KEY);

  if(Array.isArray(cached)){
    membersTotalText.textContent = ` • Total: ${cached.length} (cached)`;
    renderMembersTable(cached);
  }else{
    membersTable.innerHTML = `<div class="small">Loading...</div>`;
  }

  showLoading("Loading Members...");

  try{

    const data = await apiGet("/members", 15000);

    if(!data?.ok) throw new Error(data?.error || "members error");

    const list = Array.isArray(data.members)
      ? data.members
      : [];

    membersTotalText.textContent = ` • Total: ${list.length}`;

    renderMembersTable(list);

    saveCache(CACHE_MEMBERS_KEY, list);

  }catch(e){

    membersTable.innerHTML = `
      <div class="small" style="margin-bottom:8px;">
        ⚠️ ${esc(e.message || e)}
      </div>
    ` + (membersTable.innerHTML || "");

  }finally{

    hideLoading();
  }
}

/* ---------- Members Preview in Settings ---------- */
async function loadMembersInSettings(){

  if(!membersInSettings) return;

  membersInSettings.innerHTML = "Loading...";

  try{

    const data = await apiGet("/members", 15000);

    if(!data?.ok) throw new Error(data?.error || "members error");

    const list = Array.isArray(data.members)
      ? data.members
      : [];

    membersInSettings.innerHTML = list.length
      ? list.map((m,i) => {

          const u = m.username
            ? `@${String(m.username).replace("@","")}`
            : "-";

          const st = (m.active === false)
            ? "INACTIVE"
            : "ACTIVE";

          return `${i+1}. ${esc(m.display || "-")} (${esc(u)}) [${esc(String(m.id || "-"))}] • ${st}`;
        }).join("<br>")
      : "No members yet";

    saveCache(CACHE_MEMBERS_KEY, list);

  }catch(e){

    membersInSettings.innerHTML = `Error: ${esc(e.message || e)}`;
  }
}

/* ---------- Buttons ---------- */
membersBtn?.addEventListener("click", loadMembersUI);

refreshMembersInSettingsBtn?.addEventListener("click", loadMembersInSettings);

/* ---------- Global Delegation: Telegram / Notice (members & winner list share) ---------- */
document.addEventListener("click", async (e) => {

  const btn = e.target.closest("button");

  if(!btn) return;

  /* telegram */
  if(btn.classList.contains("js-telegram")){

    const user = (btn.dataset.user || "").replace("@","").trim();

    if(!user) return;

    window.open(`https://t.me/${user}`, "_blank");

    return;
  }

  /* notice */
  if(btn.classList.contains("js-notice")){

    const userId = btn.dataset.id;

    const prize = btn.dataset.prize || "";

    if(!userId) return;

    showLoading("Sending Notice...");

    try{

      const r = await apiPost(
        "/notice",
        {
          user_id: userId,
          prize
        },
        12000
      );

      if(r?.dm_ok) alert("DM sent ✅");
      else alert("DM failed / user not started bot ⚠️");

    }catch(err){

      alert("Notice error: " + (err.message || err));

    }finally{

      hideLoading();
    }

    return;
  }
});
/* ===========================
 PART 5/7
 WINNER LIST PANEL (Spin #)
=========================== */

let winnerList = [];

/* ---------- Panel Open/Close ---------- */

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

winnerListCloseBtn?.addEventListener(
  "click",
  hideWinnerListPanel
);

/* ---------- Winner List Render ---------- */

function renderWinnerListPanel(){

  if(!winnerListBody) return;

  if(!winnerList.length){

    winnerListBody.innerHTML =
      `<div class="small">Winner List: (empty)</div>`;

    if(winnerListTotalText)
      winnerListTotalText.textContent = "";

    return;
  }

  const rows = winnerList.map((w,idx) => {

    const username = String(
      w.username || ""
    ).replace("@","").trim();

    const actionBtn = username
      ? `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`
      : `<button class="btn mini js-notice" data-id="${esc(w.id)}" data-prize="${esc(w.prize)}">Notice</button>`;

    const doneBtn = `
      <button class="btn mini js-prize-done"
        data-id="${esc(w.id)}"
        data-index="${idx}"
        ${w.done ? `style="background:#16a34a;color:#fff;border-color:#16a34a;"` : ``}>
        ${w.done ? "Done ✅" : "Prize Done"}
      </button>
    `;

    return `
      <tr>
        <td>${idx+1}</td>
        <td><b>Spin #${idx+1}</b> - ${esc(w.prize)}</td>
        <td>${esc(w.display || "-")}</td>
        <td>${esc(String(w.id || "-"))}</td>
        <td>${doneBtn}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join("");

  winnerListBody.innerHTML = `
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

  if(winnerListTotalText)
    winnerListTotalText.textContent =
      ` • Total: ${winnerList.length}`;
}

/* ---------- Prize Done Toggle ---------- */

document.addEventListener("click",(e)=>{

  const btn = e.target.closest(".js-prize-done");

  if(!btn) return;

  const index = Number(btn.dataset.index);

  if(!winnerList[index]) return;

  winnerList[index].done = !winnerList[index].done;

  renderWinnerListPanel();
});
/* ===========================
 PART 6/7
 SPIN + POOL + RESTART
=========================== */

/* ---------- Pool Refresh ---------- */

async function refreshPoolUI(){

  try{

    const data = await apiGet("/pool",7000);

    if(!data?.ok) throw new Error(data?.error || "pool error");

    poolText.textContent =
      `${data.count || 0} people in pool`;

  }catch{

    poolText.textContent = "Pool: error";
  }
}

/* ---------- Restart Spin ---------- */

restartSpinBtn?.addEventListener("click", async ()=>{

  showLoading("Restarting Spin...");

  restartSpinBtn.disabled = true;

  try{

    const data = await apiPost(
      "/restart-spin",
      {},
      12000
    );

    if(!data?.ok)
      throw new Error(data?.error || "restart error");

    winnerList = [];

    hideWinnerModal();

    renderWinnerListPanel();

    await refreshPoolUI();

    alert("Restart Spin ✅");

  }catch(e){

    alert("Restart error: " + (e.message || e));

  }finally{

    restartSpinBtn.disabled = false;

    hideLoading();
  }
});

/* ===========================
 SPIN
=========================== */

async function spin(){

  if(spinning) return;

  if(wheelPrizes.length < 2){

    alert("Add Prize List in Settings");

    return;
  }

  spinning = true;

  spinBtn.disabled = true;

  const oldText = spinBtn.textContent;

  spinBtn.textContent = "SPIN...";

  showLoading("Spinning...");

  let result;

  try{

    result = await apiPost(
      "/spin",
      {},
      12000
    );

    if(!result?.ok)
      throw new Error(result?.error || "spin error");

  }catch(e){

    spinning = false;

    spinBtn.disabled = false;

    spinBtn.textContent = oldText;

    hideLoading();

    alert("Spin error: " + (e.message || e));

    return;

  }finally{

    hideLoading();
  }

  const prize = String(result.prize || "-");

  const winner = result.winner || {};

  /* ---------- calculate target ---------- */

  let targetAngle = calcAngleToLandOnPrize(prize);

  if(targetAngle === null)
    targetAngle = Math.random() * TAU;

  if(musicOn && bgMusic.src)
    bgMusic.play().catch(()=>{});

  const extraSpins = 7 + Math.random()*6;

  const currentNorm =
    ((currentAngle % TAU) + TAU) % TAU;

  const delta =
    ((targetAngle - currentNorm) + TAU) % TAU;

  const finalAngle =
    currentAngle + extraSpins*TAU + delta;

  const duration = 3200;

  const startTime = performance.now();

  const startAngle = currentAngle;

  function easeOutCubic(t){
    return 1 - Math.pow(1 - t,3);
  }

  let tickT = 0;

  function animate(now){

    const elapsed = now - startTime;

    const t = Math.min(elapsed/duration,1);

    const eased = easeOutCubic(t);

    currentAngle =
      startAngle + (finalAngle-startAngle)*eased;

    drawWheel();

    const nt = Math.floor(eased*60);

    if(nt !== tickT){

      tickT = nt;

      tickSound(
        600 + nt*10,
        0.015,
        0.04
      );
    }

    if(t < 1){

      requestAnimationFrame(animate);

    }else{

      /* ---------- Spin Finished ---------- */

      const wid =
        winner?.id ??
        winner?.user_id ??
        winner?.winner_id;

      const username =
        String(winner?.username || "")
        .replace("@","")
        .trim();

      const display =
        String(
          winner?.display ||
          winner?.name ||
          (username ? `@${username}` : String(wid || "-"))
        );

      /* save winner */

      winnerList.push({

        id: String(wid || "-"),

        display,

        username,

        prize,

        done:false
      });

      setWinnerPrize(wid,prize);

      /* modal */

      showWinnerModal(prize,winner);

      renderWinnerListPanel();

      refreshPoolUI();

      spinning = false;

      spinBtn.disabled = false;

      spinBtn.textContent = oldText;
    }
  }

  requestAnimationFrame(animate);
}

spinBtn?.addEventListener("click",spin);
/* ===========================
 PART 7/7 (FINAL)
 SETTINGS SAVE/RESET + UPLOADS + INIT
=========================== */

/* ---------- Save Settings + Push Prizes ---------- */
saveBtn?.addEventListener("click", async () => {

  const s = loadSettings();

  s.apiBase = (apiBaseInput?.value || DEFAULT_API_BASE).trim();
  s.apiKey  = (apiKeyInput?.value  || DEFAULT_API_KEY).trim();

  s.uiColor      = uiColorInput?.value || "#ffffff";
  s.wheelAccent  = wheelAccentInput?.value || "#d6b25e";
  s.wheelColorsText = wheelColorsInput?.value || defaultSettings.wheelColorsText;

  saveSettingsLocal(s);

  // apply theme + wheel colors
  applyThemeUI(s.uiColor, s.wheelAccent);
  sliceColors = parseWheelColors(s.wheelColorsText);

  // build prizes -> unique wheel display
  const prizeText = buildPrizeText(s.prizes);
  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  drawWheel();

  saveBtn.disabled = true;
  showLoading("Saving Settings + Uploading Prizes...");

  try {

    // Push prizes to Render
    await pushPrizeConfigToRender(prizeText);

    // refresh pool
    await refreshPoolUI();

    closeSettings();
    alert("Save ✅");

  } catch (e) {

    alert("Save error: " + (e?.message || e));

  } finally {

    saveBtn.disabled = false;
    hideLoading();
  }
});

/* ---------- Reset Settings ---------- */
resetBtn?.addEventListener("click", () => {

  if (!confirm("Reset settings လုပ်မလား?")) return;

  saveSettingsLocal(clone(defaultSettings));

  clearCache();

  localStorage.removeItem(LS_WINNERS_KEY);

  // clear local winner list (UI)
  winnerList = [];

  init();

  alert("Reset done ✅");
});

/* ---------- Upload Helpers ---------- */
pageBgFile?.addEventListener("change", async (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const s = loadSettings();

  s.pageBgDataUrl = await fileToDataURL(f);

  saveSettingsLocal(s);

  applyPageBg(s.pageBgDataUrl);
});

wheelBgFile?.addEventListener("change", async (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const s = loadSettings();

  s.wheelBgDataUrl = await fileToDataURL(f);

  saveSettingsLocal(s);

  applyWheelBg(s.wheelBgDataUrl);
});

topBannerFile?.addEventListener("change", async (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const s = loadSettings();

  s.topBannerDataUrl = await fileToDataURL(f);

  saveSettingsLocal(s);

  applyBanner(s.topBannerDataUrl, topBannerImg, topBannerFallback);
});

bottomBannerFile?.addEventListener("change", async (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const s = loadSettings();

  s.bottomBannerDataUrl = await fileToDataURL(f);

  saveSettingsLocal(s);

  applyBanner(s.bottomBannerDataUrl, bottomBannerImg, bottomBannerFallback);
});

wheelBannerFile?.addEventListener("change", async (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const s = loadSettings();

  s.wheelBannerDataUrl = await fileToDataURL(f);

  saveSettingsLocal(s);

  applyWheelBanner(s.wheelBannerDataUrl);
});

bgSongFile?.addEventListener("change", (e) => {

  const f = e.target?.files?.[0];
  if (!f) return;

  const url = URL.createObjectURL(f);

  bgMusic.src = url;

  if (musicOn) bgMusic.play().catch(()=>{});
});

/* ---------- Settings: Members preview button ---------- */
refreshMembersInSettingsBtn?.addEventListener("click", loadMembersInSettings);

/* ===========================
 INIT
=========================== */

function init(){

  const s = loadSettings();

  // Inputs
  if (apiBaseInput) apiBaseInput.value = s.apiBase || DEFAULT_API_BASE;
  if (apiKeyInput)  apiKeyInput.value  = s.apiKey  || DEFAULT_API_KEY;

  if (uiColorInput) uiColorInput.value = s.uiColor || "#ffffff";
  if (wheelAccentInput) wheelAccentInput.value = s.wheelAccent || "#d6b25e";
  if (wheelColorsInput) wheelColorsInput.value = s.wheelColorsText || defaultSettings.wheelColorsText;

  // Theme
  applyThemeUI(s.uiColor, s.wheelAccent);

  // Images
  applyPageBg(s.pageBgDataUrl || "");
  applyWheelBg(s.wheelBgDataUrl || "");
  applyBanner(s.topBannerDataUrl || "", topBannerImg, topBannerFallback);
  applyBanner(s.bottomBannerDataUrl || "", bottomBannerImg, bottomBannerFallback);
  applyWheelBanner(s.wheelBannerDataUrl || "");

  // Prize Builder UI
  renderPrizeBuilder(s.prizes || clone(defaultSettings.prizes));

  // Wheel prizes/colors
  sliceColors = parseWheelColors(s.wheelColorsText);
  const prizeText = buildPrizeText(s.prizes || []);
  wheelPrizes = uniquePrizesFromPrizeText(prizeText);

  drawWheel();

  // Music btn text
  updateMusicBtn();

  // Winner list reset (today only in UI)
  winnerList = [];

  // First load pool
  refreshPoolUI();

  // Render winner list UI empty
  renderWinnerListPanel();
}

init();