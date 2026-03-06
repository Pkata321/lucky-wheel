"use strict";

/* ===========================
  Lucky77 Premium Wheel
  PART 1 — CORE BASE (Render-linked)
  - Settings (localStorage)
  - API helpers (timeout + abort)
  - Theme color (Luxury default)
  - Image/Audio upload helpers (dataURL)
  - Members cache (instant show)
=========================== */

/* ===== DEFAULT RENDER API ===== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";

/* ===== LOCAL STORAGE KEYS (Premium v2) ===== */
const LS_SETTINGS          = "lucky77_premium_settings_v2";
const LS_CACHE_MEMBERS     = "lucky77_cache_members_v2";
const LS_CACHE_MEMBERS_AT  = "lucky77_cache_members_at_v2";
const LS_CACHE_HISTORY     = "lucky77_cache_history_v2";
const LS_CACHE_HISTORY_AT  = "lucky77_cache_history_at_v2";

/* ===== DOM HELPERS ===== */
function $req(id){
  const el = document.getElementById(id);
  if(!el) throw new Error("Missing DOM #" + id);
  return el;
}
function $opt(id){
  return document.getElementById(id) || null;
}

/* ===== UTILS ===== */
function esc(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function clamp(n,a,b){
  n = Number(n);
  if(!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}
function nowISO(){
  return new Date().toISOString();
}

/* ===== DEFAULT SETTINGS MODEL (Luxury) ===== */
const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey:  DEFAULT_API_KEY,

  /* Luxury theme */
  uiColor: "#d6b25e",        // premium gold default
  wheelAccent: "#d6b25e",
  wheelColorsText:
`#ffffff
#f1f5ff
#fff4d6
#e9eefc`,

  /* Prize builder */
  prizes: [
    { name: "10000Ks", times: 4 },
    { name: "5000Ks",  times: 2 },
    { name: "3000Ks",  times: 3 }
  ],

  /* Upload assets (DataURL) */
  pageBgDataUrl: "",
  wheelBorderBgDataUrl: "",     // ✅ wheel border div background
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",       // ✅ wheel under banner PNG logo

  /* Music */
  bgSongDataUrl: "",
  musicEnabled: false,
  musicVolume: 0.55
};

function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_SETTINGS);
    if(!raw) return structuredClone(defaultSettings);
    const data = JSON.parse(raw);
    return { ...structuredClone(defaultSettings), ...(data || {}) };
  }catch{
    return structuredClone(defaultSettings);
  }
}
function saveSettings(s){
  try{
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }catch{}
}

/* ===== APPLY THEME (CSS vars) ===== */
function applyTheme(settings){
  const ui = String(settings.uiColor || "#d6b25e");
  const gold = String(settings.wheelAccent || ui);

  document.documentElement.style.setProperty("--ui", ui);
  document.documentElement.style.setProperty("--gold", gold);
}

/* ===== FILE -> DATA URL ===== */
function fileToDataUrl(file, maxBytes = 6 * 1024 * 1024){
  return new Promise((resolve, reject) => {
    if(!file) return resolve("");
    if(file.size > maxBytes) return reject(new Error("File too large"));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("File read error"));
    r.readAsDataURL(file);
  });
}

/* ===== API BASE/KEY ===== */
function getApiBase(settings){
  const base = String(settings.apiBase || DEFAULT_API_BASE).trim();
  return base.replace(/\/+$/,"");
}
function getApiKey(settings){
  return String(settings.apiKey || DEFAULT_API_KEY).trim();
}
function buildUrl(settings, path){
  const base = getApiBase(settings);
  const key  = getApiKey(settings);
  // Render supports header x-api-key, but keep ?key too (compat)
  return `${base}${path}?key=${encodeURIComponent(key)}`;
}

/* ===== FETCH JSON with timeout + abort ===== */
async function fetchJson(url, opt = {}, timeout = 15000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  try{
    const res = await fetch(url, { ...opt, signal: ctrl.signal });
    const txt = await res.text();

    let json;
    try{ json = JSON.parse(txt); }
    catch{ json = { ok:false, error:"invalid_json", raw: txt }; }

    // normalize errors
    if(!res.ok && !json.ok){
      return { ok:false, error: json.error || ("HTTP_" + res.status) };
    }
    return json;

  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }finally{
    clearTimeout(t);
  }
}

async function apiGet(settings, path, timeout){
  return fetchJson(buildUrl(settings, path), { method:"GET" }, timeout);
}
async function apiPost(settings, path, body, timeout){
  const headers = {
    "Content-Type":"application/json",
    "x-api-key": getApiKey(settings)
  };
  return fetchJson(
    buildUrl(settings, path),
    { method:"POST", headers, body: JSON.stringify(body || {}) },
    timeout
  );
}

/* ===== BUTTON BUSY ===== */
function setBusy(btn, busy, text){
  if(!btn) return;
  if(busy){
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    if(text) btn.textContent = text;
  }else{
    btn.disabled = false;
    if(btn.dataset.old){
      btn.textContent = btn.dataset.old;
      delete btn.dataset.old;
    }
  }
}

/* ===== MEMBERS CACHE (instant open) ===== */
function cacheMembers(list){
  try{
    localStorage.setItem(LS_CACHE_MEMBERS, JSON.stringify(list || []));
    localStorage.setItem(LS_CACHE_MEMBERS_AT, String(Date.now()));
  }catch{}
}
function readMembersCache(){
  try{
    const raw = localStorage.getItem(LS_CACHE_MEMBERS);
    if(!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  }catch{
    return null;
  }
}

/* ===== HISTORY CACHE (for Winners/History table) ===== */
function cacheHistory(list){
  try{
    localStorage.setItem(LS_CACHE_HISTORY, JSON.stringify(list || []));
    localStorage.setItem(LS_CACHE_HISTORY_AT, String(Date.now()));
  }catch{}
}
function readHistoryCache(){
  try{
    const raw = localStorage.getItem(LS_CACHE_HISTORY);
    if(!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  }catch{
    return null;
  }
}

/* ===== MUSIC ENGINE (DataURL audio) ===== */
let bgAudio = null;

function ensureAudio(settings){
  if(bgAudio) return bgAudio;
  bgAudio = new Audio();
  bgAudio.loop = true;
  bgAudio.volume = clamp(settings.musicVolume ?? 0.55, 0, 1);
  return bgAudio;
}
function setMusicSource(settings){
  const a = ensureAudio(settings);
  const src = String(settings.bgSongDataUrl || "").trim();
  if(!src){
    a.pause();
    a.src = "";
    return false;
  }
  if(a.src !== src) a.src = src;
  return true;
}
async function playMusic(settings){
  const ok = setMusicSource(settings);
  if(!ok) return { ok:false, error:"no_music" };

  const a = ensureAudio(settings);
  a.volume = clamp(settings.musicVolume ?? 0.55, 0, 1);

  try{
    await a.play();
    return { ok:true };
  }catch(e){
    return { ok:false, error: String(e?.message || e) };
  }
}
function stopMusic(){
  if(!bgAudio) return;
  try{ bgAudio.pause(); }catch{}
}

/* ===== GLOBAL STATE (shared for next parts) ===== */
let settings = loadSettings();
applyTheme(settings);
// (Next parts will bind DOM, apply images, build wheel, members/history panels, PDF export)

/* ===== QUICK SELF CHECK (optional) ===== */
window.__lucky77 = {
  get settings(){ return settings; },
  setSettings(next){ settings = { ...settings, ...(next||{}) }; saveSettings(settings); applyTheme(settings); },
  apiGet: (path, t)=>apiGet(settings, path, t),
  apiPost: (path, body, t)=>apiPost(settings, path, body, t),
  cacheMembers, readMembersCache,
  cacheHistory, readHistoryCache,
  playMusic: ()=>playMusic(settings),
  stopMusic
};
/* ===========================
 PART 2 — UI BOOT + THEME + MEDIA (Premium Base)
 - Settings load/apply
 - Theme color apply (Luxury default)
 - Background / Banners / Wheel Border BG / Wheel Banner PNG
 - Music (upload mp3 + toggle)
=========================== */

let settings = loadSettings();

/* ===== DOM (must exist in HTML) ===== */
const bgLayer = $("bgLayer");

const settingsBtn = $("settingsBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const drawer = $("drawer");

const saveBtn = $("saveBtn");
const resetBtn = $("resetBtn");

const musicBtn = $("musicBtn");

const apiBaseInput = $("apiBaseInput");
const apiKeyInput = $("apiKeyInput");

const uiColorInput = $("uiColorInput");
const wheelAccentInput = $("wheelAccentInput");
const wheelColorsInput = $("wheelColorsInput");

const pageBgFile = $("pageBgFile");
const wheelBgFile = $("wheelBgFile");
const topBannerFile = $("topBannerFile");
const bottomBannerFile = $("bottomBannerFile");
const wheelBannerFile = $("wheelBannerFile");
const bgSongFile = $("bgSongFile");

const topBannerImg = $("topBannerImg");
const topBannerFallback = $("topBannerFallback");

const bottomBannerImg = $("bottomBannerImg");
const bottomBannerFallback = $("bottomBannerFallback");

const wheelBannerImg = $("wheelBannerImg");
const wheelBannerFallback = $("wheelBannerFallback");

const wheelWrap = $("wheelWrap");

/* ===== Music engine ===== */
let bgAudio = null;

function ensureAudio() {
  if (bgAudio) return bgAudio;
  bgAudio = new Audio();
  bgAudio.loop = true;
  bgAudio.preload = "auto";
  bgAudio.volume = 0.6;
  return bgAudio;
}

function setMusicBtnState() {
  const a = ensureAudio();
  const on = !a.paused && !a.ended;
  musicBtn.textContent = on ? "🎵 Music: ON" : "🎵 Music: OFF";
}

async function playMusic() {
  const a = ensureAudio();
  if (!settings.bgSongDataUrl) {
    alert("MP3 မရွေးထားသေးပါ (Settings > Upload MP3)");
    return;
  }
  a.src = settings.bgSongDataUrl;
  try {
    await a.play();
  } catch (e) {
    // iOS/Chrome: must be user gesture; this is called from click so usually ok
    alert("Music play မရပါ: browser permission လိုနိုင်ပါတယ်");
  }
  setMusicBtnState();
}

function stopMusic() {
  const a = ensureAudio();
  try { a.pause(); } catch {}
  setMusicBtnState();
}

/* ===== File -> DataURL ===== */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("file read error"));
    fr.readAsDataURL(file);
  });
}

/* ===== Apply settings to UI ===== */
function applySettingsUI() {
  // inputs
  apiBaseInput.value = settings.apiBase || DEFAULT_API_BASE;
  apiKeyInput.value = settings.apiKey || DEFAULT_API_KEY;

  uiColorInput.value = settings.uiColor || "#ffffff";
  wheelAccentInput.value = settings.wheelAccent || "#d6b25e";
  wheelColorsInput.value = settings.wheelColorsText || "";

  // css vars (Luxury)
  document.documentElement.style.setProperty("--ui", uiColorInput.value);
  document.documentElement.style.setProperty("--gold", wheelAccentInput.value);

  // page bg
  if (settings.pageBgDataUrl) {
    bgLayer.style.backgroundImage = `url(${settings.pageBgDataUrl})`;
    bgLayer.classList.add("has-img");
  } else {
    bgLayer.style.backgroundImage = "";
    bgLayer.classList.remove("has-img");
  }

  // wheel border bg (inside wheelWrap)
  if (settings.wheelBgDataUrl) {
    wheelWrap.style.setProperty("--wheel-bg", `url(${settings.wheelBgDataUrl})`);
    wheelWrap.classList.add("has-wheel-bg");
  } else {
    wheelWrap.style.removeProperty("--wheel-bg");
    wheelWrap.classList.remove("has-wheel-bg");
  }

  // top banner
  if (settings.topBannerDataUrl) {
    topBannerImg.src = settings.topBannerDataUrl;
    topBannerImg.style.display = "block";
    topBannerFallback.style.display = "none";
  } else {
    topBannerImg.removeAttribute("src");
    topBannerImg.style.display = "none";
    topBannerFallback.style.display = "block";
  }

  // bottom banner
  if (settings.bottomBannerDataUrl) {
    bottomBannerImg.src = settings.bottomBannerDataUrl;
    bottomBannerImg.style.display = "block";
    bottomBannerFallback.style.display = "none";
  } else {
    bottomBannerImg.removeAttribute("src");
    bottomBannerImg.style.display = "none";
    bottomBannerFallback.style.display = "block";
  }

  // wheel banner png
  if (settings.wheelBannerDataUrl) {
    wheelBannerImg.src = settings.wheelBannerDataUrl;
    wheelBannerImg.style.display = "block";
    wheelBannerFallback.style.display = "none";
  } else {
    wheelBannerImg.removeAttribute("src");
    wheelBannerImg.style.display = "none";
    wheelBannerFallback.style.display = "block";
  }

  // music button state
  setMusicBtnState();
}

/* ===== Open / Close settings ===== */
settingsBtn.addEventListener("click", () => {
  drawer.classList.add("open");
});

closeSettingsBtn.addEventListener("click", () => {
  drawer.classList.remove("open");
});

/* ===== Save settings from UI ===== */
function readSettingsFromUI() {
  settings.apiBase = String(apiBaseInput.value || "").trim() || DEFAULT_API_BASE;
  settings.apiKey = String(apiKeyInput.value || "").trim() || DEFAULT_API_KEY;

  settings.uiColor = String(uiColorInput.value || "#ffffff");
  settings.wheelAccent = String(wheelAccentInput.value || "#d6b25e");

  settings.wheelColorsText = String(wheelColorsInput.value || "").trim();

  saveSettings(settings);
  applySettingsUI();
}

/* ===== Reset (premium defaults) ===== */
function resetAllSettings() {
  // stop music first
  stopMusic();

  // clear local storage keys
  try { localStorage.removeItem(LS_SETTINGS); } catch {}
  try { localStorage.removeItem(LS_CACHE_MEMBERS); } catch {}
  try { localStorage.removeItem(LS_CACHE_MEMBERS_AT); } catch {}
  // today winners keys are per day; keep or clear? -> keep safe (optional)
  // try { localStorage.removeItem(todayKey()); } catch {}

  settings = structuredClone(defaultSettings);
  saveSettings(settings);
  applySettingsUI();

  alert("✅ Reset ပြီးပါပြီ");
}

/* ===== Wire Save/Reset ===== */
saveBtn.addEventListener("click", () => {
  readSettingsFromUI();
  drawer.classList.remove("open");
  alert("✅ Saved");
});

resetBtn.addEventListener("click", () => {
  const ok = confirm("Reset လုပ်မလား? (UI settings တွေပြန်စတင်မယ်)");
  if (!ok) return;
  resetAllSettings();
});

/* ===== Live theme update ===== */
uiColorInput.addEventListener("input", () => {
  settings.uiColor = uiColorInput.value;
  saveSettings(settings);
  applySettingsUI();
});

wheelAccentInput.addEventListener("input", () => {
  settings.wheelAccent = wheelAccentInput.value;
  saveSettings(settings);
  applySettingsUI();
});

wheelColorsInput.addEventListener("change", () => {
  settings.wheelColorsText = String(wheelColorsInput.value || "");
  saveSettings(settings);
  // wheel redraw handled in Part 3
});

/* ===== Upload handlers ===== */
pageBgFile.addEventListener("change", async () => {
  const f = pageBgFile.files?.[0];
  if (!f) return;
  settings.pageBgDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  applySettingsUI();
});

wheelBgFile.addEventListener("change", async () => {
  const f = wheelBgFile.files?.[0];
  if (!f) return;
  settings.wheelBgDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  applySettingsUI();
});

topBannerFile.addEventListener("change", async () => {
  const f = topBannerFile.files?.[0];
  if (!f) return;
  settings.topBannerDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  applySettingsUI();
});

bottomBannerFile.addEventListener("change", async () => {
  const f = bottomBannerFile.files?.[0];
  if (!f) return;
  settings.bottomBannerDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  applySettingsUI();
});

wheelBannerFile.addEventListener("change", async () => {
  const f = wheelBannerFile.files?.[0];
  if (!f) return;
  settings.wheelBannerDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  applySettingsUI();
});

bgSongFile.addEventListener("change", async () => {
  const f = bgSongFile.files?.[0];
  if (!f) return;
  settings.bgSongDataUrl = await readFileAsDataURL(f);
  saveSettings(settings);
  alert("✅ MP3 Saved — Music button နဲ့ ON/OFF လုပ်နိုင်ပါပြီ");
});

/* ===== Music toggle ===== */
musicBtn.addEventListener("click", async () => {
  const a = ensureAudio();
  if (!a.paused && !a.ended) {
    stopMusic();
    return;
  }
  await playMusic();
});

/* ===== INIT ===== */
applySettingsUI();
/* ===========================
 PART 3 — WHEEL + PRIZE BUILDER (Premium)
 - Wheel draw with luxury accents
 - Prize Builder (add/remove/stepper)
 - Sync prizes to Render: POST /config/prizes
=========================== */

let wheelAngle = 0;
let wheelPrizes = [];

const wheelCanvas = $("wheel");
const wheelCtx = wheelCanvas.getContext("2d");

/* ===== Prize Builder DOM ===== */
const prizeBuilder = $("prizeBuilder");

/* ===== helpers ===== */
function parseWheelColors() {
  const txt = String(settings.wheelColorsText || "").trim();
  const arr = txt
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  return arr.length ? arr : ["#ffffff", "#f1f5ff", "#fff4d6", "#e9eefc"];
}

function buildPrizeTextForRender() {
  // Render format: "PrizeName 3" each line
  // ignore empty names
  const lines = [];
  for (const p of settings.prizes || []) {
    const name = String(p?.name || "").trim();
    const times = clamp(p?.times, 1, 9999);
    if (!name) continue;
    lines.push(`${name} ${times}`);
  }
  return lines.join("\n");
}

/* ===== BUILD UNIQUE PRIZES (for wheel slices) ===== */
function buildWheelPrizes() {
  wheelPrizes = [];
  const seen = new Set();

  (settings.prizes || []).forEach((p) => {
    const name = String(p?.name || "").trim();
    if (!name) return;

    const key = name.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    wheelPrizes.push(name);
  });

  if (!wheelPrizes.length) wheelPrizes = ["EMPTY"];
}

/* ===== DRAW WHEEL ===== */
function drawWheel() {
  const total = wheelPrizes.length;
  const TAU = Math.PI * 2;

  const w = wheelCanvas.width;
  const h = wheelCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const r = Math.min(cx, cy) - 10;

  wheelCtx.clearRect(0, 0, w, h);

  // base shadow
  wheelCtx.save();
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, r + 2, 0, TAU);
  wheelCtx.fillStyle = "rgba(0,0,0,0.06)";
  wheelCtx.fill();
  wheelCtx.restore();

  const colors = parseWheelColors();
  const slice = TAU / total;

  for (let i = 0; i < total; i++) {
    const start = wheelAngle + i * slice;
    const end = start + slice;

    // slice
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.arc(cx, cy, r, start, end);
    wheelCtx.closePath();

    wheelCtx.fillStyle = colors[i % colors.length];
    wheelCtx.fill();

    // divider
    wheelCtx.strokeStyle = "rgba(16,19,24,0.10)";
    wheelCtx.lineWidth = 1;
    wheelCtx.stroke();

    // text
    wheelCtx.save();
    wheelCtx.translate(cx, cy);
    wheelCtx.rotate(start + slice / 2);

    wheelCtx.fillStyle = "#101318";
    wheelCtx.font = "700 16px system-ui";
    wheelCtx.textAlign = "right";
    wheelCtx.textBaseline = "middle";

    const label = String(wheelPrizes[i] || "");
    wheelCtx.fillText(label, r - 18, 0);

    wheelCtx.restore();
  }

  // inner ring (luxury accent)
  wheelCtx.save();
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, r - 6, 0, TAU);
  wheelCtx.strokeStyle = "rgba(214,178,94,0.35)";
  wheelCtx.lineWidth = 4;
  wheelCtx.stroke();
  wheelCtx.restore();

  // center cap
  wheelCtx.save();
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, 42, 0, TAU);
  wheelCtx.fillStyle = "rgba(255,255,255,0.85)";
  wheelCtx.fill();
  wheelCtx.strokeStyle = "rgba(16,19,24,0.12)";
  wheelCtx.lineWidth = 1;
  wheelCtx.stroke();
  wheelCtx.restore();
}

/* ===========================
 PRIZE BUILDER UI
=========================== */

function renderPrizeBuilder() {
  prizeBuilder.innerHTML = "";

  (settings.prizes || []).forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "prize-row";

    const name = document.createElement("input");
    name.type = "text";
    name.value = String(p?.name || "");
    name.placeholder = "Prize name";

    const step = document.createElement("div");
    step.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";

    const input = document.createElement("input");
    input.type = "number";
    input.value = clamp(p?.times, 1, 9999);
    input.min = "1";
    input.max = "9999";

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "✖";

    minus.onclick = () => {
      p.times = Math.max(1, clamp(p.times, 1, 9999) - 1);
      saveSettings(settings);
      renderPrizeBuilder();
    };

    plus.onclick = () => {
      p.times = clamp(p.times, 1, 9999) + 1;
      saveSettings(settings);
      renderPrizeBuilder();
    };

    input.onchange = () => {
      p.times = clamp(input.value, 1, 9999);
      saveSettings(settings);
      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

    name.onchange = () => {
      p.name = String(name.value || "");
      saveSettings(settings);
      buildWheelPrizes();
      drawWheel();
    };

    remove.onclick = () => {
      settings.prizes.splice(idx, 1);
      if (settings.prizes.length === 0) {
        settings.prizes.push({ name: "", times: 1 });
      }
      saveSettings(settings);
      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    };

    step.append(minus, input, plus, remove);
    row.append(name, step);
    prizeBuilder.append(row);
  });

  // actions row
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "10px";
  actions.style.marginTop = "10px";
  actions.style.flexWrap = "wrap";

  const addBtn = document.createElement("button");
  addBtn.className = "btn";
  addBtn.type = "button";
  addBtn.textContent = "+ Add Prize";
  addBtn.onclick = () => {
    settings.prizes.push({ name: "", times: 1 });
    saveSettings(settings);
    renderPrizeBuilder();
  };

  const syncBtn = document.createElement("button");
  syncBtn.className = "btn primary";
  syncBtn.type = "button";
  syncBtn.textContent = "Save & Sync to Render";
  syncBtn.onclick = async () => {
    // Save UI settings first
    saveSettings(settings);

    // Build render text + call /config/prizes
    const prizeText = buildPrizeTextForRender();
    if (!String(prizeText).trim()) {
      alert("Prize မရှိသေးပါ (Name ထည့်ပါ)");
      return;
    }

    setBusy(syncBtn, true, "Syncing...");
    try {
      const r = await apiPost("/config/prizes", { prizeText }, 15000);
      if (!r?.ok) throw new Error(r?.error || "sync_failed");
      alert(`✅ Render Sync OK (bag: ${r.bag_size || "-"})`);
    } catch (e) {
      alert("Sync error: " + (e?.message || e));
    } finally {
      setBusy(syncBtn, false);
    }

    // rebuild wheel
    buildWheelPrizes();
    drawWheel();
  };

  actions.append(addBtn, syncBtn);
  prizeBuilder.append(actions);
}

/* ===== INIT (Part 3) ===== */
buildWheelPrizes();
drawWheel();
renderPrizeBuilder();
/* ===========================
 PART 4 — SPIN ENGINE (Render)
 - call /spin
 - animate wheel
 - show winner modal
 - refresh pool
=========================== */

let spinning = false;

/* ===== find prize index ===== */
function findPrizeIndex(prize){

  const p = String(prize || "").trim();

  let idx = wheelPrizes.findIndex(v => String(v).trim() === p);

  if(idx >= 0) return idx;

  const lower = p.toLowerCase();

  idx = wheelPrizes.findIndex(v => String(v).toLowerCase() === lower);

  return idx;
}

/* ===== calculate angle ===== */
function calcTargetAngle(idx){

  const TAU = Math.PI * 2;

  const total = wheelPrizes.length;

  const slice = TAU / total;

  const pointer = -Math.PI / 2;

  let target = pointer - (idx + 0.5) * slice;

  target = ((target % TAU) + TAU) % TAU;

  return target;
}

/* ===== animate spin ===== */
function animateSpin(target, duration = 3200){

  const TAU = Math.PI * 2;

  const start = wheelAngle;

  const startNorm = ((start % TAU) + TAU) % TAU;

  const delta = ((target - startNorm) + TAU) % TAU;

  const extra = 6 + Math.random() * 4;

  const final = start + extra * TAU + delta;

  const t0 = performance.now();

  function ease(t){
    return 1 - Math.pow(1 - t, 3);
  }

  return new Promise(resolve => {

    function frame(now){

      const p = Math.min((now - t0) / duration, 1);

      const e = ease(p);

      wheelAngle = start + (final - start) * e;

      drawWheel();

      if(p < 1) requestAnimationFrame(frame);
      else resolve();

    }

    requestAnimationFrame(frame);

  });
}

/* ===== SPIN ===== */
async function doSpin(){

  if(spinning) return;

  if(!wheelPrizes.length){
    alert("Prize မရှိသေးပါ");
    return;
  }

  spinning = true;

  setBusy(spinBtn, true, "SPIN...");

  let res;

  try{

    /* call Render spin */
    res = await apiPost("/spin", {}, 15000);

    if(!res?.ok){
      throw new Error(res?.error || "spin_error");
    }

  }catch(e){

    spinning = false;

    setBusy(spinBtn, false);

    alert("Spin error: " + (e?.message || e));

    return;
  }

  const prize = String(res.prize || "");

  const winner = res.winner || {};

  /* find slice */
  let idx = findPrizeIndex(prize);

  if(idx < 0){

    buildWheelPrizes();
    drawWheel();

    idx = findPrizeIndex(prize);

  }

  if(idx < 0){

    idx = Math.floor(Math.random() * wheelPrizes.length);

  }

  const target = calcTargetAngle(idx);

  /* spin animation */
  await animateSpin(target, 3200);

  /* winner modal */
  showWinnerModal(prize, winner, res.turn);

  /* refresh pool */
  refreshPool();

  spinning = false;

  setBusy(spinBtn, false);
}

/* ===== bind spin button ===== */
spinBtn.onclick = doSpin;

/* ===== restart event ===== */
restartSpinBtn.onclick = async () => {

  setBusy(restartSpinBtn, true, "Restarting...");

  try{

    const r = await apiPost("/event/reset", {}, 15000);

    if(!r?.ok){
      alert("Reset error: " + (r?.error || "unknown"));
    }

    refreshPool();

  }catch(e){

    alert("Reset error: " + (e?.message || e));

  }finally{

    setBusy(restartSpinBtn, false);

  }

};
/* ===========================
 PART 5 — WINNER LIST PANEL
 - fetch /winners
 - show table
 - done toggle
 - telegram / notice
=========================== */

const historyBtn = $("historyBtn");
const historyPanel = $("historyPanel");
const historyCloseBtn = $("historyCloseBtn");

const historyTbody = $("historyTbody");
const historyTotalText = $("historyTotalText");

/* ===== open panel ===== */

historyBtn.onclick = () => {

  historyPanel.classList.remove("hidden");

  loadWinnerList();

};

historyCloseBtn.onclick = () => {

  historyPanel.classList.add("hidden");

};

/* ===== load winners ===== */

async function loadWinnerList(){

  historyTbody.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;

  try{

    const res = await apiGet("/winners",15000);

    if(!res?.ok){
      throw new Error(res?.error || "winners_error");
    }

    const list = res.winners || [];

    historyTotalText.textContent = list.length;

    renderWinnerRows(list);

  }catch(e){

    historyTbody.innerHTML =
      `<tr><td colspan="5">Error: ${esc(e?.message || e)}</td></tr>`;

  }

}

/* ===== render table ===== */

function renderWinnerRows(list){

  if(!list.length){

    historyTbody.innerHTML =
      `<tr><td colspan="5">No winners yet</td></tr>`;

    return;

  }

  const rows = list.map(w=>{

    const name = esc(w.name || w.display || "-");

    const id = esc(w.user_id || "-");

    const prize = esc(w.prize || "-");

    const turn = esc(w.turn || "-");

    const username = String(w.username || "").replace("@","");

    const done = w.done;

    let actionHTML = "";

    if(username){

      actionHTML =
      `<button class="btn mini"
        data-act="tg"
        data-user="${esc(username)}">
        Telegram
      </button>`;

    }else{

      actionHTML =
      `<button class="btn mini"
        data-act="notice"
        data-uid="${id}"
        data-prize="${prize}">
        Notice
      </button>`;

    }

    const doneBtn =
      `<button class="btn mini ${done ? "success":""}"
        data-act="done"
        data-uid="${id}">
        ${done ? "Done": "Prize Done"}
      </button>`;

    return `
<tr>
<td>${turn}</td>
<td>${prize}</td>
<td>${name}</td>
<td>${id}</td>
<td>
<div style="display:flex;gap:6px;flex-wrap:wrap;">
${doneBtn}
${actionHTML}
</div>
</td>
</tr>
`;

  }).join("");

  historyTbody.innerHTML = rows;

}

/* ===== table actions ===== */

historyTbody.addEventListener("click", async (e)=>{

  const btn = e.target.closest("button");

  if(!btn) return;

  const act = btn.dataset.act;

  /* Telegram open */

  if(act === "tg"){

    const user = btn.dataset.user;

    window.open(`https://t.me/${user}`,"_blank");

    return;

  }

  /* Notice DM */

  if(act === "notice"){

    const uid = btn.dataset.uid;

    const prize = btn.dataset.prize;

    setBusy(btn,true,"Sending...");

    try{

      const r = await apiPost("/notice",
      {
        user_id: uid,
        prize: prize
      },15000);

      if(!r?.ok){
        throw new Error(r?.error || "notice_error");
      }

      alert("✅ DM Notice sent");

    }catch(e){

      alert("Notice error: "+(e?.message || e));

    }finally{

      setBusy(btn,false);

    }

    return;

  }

  /* Prize Done */

  if(act === "done"){

    const uid = btn.dataset.uid;

    setBusy(btn,true,"Saving...");

    try{

      const r = await apiPost("/winner/done",
      {
        user_id: uid
      },15000);

      if(!r?.ok){
        throw new Error(r?.error || "done_error");
      }

      loadWinnerList();

    }catch(e){

      alert("Done error: "+(e?.message || e));

    }

  }

});
/* ===========================
 PART 6 — MEMBERS PANEL
 - fetch /members
 - cache load
 - active/inactive status
 - telegram / notice
=========================== */

const membersBtn = $("membersBtn");
const membersPanel = $("membersPanel");
const membersCloseBtn = $("membersCloseBtn");

const membersTable = $("membersTable");
const membersTotalText = $("membersTotalText");

/* ===== open panel ===== */

membersBtn.onclick = () => {

  membersPanel.classList.remove("hidden");

  const cache = readMembersCache();

  if(cache && cache.length){
    renderMembers(cache,true);
  }else{
    membersTable.innerHTML = `<div class="small">Loading...</div>`;
  }

  loadMembers();

};

membersCloseBtn.onclick = () => {

  membersPanel.classList.add("hidden");

};

/* ===== status badge ===== */

function statusBadge(active){

  if(active){
    return `<span style="color:#16a34a;font-weight:900;">ACTIVE</span>`;
  }

  return `<span style="color:#ef4444;font-weight:900;">INACTIVE</span>`;
}

/* ===== render members ===== */

function renderMembers(list,fromCache=false){

  const arr = Array.isArray(list) ? list : [];

  membersTotalText.textContent =
    arr.length ? `Total : ${arr.length}${fromCache ? " (cache)":""}` : "";

  if(!arr.length){

    membersTable.innerHTML = `<div class="small">No members</div>`;

    return;

  }

  arr.sort((a,b)=> (b.active===true) - (a.active===true));

  const rows = arr.map(m=>{

    const username = String(m.username || "").replace("@","");

    const display =
      m.display ||
      m.name ||
      (username ? "@"+username : m.id);

    const uid = String(m.id || "");

    let actionHTML="";

    if(username){

      actionHTML =
      `<button class="btn mini"
        data-act="tg"
        data-user="${esc(username)}">
        Telegram
      </button>`;

    }else{

      actionHTML =
      `<button class="btn mini"
        data-act="notice"
        data-uid="${esc(uid)}">
        Notice
      </button>`;

    }

    return `
<div style="display:flex;justify-content:space-between;gap:10px;
border-bottom:1px solid rgba(16,19,24,0.08);padding:10px 0;">

<div>

<div style="font-weight:900;">
${esc(display)}
</div>

<div class="small">
ID : ${esc(uid)} • ${statusBadge(m.active)}
</div>

</div>

<div style="display:flex;gap:6px;">
${actionHTML}
</div>

</div>
`;

  }).join("");

  membersTable.innerHTML = rows;

}

/* ===== fetch members ===== */

async function loadMembers(){

  setBusy(membersBtn,true,"Members...");

  try{

    const res = await apiGet("/members",15000);

    if(!res?.ok){
      throw new Error(res?.error || "members_error");
    }

    const list = res.members || [];

    cacheMembers(list);

    renderMembers(list,false);

  }catch(e){

    const cache = readMembersCache();

    if(cache && cache.length){

      renderMembers(cache,true);

      membersTable.insertAdjacentHTML(
        "afterbegin",
        `<div class="small">⚠️ Live error — showing cache</div>`
      );

    }else{

      membersTable.innerHTML =
      `<div class="small">
      Members error : ${esc(e?.message || e)}
      </div>`;

    }

  }finally{

    setBusy(membersBtn,false);

  }

}

/* ===== actions ===== */

membersTable.addEventListener("click", async (e)=>{

  const btn = e.target.closest("button");

  if(!btn) return;

  const act = btn.dataset.act;

  /* Telegram */

  if(act === "tg"){

    const user = btn.dataset.user;

    window.open(`https://t.me/${user}`,"_blank");

    return;

  }

  /* Notice */

  if(act === "notice"){

    const uid = btn.dataset.uid;

    setBusy(btn,true,"Sending...");

    try{

      const r = await apiPost("/notice",
      {
        user_id: uid,
        prize: ""
      },15000);

      if(!r?.ok){
        throw new Error(r?.error || "notice_error");
      }

      alert("✅ Notice DM sent");

    }catch(e){

      alert("Notice error: "+(e?.message || e));

    }finally{

      setBusy(btn,false);

    }

  }

});
/* ===========================
 PART 7 — SETTINGS + ASSETS + MUSIC + WINNERS(HISTORY) + INIT
 - Save/Reset settings
 - Apply images (bg/top/bottom/wheelBanner/wheelBorder)
 - Music upload & toggle
 - Winner history panel uses /winners (done/notice/tg)
=========================== */

/* ===== optional DOM getter (no throw) ===== */
function $opt(id){
  return document.getElementById(id);
}

/* ===== DOM (settings) ===== */
const saveBtn  = $opt("saveBtn");
const resetBtn = $opt("resetBtn");

const pageBgFile     = $opt("pageBgFile");
const wheelBgFile    = $opt("wheelBgFile");
const topBannerFile  = $opt("topBannerFile");
const bottomBannerFile = $opt("bottomBannerFile");
const wheelBannerFile  = $opt("wheelBannerFile");
const bgSongFile       = $opt("bgSongFile");

const wheelWrap = $opt("wheelWrap");
const topBannerFallback = $opt("topBannerFallback");
const bottomBannerFallback = $opt("bottomBannerFallback");
const wheelBannerFallback = $opt("wheelBannerFallback");

const musicBtn = $opt("musicBtn");

/* ===== DOM (history / winners) ===== */
const historyBtn = $opt("historyBtn");
const historyPanel = $opt("historyPanel");
const historyCloseBtn = $opt("historyCloseBtn");
const historyList = $opt("historyList");

/* ===== STORAGE (assets + music) ===== */
const LS_MUSIC_DATAURL = "lucky77_music_dataurl_v1";
const LS_MUSIC_ON = "lucky77_music_on_v1";

/* ===== music audio ===== */
let bgAudio = null;

function ensureAudio(){
  if(bgAudio) return bgAudio;
  bgAudio = new Audio();
  bgAudio.loop = true;
  bgAudio.volume = 0.7;

  const data = localStorage.getItem(LS_MUSIC_DATAURL);
  if(data) bgAudio.src = data;

  return bgAudio;
}

function setMusicBtnLabel(){
  if(!musicBtn) return;
  const on = localStorage.getItem(LS_MUSIC_ON) === "1";
  musicBtn.textContent = on ? "🎵 Music: ON" : "🎵 Music: OFF";
}

async function playMusic(){
  const a = ensureAudio();
  if(!a.src){
    alert("Music file မထည့်ရသေးပါ (Settings > Upload MP3)");
    return;
  }
  try{
    await a.play();
    localStorage.setItem(LS_MUSIC_ON,"1");
    setMusicBtnLabel();
  }catch(e){
    alert("Music play blocked (browser). Button ကိုနောက်တစ်ခါနှိပ်ပါ");
  }
}

function stopMusic(){
  const a = ensureAudio();
  try{ a.pause(); }catch{}
  localStorage.setItem(LS_MUSIC_ON,"0");
  setMusicBtnLabel();
}

/* ===== read file -> dataURL ===== */
function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result || ""));
    r.onerror = ()=> reject(new Error("file_read_error"));
    r.readAsDataURL(file);
  });
}

/* ===== apply images to UI (premium) ===== */
function applyPremiumImages(){

  // page bg
  if(bgLayer){
    if(settings.pageBgDataUrl){
      bgLayer.style.backgroundImage = `url(${settings.pageBgDataUrl})`;
      bgLayer.classList.add("has-img");
    }else{
      bgLayer.style.backgroundImage = "";
      bgLayer.classList.remove("has-img");
    }
  }

  // wheel border bg (wheelWrap background)
  if(wheelWrap){
    if(settings.wheelBgDataUrl){
      wheelWrap.style.backgroundImage = `url(${settings.wheelBgDataUrl})`;
      wheelWrap.classList.add("has-wheelbg");
    }else{
      wheelWrap.style.backgroundImage = "";
      wheelWrap.classList.remove("has-wheelbg");
    }
  }

  // top banner
  if(topBannerImg){
    if(settings.topBannerDataUrl){
      topBannerImg.src = settings.topBannerDataUrl;
      topBannerImg.style.display = "block";
      if(topBannerFallback) topBannerFallback.style.display = "none";
    }else{
      topBannerImg.removeAttribute("src");
      topBannerImg.style.display = "none";
      if(topBannerFallback) topBannerFallback.style.display = "block";
    }
  }

  // bottom banner
  if(bottomBannerImg){
    if(settings.bottomBannerDataUrl){
      bottomBannerImg.src = settings.bottomBannerDataUrl;
      bottomBannerImg.style.display = "block";
      if(bottomBannerFallback) bottomBannerFallback.style.display = "none";
    }else{
      bottomBannerImg.removeAttribute("src");
      bottomBannerImg.style.display = "none";
      if(bottomBannerFallback) bottomBannerFallback.style.display = "block";
    }
  }

  // wheel banner png (under wheel)
  if(wheelBannerImg){
    if(settings.wheelBannerDataUrl){
      wheelBannerImg.src = settings.wheelBannerDataUrl;
      wheelBannerImg.style.display = "block";
      if(wheelBannerFallback) wheelBannerFallback.style.display = "none";
    }else{
      wheelBannerImg.removeAttribute("src");
      wheelBannerImg.style.display = "none";
      if(wheelBannerFallback) wheelBannerFallback.style.display = "block";
    }
  }
}

/* ===== push prizes to Render ===== */
async function pushPrizesToRender(){
  // settings.prizes -> prizeText
  const lines = (settings.prizes || [])
    .map(p=>{
      const name = String(p?.name || "").trim();
      const times = Number(p?.times || 0);
      if(!name || !Number.isFinite(times) || times <= 0) return "";
      return `${name} ${times}`;
    })
    .filter(Boolean);

  const prizeText = lines.join("\n");
  if(!prizeText.trim()) return;

  // send to Render
  const r = await apiPost("/config/prizes",{ prizeText },15000);
  if(!r?.ok) throw new Error(r?.error || "prize_save_failed");
}

/* ===== settings save/reset ===== */
async function onSaveAll(){

  if(!saveBtn) return;

  setBusy(saveBtn,true,"Saving...");

  try{

    // pull normal inputs (these exist in Part 2)
    if(apiBaseInput) settings.apiBase = apiBaseInput.value.trim();
    if(apiKeyInput)  settings.apiKey  = apiKeyInput.value.trim();
    if(uiColorInput) settings.uiColor = uiColorInput.value;
    if(wheelAccentInput) settings.wheelAccent = wheelAccentInput.value;

    // save local first
    saveSettings(settings);
    applySettingsUI();

    // apply premium image rules
    applyPremiumImages();

    // push prizes -> render (optional but premium goal)
    await pushPrizesToRender();

    alert("✅ Saved");

  }catch(e){

    alert("Save error: " + (e?.message || e));

  }finally{

    setBusy(saveBtn,false);

  }
}

function onResetAll(){

  if(!confirm("Reset settings ပြန်လုပ်မလား? (local settings ပဲ reset)")) return;

  try{
    localStorage.removeItem(LS_SETTINGS);

    // music reset optional
    // localStorage.removeItem(LS_MUSIC_DATAURL);
    // localStorage.removeItem(LS_MUSIC_ON);

  }catch{}

  settings = loadSettings();
  applySettingsUI();
  applyPremiumImages();

  buildWheelPrizes();
  drawWheel();
  renderPrizeBuilder();

  alert("✅ Reset done");
}

/* ===== file inputs ===== */
async function bindFileToSetting(inputEl, keyName, isAudio=false){

  if(!inputEl) return;

  inputEl.addEventListener("change", async ()=>{
    const f = inputEl.files && inputEl.files[0];
    if(!f) return;

    try{

      const dataUrl = await readFileAsDataURL(f);

      if(isAudio){
        localStorage.setItem(LS_MUSIC_DATAURL, dataUrl);
        ensureAudio().src = dataUrl;

        // auto play if ON
        if(localStorage.getItem(LS_MUSIC_ON)==="1"){
          await playMusic();
        }
        alert("✅ Music uploaded");
        return;
      }

      settings[keyName] = dataUrl;
      saveSettings(settings);

      applySettingsUI();
      applyPremiumImages();

      alert("✅ Image uploaded");

    }catch(e){
      alert("Upload error: "+(e?.message || e));
    }
  });

}

/* ===== music button ===== */
if(musicBtn){
  musicBtn.addEventListener("click", async ()=>{
    const on = localStorage.getItem(LS_MUSIC_ON) === "1";
    if(on) stopMusic();
    else await playMusic();
  });
}

/* ===== winners/history panel (Render /winners) ===== */
function openHistoryPanel(){
  if(!historyPanel) return;
  historyPanel.classList.remove("hidden");
  loadWinnersHistory();
}
function closeHistoryPanel(){
  if(!historyPanel) return;
  historyPanel.classList.add("hidden");
}

if(historyBtn) historyBtn.addEventListener("click", openHistoryPanel);
if(historyCloseBtn) historyCloseBtn.addEventListener("click", closeHistoryPanel);

function renderWinnersHistory(winners){

  if(!historyList) return;

  const arr = Array.isArray(winners) ? winners : [];

  if(!arr.length){
    historyList.innerHTML = `<div class="small">No winners yet</div>`;
    return;
  }

  const rows = arr.map((w,i)=>{

    const uid = String(w.user_id || w.id || "");
    const prize = String(w.prize || "-");
    const turn = String(w.turn || (i+1));
    const username = String(w.username || "").replace("@","").trim();
    const display = String(w.display || w.name || (username? "@"+username : uid));

    const done = !!w.done;

    const doneBtnTxt = done ? "Done ✅" : "Prize Done";
    const doneCls = done ? "success" : "";

    const action =
      username
        ? `<button class="btn mini" data-act="tg" data-user="${esc(username)}">Telegram</button>`
        : `<button class="btn mini" data-act="notice" data-uid="${esc(uid)}" data-prize="${esc(prize)}">Notice</button>`;

    return `
<div style="display:flex;justify-content:space-between;gap:10px;
border-bottom:1px solid rgba(16,19,24,0.08);padding:10px 0;">

<div style="min-width:0;">
  <div style="font-weight:1000;">#${esc(turn)} • ${esc(prize)}</div>
  <div class="small" style="margin-top:4px;">
    ${esc(display)} • ID: ${esc(uid)}
  </div>
</div>

<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
  <button class="btn mini ${doneCls}" data-act="done" data-uid="${esc(uid)}">
    ${doneBtnTxt}
  </button>
  ${action}
</div>

</div>`;
  }).join("");

  historyList.innerHTML = rows;
}

async function loadWinnersHistory(){

  if(!historyList) return;

  historyList.innerHTML = `<div class="small">Loading...</div>`;

  try{

    const res = await apiGet("/winners",15000);
    if(!res?.ok) throw new Error(res?.error || "winners_error");

    renderWinnersHistory(res.winners || []);

  }catch(e){

    historyList.innerHTML = `<div class="small">History error: ${esc(e?.message || e)}</div>`;

  }
}

/* history actions */
if(historyList){
  historyList.addEventListener("click", async (e)=>{

    const b = e.target.closest("button");
    if(!b) return;

    const act = b.dataset.act;

    if(act === "tg"){
      const user = String(b.dataset.user||"").replace("@","").trim();
      if(!user) return;
      window.open(`https://t.me/${user}`,"_blank");
      return;
    }

    if(act === "notice"){
      const uid = String(b.dataset.uid||"").trim();
      const prize = String(b.dataset.prize||"").trim();

      if(!uid) return;

      setBusy(b,true,"Sending...");

      try{
        const r = await apiPost("/notice",{ user_id: uid, prize },15000);
        if(!r?.ok) throw new Error(r?.error || "notice_failed");
        alert("✅ Notice DM sent");
      }catch(err){
        alert("Notice error: "+(err?.message || err));
      }finally{
        setBusy(b,false);
      }
      return;
    }

    if(act === "done"){
      const uid = String(b.dataset.uid||"").trim();
      if(!uid) return;

      setBusy(b,true,"Saving...");

      try{
        const r = await apiPost("/winner/done",{ user_id: uid },15000);
        if(!r?.ok) throw new Error(r?.error || "done_failed");
        await loadWinnersHistory();
      }catch(err){
        alert("Done error: "+(err?.message || err));
      }finally{
        setBusy(b,false);
      }
      return;
    }

  });
}

/* ===== bind buttons ===== */
if(saveBtn)  saveBtn.addEventListener("click", onSaveAll);
if(resetBtn) resetBtn.addEventListener("click", onResetAll);

/* ===== bind file inputs ===== */
bindFileToSetting(pageBgFile, "pageBgDataUrl");
bindFileToSetting(topBannerFile, "topBannerDataUrl");
bindFileToSetting(bottomBannerFile, "bottomBannerDataUrl");
bindFileToSetting(wheelBannerFile, "wheelBannerDataUrl");

// NEW: wheel border background image
bindFileToSetting(wheelBgFile, "wheelBgDataUrl");

// music mp3 upload
bindFileToSetting(bgSongFile, "", true);

/* ===== INIT ===== */
(function initPremium(){

  // apply images
  applyPremiumImages();

  // music state
  setMusicBtnLabel();
  if(localStorage.getItem(LS_MUSIC_ON)==="1"){
    // try autoplay on first user gesture later
    // (browser blocks autoplay; button click will start)
    ensureAudio();
  }

  // refresh pool at start (safe)
  try{ refreshPool(); }catch{}

})();
