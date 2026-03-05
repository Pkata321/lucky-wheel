"use strict";

/* ===========================
 PART 1 — CORE BASE (FIXED)
 - Default API
 - LocalStorage keys
 - DOM helper
 - Utils (esc fixed)
 - Settings model load/save
 - API helpers (abort/timeout)
 - Button busy helper
 - Test mode flag
 - Members/History cache helpers
=========================== */

/* ===== DEFAULT API ===== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY = "Lucky77_luckywheel_77";

/* ===== STORAGE KEYS ===== */
const LS_SETTINGS = "lucky77_ui_settings_v1";

// cache (members/history) — UI stuck မဖြစ်အောင် cache သုံး
const LS_CACHE_MEMBERS = "lucky77_cache_members_v1";
const LS_CACHE_MEMBERS_AT = "lucky77_cache_members_at_v1";

const LS_CACHE_HISTORY = "lucky77_cache_history_v1";
const LS_CACHE_HISTORY_AT = "lucky77_cache_history_at_v1";

// today winners (per day key)
const LS_TODAY_WINNERS = "lucky77_today_winners_v1";

// test mode (UI local flag)
const LS_TEST_MODE = "lucky77_test_mode_v1";

/* ===== DOM HELPER ===== */
function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing DOM #" + id);
  return el;
}

/* ===== UTILS ===== */
function esc(str) {
  // ✅ COMPLETE escape (prevent XSS & broken HTML)
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(n, a, b) {
  n = Number(n);
  if (!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/* ===== SETTINGS MODEL ===== */
const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey: DEFAULT_API_KEY,

  uiColor: "#ffffff",
  wheelAccent: "#d6b25e",

  wheelColorsText: `#ffffff
#f1f5ff
#fff4d6
#e9eefc`,

  prizes: [
    { name: "10000Ks", times: 4 },
    { name: "5000Ks", times: 2 },
    { name: "3000Ks", times: 3 },
  ],

  pageBgDataUrl: "",
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",

  // (optional) music / assets
  bgSongDataUrl: "",
};

/* ===== SETTINGS LOAD/SAVE ===== */
function loadSettings() {
  const raw = localStorage.getItem(LS_SETTINGS);
  if (!raw) return structuredClone(defaultSettings);

  const data = safeJsonParse(raw, null);
  if (!data || typeof data !== "object") return structuredClone(defaultSettings);

  // merge with defaults (missing fields auto fill)
  return { ...structuredClone(defaultSettings), ...data };
}

function saveSettings(s) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

/* ===== TEST MODE FLAG ===== */
function isTestMode() {
  return localStorage.getItem(LS_TEST_MODE) === "1";
}
function setTestModeLocal(enabled) {
  localStorage.setItem(LS_TEST_MODE, enabled ? "1" : "0");
}

/* ===== API BASE / KEY ===== */
function getApiBase() {
  const s = loadSettings();
  return String(s.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}
function getApiKey() {
  const s = loadSettings();
  return String(s.apiKey || DEFAULT_API_KEY);
}
function buildUrl(path) {
  // ✅ keep both query key + header key (your backend supports both)
  const base = getApiBase();
  const key = getApiKey();
  return `${base}${path}?key=${encodeURIComponent(key)}`;
}

/* ===== FETCH JSON (ABORT/TIMEOUT SAFE) ===== */
async function fetchJson(url, opt = {}, timeout = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await fetch(url, { ...opt, signal: ctrl.signal });

    // read as text first (avoid crash if invalid JSON)
    const txt = await res.text();
    const json = safeJsonParse(txt, { ok: false, error: "Invalid JSON" });

    if (!res.ok) {
      // server returned HTTP error
      return { ok: false, error: json?.error || "HTTP_" + res.status };
    }

    return json;
  } catch (e) {
    const msg = String(e?.name || "").toLowerCase().includes("abort")
      ? "timeout"
      : (e?.message || String(e));
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

async function apiGet(path, timeout) {
  return fetchJson(buildUrl(path), { method: "GET" }, timeout);
}

async function apiPost(path, body, timeout) {
  return fetchJson(
    buildUrl(path),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify(body || {}),
    },
    timeout
  );
}

/* ===== BUTTON BUSY ===== */
function setBusy(btn, busy, text) {
  if (!btn) return;

  if (busy) {
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    if (text) btn.textContent = text;
  } else {
    btn.disabled = false;
    if (btn.dataset.old) {
      btn.textContent = btn.dataset.old;
      delete btn.dataset.old;
    }
  }
}

/* ===== MEMBERS CACHE ===== */
function cacheMembers(list) {
  try {
    localStorage.setItem(LS_CACHE_MEMBERS, JSON.stringify(list || []));
    localStorage.setItem(LS_CACHE_MEMBERS_AT, String(Date.now()));
  } catch {}
}
function readMembersCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_MEMBERS);
    if (!raw) return null;
    const arr = safeJsonParse(raw, null);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/* ===== HISTORY CACHE ===== */
function cacheHistory(list) {
  try {
    localStorage.setItem(LS_CACHE_HISTORY, JSON.stringify(list || []));
    localStorage.setItem(LS_CACHE_HISTORY_AT, String(Date.now()));
  } catch {}
}
function readHistoryCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_HISTORY);
    if (!raw) return null;
    const arr = safeJsonParse(raw, null);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/* ===== TODAY WINNERS (PER DAY KEY) ===== */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${LS_TODAY_WINNERS}_${y}-${m}-${day}`;
}

function readTodayWinners() {
  try {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return [];
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeTodayWinners(arr) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(arr || []));
  } catch {}
}

/* ===== HARD RESET UI LOCAL (used by Reset button) ===== */
function resetUiLocalAll() {
  try {
    localStorage.removeItem(LS_SETTINGS);

    localStorage.removeItem(LS_CACHE_MEMBERS);
    localStorage.removeItem(LS_CACHE_MEMBERS_AT);

    localStorage.removeItem(LS_CACHE_HISTORY);
    localStorage.removeItem(LS_CACHE_HISTORY_AT);

    localStorage.removeItem(LS_TEST_MODE);

    // today winners key only (today)
    localStorage.removeItem(todayKey());
  } catch {}
}
/* ===========================
 PART 2 — UI BOOT
 - Settings load
 - Apply UI
 - Drawer open/close
 - Save settings
 - Pool refresh
=========================== */

let settings = loadSettings();

/* ===== DOM ===== */

const spinBtn = $("spinBtn");
const restartSpinBtn = $("restartSpinBtn");
const membersBtn = $("membersBtn");
const historyBtn = $("historyBtn");

const poolText = $("poolText");

const settingsBtn = $("settingsBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const drawer = $("drawer");

const musicBtn = $("musicBtn");

const apiBaseInput = $("apiBaseInput");
const apiKeyInput = $("apiKeyInput");

const uiColorInput = $("uiColorInput");
const wheelAccentInput = $("wheelAccentInput");

const topBannerImg = $("topBannerImg");
const bottomBannerImg = $("bottomBannerImg");
const wheelBannerImg = $("wheelBannerImg");

const bgLayer = $("bgLayer");

/* ===== APPLY SETTINGS ===== */

function applySettingsUI(){

  apiBaseInput.value = settings.apiBase;
  apiKeyInput.value = settings.apiKey;

  uiColorInput.value = settings.uiColor;
  wheelAccentInput.value = settings.wheelAccent;

  document.documentElement.style.setProperty("--ui",settings.uiColor);
  document.documentElement.style.setProperty("--gold",settings.wheelAccent);

  if(settings.pageBgDataUrl){
    bgLayer.style.backgroundImage = `url(${settings.pageBgDataUrl})`;
    bgLayer.classList.add("has-img");
  }

  if(settings.topBannerDataUrl){
    topBannerImg.src = settings.topBannerDataUrl;
    topBannerImg.style.display = "block";
  }

  if(settings.bottomBannerDataUrl){
    bottomBannerImg.src = settings.bottomBannerDataUrl;
    bottomBannerImg.style.display = "block";
  }

  if(settings.wheelBannerDataUrl){
    wheelBannerImg.src = settings.wheelBannerDataUrl;
    wheelBannerImg.style.display = "block";
  }

}

applySettingsUI();

/* ===== SETTINGS DRAWER ===== */

settingsBtn.onclick = ()=>{

  drawer.classList.add("open");

};

closeSettingsBtn.onclick = ()=>{

  drawer.classList.remove("open");

};

/* ===== SAVE SETTINGS ===== */

function saveSettingsFromUI(){

  settings.apiBase = apiBaseInput.value.trim();
  settings.apiKey = apiKeyInput.value.trim();

  settings.uiColor = uiColorInput.value;
  settings.wheelAccent = wheelAccentInput.value;

  saveSettings(settings);

  applySettingsUI();

}

/* ===== SAVE BUTTON ===== */

const saveBtn = $("saveBtn");

saveBtn.onclick = ()=>{

  saveSettingsFromUI();

  alert("Settings Saved ✅");

};

/* ===== RESET BUTTON ===== */

const resetBtn = $("resetBtn");

resetBtn.onclick = ()=>{

  if(!confirm("Reset UI settings ?")) return;

  resetUiLocalAll();

  location.reload();

};

/* ===== POOL REFRESH ===== */

async function refreshPool(){

  const res = await apiGet("/pool",8000);

  if(!res?.ok){

    poolText.textContent = "Error";

    return;

  }

  poolText.textContent = res.pool ?? "-";

}

/* ===== INIT ===== */

refreshPool();
/* ===========================
 PART 3 — WHEEL + PRIZE BUILDER
 - Wheel draw
 - Prize builder
 - Prize sync with Render
=========================== */

let wheelAngle = 0;
let wheelPrizes = [];

const wheelCanvas = $("wheel");
const wheelCtx = wheelCanvas.getContext("2d");

/* ===== PARSE WHEEL COLORS ===== */

function parseWheelColors(){

  const txt = settings.wheelColorsText || "";

  const arr = txt
    .split("\n")
    .map(v=>v.trim())
    .filter(v=>v);

  if(!arr.length){
    return ["#ffffff","#f1f5ff","#fff4d6","#e9eefc"];
  }

  return arr;
}

/* ===== BUILD UNIQUE PRIZES ===== */

function buildWheelPrizes(){

  wheelPrizes = [];

  const seen = new Set();

  settings.prizes.forEach(p=>{

    const name = String(p.name || "").trim();

    if(!name) return;

    const key = name.toLowerCase();

    if(seen.has(key)) return;

    seen.add(key);

    wheelPrizes.push(name);

  });

  if(!wheelPrizes.length){
    wheelPrizes = ["EMPTY"];
  }
}

/* ===== DRAW WHEEL ===== */

function drawWheel(){

  const total = wheelPrizes.length;

  const TAU = Math.PI * 2;

  const w = wheelCanvas.width;
  const h = wheelCanvas.height;

  const cx = w/2;
  const cy = h/2;

  const r = Math.min(cx,cy) - 10;

  wheelCtx.clearRect(0,0,w,h);

  const colors = parseWheelColors();

  const slice = TAU/total;

  for(let i=0;i<total;i++){

    const start = wheelAngle + i*slice;
    const end = start + slice;

    wheelCtx.beginPath();
    wheelCtx.moveTo(cx,cy);
    wheelCtx.arc(cx,cy,r,start,end);
    wheelCtx.closePath();

    wheelCtx.fillStyle = colors[i % colors.length];
    wheelCtx.fill();

    wheelCtx.strokeStyle = "rgba(0,0,0,0.12)";
    wheelCtx.stroke();

    wheelCtx.save();

    wheelCtx.translate(cx,cy);
    wheelCtx.rotate(start + slice/2);

    wheelCtx.fillStyle = "#101318";
    wheelCtx.font = "bold 16px system-ui";
    wheelCtx.textAlign = "right";

    wheelCtx.fillText(
      wheelPrizes[i],
      r - 20,
      6
    );

    wheelCtx.restore();
  }
}

/* ===========================
 PRIZE BUILDER
=========================== */

const prizeBuilder = $("prizeBuilder");

function renderPrizeBuilder(){

  prizeBuilder.innerHTML = "";

  settings.prizes.forEach((p,idx)=>{

    const row = document.createElement("div");
    row.className = "prize-row";

    const name = document.createElement("input");
    name.value = p.name;

    const step = document.createElement("div");
    step.className = "stepper";

    const minus = document.createElement("button");
    minus.textContent = "-";

    const input = document.createElement("input");
    input.type = "number";
    input.value = p.times;

    const plus = document.createElement("button");
    plus.textContent = "+";

    const remove = document.createElement("button");
    remove.textContent = "✖";

/* ===== MINUS ===== */

    minus.onclick = ()=>{

      p.times = Math.max(1,p.times-1);

      saveSettings(settings);

      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

/* ===== PLUS ===== */

    plus.onclick = ()=>{

      p.times = p.times + 1;

      saveSettings(settings);

      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

/* ===== INPUT CHANGE ===== */

    input.onchange = ()=>{

      p.times = clamp(input.value,1,9999);

      saveSettings(settings);

      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

/* ===== NAME CHANGE ===== */

    name.onchange = ()=>{

      p.name = name.value;

      saveSettings(settings);

      buildWheelPrizes();
      drawWheel();
    };

/* ===== REMOVE ===== */

    remove.onclick = ()=>{

      settings.prizes.splice(idx,1);

      if(settings.prizes.length===0){

        settings.prizes.push({
          name:"",
          times:1
        });
      }

      saveSettings(settings);

      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

    step.append(minus,input,plus,remove);

    row.append(name,step);

    prizeBuilder.append(row);
  });

/* ===== ADD PRIZE ===== */

  const addBtn = document.createElement("button");

  addBtn.className = "btn";
  addBtn.textContent = "+ Add Prize";

  addBtn.onclick = ()=>{

    settings.prizes.push({
      name:"",
      times:1
    });

    saveSettings(settings);

    renderPrizeBuilder();
    buildWheelPrizes();
    drawWheel();
  };

  prizeBuilder.append(addBtn);
}

/* ===== SYNC PRIZES TO RENDER ===== */

async function syncPrizesToServer(){

  const lines = settings.prizes
    .filter(p=>p.name && p.times)
    .map(p=>`${p.name} ${p.times}time`)
    .join("\n");

  if(!lines) return;

  try{

    const res = await apiPost("/config/prizes",{prizeText:lines},12000);

    if(!res?.ok){
      console.warn("Prize sync error",res.error);
    }

  }catch(e){
    console.warn("Prize sync fail",e);
  }
}

/* ===== AUTO SYNC ON SAVE ===== */

saveBtn.addEventListener("click",syncPrizesToServer);

/* ===== INIT ===== */

buildWheelPrizes();
drawWheel();
renderPrizeBuilder();