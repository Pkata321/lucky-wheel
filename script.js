"use strict";

/* ===========================
  JS PART 1/7 — CORE BASE (Premium)
  Goal: Render Redis members မပျောက်ဘဲ ပြန်ပြဖို့ (cache + safe fetch)
=========================== */

/* ===== DEFAULT API (Render) ===== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY  = "Lucky77_luckywheel_77";

/* ===== LocalStorage Keys ===== */
const LS_SETTINGS            = "lucky77_premium_settings_v3";
const LS_CACHE_MEMBERS       = "lucky77_cache_members_v3";
const LS_CACHE_MEMBERS_AT    = "lucky77_cache_members_at_v3";
const LS_CACHE_WINNERS       = "lucky77_cache_winners_v3";
const LS_CACHE_WINNERS_AT    = "lucky77_cache_winners_at_v3";
const LS_TEST_MODE           = "lucky77_test_mode_v3";

/* ===== DOM helper ===== */
function $(id){
  const el = document.getElementById(id);
  if(!el) throw new Error("Missing DOM #" + id);
  return el;
}

/* ===== Security: escape HTML ===== */
function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

/* ===== number clamp ===== */
function clamp(n, a, b){
  n = Number(n);
  if(!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}

/* ===== settings model (premium) ===== */
const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey:  DEFAULT_API_KEY,

  uiColor: "#ffffff",
  wheelAccent: "#d6b25e",
  wheelColorsText:
`#ffffff
#f1f5ff
#fff4d6
#e9eefc`,

  prizes: [
    { name:"10000Ks", times:4 },
    { name:"5000Ks",  times:2 },
    { name:"3000Ks",  times:3 }
  ],

  // images (data url)
  pageBgDataUrl: "",
  wheelBgDataUrl: "",        // ✅ wheel border background image
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",    // ✅ wheel under banner png

  // music
  bgSongDataUrl: "",
  musicEnabled: false,
};

/* ===== load/save settings ===== */
function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_SETTINGS);
    if(!raw) return structuredClone(defaultSettings);
    const data = JSON.parse(raw);
    return { ...structuredClone(defaultSettings), ...data };
  }catch{
    return structuredClone(defaultSettings);
  }
}

function saveSettings(s){
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

/* ===== Test Mode flag ===== */
function isTestMode(){
  return localStorage.getItem(LS_TEST_MODE) === "1";
}
function setTestMode(v){
  localStorage.setItem(LS_TEST_MODE, v ? "1" : "0");
}

/* ===========================
  API helpers (Abort + Timeout)
=========================== */

function getApiBase(){
  const s = loadSettings();
  return String(s.apiBase || DEFAULT_API_BASE).replace(/\/+$/,"");
}
function getApiKey(){
  const s = loadSettings();
  return String(s.apiKey || DEFAULT_API_KEY).trim();
}
function buildUrl(path){
  const base = getApiBase();
  const key  = getApiKey();
  // Render code supports query key + header key, we send both for safety
  const glue = path.includes("?") ? "&" : "?";
  return `${base}${path}${glue}key=${encodeURIComponent(key)}`;
}

async function fetchJson(url, opt = {}, timeout = 15000){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  try{
    const res = await fetch(url, { ...opt, signal: ctrl.signal });
    const text = await res.text();

    let json;
    try{ json = JSON.parse(text); }
    catch{ json = { ok:false, error:"Invalid JSON" }; }

    // normalize
    if(!res.ok && json && json.ok !== true){
      return { ok:false, error: json.error || ("HTTP_" + res.status) };
    }
    return json;

  }catch(e){
    return { ok:false, error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch_error") };
  }finally{
    clearTimeout(timer);
  }
}

async function apiGet(path, timeout){
  return fetchJson(buildUrl(path), {
    method: "GET",
    headers: { "x-api-key": getApiKey() }
  }, timeout || 15000);
}

async function apiPost(path, body, timeout){
  return fetchJson(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "x-api-key": getApiKey()
    },
    body: JSON.stringify(body || {})
  }, timeout || 15000);
}

/* ===========================
  Cache helpers (Members focus)
=========================== */

function cacheWrite(key, atKey, value){
  try{
    localStorage.setItem(key, JSON.stringify(value || []));
    localStorage.setItem(atKey, String(Date.now()));
  }catch{}
}

function cacheRead(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const val = JSON.parse(raw);
    return val;
  }catch{
    return null;
  }
}

function cacheAgeMs(atKey){
  try{
    const t = Number(localStorage.getItem(atKey) || 0);
    if(!t) return Infinity;
    return Date.now() - t;
  }catch{
    return Infinity;
  }
}

function cacheMembers(list){
  cacheWrite(LS_CACHE_MEMBERS, LS_CACHE_MEMBERS_AT, list);
}

function readMembersCache(){
  const val = cacheRead(LS_CACHE_MEMBERS);
  return Array.isArray(val) ? val : null;
}

function cacheWinners(list){
  cacheWrite(LS_CACHE_WINNERS, LS_CACHE_WINNERS_AT, list);
}

function readWinnersCache(){
  const val = cacheRead(LS_CACHE_WINNERS);
  return Array.isArray(val) ? val : null;
}

/* ===========================
  Shared UI helper
=========================== */
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

/* ===== Global state ===== */
let settings = loadSettings();
/* ===========================
 PART 2 — PREMIUM UI BOOT + SETTINGS (Theme/Music/Images) ✅
 - Drawer open/close
 - Apply theme color (luxury default)
 - Upload images: page bg / wheel border bg / top banner / bottom banner / wheel banner PNG
 - Upload music mp3 + play toggle
 - Save/Reset settings (localStorage)
 - Initial: health + pool refresh
=========================== */

/* ---------- SAFE DOM (no crash) ---------- */
function $o(id){
  return document.getElementById(id) || null;
}

/* ---------- STATE ---------- */
let settings = loadSettings();

/* ---------- DOM ---------- */
const drawer = $o("drawer");
const settingsBtn = $o("settingsBtn");
const closeSettingsBtn = $o("closeSettingsBtn");
const saveBtn = $o("saveBtn");
const resetBtn = $o("resetBtn");

const apiBaseInput = $o("apiBaseInput");
const apiKeyInput  = $o("apiKeyInput");

const uiColorInput = $o("uiColorInput");
const wheelAccentInput = $o("wheelAccentInput");
const wheelColorsInput = $o("wheelColorsInput");

const bgLayer = $o("bgLayer");
const wheelWrap = $o("wheelWrap");

const topBannerImg = $o("topBannerImg");
const bottomBannerImg = $o("bottomBannerImg");
const wheelBannerImg = $o("wheelBannerImg");

const topBannerFallback = $o("topBannerFallback");
const bottomBannerFallback = $o("bottomBannerFallback");
const wheelBannerFallback = $o("wheelBannerFallback");

const pageBgFile = $o("pageBgFile");
const wheelBgFile = $o("wheelBgFile");
const topBannerFile = $o("topBannerFile");
const bottomBannerFile = $o("bottomBannerFile");
const wheelBannerFile = $o("wheelBannerFile");
const bgSongFile = $o("bgSongFile");

const musicBtn = $o("musicBtn");

const poolText = $o("poolText");

/* ---------- MUSIC ENGINE ---------- */
let audio = null;
let musicOn = false;

function ensureAudio(){
  if (audio) return audio;
  audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.7;
  return audio;
}

function setMusicBtn(){
  if (!musicBtn) return;
  musicBtn.textContent = musicOn ? "🎵 Music: ON" : "🎵 Music: OFF";
}

async function playMusic(){
  const a = ensureAudio();
  if (!settings.bgSongDataUrl) {
    alert("MP3 မထည့်ရသေးပါ (Settings ထဲမှာ Upload လုပ်ပါ)");
    return;
  }
  if (a.src !== settings.bgSongDataUrl) a.src = settings.bgSongDataUrl;
  try{
    await a.play();
    musicOn = true;
    setMusicBtn();
  }catch(e){
    musicOn = false;
    setMusicBtn();
    alert("Browser က autoplay ပိတ်ထားနိုင်ပါတယ်။ Music button ကို ထပ်နှိပ်ပါ။");
  }
}

function stopMusic(){
  const a = ensureAudio();
  try{ a.pause(); }catch{}
  musicOn = false;
  setMusicBtn();
}

if (musicBtn){
  musicBtn.addEventListener("click", async ()=>{
    if (!musicOn) await playMusic();
    else stopMusic();
  });
}

/* ---------- FILE -> DATAURL ---------- */
function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result || ""));
    r.onerror = ()=> reject(new Error("file_read_error"));
    r.readAsDataURL(file);
  });
}

/* ---------- APPLY SETTINGS TO UI ---------- */
function applySettingsUI(){
  // inputs
  if (apiBaseInput) apiBaseInput.value = settings.apiBase || DEFAULT_API_BASE;
  if (apiKeyInput)  apiKeyInput.value  = settings.apiKey  || DEFAULT_API_KEY;

  if (uiColorInput) uiColorInput.value = settings.uiColor || "#ffffff";
  if (wheelAccentInput) wheelAccentInput.value = settings.wheelAccent || "#d6b25e";
  if (wheelColorsInput) wheelColorsInput.value = settings.wheelColorsText || "";

  // css vars
  document.documentElement.style.setProperty("--ui", settings.uiColor || "#ffffff");
  document.documentElement.style.setProperty("--gold", settings.wheelAccent || "#d6b25e");

  // page bg
  if (bgLayer){
    if (settings.pageBgDataUrl){
      bgLayer.style.backgroundImage = `url(${settings.pageBgDataUrl})`;
      bgLayer.classList.add("has-img");
    }else{
      bgLayer.style.backgroundImage = "";
      bgLayer.classList.remove("has-img");
    }
  }

  // wheel border bg image
  if (wheelWrap){
    if (settings.wheelBgDataUrl){
      wheelWrap.style.backgroundImage = `url(${settings.wheelBgDataUrl})`;
      wheelWrap.classList.add("has-bg");
    }else{
      wheelWrap.style.backgroundImage = "";
      wheelWrap.classList.remove("has-bg");
    }
  }

  // top banner
  if (topBannerImg){
    if (settings.topBannerDataUrl){
      topBannerImg.src = settings.topBannerDataUrl;
      topBannerImg.style.display = "block";
      if (topBannerFallback) topBannerFallback.style.display = "none";
    }else{
      topBannerImg.removeAttribute("src");
      topBannerImg.style.display = "none";
      if (topBannerFallback) topBannerFallback.style.display = "grid";
    }
  }

  // bottom banner
  if (bottomBannerImg){
    if (settings.bottomBannerDataUrl){
      bottomBannerImg.src = settings.bottomBannerDataUrl;
      bottomBannerImg.style.display = "block";
      if (bottomBannerFallback) bottomBannerFallback.style.display = "none";
    }else{
      bottomBannerImg.removeAttribute("src");
      bottomBannerImg.style.display = "none";
      if (bottomBannerFallback) bottomBannerFallback.style.display = "grid";
    }
  }

  // wheel banner png
  if (wheelBannerImg){
    if (settings.wheelBannerDataUrl){
      wheelBannerImg.src = settings.wheelBannerDataUrl;
      wheelBannerImg.style.display = "block";
      if (wheelBannerFallback) wheelBannerFallback.style.display = "none";
    }else{
      wheelBannerImg.removeAttribute("src");
      wheelBannerImg.style.display = "none";
      if (wheelBannerFallback) wheelBannerFallback.style.display = "grid";
    }
  }

  // music button text
  setMusicBtn();
}

applySettingsUI();

/* ---------- DRAWER OPEN/CLOSE ---------- */
function openDrawer(){
  if (!drawer) return;
  drawer.classList.add("open");
}
function closeDrawer(){
  if (!drawer) return;
  drawer.classList.remove("open");
}

if (settingsBtn) settingsBtn.addEventListener("click", openDrawer);
if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeDrawer);

/* ---------- SAVE FROM UI ---------- */
function readSettingsFromUI(){
  if (apiBaseInput) settings.apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;
  if (apiKeyInput)  settings.apiKey  = apiKeyInput.value.trim()  || DEFAULT_API_KEY;

  if (uiColorInput) settings.uiColor = uiColorInput.value || "#ffffff";
  if (wheelAccentInput) settings.wheelAccent = wheelAccentInput.value || "#d6b25e";
  if (wheelColorsInput) settings.wheelColorsText = wheelColorsInput.value || settings.wheelColorsText;

  saveSettings(settings);
  applySettingsUI();
}

/* ---------- RESET (LOCAL ONLY) ---------- */
function doResetUI(){
  const ok = confirm("Reset UI settings? (Prize/Images/Music/Theme) LocalStorage ပဲ reset လုပ်မယ်");
  if (!ok) return;

  try{
    localStorage.removeItem(LS_SETTINGS);
  }catch{}

  settings = loadSettings();
  applySettingsUI();

  // music stop
  stopMusic();

  alert("✅ Reset done");
}

if (resetBtn) resetBtn.addEventListener("click", doResetUI);

/* ---------- SAVE BUTTON ---------- */
if (saveBtn){
  saveBtn.addEventListener("click", async ()=>{
    setBusy(saveBtn, true, "Saving...");
    try{
      readSettingsFromUI();

      // ⭐ optional: prizes sync ကို PART3/4 မှာလုပ်မယ်
      // (ဒီ PART2 မှာ UI only)

      alert("✅ Saved");
      closeDrawer();
    }catch(e){
      alert("Save error: " + (e?.message || e));
    }finally{
      setBusy(saveBtn, false);
    }
  });
}

/* ---------- FILE INPUTS ---------- */
async function bindFileInput(inputEl, assignFn, label){
  if (!inputEl) return;
  inputEl.addEventListener("change", async ()=>{
    const f = inputEl.files && inputEl.files[0];
    if (!f) return;

    try{
      const dataUrl = await fileToDataUrl(f);
      assignFn(dataUrl);

      saveSettings(settings);
      applySettingsUI();
    }catch(e){
      alert(`${label} upload error`);
    }finally{
      // browser security: keep as-is, no need to clear
    }
  });
}

bindFileInput(pageBgFile, (v)=>{ settings.pageBgDataUrl = v; }, "Page Background");
bindFileInput(wheelBgFile, (v)=>{ settings.wheelBgDataUrl = v; }, "Wheel Border Background");
bindFileInput(topBannerFile, (v)=>{ settings.topBannerDataUrl = v; }, "Top Banner");
bindFileInput(bottomBannerFile, (v)=>{ settings.bottomBannerDataUrl = v; }, "Bottom Banner");
bindFileInput(wheelBannerFile, (v)=>{ settings.wheelBannerDataUrl = v; }, "Wheel Banner PNG");

bindFileInput(bgSongFile, (v)=>{
  settings.bgSongDataUrl = v;
  // if music already on -> reload & keep playing
  if (musicOn){
    stopMusic();
    setTimeout(()=>playMusic(), 50);
  }
}, "Background Song");

/* ---------- HEALTH + POOL ---------- */
async function refreshPool(){
  if (!poolText) return;

  const res = await apiGet("/pool", 12000);
  if (!res?.ok){
    poolText.textContent = "-";
    return;
  }
  poolText.textContent = String(res.pool ?? "-");
}

async function refreshHealthOnce(){
  // optional status check (no UI element required)
  await apiGet("/health", 12000);
}

refreshHealthOnce();
refreshPool();
/* ===========================
 PART 3 — PREMIUM PRIZE BUILDER + RENDER SYNC (/config/prizes) ✅
 - Stepper add/remove prize + times
 - Build prizeText => "PrizeName 3" lines
 - Save to localStorage
 - Sync to Render: POST /config/prizes { prizeText }
 - Rebuild wheelPrizes + drawWheel() (Part4 will use)
=========================== */

/* ---------- Ensure default fields exist ---------- */
settings.prizes = Array.isArray(settings.prizes) ? settings.prizes : [];
if (!settings.prizes.length) settings.prizes = [{ name: "", times: 1 }];

if (typeof settings.wheelColorsText !== "string") settings.wheelColorsText = "";

/* ---------- DOM ---------- */
const prizeBuilder = $o("prizeBuilder");

/* ---------- Helpers ---------- */
function normalizePrizeRow(p){
  return {
    name: String(p?.name || "").trim(),
    times: clamp(p?.times ?? 1, 1, 9999),
  };
}

function buildPrizeTextFromSettings(){
  const lines = [];

  const arr = (settings.prizes || []).map(normalizePrizeRow);

  for (const p of arr){
    if (!p.name) continue;
    lines.push(`${p.name} ${p.times}`);
  }

  return lines.join("\n");
}

async function syncPrizesToRender(){
  const prizeText = buildPrizeTextFromSettings();

  if (!prizeText.trim()){
    // no valid prizes -> do not send
    return { ok:false, error:"no_valid_prizes" };
  }

  // Render endpoint expects x-api-key too (we already set in apiPost)
  const r = await apiPost("/config/prizes", { prizeText }, 15000);
  return r;
}

/* ---------- UI Render ---------- */
function renderPrizeBuilder(){
  if (!prizeBuilder) return;

  prizeBuilder.innerHTML = "";

  const list = settings.prizes.map(normalizePrizeRow);

  list.forEach((p, idx)=>{
    const row = document.createElement("div");
    row.className = "prize-row";

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Prize name";
    nameInput.value = p.name;

    const step = document.createElement("div");
    step.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";

    const timesInput = document.createElement("input");
    timesInput.type = "number";
    timesInput.min = "1";
    timesInput.max = "9999";
    timesInput.value = String(p.times);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "✖";

    function commit(){
      // keep current row to settings
      settings.prizes[idx] = normalizePrizeRow({
        name: nameInput.value,
        times: timesInput.value,
      });

      // ensure at least 1 row exists
      if (!settings.prizes.length) settings.prizes = [{ name:"", times:1 }];

      saveSettings(settings);
    }

    nameInput.addEventListener("change", ()=>{
      commit();
      // wheel rebuild
      buildWheelPrizes();
      drawWheel();
    });

    timesInput.addEventListener("change", ()=>{
      timesInput.value = String(clamp(timesInput.value, 1, 9999));
      commit();
      buildWheelPrizes();
      drawWheel();
    });

    minus.addEventListener("click", ()=>{
      const n = clamp(Number(timesInput.value) - 1, 1, 9999);
      timesInput.value = String(n);
      commit();
      buildWheelPrizes();
      drawWheel();
    });

    plus.addEventListener("click", ()=>{
      const n = clamp(Number(timesInput.value) + 1, 1, 9999);
      timesInput.value = String(n);
      commit();
      buildWheelPrizes();
      drawWheel();
    });

    remove.addEventListener("click", ()=>{
      settings.prizes.splice(idx, 1);
      if (!settings.prizes.length) settings.prizes = [{ name:"", times:1 }];
      saveSettings(settings);

      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    });

    step.append(minus, timesInput, plus, remove);
    row.append(nameInput, step);
    prizeBuilder.append(row);
  });

  // Add button
  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn";
  add.textContent = "+ Add Prize";
  add.addEventListener("click", ()=>{
    settings.prizes.push({ name:"", times:1 });
    saveSettings(settings);
    renderPrizeBuilder();
  });

  // Sync button (Render)
  const sync = document.createElement("button");
  sync.type = "button";
  sync.className = "btn primary";
  sync.textContent = "Save Prizes to Render";
  sync.style.marginTop = "10px";

  sync.addEventListener("click", async ()=>{
    setBusy(sync, true, "Saving...");
    try{
      // commit latest text fields (in case user didn't blur)
      // (We already commit on change/click, so safe)

      const r = await syncPrizesToRender();
      if (!r?.ok) throw new Error(r?.error || "save_failed");
      alert(`✅ Saved to Render (bag_size: ${r.bag_size || "-"})`);
    }catch(e){
      alert("Save prizes error: " + (e?.message || e));
    }finally{
      setBusy(sync, false);
    }
  });

  prizeBuilder.append(add, sync);
}

/* ---------- Boot Prize Builder + Wheel ---------- */
buildWheelPrizes();
drawWheel();
renderPrizeBuilder();
/* ===========================
 PART 4 — SPIN ENGINE (Render Winner)
=========================== */

let spinning = false;

/* ===== Wheel state ===== */

let wheelAngle = 0;
let wheelPrizes = [];

const wheelCanvas = $o("wheel");
const wheelCtx = wheelCanvas.getContext("2d");


/* ===========================
 BUILD UNIQUE PRIZES
=========================== */

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


/* ===========================
 WHEEL COLORS
=========================== */

function parseWheelColors(){

  const txt = settings.wheelColorsText || "";

  const arr = txt.split("\n")
  .map(v=>v.trim())
  .filter(v=>v);

  if(!arr.length){
    return ["#ffffff","#f1f5ff","#fff4d6","#e9eefc"];
  }

  return arr;

}


/* ===========================
 DRAW WHEEL
=========================== */

function drawWheel(){

  const total = wheelPrizes.length;

  const TAU = Math.PI * 2;

  const w = wheelCanvas.width;
  const h = wheelCanvas.height;

  const cx = w / 2;
  const cy = h / 2;

  const r = Math.min(cx,cy) - 10;

  wheelCtx.clearRect(0,0,w,h);

  const colors = parseWheelColors();

  const slice = TAU / total;

  for(let i=0;i<total;i++){

    const start = wheelAngle + i * slice;
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
    wheelCtx.rotate(start + slice / 2);

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
 FIND PRIZE INDEX
=========================== */

function findPrizeIndex(prize){

  const p = String(prize || "").trim();

  let idx = wheelPrizes.findIndex(v => String(v).trim() === p);

  if(idx >= 0) return idx;

  const lower = p.toLowerCase();

  idx = wheelPrizes.findIndex(v => String(v).toLowerCase() === lower);

  return idx;

}


/* ===========================
 CALCULATE TARGET ANGLE
=========================== */

function calcTargetAngle(idx){

  const TAU = Math.PI * 2;

  const total = wheelPrizes.length;

  const slice = TAU / total;

  const pointer = -Math.PI / 2;

  let target = pointer - (idx + 0.5) * slice;

  target = ((target % TAU) + TAU) % TAU;

  return target;

}


/* ===========================
 SPIN ANIMATION
=========================== */

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

      if(p < 1){
        requestAnimationFrame(frame);
      }else{
        resolve();
      }

    }

    requestAnimationFrame(frame);

  });

}


/* ===========================
 SPIN CLICK
=========================== */

const spinBtn = $o("spinBtn");

async function doSpin(){

  if(spinning) return;

  if(!wheelPrizes.length){
    alert("Prize မရှိသေးပါ");
    return;
  }

  spinning = true;

  setBusy(spinBtn,true,"SPIN...");

  let res;

  try{

    res = await apiPost("/spin",{},15000);

    if(!res?.ok){
      throw new Error(res?.error || "spin error");
    }

  }catch(e){

    spinning = false;

    setBusy(spinBtn,false);

    alert("Spin error: " + (e?.message || e));

    return;
  }

  const prize = String(res.prize || "");

  const winner = res.winner || {};

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

  await animateSpin(target,3200);

  showWinnerModal(prize,winner,res.turn);

  recordTodayWinner({
    prize,
    winner,
    turn: res.turn
  });

  refreshPool();

  spinning = false;

  setBusy(spinBtn,false);

}

spinBtn.onclick = doSpin;


/* ===== INIT WHEEL ===== */

buildWheelPrizes();
drawWheel();
/* ===========================
 PART 5 — WINNER MODAL + WINNER LIST
=========================== */

/* ---------- DOM ---------- */

const winnerModal = $o("winnerModal");
const winnerBackdrop = $o("winnerBackdrop");
const winnerCloseBtn = $o("winnerCloseBtn");

const winnerPrizeTitle = $o("winnerPrizeTitle");
const winnerTitleText = $o("winnerTitleText");
const winnerNameText = $o("winnerNameText");
const winnerHint = $o("winnerHint");

const contactBtn = $o("contactBtn");
const noticeBtn = $o("noticeBtn");

const winnersBtn = $o("winnersBtn");
const winnersPanel = $o("winnersPanel");
const winnersCloseBtn = $o("winnersCloseBtn");
const winnersList = $o("winnersList");
const winnersTotalText = $o("winnersTotalText");

/* ---------- STATE ---------- */

let lastWinner = null;


/* ===========================
 Winner Modal
=========================== */

function winnerDisplay(w){

  const username = String(w?.username || "").replace("@","").trim();
  const name = String(w?.name || "").trim();
  const display = String(w?.display || "").trim();

  return display || name || (username ? "@"+username : String(w?.id || "-"));

}

function hasUsername(w){
  const u = String(w?.username || "").replace("@","").trim();
  return !!u;
}

function showWinnerModal(prize,winnerObj,turn){

  lastWinner = {
    prize:String(prize || "-"),
    winner:winnerObj || {},
    turn:turn || null
  };

  winnerPrizeTitle.textContent = "WINNER";

  winnerTitleText.textContent = String(prize || "—");

  winnerNameText.textContent = winnerDisplay(winnerObj);

  if(hasUsername(winnerObj)){

    contactBtn.style.display = "inline-flex";
    noticeBtn.style.display = "none";

    winnerHint.textContent =
      "Username ရှိပါတယ် → Telegram ကို တန်းဆက်သွယ်နိုင်ပါတယ်";

  }else{

    contactBtn.style.display = "none";
    noticeBtn.style.display = "inline-flex";

    winnerHint.textContent =
      "Username မရှိပါ → Notice(DM) နှိပ်ပြီး Bot က DM ပို့ပါ";

  }

  winnerModal.classList.remove("hidden");

  winnerModal.setAttribute("aria-hidden","false");

}

function hideWinnerModal(){

  winnerModal.classList.add("hidden");

  winnerModal.setAttribute("aria-hidden","true");

  lastWinner = null;

}

winnerCloseBtn?.addEventListener("click",hideWinnerModal);
winnerBackdrop?.addEventListener("click",hideWinnerModal);


/* ===========================
 Telegram Contact
=========================== */

contactBtn?.addEventListener("click",()=>{

  if(!lastWinner) return;

  const u = String(lastWinner.winner?.username || "")
  .replace("@","")
  .trim();

  if(!u) return;

  window.open(`https://t.me/${u}`,"_blank");

});


/* ===========================
 Notice DM
=========================== */

noticeBtn?.addEventListener("click",async ()=>{

  if(!lastWinner) return;

  const uid = lastWinner.winner?.id;

  if(!uid) return;

  setBusy(noticeBtn,true,"Sending...");

  try{

    const r = await apiPost("/notice",{
      user_id:String(uid),
      prize:String(lastWinner.prize || "")
    },15000);

    if(!r?.ok){
      throw new Error(r?.error || "notice_failed");
    }

    alert("✅ Notice DM ပို့ပြီးပါပြီ");

  }catch(e){

    alert("Notice error: "+(e?.message || e));

  }finally{

    setBusy(noticeBtn,false);

  }

});


/* ===========================
 Winners Panel
=========================== */

function openWinnersPanel(){

  winnersPanel.classList.remove("hidden");

  refreshWinners();

}

function closeWinnersPanel(){

  winnersPanel.classList.add("hidden");

}

winnersBtn?.addEventListener("click",openWinnersPanel);
winnersCloseBtn?.addEventListener("click",closeWinnersPanel);


/* ===========================
 Render Winners List
=========================== */

function renderWinners(list){

  const arr = Array.isArray(list) ? list : [];

  winnersTotalText.textContent =
    arr.length ? ` • Total: ${arr.length}` : "";

  if(!arr.length){

    winnersList.innerHTML =
      `<div class="small">No winners yet</div>`;

    return;

  }

  const rows = arr.map(w=>{

    const username = String(w.username || "").replace("@","").trim();

    const doneText = w.done ? "Done ✅" : "Prize Done";

    const doneClass = w.done ? "success" : "";

    return `
      <div class="winner-row">

        <div class="winner-main">
          <div class="winner-prize">
            #${esc(String(w.turn))} • ${esc(String(w.prize))}
          </div>

          <div class="winner-meta">
            ${esc(String(w.display || w.name || w.user_id))}
          </div>
        </div>

        <div class="winner-actions">

          <button
            class="btn mini ${doneClass}"
            data-act="done"
            data-id="${esc(String(w.user_id))}"
          >
            ${doneText}
          </button>

          ${
            username
            ? `<button class="btn mini"
                data-act="tg"
                data-user="${esc(username)}"
               >Telegram</button>`
            : `<button class="btn mini"
                data-act="notice"
                data-id="${esc(String(w.user_id))}"
                data-prize="${esc(String(w.prize))}"
               >Notice</button>`
          }

        </div>

      </div>
    `;

  }).join("");

  winnersList.innerHTML = rows;

}


/* ===========================
 Winners Fetch
=========================== */

async function refreshWinners(){

  const res = await apiGet("/winners",15000);

  if(!res?.ok){

    winnersList.innerHTML =
      `<div class="small">Load error</div>`;

    return;

  }

  renderWinners(res.winners || []);

}


/* ===========================
 Winners Actions
=========================== */

winnersList?.addEventListener("click",async e=>{

  const btn = e.target.closest("button");

  if(!btn) return;

  const act = btn.dataset.act;

  if(act === "tg"){

    const user = btn.dataset.user;

    window.open(`https://t.me/${user}`,"_blank");

  }

  if(act === "notice"){

    const uid = btn.dataset.id;
    const prize = btn.dataset.prize;

    setBusy(btn,true,"Sending...");

    try{

      const r = await apiPost("/notice",{
        user_id:uid,
        prize
      },15000);

      if(!r?.ok){
        throw new Error(r?.error);
      }

      alert("Notice sent");

    }catch(err){

      alert("Notice error");

    }finally{

      setBusy(btn,false);

    }

  }

  if(act === "done"){

    const uid = btn.dataset.id;

    setBusy(btn,true,"Saving...");

    try{

      const r = await apiPost("/winner/done",{
        user_id:uid
      },15000);

      if(!r?.ok){
        throw new Error(r?.error);
      }

      refreshWinners();

    }catch(err){

      alert("Done update error");

    }

  }

});
/* ===========================
 PART 6 — MEMBERS PANEL (PRO FIX)
 ✅ /members ကနေ 167+ member ပြန်ပေါ်
 ✅ Active/Inactive badge
 ✅ Username ရှိရင် Telegram button
 ✅ Username မရှိရင် Notice(DM) button
 ✅ Cache (instant open) + Live refresh
 ✅ Timeout (15s) / Error => Cache fallback
=========================== */

/* ===== DOM ===== */
const membersPanel = $("membersPanel");
const membersCloseBtn = $("membersCloseBtn");
const membersTable = $("membersTable");
const membersTotalText = $("membersTotalText");

/* ===== OPEN/CLOSE ===== */
function openMembersPanel() {
  membersPanel.classList.remove("hidden");

  // ✅ show cache instantly
  const cache = readMembersCache();
  if (cache && cache.length) {
    renderMembers(cache, true);
  } else {
    membersTable.innerHTML = `<div class="small">Loading members...</div>`;
  }

  // ✅ then fetch fresh
  refreshMembers();
}

function closeMembersPanel() {
  membersPanel.classList.add("hidden");
}

membersBtn.addEventListener("click", openMembersPanel);
membersCloseBtn.addEventListener("click", closeMembersPanel);

/* ===== UI ===== */
function statusBadge(active) {
  return active
    ? `<span style="font-weight:1000;color:#16a34a;">ACTIVE</span>`
    : `<span style="font-weight:1000;color:#ef4444;">INACTIVE</span>`;
}

function memberDisplay(m) {
  const username = String(m?.username || "").replace(/^@+/, "").trim();
  const display = String(m?.display || "").trim();
  const name = String(m?.name || "").trim();
  const id = String(m?.id || "").trim();
  return display || name || (username ? `@${username}` : id || "-");
}

function renderMembers(list, fromCache = false) {
  const arr = Array.isArray(list) ? list.slice() : [];
  membersTotalText.textContent = arr.length
    ? ` • Total: ${arr.length}${fromCache ? " (cache)" : ""}`
    : "";

  if (!arr.length) {
    membersTable.innerHTML = `<div class="small">No members</div>`;
    return;
  }

  // ✅ active first
  arr.sort((a, b) => (b.active === true) - (a.active === true));

  const rows = arr.map((m) => {
    const username = String(m?.username || "").replace(/^@+/, "").trim();
    const uid = String(m?.id || "").trim();
    const display = memberDisplay(m);

    return `
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(16,19,24,0.10);padding:10px 0;">
        <div style="min-width:0;">
          <div style="font-weight:1000;word-break:break-word;">${esc(display)}</div>
          <div class="small" style="margin-top:4px;">
            ID: ${esc(uid)} • ${statusBadge(!!m.active)}
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          ${
            username
              ? `<button class="btn mini" data-act="tg" data-user="${esc(username)}">Telegram</button>`
              : `<button class="btn mini" data-act="notice" data-uid="${esc(uid)}">Notice</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  membersTable.innerHTML = rows;
}

/* ===== FETCH ===== */
async function refreshMembers() {
  setBusy(membersBtn, true, "Members...");

  try {
    // ✅ 167+ member များရင် 15s ပေး
    const res = await apiGet("/members", 15000);
    if (!res?.ok) throw new Error(res?.error || "members_error");

    const list = Array.isArray(res.members) ? res.members : [];
    cacheMembers(list);          // ✅ cache update
    renderMembers(list, false);  // ✅ render fresh

  } catch (e) {
    // ✅ fallback to cache
    const cache = readMembersCache();
    if (cache && cache.length) {
      renderMembers(cache, true);
      membersTable.insertAdjacentHTML(
        "afterbegin",
        `<div class="small" style="margin-bottom:8px;">⚠️ Live fetch error, showing cache</div>`
      );
    } else {
      membersTable.innerHTML = `<div class="small">Members error: ${esc(e?.message || e)}</div>`;
    }
  } finally {
    setBusy(membersBtn, false);
  }
}

/* ===== ACTIONS (delegation) ===== */
membersTable.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;

  const act = b.dataset.act;

  // Telegram open
  if (act === "tg") {
    const user = String(b.dataset.user || "").replace(/^@+/, "").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  // Notice (DM)
  if (act === "notice") {
    const uid = String(b.dataset.uid || "").trim();
    if (!uid) return;

    setBusy(b, true, "Sending...");
    try {
      // prize မသိရင် empty ပို့လည်းရ
      const r = await apiPost("/notice", { user_id: uid, prize: "" }, 12000);
      if (!r?.ok) throw new Error(r?.error || "notice_failed");
      alert("✅ Notice (DM) ပို့ပြီးပါပြီ");
    } catch (err) {
      alert("Notice error: " + (err?.message || err));
    } finally {
      setBusy(b, false);
    }
    return;
  }
});

/* ===== OPTIONAL: auto refresh when drawer opens =====
   (မလိုရင် ဖျက်လို့ရ)
*/
// settingsBtn.addEventListener("click", () => {
//   const cache = readMembersCache();
//   if (!cache || !cache.length) refreshMembers();
// });

