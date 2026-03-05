"use strict";

/* ===========================
   PART 1 — Clean Premium (Fast UI)
   - No Loading Overlay (disabled)
   - Instant click + button text waiting
   - Members panel: cache first, then fetch
   - DOM ids matched to your latest HTML
=========================== */

/* ===========================
   HARD DEFAULTS
=========================== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY = "Lucky77_luckywheel_77";

/* ===========================
   DOM (match your HTML)
=========================== */
const wheelCanvas = document.getElementById("wheel");
const ctx = wheelCanvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const poolText = document.getElementById("poolText");

const drawer = document.getElementById("drawer");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

const apiBaseInput = document.getElementById("apiBaseInput");
const apiKeyInput = document.getElementById("apiKeyInput");

const prizeBuilder = document.getElementById("prizeBuilder");
const uiColorInput = document.getElementById("uiColorInput");
const wheelAccentInput = document.getElementById("wheelAccentInput");
const wheelColorsInput = document.getElementById("wheelColorsInput");

const topBannerFile = document.getElementById("topBannerFile");
const bottomBannerFile = document.getElementById("bottomBannerFile");
const pageBgFile = document.getElementById("pageBgFile");
const wheelBgFile = document.getElementById("wheelBgFile");
const wheelBannerFile = document.getElementById("wheelBannerFile");
const bgSongFile = document.getElementById("bgSongFile");

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

/* Panels */
const membersPanel = document.getElementById("membersPanel");
const membersCloseBtn = document.getElementById("membersCloseBtn");
const membersTable = document.getElementById("membersTable");
const membersTotalText = document.getElementById("membersTotalText");

/* Winner List panel (Part2 will fill data) */
const winnerListPanel = document.getElementById("winnerListPanel");
const winnerListCloseBtn = document.getElementById("winnerListCloseBtn");
const winnerListBody = document.getElementById("winnerListBody");
const winnerListTotalText = document.getElementById("winnerListTotalText");

/* Winner Modal (Part2 will wire actions) */
const winnerModal = document.getElementById("winnerModal");
const winnerBackdrop = document.getElementById("winnerBackdrop");
const winnerPrizeTitle = document.getElementById("winnerPrizeTitle");
const winnerTitleText = document.getElementById("winnerTitleText");
const winnerNameText = document.getElementById("winnerNameText");
const contactBtn = document.getElementById("contactBtn");
const noticeBtn = document.getElementById("noticeBtn");
const winnerCloseBtn = document.getElementById("winnerCloseBtn");
const winnerHint = document.getElementById("winnerHint");

/* Settings extra UI */
const refreshMembersInSettingsBtn = document.getElementById("refreshMembersInSettingsBtn");
const membersInSettings = document.getElementById("membersInSettings");

/* Test/Event History controls (Part3+) */
const testModeBtn = document.getElementById("testModeBtn");
const clearTestHistoryBtn = document.getElementById("clearTestHistoryBtn");
const eventHistoryField = document.getElementById("eventHistoryField");
const refreshEventHistoryBtn = document.getElementById("refreshEventHistoryBtn");
const exportEventHistoryBtn = document.getElementById("exportEventHistoryBtn");
const clearEventHistoryBtn = document.getElementById("clearEventHistoryBtn");
const eventHistoryViewer = document.getElementById("eventHistoryViewer");

/* Music */
const musicBtn = document.getElementById("musicBtn");

/* ===========================
   NO LOADING OVERLAY (hard disable)
   - We keep functions but they do nothing
=========================== */
function showLoading(_) {}
function hideLoading() {}

/* ===========================
   Small UI helper: button waiting
=========================== */
function withBtnWaiting(btn, waitingText, fn) {
  if (!btn) return;
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = waitingText;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      btn.disabled = false;
      btn.textContent = old;
    });
}

/* ===========================
   Storage
=========================== */
const STORAGE_KEY = "lucky77_fast_v1";
const CACHE_MEMBERS_KEY = "lucky77_cache_members_v1";

/* ===========================
   Default Settings
=========================== */
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

  // Part3+ will use:
  testMode: false,
};

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

/* cache (members) */
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

/* ===========================
   Theme Apply
=========================== */
function applyThemeUI(uiColor, wheelAccent) {
  document.documentElement.style.setProperty("--ui", uiColor);
  document.documentElement.style.setProperty("--bg", uiColor);
  document.documentElement.style.setProperty("--gold", wheelAccent);
  document.documentElement.style.setProperty("--text", "#101318");
}

/* ===========================
   Images
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
  if (dataUrl) {
    bgLayer.classList.add("has-img");
    bgLayer.style.backgroundImage = `url("${dataUrl}")`;
  } else {
    bgLayer.classList.remove("has-img");
    bgLayer.style.backgroundImage = "";
  }
}
function applyWheelBg(dataUrl) {
  if (dataUrl) {
    wheelWrap.classList.add("has-img");
    wheelWrap.style.backgroundImage = `url("${dataUrl}")`;
  } else {
    wheelWrap.classList.remove("has-img");
    wheelWrap.style.backgroundImage = "";
  }
}
function applyWheelBanner(dataUrl) {
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
   Drawer
=========================== */
function openSettings() { drawer.classList.add("open"); }
function closeSettings() { drawer.classList.remove("open"); }
settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);

/* ===========================
   API Helpers (timeout)
=========================== */
function getApiBase() {
  const s = loadSettings();
  return (s.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}
function getApiKey() {
  const s = loadSettings();
  return s.apiKey || DEFAULT_API_KEY;
}
async function fetchJsonWithTimeout(url, opt = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opt, signal: ctrl.signal });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); }
    catch { json = { ok: false, error: "Invalid JSON", raw: String(text || "").slice(0, 200) }; }
    if (!r.ok && json?.ok !== true) return { ok: false, error: json?.error || `HTTP ${r.status}` };
    return json;
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "Timeout" : (e?.message || String(e)) };
  } finally {
    clearTimeout(id);
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
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(body || {}),
    },
    timeoutMs
  );
}

/* ===========================
   Pool UI (fast)
=========================== */
async function refreshPoolUI() {
  const data = await apiGet("/pool", 7000);
  if (data?.ok) {
    // your render returns {pool, ids}
    const count = Number(data.pool ?? data.count ?? 0);
    poolText.textContent = `${count} people in pool`;
  } else {
    poolText.textContent = "Pool: -";
  }
}

/* ===========================
   Members Panel (cache first, then fetch)
=========================== */
function showMembersPanel() { membersPanel.classList.remove("hidden"); }
function hideMembersPanel() { membersPanel.classList.add("hidden"); }
membersCloseBtn.addEventListener("click", hideMembersPanel);

function contactButtonHTML(m) {
  const username = m.username ? String(m.username).replace("@", "").trim() : "";
  const id = String(m.id || "");
  const name = String(m.display || m.name || "-");

  const isActive = (m.active === true || m.active === "1" || m.active === 1);
  if (!isActive) return `<span class="small">inactive</span>`;

  if (username) {
    return `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`;
  }
  return `<button class="btn mini js-notice" data-id="${esc(id)}" data-prize="" data-name="${esc(name)}">Notice</button>`;
}

function renderMembersTable(list) {
  const rows = (list || []).map((m, i) => {
    const username = m.username ? `@${String(m.username).replace("@", "")}` : "-";
    const status = (m.active === true || m.active === "1") ? "✅ ACTIVE" : "❌ INACTIVE";
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(m.display || m.name || "-")}</td>
      <td>${esc(username)}</td>
      <td>${esc(String(m.id || "-"))}</td>
      <td>${status}</td>
      <td>${contactButtonHTML(m)}</td>
    </tr>`;
  }).join("");

  membersTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>No.</th><th>Name</th><th>Username</th><th>ID</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No members yet</td></tr>`}</tbody>
    </table>
  `;
}

async function loadMembersUI() {
  showMembersPanel();
  membersTotalText.textContent = "";

  // 1) show cache instantly
  const cached = readCache(CACHE_MEMBERS_KEY);
  if (Array.isArray(cached)) {
    membersTotalText.textContent = ` • Total: ${cached.length} (cached)`;
    renderMembersTable(cached);
  } else {
    membersTable.innerHTML = `<div class="small">Loading...</div>`;
  }

  // 2) fetch and update
  await withBtnWaiting(membersBtn, "Loading Members...", async () => {
    const data = await apiGet("/members", 15000);
    if (!data?.ok) return;

    const list = Array.isArray(data.members) ? data.members : [];
    membersTotalText.textContent = ` • Total: ${list.length}`;
    renderMembersTable(list);
    saveCache(CACHE_MEMBERS_KEY, list);
  });
}

/* Settings preview list */
async function loadMembersInSettings() {
  membersInSettings.innerHTML = "Loading...";
  const data = await apiGet("/members", 15000);
  if (!data?.ok) {
    membersInSettings.innerHTML = "—";
    return;
  }
  const list = Array.isArray(data.members) ? data.members : [];
  membersInSettings.innerHTML = list.length
    ? list.map((m, i) => {
        const u = m.username ? `@${String(m.username).replace("@", "")}` : "-";
        const st = (m.active === true || m.active === "1") ? "ACTIVE" : "INACTIVE";
        return `${i + 1}. ${esc(m.display || m.name || "-")} (${esc(u)}) [${esc(String(m.id || "-"))}] • ${st}`;
      }).join("<br>")
    : "No members yet";
  saveCache(CACHE_MEMBERS_KEY, list);
}

/* ===========================
   Winner List Panel (UI only in Part1)
=========================== */
function showWinnerListPanel() { winnerListPanel.classList.remove("hidden"); }
function hideWinnerListPanel() { winnerListPanel.classList.add("hidden"); }
winnerListCloseBtn.addEventListener("click", hideWinnerListPanel);

async function openWinnerListUI() {
  showWinnerListPanel();
  winnerListTotalText.textContent = "";
  winnerListBody.innerHTML = `<div class="small">— (Part2 မှာ Today winners data ထည့်မယ်)</div>`;
  // button waiting (no overlay)
  await withBtnWaiting(winnerListBtn, "Loading...", async () => {});
}

/* ===========================
   Delegation (Telegram / Notice click)
   - Notice API already exists on Render
=========================== */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("js-telegram")) {
    const user = (btn.dataset.user || "").replace("@", "").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  if (btn.classList.contains("js-notice")) {
    const userId = btn.dataset.id;
    const prize = btn.dataset.prize || "";
    if (!userId) return;

    await withBtnWaiting(btn, "Sending...", async () => {
      await apiPost("/notice", { user_id: userId, prize }, 12000);
    });
    return;
  }
});

/* ===========================
   Music (fast)
=========================== */
const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.55;
let musicOn = false;

function updateMusicBtn() {
  musicBtn.textContent = musicOn ? "🎵 Music: ON" : "🎵 Music: OFF";
  musicBtn.classList.toggle("primary", musicOn);
}
musicBtn.addEventListener("click", async () => {
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

/* ===========================
   Wheel minimal draw (Part2 will replace with full spin match)
=========================== */
let wheelPrizes = ["Prize A", "Prize B"]; // Part2 will load from settings prizes
let sliceColors = ["#ffffff", "#f1f5ff"];
let currentAngle = 0;
const TAU = Math.PI * 2;

function drawWheel() {
  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const radius = Math.min(cx, cy) - 12;

  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  const slice = TAU / wheelPrizes.length;
  const base = -currentAngle;

  for (let i = 0; i < wheelPrizes.length; i++) {
    const start = base + i * slice;
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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#101318";
    ctx.font = "900 18px sans-serif";
    ctx.fillText(String(wheelPrizes[i] || ""), radius - 18, 6);
    ctx.restore();
  }
}

/* ===========================
   Save / Reset (Part1: only local + theme + images)
   - Render /config/prizes push will be in Part3 (with Test Mode)
=========================== */
saveBtn.addEventListener("click", async () => {
  await withBtnWaiting(saveBtn, "Saving...", async () => {
    const s = loadSettings();

    s.apiBase = (apiBaseInput.value || DEFAULT_API_BASE).trim();
    s.apiKey = (apiKeyInput.value || DEFAULT_API_KEY).trim();

    s.uiColor = uiColorInput.value || "#ffffff";
    s.wheelAccent = wheelAccentInput.value || "#d6b25e";
    s.wheelColorsText = wheelColorsInput.value || defaultSettings.wheelColorsText;

    saveSettingsLocal(s);

    applyThemeUI(s.uiColor, s.wheelAccent);
    // keep draw stable
    drawWheel();

    await refreshPoolUI();
    closeSettings();
  });
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset settings လုပ်မလား?")) return;
  saveSettingsLocal(clone(defaultSettings));
  init();
  alert("Reset done ✅");
});

/* Upload handlers (store to LocalStorage) */
pageBgFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.pageBgDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyPageBg(s.pageBgDataUrl);
});
wheelBgFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.wheelBgDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyWheelBg(s.wheelBgDataUrl);
});
topBannerFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.topBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyBanner(s.topBannerDataUrl, topBannerImg, topBannerFallback);
});
bottomBannerFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.bottomBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyBanner(s.bottomBannerDataUrl, bottomBannerImg, bottomBannerFallback);
});
wheelBannerFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const s = loadSettings();
  s.wheelBannerDataUrl = await fileToDataURL(f);
  saveSettingsLocal(s);
  applyWheelBanner(s.wheelBannerDataUrl);
});
bgSongFile.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  bgMusic.src = URL.createObjectURL(f);
  if (musicOn) bgMusic.play().catch(() => {});
});

/* ===========================
   Buttons wiring
=========================== */
membersBtn.addEventListener("click", loadMembersUI);
winnerListBtn.addEventListener("click", openWinnerListUI);
refreshMembersInSettingsBtn.addEventListener("click", loadMembersInSettings);

/* Restart button (Part2 will call correct endpoint)
   - for now just refresh pool fast (no errors)
*/
restartSpinBtn.addEventListener("click", async () => {
  await withBtnWaiting(restartSpinBtn, "Restarting...", async () => {
    await refreshPoolUI();
  });
});

/* Spin button (Part2 will implement /spin + perfect landing) */
spinBtn.addEventListener("click", async () => {
  // Part2
  alert("Part2 မှာ SPIN logic (perfect match) ထည့်မယ် ✅");
});

/* ===========================
   Init
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

  // minimal wheel render now
  sliceColors = String(s.wheelColorsText || "")
    .split("\n").map(x => x.trim()).filter(Boolean);
  if (!sliceColors.length) sliceColors = ["#ffffff", "#f1f5ff"];

  // Part2 will build real wheelPrizes from prizeBuilder settings
  wheelPrizes = (s.prizes || []).map(p => String(p.name || "").trim()).filter(Boolean);
  if (wheelPrizes.length < 2) wheelPrizes = ["Prize A", "Prize B"];

  drawWheel();
  updateMusicBtn();
  refreshPoolUI();
}
init();

/* ===========================
   Utils
=========================== */
function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
/* ===========================
   PART 2 — Spin perfect match + Winner Modal + Restart + Today Winner List
=========================== */

/* ---------- Today Winner List Storage ---------- */
const LS_TODAY_WINNERS = "lucky77_today_winners_v1";

function loadTodayWinners() {
  try { return JSON.parse(localStorage.getItem(LS_TODAY_WINNERS) || "[]"); }
  catch { return []; }
}
function saveTodayWinners(list) {
  try { localStorage.setItem(LS_TODAY_WINNERS, JSON.stringify(Array.isArray(list) ? list : [])); } catch {}
}
function clearTodayWinners() {
  try { localStorage.removeItem(LS_TODAY_WINNERS); } catch {}
}

function pushTodayWinner({ turn, prize, winner }) {
  const list = loadTodayWinners();
  list.push({
    turn: Number(turn || list.length + 1),
    prize: String(prize || "-"),
    winner: {
      id: String(winner?.id ?? winner?.user_id ?? ""),
      name: String(winner?.name || ""),
      username: String(winner?.username || ""),
      display: String(winner?.display || winner?.name || (winner?.username ? `@${String(winner.username).replace(/^@+/, "")}` : String(winner?.id || ""))),
    },
    done: false,
    at: Date.now(),
  });
  saveTodayWinners(list);
  return list;
}

/* ---------- Winner List Panel Render ---------- */
function renderWinnerListToday() {
  const list = loadTodayWinners();
  const total = list.length;

  if (winnerListTotalText) winnerListTotalText.textContent = total ? ` • Total: ${total}` : "";
  if (!winnerListBody) return;

  if (!total) {
    winnerListBody.innerHTML = `<div class="small">No winners yet (Today)</div>`;
    return;
  }

  const rows = list.map((r, i) => {
    const w = r.winner || {};
    const username = w.username ? `@${String(w.username).replace(/^@+/, "")}` : "-";
    const id = String(w.id || "-");
    const done = !!r.done;

    const doneBtnClass = done ? "btn mini success js-wl-done" : "btn mini js-wl-done";
    const doneBtnText = done ? "Done ✅" : "Prize Done";

    // action: Telegram if username, else Notice (DM)
    let actionHTML = `<span class="small">—</span>`;
    if (w.username) {
      actionHTML = `<button class="btn mini js-telegram" data-user="${esc(String(w.username).replace(/^@+/, ""))}">Telegram</button>`;
    } else if (id && id !== "-") {
      actionHTML = `<button class="btn mini js-notice" data-id="${esc(id)}" data-prize="${esc(String(r.prize || ""))}" data-name="${esc(String(w.display || ""))}">Notice</button>`;
    }

    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(String(r.turn ?? (i + 1)))}</td>
      <td>${esc(String(r.prize || "-"))}</td>
      <td>${esc(String(w.display || w.name || "-"))}</td>
      <td>${esc(username)}</td>
      <td>${esc(id)}</td>
      <td><button class="${doneBtnClass}" data-idx="${esc(String(i))}">${doneBtnText}</button></td>
      <td>${actionHTML}</td>
    </tr>`;
  }).join("");

  winnerListBody.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>#</th><th>Spin</th><th>Prize</th><th>Name</th><th>Username</th><th>ID</th><th>Done</th><th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function openWinnerListUI_v2() {
  showWinnerListPanel();
  renderWinnerListToday();
}

/* ---------- Winner Modal ---------- */
let lastWinner = null;

function showWinnerModal(prize, winnerObj) {
  const w = winnerObj || {};
  const username = String(w.username || "").replace(/^@+/, "").trim();
  const hasUsername = !!username;

  const display = String(
    w.display ||
    w.name ||
    (username ? `@${username}` : String(w.id || w.user_id || "-"))
  );

  lastWinner = { prize: String(prize || "-"), winner: { ...w, id: String(w.id || w.user_id || "") } };

  if (winnerPrizeTitle) winnerPrizeTitle.textContent = "WINNER";
  if (winnerTitleText) winnerTitleText.textContent = String(prize || "—");
  if (winnerNameText) winnerNameText.textContent = display;

  if (contactBtn) contactBtn.style.display = hasUsername ? "inline-flex" : "none";
  if (noticeBtn) noticeBtn.style.display = hasUsername ? "none" : "inline-flex";

  if (winnerHint) {
    winnerHint.textContent = hasUsername
      ? "✅ Username ရှိလို့ Telegram ကို တန်းဖွင့်နိုင်ပါတယ်"
      : "✅ Username မရှိလို့ Notice နှိပ်ရင် Bot က DM ပို့မယ်";
  }

  if (winnerModal) {
    winnerModal.classList.remove("hidden");
    winnerModal.setAttribute("aria-hidden", "false");
  }
}

function hideWinnerModal() {
  lastWinner = null;
  if (winnerModal) {
    winnerModal.classList.add("hidden");
    winnerModal.setAttribute("aria-hidden", "true");
  }
}

if (winnerCloseBtn) winnerCloseBtn.addEventListener("click", hideWinnerModal);
if (winnerBackdrop) winnerBackdrop.addEventListener("click", hideWinnerModal);

if (contactBtn) {
  contactBtn.addEventListener("click", () => {
    if (!lastWinner) return;
    const u = String(lastWinner.winner.username || "").replace(/^@+/, "").trim();
    if (!u) return;
    window.open(`https://t.me/${u}`, "_blank");
  });
}

if (noticeBtn) {
  noticeBtn.addEventListener("click", async () => {
    if (!lastWinner) return;

    const w = lastWinner.winner;
    const prize = lastWinner.prize;
    const uid = String(w.id || "");
    if (!uid) return;

    await withBtnWaiting(noticeBtn, "Sending...", async () => {
      await apiPost("/notice", { user_id: uid, prize }, 12000);
    });
  });
}

/* ---------- Wheel perfect landing ---------- */
function normalizePrizeName(x) {
  return String(x || "").trim();
}

// pointer at TOP and we draw with base = -currentAngle
function calcAngleToLandOnPrize(prize) {
  const p = normalizePrizeName(prize);
  const idx = wheelPrizes.findIndex((x) => normalizePrizeName(x) === p);

  if (idx < 0 || wheelPrizes.length < 2) return null;

  const slice = TAU / wheelPrizes.length;

  // pointer top (up) in canvas angle system
  const pointerAngle = (Math.PI * 3) / 2; // 270°

  // center of slice i should land on pointer
  const centerOffset = (idx + 0.5) * slice;

  // displayed angle where slice center aligns to pointer (before we invert)
  let displayedTarget = pointerAngle - centerOffset;

  // tiny jitter inside slice
  const jitter = (Math.random() * 0.6 - 0.3) * (slice * 0.5);
  displayedTarget += jitter;

  // draw uses base = -currentAngle, so -currentAngle == displayedTarget
  let target = -displayedTarget;

  // normalize [0..TAU)
  target = ((target % TAU) + TAU) % TAU;
  return target;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/* ---------- SPIN (API → perfect prize landing → modal + today list) ---------- */
let spinning = false;

async function spin_v2() {
  if (spinning) return;

  // must have at least 2 unique prizes
  if (!Array.isArray(wheelPrizes) || wheelPrizes.length < 2) {
    alert("Settings ထဲမှာ Prize (အနည်းဆုံး 2 ခု) ထည့်ပါ");
    return;
  }

  spinning = true;

  await withBtnWaiting(spinBtn, "SPIN...", async () => {
    // 1) call API /spin
    const result = await apiPost("/spin", {}, 12000);
    if (!result?.ok) {
      // keep silent/no overlay; just small alert
      alert(String(result?.error || "spin error"));
      return;
    }

    const prize = String(result.prize || "-");
    const winner = result.winner || {};
    const turn = Number(result.turn || 0);

    // 2) compute target angle for prize
    let targetAngle = calcAngleToLandOnPrize(prize);
    if (targetAngle === null) {
      // if prize string not found in wheel list, fallback random
      targetAngle = Math.random() * TAU;
    }

    // 3) animate
    const extraSpins = 7 + Math.random() * 6;
    const currentNorm = ((currentAngle % TAU) + TAU) % TAU;
    const delta = ((targetAngle - currentNorm) + TAU) % TAU;
    const finalAngle = currentAngle + extraSpins * TAU + delta;

    const duration = 3200;
    const startTime = performance.now();
    const startAngle = currentAngle;

    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(t);

      currentAngle = startAngle + (finalAngle - startAngle) * eased;
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // 4) store today winner + refresh winner list UI if open
        pushTodayWinner({ turn, prize, winner: { ...winner, id: winner.id || winner.user_id } });
        if (winnerListPanel && !winnerListPanel.classList.contains("hidden")) {
          renderWinnerListToday();
        }

        // 5) show modal
        showWinnerModal(prize, { ...winner, id: winner.id || winner.user_id });

        // 6) refresh pool text (fast)
        refreshPoolUI();
      }
    };

    requestAnimationFrame(animate);
  });

  spinning = false;
}

/* ---------- Restart Spin (Render uses /event/reset) ---------- */
async function restart_v2() {
  await withBtnWaiting(restartSpinBtn, "Restarting...", async () => {
    const r = await apiPost("/event/reset", {}, 12000);
    if (!r?.ok) {
      alert(String(r?.error || "restart error"));
      return;
    }

    // new session in UI
    clearTodayWinners();
    if (winnerListPanel && !winnerListPanel.classList.contains("hidden")) {
      renderWinnerListToday();
    }
    hideWinnerModal();
    await refreshPoolUI();
  });
}

/* ---------- Winner list Done toggle + optional backend persist ---------- */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("js-wl-done")) {
    const idx = Number(btn.dataset.idx);
    const list = loadTodayWinners();
    if (!Number.isFinite(idx) || !list[idx]) return;

    list[idx].done = !list[idx].done;
    saveTodayWinners(list);

    // optimistic UI
    btn.textContent = list[idx].done ? "Done ✅" : "Prize Done";
    btn.classList.toggle("success", !!list[idx].done);

    // persist to backend if you want (Render has /winner/done)
    const uid = String(list[idx]?.winner?.id || "");
    if (uid && list[idx].done) {
      // don't block UI; just try
      apiPost("/winner/done", { user_id: uid }, 12000).catch(() => {});
    }
    return;
  }
});

/* ---------- Override Part1 button handlers ---------- */
spinBtn.removeEventListener("click", () => {});
spinBtn.onclick = spin_v2;

restartSpinBtn.removeEventListener("click", () => {});
restartSpinBtn.onclick = restart_v2;

winnerListBtn.removeEventListener("click", () => {});
winnerListBtn.onclick = openWinnerListUI_v2;

/* ---------- Update winner list panel when closing/opening ---------- */
if (winnerListCloseBtn) {
  winnerListCloseBtn.addEventListener("click", () => {
    hideWinnerListPanel();
  });
}

/* ---------- Ensure wheelPrizes always unique (match API prize string) ---------- */
function rebuildWheelPrizesFromSettings() {
  const s = loadSettings();
  const uniq = [];
  const seen = new Set();
  (s.prizes || []).forEach((p) => {
    const name = String(p?.name || "").trim();
    if (!name) return;
    if (seen.has(name)) return;
    seen.add(name);
    uniq.push(name);
  });
  if (uniq.length >= 2) wheelPrizes = uniq;
  else wheelPrizes = ["Prize A", "Prize B"];
}
rebuildWheelPrizesFromSettings();
drawWheel();
/* ===========================
   PART 3 — Prize Builder + Test Mode + Save push
=========================== */

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

/* ---------- Build Prize Text ---------- */

function buildPrizeText(prizes){
  return (prizes||[])
    .filter(p=>p && String(p.name||"").trim())
    .map(p=>`${String(p.name).trim()} ${clamp(Number(p.times||1),1,9999)}time`)
    .join("\n");
}

/* ---------- Prize Builder Render ---------- */

function renderPrizeBuilder(prizes){

  prizeBuilder.innerHTML="";

  prizes.forEach((p,idx)=>{

    const row=document.createElement("div");
    row.className="prize-row";

    const left=document.createElement("div");

    left.innerHTML=`
      <div class="pname">Prize</div>
      <input data-k="name" data-i="${idx}" value="${esc(p.name||"")}" placeholder="10000Ks">
    `;

    const right=document.createElement("div");
    right.className="stepper";

    right.innerHTML=`
      <button data-act="dec" data-i="${idx}">-</button>
      <input data-k="times" data-i="${idx}" type="number" min="1" max="9999" value="${clamp(Number(p.times||1),1,9999)}">
      <button data-act="inc" data-i="${idx}">+</button>
      <button class="btn mini danger" data-act="remove" data-i="${idx}">Remove</button>
    `;

    row.appendChild(left);
    row.appendChild(right);

    prizeBuilder.appendChild(row);

  });

  /* add button */

  const addBtn=document.createElement("button");
  addBtn.className="btn";
  addBtn.textContent="+ Add Prize";

  addBtn.onclick=()=>{

    const s=loadSettings();
    s.prizes.push({name:"",times:1});
    saveSettingsLocal(s);

    renderPrizeBuilder(s.prizes);

  };

  prizeBuilder.appendChild(addBtn);

  /* button events */

  prizeBuilder.querySelectorAll("button[data-act]").forEach(btn=>{

    btn.onclick=()=>{

      const i=Number(btn.dataset.i);
      const act=btn.dataset.act;

      const s=loadSettings();
      if(!s.prizes[i]) return;

      if(act==="remove"){

        s.prizes.splice(i,1);

        if(!s.prizes.length){
          s.prizes.push({name:"",times:1});
        }

        saveSettingsLocal(s);
        renderPrizeBuilder(s.prizes);
        return;
      }

      const cur=clamp(Number(s.prizes[i].times||1),1,9999);

      s.prizes[i].times=
        act==="inc"
        ? clamp(cur+1,1,9999)
        : clamp(cur-1,1,9999);

      saveSettingsLocal(s);
      renderPrizeBuilder(s.prizes);

    };

  });

  prizeBuilder.querySelectorAll("input[data-k]").forEach(inp=>{

    inp.oninput=()=>{

      const i=Number(inp.dataset.i);
      const k=inp.dataset.k;

      const s=loadSettings();
      if(!s.prizes[i]) return;

      if(k==="name"){
        s.prizes[i].name=String(inp.value||"");
      }

      if(k==="times"){
        s.prizes[i].times=clamp(Number(inp.value||1),1,9999);
      }

      saveSettingsLocal(s);

    };

  });

}

/* ---------- Push prize config to Render ---------- */

async function pushPrizeConfig(prizeText){

  const r=await apiPost("/config/prizes",{prizeText},12000);

  if(!r?.ok){
    throw new Error(r?.error||"config/prizes error");
  }

}

/* ---------- Save Button Override ---------- */

saveBtn.onclick=async()=>{

  await withBtnWaiting(saveBtn,"Saving...",async()=>{

    const s=loadSettings();

    s.apiBase=(apiBaseInput.value||DEFAULT_API_BASE).trim();
    s.apiKey=(apiKeyInput.value||DEFAULT_API_KEY).trim();

    s.uiColor=uiColorInput.value||"#ffffff";
    s.wheelAccent=wheelAccentInput.value||"#d6b25e";
    s.wheelColorsText=wheelColorsInput.value||defaultSettings.wheelColorsText;

    saveSettingsLocal(s);

    applyThemeUI(s.uiColor,s.wheelAccent);

    const prizeText=buildPrizeText(s.prizes);

    /* rebuild wheel prizes */

    wheelPrizes=s.prizes
      .map(p=>String(p.name||"").trim())
      .filter(Boolean);

    drawWheel();

    /* test mode check */

    if(!s.testMode){

      try{
        await pushPrizeConfig(prizeText);
      }catch(e){
        alert("Render push error: "+e.message);
      }

    }

    await refreshPoolUI();

    closeSettings();

  });

};

/* ---------- Test Mode Toggle ---------- */

function updateTestBtn(){

  const s=loadSettings();

  if(!testModeBtn) return;

  if(s.testMode){
    testModeBtn.textContent="Test: ON";
    testModeBtn.classList.add("danger");
  }else{
    testModeBtn.textContent="Test: OFF";
    testModeBtn.classList.remove("danger");
  }

}

if(testModeBtn){

  testModeBtn.onclick=()=>{

    const s=loadSettings();

    s.testMode=!s.testMode;

    saveSettingsLocal(s);

    updateTestBtn();

  };

}

/* ---------- Init extend ---------- */

(function initPart3(){

  const s=loadSettings();

  renderPrizeBuilder(s.prizes||[]);
  updateTestBtn();

})();
/* ===========================
   PART 4 — Members Panel + Fast Cache + Actions
=========================== */

/* ---------- Members Cache ---------- */

const LS_MEMBERS_CACHE = "lucky77_cache_members_v1";

function loadMembersCache(){
  try{
    return JSON.parse(localStorage.getItem(LS_MEMBERS_CACHE)||"[]");
  }catch{
    return [];
  }
}

function saveMembersCache(list){
  try{
    localStorage.setItem(LS_MEMBERS_CACHE,JSON.stringify(list||[]));
  }catch{}
}

/* ---------- Render Members Table ---------- */

function renderMembersTable(list){

  if(!membersTable) return;

  if(!Array.isArray(list) || !list.length){
    membersTable.innerHTML=`<div class="small">No members</div>`;
    return;
  }

  const rows=list.map((m,i)=>{

    const username = m.username ? `@${String(m.username).replace(/^@+/,"")}` : "-";
    const active = m.active ? "Active" : "Inactive";

    let actionHTML=`<span class="small">—</span>`;

    if(m.username){
      actionHTML=`<button class="btn mini js-telegram" data-user="${esc(String(m.username).replace(/^@+/,""))}">Telegram</button>`;
    }else if(m.id){
      actionHTML=`<button class="btn mini js-notice" data-id="${esc(String(m.id))}" data-name="${esc(m.display||m.name||"")}" data-prize="">Notice</button>`;
    }

    return `
    <tr>
      <td>${i+1}</td>
      <td>${esc(m.display||m.name||"-")}</td>
      <td>${esc(username)}</td>
      <td>${esc(String(m.id||"-"))}</td>
      <td>${active}</td>
      <td>${actionHTML}</td>
    </tr>
    `;

  }).join("");

  membersTable.innerHTML=`
  <table class="table">
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Username</th>
        <th>ID</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  `;

}

/* ---------- Fetch Members ---------- */

async function fetchMembers(){

  const r = await apiGet("/members",15000);

  if(!r?.ok){
    throw new Error(r?.error||"members error");
  }

  const list = r.members || [];

  saveMembersCache(list);

  return list;
}

/* ---------- Open Members Panel ---------- */

async function openMembersUI(){

  showMembersPanel();

  /* fast load from cache */

  const cache = loadMembersCache();

  if(cache.length){
    renderMembersTable(cache);
  }

  if(membersTotalText){
    membersTotalText.textContent="Loading...";
  }

  try{

    const list = await fetchMembers();

    renderMembersTable(list);

    if(membersTotalText){
      membersTotalText.textContent=` • Total: ${list.length}`;
    }

  }catch(e){

    if(membersTotalText){
      membersTotalText.textContent="Error";
    }

  }

}

/* ---------- Members Button Override ---------- */

membersBtn.onclick = openMembersUI;

/* ---------- Telegram / Notice Buttons ---------- */

document.addEventListener("click",(e)=>{

  const btn = e.target.closest("button");
  if(!btn) return;

  /* telegram open */

  if(btn.classList.contains("js-telegram")){

    const user = btn.dataset.user;
    if(!user) return;

    window.open(`https://t.me/${user}`,"_blank");

    return;
  }

  /* notice */

  if(btn.classList.contains("js-notice")){

    const uid = btn.dataset.id;
    const prize = btn.dataset.prize || "";

    if(!uid) return;

    withBtnWaiting(btn,"Sending...",async()=>{

      await apiPost("/notice",{
        user_id:uid,
        prize
      },12000);

    });

  }

});

/* ---------- Members Panel Close ---------- */

if(membersCloseBtn){
  membersCloseBtn.onclick = hideMembersPanel;
}
/* ===========================
   PART 5 — Event History Sessions
=========================== */

const LS_SESSION="lucky77_session";
const LS_HISTORY="lucky77_event_history";

/* ---------- Load / Save ---------- */

function loadSession(){
  try{
    return JSON.parse(localStorage.getItem(LS_SESSION)||"null");
  }catch{return null;}
}

function saveSession(s){
  try{
    localStorage.setItem(LS_SESSION,JSON.stringify(s));
  }catch{}
}

function loadHistory(){
  try{
    return JSON.parse(localStorage.getItem(LS_HISTORY)||"[]");
  }catch{return [];}
}

function saveHistory(list){
  try{
    localStorage.setItem(LS_HISTORY,JSON.stringify(list||[]));
  }catch{}
}

/* ---------- Start Session ---------- */

function startSession(){

  const s={
    id:Date.now(),
    start:new Date().toISOString(),
    winners:[],
    completed:false
  };

  saveSession(s);

}

/* ---------- Add Winner To Session ---------- */

function sessionAddWinner(turn,prize,winner){

  const s=loadSession();
  if(!s) return;

  s.winners.push({
    turn,
    prize,
    id:winner.id,
    name:winner.name||"",
    username:winner.username||"",
    done:false
  });

  saveSession(s);

}

/* ---------- Mark Done ---------- */

function sessionDone(uid){

  const s=loadSession();
  if(!s) return;

  const w=s.winners.find(x=>String(x.id)===String(uid));

  if(w){
    w.done=true;
  }

  saveSession(s);

}

/* ---------- Complete Session ---------- */

function completeSession(){

  const s=loadSession();
  if(!s) return;

  s.completed=true;

  saveSession(s);

}

/* ---------- Archive Session ---------- */

function archiveSession(){

  const s=loadSession();
  if(!s) return;

  const hist=loadHistory();

  hist.push(s);

  saveHistory(hist);

  localStorage.removeItem(LS_SESSION);

}

/* ---------- Day Change Check ---------- */

function checkDayChange(){

  const s=loadSession();
  if(!s) return;

  if(!s.completed) return;

  const startDay=new Date(s.start).toDateString();
  const nowDay=new Date().toDateString();

  if(startDay!==nowDay){

    archiveSession();

    renderHistoryViewer();

  }

}

/* ---------- Render History Viewer ---------- */

function renderHistoryViewer(){

  if(!eventHistoryViewer) return;

  const list=loadHistory();

  if(!list.length){
    eventHistoryViewer.innerHTML="—";
    return;
  }

  const html=list.map((ev,i)=>{

    const total=ev.winners.length;

    const done=ev.winners.filter(x=>x.done).length;

    const amount=ev.winners.map(x=>x.prize).join(", ");

    return `
    <div style="margin-bottom:10px;padding:6px;border-bottom:1px solid #ddd">
      <b>Session ${i+1}</b><br>
      Start: ${esc(ev.start)}<br>
      Winners: ${total}<br>
      Done: ${done}<br>
      Prize: ${esc(amount)}
    </div>
    `;

  }).join("");

  eventHistoryViewer.innerHTML=html;

}

/* ---------- Export JSON ---------- */

if(exportEventHistoryBtn){

  exportEventHistoryBtn.onclick=()=>{

    const data=JSON.stringify(loadHistory(),null,2);

    const blob=new Blob([data],{type:"application/json"});

    const url=URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;
    a.download="lucky77_history.json";

    a.click();

  };

}

/* ---------- Clear History ---------- */

if(clearEventHistoryBtn){

  clearEventHistoryBtn.onclick=()=>{

    if(!confirm("Clear history?")) return;

    localStorage.removeItem(LS_HISTORY);

    renderHistoryViewer();

  };

}

/* ---------- Refresh History ---------- */

if(refreshEventHistoryBtn){
  refreshEventHistoryBtn.onclick=renderHistoryViewer;
}

/* ---------- Init ---------- */

(function initHistory(){

  if(!loadSession()){
    startSession();
  }

  renderHistoryViewer();

  setInterval(checkDayChange,60000);

})();
/* ===========================
   PART 6 — Theme / Images / Music
=========================== */

/* ---------- Apply Theme ---------- */

function applyThemeUI(uiColor,accent){

  document.documentElement.style.setProperty("--ui",uiColor||"#ffffff");
  document.documentElement.style.setProperty("--gold",accent||"#d6b25e");

}

/* ---------- Load Image ---------- */

function loadImage(fileInput,callback){

  if(!fileInput || !fileInput.files || !fileInput.files[0]) return;

  const reader=new FileReader();

  reader.onload=()=>{
    callback(reader.result);
  };

  reader.readAsDataURL(fileInput.files[0]);

}

/* ---------- Background Image ---------- */

if(pageBgFile){

  pageBgFile.onchange=()=>{

    loadImage(pageBgFile,(data)=>{

      const s=loadSettings();

      s.pageBg=data;

      saveSettingsLocal(s);

      applyImages();

    });

  };

}

/* ---------- Wheel Background ---------- */

if(wheelBgFile){

  wheelBgFile.onchange=()=>{

    loadImage(wheelBgFile,(data)=>{

      const s=loadSettings();

      s.wheelBg=data;

      saveSettingsLocal(s);

      applyImages();

    });

  };

}

/* ---------- Top Banner ---------- */

if(topBannerFile){

  topBannerFile.onchange=()=>{

    loadImage(topBannerFile,(data)=>{

      const s=loadSettings();

      s.topBanner=data;

      saveSettingsLocal(s);

      applyImages();

    });

  };

}

/* ---------- Bottom Banner ---------- */

if(bottomBannerFile){

  bottomBannerFile.onchange=()=>{

    loadImage(bottomBannerFile,(data)=>{

      const s=loadSettings();

      s.bottomBanner=data;

      saveSettingsLocal(s);

      applyImages();

    });

  };

}

/* ---------- Wheel Banner Logo ---------- */

if(wheelBannerFile){

  wheelBannerFile.onchange=()=>{

    loadImage(wheelBannerFile,(data)=>{

      const s=loadSettings();

      s.wheelLogo=data;

      saveSettingsLocal(s);

      applyImages();

    });

  };

}

/* ---------- Apply Images ---------- */

function applyImages(){

  const s=loadSettings();

  if(s.pageBg && bgLayer){

    bgLayer.style.backgroundImage=`url(${s.pageBg})`;
    bgLayer.classList.add("has-img");

  }

  if(s.wheelBg && wheelWrap){

    wheelWrap.style.backgroundImage=`url(${s.wheelBg})`;
    wheelWrap.classList.add("has-img");

  }

  if(s.topBanner && topBannerImg){

    topBannerImg.src=s.topBanner;
    topBannerImg.style.display="block";

    if(topBannerFallback){
      topBannerFallback.style.display="none";
    }

  }

  if(s.bottomBanner && bottomBannerImg){

    bottomBannerImg.src=s.bottomBanner;
    bottomBannerImg.style.display="block";

    if(bottomBannerFallback){
      bottomBannerFallback.style.display="none";
    }

  }

  if(s.wheelLogo && wheelBannerImg){

    wheelBannerImg.src=s.wheelLogo;
    wheelBannerImg.style.display="block";

    if(wheelBannerFallback){
      wheelBannerFallback.style.display="none";
    }

  }

}

/* ---------- Music System ---------- */

let bgAudio=null;

if(bgSongFile){

  bgSongFile.onchange=()=>{

    loadImage(bgSongFile,(data)=>{

      const s=loadSettings();

      s.music=data;

      saveSettingsLocal(s);

      initMusic();

    });

  };

}

function initMusic(){

  const s=loadSettings();

  if(!s.music) return;

  bgAudio=new Audio(s.music);

  bgAudio.loop=true;

}

if(musicBtn){

  musicBtn.onclick=()=>{

    if(!bgAudio){

      const s=loadSettings();

      if(!s.music){

        alert("MP3 Upload first");

        return;

      }

      initMusic();

    }

    if(bgAudio.paused){

      bgAudio.play();

      musicBtn.textContent="🎵 Music: ON";

    }else{

      bgAudio.pause();

      musicBtn.textContent="🎵 Music: OFF";

    }

  };

}

/* ---------- Init Images ---------- */

(function initImages(){

  applyImages();

})();
/* ===========================
   PART 7 — Final Stability / Performance
=========================== */

/* ---------- Safe JSON ---------- */

function safeJSON(x){
  try{
    return JSON.parse(x);
  }catch{
    return null;
  }
}

/* ---------- API GET ---------- */

async function apiGet(path,timeout=12000){

  const s=loadSettings();

  const url=`${s.apiBase}${path}?key=${encodeURIComponent(s.apiKey)}`;

  const ctrl=new AbortController();

  const t=setTimeout(()=>ctrl.abort(),timeout);

  try{

    const r=await fetch(url,{
      signal:ctrl.signal
    });

    clearTimeout(t);

    return await r.json();

  }catch(e){

    clearTimeout(t);

    return {ok:false,error:e.message};

  }

}

/* ---------- API POST ---------- */

async function apiPost(path,data={},timeout=12000){

  const s=loadSettings();

  const url=`${s.apiBase}${path}?key=${encodeURIComponent(s.apiKey)}`;

  const ctrl=new AbortController();

  const t=setTimeout(()=>ctrl.abort(),timeout);

  try{

    const r=await fetch(url,{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(data||{}),
      signal:ctrl.signal
    });

    clearTimeout(t);

    return await r.json();

  }catch(e){

    clearTimeout(t);

    return {ok:false,error:e.message};

  }

}

/* ---------- Pool Refresh ---------- */

async function refreshPoolUI(){

  if(!poolText) return;

  const r=await apiGet("/pool",7000);

  if(!r?.ok){
    poolText.textContent="Error";
    return;
  }

  poolText.textContent=r.pool;

}

/* ---------- Button Waiting ---------- */

async function withBtnWaiting(btn,text,fn){

  if(!btn) return;

  const old=btn.textContent;

  btn.disabled=true;
  btn.textContent=text;

  try{
    await fn();
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }

}

/* ---------- Window Error Guard ---------- */

window.addEventListener("error",(e)=>{

  console.warn("UI error:",e.message);

});

/* ---------- Unhandled Promise Guard ---------- */

window.addEventListener("unhandledrejection",(e)=>{

  console.warn("Promise error:",e.reason);

});

/* ---------- Pool Auto Refresh ---------- */

setInterval(()=>{

  refreshPoolUI();

},15000);

/* ---------- Initial Load ---------- */

(async function initFinal(){

  const s=loadSettings();

  if(apiBaseInput) apiBaseInput.value=s.apiBase;
  if(apiKeyInput) apiKeyInput.value=s.apiKey;

  applyThemeUI(s.uiColor,s.wheelAccent);

  await refreshPoolUI();

})();