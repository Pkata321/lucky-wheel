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