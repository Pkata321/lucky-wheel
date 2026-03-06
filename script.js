"use strict";

/* =========================================
   LUCKY77 PREMIUM WHEEL — FINAL JS
   Clean rewrite
   - Render backend only
   - Members / Winners / Spin / Notice / Settings
   - No duplicate declarations
========================================= */

/* =========================
   CONFIG / STORAGE
========================= */

const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY = "Lucky77_luckywheel_77";

const LS_SETTINGS = "lucky77_premium_settings_v4";
const LS_CACHE_MEMBERS = "lucky77_cache_members_v4";
const LS_CACHE_WINNERS = "lucky77_cache_winners_v4";

/* =========================
   HELPERS
========================= */

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing DOM #" + id);
  return el;
}

function esc(v) {
  return String(v ?? "")
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

function setBusy(btn, busy, text) {
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    if (!btn.dataset.oldText) btn.dataset.oldText = btn.textContent;
    if (text) btn.textContent = text;
  } else {
    btn.disabled = false;
    if (btn.dataset.oldText) {
      btn.textContent = btn.dataset.oldText;
      delete btn.dataset.oldText;
    }
  }
}

function cacheWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function cacheRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("file_read_error"));
    fr.readAsDataURL(file);
  });
}

/* =========================
   SETTINGS
========================= */

const defaultSettings = {
  apiBase: DEFAULT_API_BASE,
  apiKey: DEFAULT_API_KEY,

  uiColor: "#ffffff",
  wheelAccent: "#d6b25e",
  wheelColorsText:
`#ffffff
#f1f5ff
#fff4d6
#e9eefc`,

  prizes: [
    { name: "10000Ks", times: 4 },
    { name: "5000Ks", times: 2 },
    { name: "3000Ks", times: 3 }
  ],

  pageBgDataUrl: "",
  wheelBgDataUrl: "",
  topBannerDataUrl: "",
  bottomBannerDataUrl: "",
  wheelBannerDataUrl: "",

  bgSongDataUrl: ""
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return structuredClone(defaultSettings);
    return { ...structuredClone(defaultSettings), ...JSON.parse(raw) };
  } catch (_) {
    return structuredClone(defaultSettings);
  }
}

function saveSettings() {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

let settings = loadSettings();

/* =========================
   API
========================= */

function getApiBase() {
  return String(settings.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function getApiKey() {
  return String(settings.apiKey || DEFAULT_API_KEY).trim();
}

function buildUrl(path) {
  const glue = path.includes("?") ? "&" : "?";
  return `${getApiBase()}${path}${glue}key=${encodeURIComponent(getApiKey())}`;
}

async function fetchJson(url, opt = {}, timeout = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await fetch(url, { ...opt, signal: ctrl.signal });
    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { ok: false, error: "invalid_json" };
    }

    if (!res.ok && json.ok !== true) {
      return { ok: false, error: json.error || `HTTP_${res.status}` };
    }

    return json;
  } catch (e) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch_error")
    };
  } finally {
    clearTimeout(timer);
  }
}

function apiGet(path, timeout = 15000) {
  return fetchJson(buildUrl(path), {
    method: "GET",
    headers: { "x-api-key": getApiKey() }
  }, timeout);
}

function apiPost(path, body, timeout = 15000) {
  return fetchJson(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey()
    },
    body: JSON.stringify(body || {})
  }, timeout);
}

/* =========================
   DOM
========================= */

const bgLayer = $("bgLayer");

const settingsBtn = $("settingsBtn");
const musicBtn = $("musicBtn");

const topBannerImg = $("topBannerImg");
const topBannerFallback = $("topBannerFallback");
const bottomBannerImg = $("bottomBannerImg");
const bottomBannerFallback = $("bottomBannerFallback");
const wheelBannerImg = $("wheelBannerImg");
const wheelBannerFallback = $("wheelBannerFallback");

const wheelWrap = $("wheelWrap");
const wheelCanvas = $("wheel");
const wheelCtx = wheelCanvas.getContext("2d");
const spinBtn = $("spinBtn");

const poolText = $("poolText");
const restartSpinBtn = $("restartSpinBtn");
const membersBtn = $("membersBtn");
const winnersBtn = $("winnersBtn");

const membersPanel = $("membersPanel");
const membersCloseBtn = $("membersCloseBtn");
const membersTable = $("membersTable");
const membersTotalText = $("membersTotalText");

const winnersPanel = $("winnersPanel");
const winnersCloseBtn = $("winnersCloseBtn");
const winnersList = $("winnersList");
const winnersTotalText = $("winnersTotalText");

const winnerModal = $("winnerModal");
const winnerBackdrop = $("winnerBackdrop");
const winnerCloseBtn = $("winnerCloseBtn");
const winnerPrizeTitle = $("winnerPrizeTitle");
const winnerTitleText = $("winnerTitleText");
const winnerNameText = $("winnerNameText");
const winnerHint = $("winnerHint");
const contactBtn = $("contactBtn");
const noticeBtn = $("noticeBtn");

const drawer = $("drawer");
const closeSettingsBtn = $("closeSettingsBtn");
const saveBtn = $("saveBtn");
const resetBtn = $("resetBtn");

const apiBaseInput = $("apiBaseInput");
const apiKeyInput = $("apiKeyInput");
const uiColorInput = $("uiColorInput");
const wheelAccentInput = $("wheelAccentInput");
const wheelColorsInput = $("wheelColorsInput");
const prizeBuilder = $("prizeBuilder");

const pageBgFile = $("pageBgFile");
const wheelBgFile = $("wheelBgFile");
const topBannerFile = $("topBannerFile");
const bottomBannerFile = $("bottomBannerFile");
const wheelBannerFile = $("wheelBannerFile");
const bgSongFile = $("bgSongFile");

/* =========================
   MUSIC
========================= */

let bgAudio = null;
let musicOn = false;

function ensureAudio() {
  if (bgAudio) return bgAudio;
  bgAudio = new Audio();
  bgAudio.loop = true;
  bgAudio.preload = "auto";
  bgAudio.volume = 0.7;
  return bgAudio;
}

function syncMusicButton() {
  musicBtn.textContent = musicOn ? "🎵 Music: ON" : "🎵 Music: OFF";
}

async function playMusic() {
  if (!settings.bgSongDataUrl) {
    alert("MP3 မထည့်ရသေးပါ");
    return;
  }

  const a = ensureAudio();
  if (a.src !== settings.bgSongDataUrl) a.src = settings.bgSongDataUrl;

  try {
    await a.play();
    musicOn = true;
  } catch (_) {
    musicOn = false;
    alert("Browser က music autoplay ပိတ်ထားနိုင်ပါတယ်");
  }
  syncMusicButton();
}

function stopMusic() {
  const a = ensureAudio();
  try { a.pause(); } catch (_) {}
  musicOn = false;
  syncMusicButton();
}

/* =========================
   SETTINGS UI
========================= */

function applySettingsUI() {
  apiBaseInput.value = settings.apiBase || DEFAULT_API_BASE;
  apiKeyInput.value = settings.apiKey || DEFAULT_API_KEY;
  uiColorInput.value = settings.uiColor || "#ffffff";
  wheelAccentInput.value = settings.wheelAccent || "#d6b25e";
  wheelColorsInput.value = settings.wheelColorsText || "";

  document.documentElement.style.setProperty("--ui", settings.uiColor || "#ffffff");
  document.documentElement.style.setProperty("--gold", settings.wheelAccent || "#d6b25e");

  if (settings.pageBgDataUrl) {
    bgLayer.style.backgroundImage = `url(${settings.pageBgDataUrl})`;
    bgLayer.classList.add("has-img");
  } else {
    bgLayer.style.backgroundImage = "";
    bgLayer.classList.remove("has-img");
  }

  if (settings.wheelBgDataUrl) {
    wheelWrap.style.backgroundImage = `url(${settings.wheelBgDataUrl})`;
  } else {
    wheelWrap.style.backgroundImage = "";
  }

  if (settings.topBannerDataUrl) {
    topBannerImg.src = settings.topBannerDataUrl;
    topBannerImg.style.display = "block";
    topBannerFallback.style.display = "none";
  } else {
    topBannerImg.style.display = "none";
    topBannerFallback.style.display = "flex";
  }

  if (settings.bottomBannerDataUrl) {
    bottomBannerImg.src = settings.bottomBannerDataUrl;
    bottomBannerImg.style.display = "block";
    bottomBannerFallback.style.display = "none";
  } else {
    bottomBannerImg.style.display = "none";
    bottomBannerFallback.style.display = "flex";
  }

  if (settings.wheelBannerDataUrl) {
    wheelBannerImg.src = settings.wheelBannerDataUrl;
    wheelBannerImg.style.display = "block";
    wheelBannerFallback.style.display = "none";
  } else {
    wheelBannerImg.style.display = "none";
    wheelBannerFallback.style.display = "flex";
  }

  syncMusicButton();
}

function openDrawer() {
  drawer.classList.add("open");
}

function closeDrawer() {
  drawer.classList.remove("open");
}

function readSettingsFromInputs() {
  settings.apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;
  settings.apiKey = apiKeyInput.value.trim() || DEFAULT_API_KEY;
  settings.uiColor = uiColorInput.value || "#ffffff";
  settings.wheelAccent = wheelAccentInput.value || "#d6b25e";
  settings.wheelColorsText = wheelColorsInput.value || "";
  saveSettings();
  applySettingsUI();
  buildWheelPrizes();
  drawWheel();
}

function resetAllSettings() {
  if (!confirm("Reset UI settings ?")) return;
  localStorage.removeItem(LS_SETTINGS);
  settings = loadSettings();
  applySettingsUI();
  renderPrizeBuilder();
  buildWheelPrizes();
  drawWheel();
  stopMusic();
}

/* =========================
   FILE INPUTS
========================= */

async function bindFileInput(input, assignFn, okText) {
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    try {
      const data = await fileToDataURL(file);
      assignFn(data);
      saveSettings();
      applySettingsUI();
      if (okText) console.log(okText);
    } catch (_) {
      alert("Upload error");
    }
  });
}

bindFileInput(pageBgFile, (v) => { settings.pageBgDataUrl = v; }, "page bg ok");
bindFileInput(wheelBgFile, (v) => { settings.wheelBgDataUrl = v; }, "wheel bg ok");
bindFileInput(topBannerFile, (v) => { settings.topBannerDataUrl = v; }, "top banner ok");
bindFileInput(bottomBannerFile, (v) => { settings.bottomBannerDataUrl = v; }, "bottom banner ok");
bindFileInput(wheelBannerFile, (v) => { settings.wheelBannerDataUrl = v; }, "wheel banner ok");
bindFileInput(bgSongFile, (v) => {
  settings.bgSongDataUrl = v;
  if (musicOn) {
    stopMusic();
    setTimeout(playMusic, 60);
  }
}, "music ok");

/* =========================
   PRIZE BUILDER
========================= */

function normalizePrizeRow(p) {
  return {
    name: String(p?.name || "").trim(),
    times: clamp(p?.times ?? 1, 1, 9999)
  };
}

function buildPrizeText() {
  return (settings.prizes || [])
    .map(normalizePrizeRow)
    .filter((p) => p.name)
    .map((p) => `${p.name} ${p.times}`)
    .join("\n");
}

async function syncPrizesToRender() {
  const prizeText = buildPrizeText();
  if (!prizeText.trim()) return { ok: false, error: "no_valid_prizes" };
  return apiPost("/config/prizes", { prizeText }, 15000);
}

function renderPrizeBuilder() {
  prizeBuilder.innerHTML = "";

  if (!Array.isArray(settings.prizes) || !settings.prizes.length) {
    settings.prizes = [{ name: "", times: 1 }];
  }

  settings.prizes.forEach((row, idx) => {
    const p = normalizePrizeRow(row);

    const wrap = document.createElement("div");
    wrap.className = "prize-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Prize name";
    nameInput.value = p.name;

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";

    const num = document.createElement("input");
    num.type = "number";
    num.min = "1";
    num.max = "9999";
    num.value = String(p.times);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✖";

    function commit() {
      settings.prizes[idx] = normalizePrizeRow({
        name: nameInput.value,
        times: num.value
      });
      saveSettings();
      buildWheelPrizes();
      drawWheel();
    }

    nameInput.addEventListener("change", commit);
    num.addEventListener("change", () => {
      num.value = String(clamp(num.value, 1, 9999));
      commit();
    });
    minus.addEventListener("click", () => {
      num.value = String(clamp(Number(num.value) - 1, 1, 9999));
      commit();
    });
    plus.addEventListener("click", () => {
      num.value = String(clamp(Number(num.value) + 1, 1, 9999));
      commit();
    });
    del.addEventListener("click", () => {
      settings.prizes.splice(idx, 1);
      if (!settings.prizes.length) settings.prizes = [{ name: "", times: 1 }];
      saveSettings();
      renderPrizeBuilder();
      buildWheelPrizes();
      drawWheel();
    });

    stepper.append(minus, num, plus, del);
    wrap.append(nameInput, stepper);
    prizeBuilder.append(wrap);
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn";
  addBtn.textContent = "+ Add Prize";
  addBtn.addEventListener("click", () => {
    settings.prizes.push({ name: "", times: 1 });
    saveSettings();
    renderPrizeBuilder();
  });

  const syncBtn = document.createElement("button");
  syncBtn.type = "button";
  syncBtn.className = "btn primary";
  syncBtn.style.marginTop = "10px";
  syncBtn.textContent = "Save Prizes to Render";
  syncBtn.addEventListener("click", async () => {
    setBusy(syncBtn, true, "Saving...");
    try {
      const r = await syncPrizesToRender();
      if (!r?.ok) throw new Error(r?.error || "save_failed");
      alert(`✅ Saved to Render (bag_size: ${r.bag_size || "-"})`);
    } catch (e) {
      alert("Save prizes error: " + (e?.message || e));
    } finally {
      setBusy(syncBtn, false);
    }
  });

  prizeBuilder.append(addBtn, syncBtn);
}

/* =========================
   WHEEL
========================= */

let spinning = false;
let wheelAngle = 0;
let wheelPrizes = [];

function parseWheelColors() {
  const arr = String(settings.wheelColorsText || "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  return arr.length ? arr : ["#ffffff", "#f1f5ff", "#fff4d6", "#e9eefc"];
}

function buildWheelPrizes() {
  const seen = new Set();
  wheelPrizes = [];

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

function drawWheel() {
  const total = wheelPrizes.length;
  const TAU = Math.PI * 2;
  const w = wheelCanvas.width;
  const h = wheelCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 12;
  const slice = TAU / total;
  const colors = parseWheelColors();

  wheelCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < total; i++) {
    const start = wheelAngle + i * slice;
    const end = start + slice;

    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.arc(cx, cy, r, start, end);
    wheelCtx.closePath();
    wheelCtx.fillStyle = colors[i % colors.length];
    wheelCtx.fill();
    wheelCtx.strokeStyle = "rgba(0,0,0,0.08)";
    wheelCtx.lineWidth = 1;
    wheelCtx.stroke();

    wheelCtx.save();
    wheelCtx.translate(cx, cy);
    wheelCtx.rotate(start + slice / 2);
    wheelCtx.fillStyle = "#101318";
    wheelCtx.font = "bold 16px system-ui";
    wheelCtx.textAlign = "right";
    wheelCtx.fillText(wheelPrizes[i], r - 20, 6);
    wheelCtx.restore();
  }
}

function findPrizeIndex(prize) {
  const p = String(prize || "").trim();
  let idx = wheelPrizes.findIndex((v) => String(v).trim() === p);
  if (idx >= 0) return idx;
  idx = wheelPrizes.findIndex((v) => String(v).toLowerCase() === p.toLowerCase());
  return idx;
}

function calcTargetAngle(idx) {
  const TAU = Math.PI * 2;
  const total = wheelPrizes.length;
  const slice = TAU / total;
  const pointer = -Math.PI / 2;
  let target = pointer - (idx + 0.5) * slice;
  target = ((target % TAU) + TAU) % TAU;
  return target;
}

function animateSpin(target, duration = 3200) {
  const TAU = Math.PI * 2;
  const start = wheelAngle;
  const startNorm = ((start % TAU) + TAU) % TAU;
  const delta = ((target - startNorm) + TAU) % TAU;
  const extra = 6 + Math.random() * 4;
  const final = start + extra * TAU + delta;
  const t0 = performance.now();

  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  return new Promise((resolve) => {
    function frame(now) {
      const p = Math.min((now - t0) / duration, 1);
      wheelAngle = start + (final - start) * ease(p);
      drawWheel();
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/* =========================
   WINNER MODAL / PANELS
========================= */

let lastWinner = null;

function winnerDisplay(w) {
  const username = String(w?.username || "").replace(/^@+/, "").trim();
  const display = String(w?.display || "").trim();
  const name = String(w?.name || "").trim();
  const id = String(w?.id || w?.user_id || "").trim();
  return display || name || (username ? `@${username}` : id || "-");
}

function hasUsername(w) {
  return !!String(w?.username || "").replace(/^@+/, "").trim();
}

function showWinnerModal(prize, winnerObj, turn) {
  lastWinner = {
    prize: String(prize || "-"),
    winner: winnerObj || {},
    turn: turn || null
  };

  winnerPrizeTitle.textContent = "WINNER";
  winnerTitleText.textContent = String(prize || "—");
  winnerNameText.textContent = winnerDisplay(winnerObj);

  if (hasUsername(winnerObj)) {
    contactBtn.style.display = "inline-flex";
    noticeBtn.style.display = "none";
    winnerHint.textContent = "Username ရှိပါတယ် → Telegram ကို တန်းဆက်သွယ်နိုင်ပါတယ်";
  } else {
    contactBtn.style.display = "none";
    noticeBtn.style.display = "inline-flex";
    winnerHint.textContent = "Username မရှိပါ → Notice(DM) နှိပ်ပြီး Bot က DM ပို့ပါ";
  }

  winnerModal.classList.remove("hidden");
  winnerModal.setAttribute("aria-hidden", "false");
}

function hideWinnerModal() {
  winnerModal.classList.add("hidden");
  winnerModal.setAttribute("aria-hidden", "true");
}

/* =========================
   MEMBERS
========================= */

function renderMembers(list, fromCache = false) {
  const arr = Array.isArray(list) ? list.slice() : [];
  membersTotalText.textContent = arr.length ? ` • Total: ${arr.length}${fromCache ? " (cache)" : ""}` : "";

  if (!arr.length) {
    membersTable.innerHTML = `<div class="small">No members</div>`;
    return;
  }

  arr.sort((a, b) => (b.active === true) - (a.active === true));

  membersTable.innerHTML = arr.map((m) => {
    const username = String(m?.username || "").replace(/^@+/, "").trim();
    const uid = String(m?.id || "").trim();
    const display = winnerDisplay(m);

    return `
      <div class="winner-row">
        <div class="winner-main">
          <div class="winner-prize">${esc(display)}</div>
          <div class="winner-meta">
            ID: ${esc(uid)} • ${m.active ? "ACTIVE" : "INACTIVE"} • DM: ${m.dm_ready ? "READY" : "OFF"}
          </div>
        </div>
        <div class="winner-actions">
          ${
            username
              ? `<button class="btn mini" data-act="tg" data-user="${esc(username)}">Telegram</button>`
              : `<button class="btn mini" data-act="notice" data-uid="${esc(uid)}">Notice</button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

async function refreshMembers() {
  setBusy(membersBtn, true, "Members...");
  try {
    const res = await apiGet("/members", 15000);
    if (!res?.ok) throw new Error(res?.error || "members_error");
    const list = Array.isArray(res.members) ? res.members : [];
    cacheWrite(LS_CACHE_MEMBERS, list);
    renderMembers(list, false);
  } catch (e) {
    const cache = cacheRead(LS_CACHE_MEMBERS);
    if (Array.isArray(cache) && cache.length) {
      renderMembers(cache, true);
    } else {
      membersTable.innerHTML = `<div class="small">Members error: ${esc(e?.message || e)}</div>`;
    }
  } finally {
    setBusy(membersBtn, false);
  }
}

/* =========================
   WINNERS
========================= */

function renderWinners(list) {
  const arr = Array.isArray(list) ? list : [];
  winnersTotalText.textContent = arr.length ? ` • Total: ${arr.length}` : "";

  if (!arr.length) {
    winnersList.innerHTML = `<div class="small">No winners yet</div>`;
    return;
  }

  winnersList.innerHTML = arr.map((w) => {
    const username = String(w.username || "").replace(/^@+/, "").trim();
    const doneText = w.done ? "Done ✅" : "Prize Done";
    const doneClass = w.done ? "success" : "";

    return `
      <div class="winner-row">
        <div class="winner-main">
          <div class="winner-prize">#${esc(String(w.turn))} • ${esc(String(w.prize || "-"))}</div>
          <div class="winner-meta">${esc(String(w.display || w.name || w.user_id || "-"))}</div>
        </div>
        <div class="winner-actions">
          <button class="btn mini ${doneClass}" data-act="done" data-id="${esc(String(w.user_id))}">
            ${doneText}
          </button>
          ${
            username
              ? `<button class="btn mini" data-act="tg" data-user="${esc(username)}">Telegram</button>`
              : `<button class="btn mini" data-act="notice" data-id="${esc(String(w.user_id))}" data-prize="${esc(String(w.prize || ""))}">Notice</button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

async function refreshWinners() {
  setBusy(winnersBtn, true, "Winners...");
  try {
    const res = await apiGet("/winners", 15000);
    if (!res?.ok) throw new Error(res?.error || "winners_error");
    const list = Array.isArray(res.winners) ? res.winners : [];
    cacheWrite(LS_CACHE_WINNERS, list);
    renderWinners(list);
  } catch (e) {
    const cache = cacheRead(LS_CACHE_WINNERS);
    if (Array.isArray(cache) && cache.length) {
      renderWinners(cache);
    } else {
      winnersList.innerHTML = `<div class="small">Winners error: ${esc(e?.message || e)}</div>`;
    }
  } finally {
    setBusy(winnersBtn, false);
  }
}

/* =========================
   SPIN / POOL / RESET
========================= */

async function refreshPool() {
  const res = await apiGet("/pool", 12000);
  if (!res?.ok) {
    poolText.textContent = "-";
    return;
  }
  poolText.textContent = String(res.pool ?? "-");
}

async function refreshHealth() {
  await apiGet("/health", 12000);
}

async function doSpin() {
  if (spinning) return;
  if (!wheelPrizes.length) {
    alert("Prize မရှိသေးပါ");
    return;
  }

  spinning = true;
  setBusy(spinBtn, true, "SPIN...");

  try {
    const res = await apiPost("/spin", {}, 15000);
    if (!res?.ok) throw new Error(res?.error || "spin_error");

    const prize = String(res.prize || "");
    const winner = res.winner || {};

    let idx = findPrizeIndex(prize);
    if (idx < 0) {
      buildWheelPrizes();
      drawWheel();
      idx = findPrizeIndex(prize);
    }
    if (idx < 0) idx = Math.floor(Math.random() * wheelPrizes.length);

    const target = calcTargetAngle(idx);
    await animateSpin(target, 3200);

    showWinnerModal(prize, winner, res.turn);
    refreshPool();
    refreshWinners();

  } catch (e) {
    alert("Spin error: " + (e?.message || e));
  } finally {
    spinning = false;
    setBusy(spinBtn, false);
  }
}

async function doReset() {
  if (!confirm("Restart spin / reset winners ?")) return;
  setBusy(restartSpinBtn, true, "Restarting...");
  try {
    const r = await apiPost("/event/reset", {}, 15000);
    if (!r?.ok) throw new Error(r?.error || "reset_error");
    await refreshPool();
    await refreshWinners();
    hideWinnerModal();
    alert("✅ Spin reset complete");
  } catch (e) {
    alert("Reset error: " + (e?.message || e));
  } finally {
    setBusy(restartSpinBtn, false);
  }
}

/* =========================
   EVENTS
========================= */

settingsBtn.addEventListener("click", openDrawer);
closeSettingsBtn.addEventListener("click", closeDrawer);

saveBtn.addEventListener("click", () => {
  readSettingsFromInputs();
  closeDrawer();
  alert("✅ Saved");
});

resetBtn.addEventListener("click", resetAllSettings);

musicBtn.addEventListener("click", async () => {
  if (musicOn) stopMusic();
  else await playMusic();
});

spinBtn.addEventListener("click", doSpin);
restartSpinBtn.addEventListener("click", doReset);

membersBtn.addEventListener("click", async () => {
  membersPanel.classList.remove("hidden");
  winnersPanel.classList.add("hidden");

  const cache = cacheRead(LS_CACHE_MEMBERS);
  if (Array.isArray(cache) && cache.length) renderMembers(cache, true);
  else membersTable.innerHTML = `<div class="small">Loading members...</div>`;

  await refreshMembers();
});

membersCloseBtn.addEventListener("click", () => {
  membersPanel.classList.add("hidden");
});

winnersBtn.addEventListener("click", async () => {
  winnersPanel.classList.remove("hidden");
  membersPanel.classList.add("hidden");

  const cache = cacheRead(LS_CACHE_WINNERS);
  if (Array.isArray(cache) && cache.length) renderWinners(cache);
  else winnersList.innerHTML = `<div class="small">Loading winners...</div>`;

  await refreshWinners();
});

winnersCloseBtn.addEventListener("click", () => {
  winnersPanel.classList.add("hidden");
});

winnerCloseBtn.addEventListener("click", hideWinnerModal);
winnerBackdrop.addEventListener("click", hideWinnerModal);

contactBtn.addEventListener("click", () => {
  if (!lastWinner) return;
  const user = String(lastWinner.winner?.username || "").replace(/^@+/, "").trim();
  if (!user) return;
  window.open(`https://t.me/${user}`, "_blank");
});

noticeBtn.addEventListener("click", async () => {
  if (!lastWinner) return;
  const uid = String(lastWinner.winner?.id || "");
  if (!uid) return;

  setBusy(noticeBtn, true, "Sending...");
  try {
    const r = await apiPost("/notice", {
      user_id: uid,
      prize: String(lastWinner.prize || "")
    }, 15000);

    if (!r?.ok) throw new Error(r?.error || "notice_failed");
    alert("✅ Notice DM ပို့ပြီးပါပြီ");
  } catch (e) {
    alert("Notice error: " + (e?.message || e));
  } finally {
    setBusy(noticeBtn, false);
  }
});

membersTable.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;

  const act = b.dataset.act;

  if (act === "tg") {
    const user = String(b.dataset.user || "").replace(/^@+/, "").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  if (act === "notice") {
    const uid = String(b.dataset.uid || "");
    if (!uid) return;

    setBusy(b, true, "Sending...");
    try {
      const r = await apiPost("/notice", { user_id: uid, prize: "" }, 15000);
      if (!r?.ok) throw new Error(r?.error || "notice_failed");
      alert("✅ Notice DM ပို့ပြီးပါပြီ");
    } catch (e2) {
      alert("Notice error: " + (e2?.message || e2));
    } finally {
      setBusy(b, false);
    }
  }
});

winnersList.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;

  const act = b.dataset.act;

  if (act === "tg") {
    const user = String(b.dataset.user || "").replace(/^@+/, "").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  if (act === "notice") {
    const uid = String(b.dataset.id || "");
    const prize = String(b.dataset.prize || "");
    if (!uid) return;

    setBusy(b, true, "Sending...");
    try {
      const r = await apiPost("/notice", { user_id: uid, prize }, 15000);
      if (!r?.ok) throw new Error(r?.error || "notice_failed");
      alert("✅ Notice DM ပို့ပြီးပါပြီ");
    } catch (e2) {
      alert("Notice error: " + (e2?.message || e2));
    } finally {
      setBusy(b, false);
    }
    return;
  }

  if (act === "done") {
    const uid = String(b.dataset.id || "");
    if (!uid) return;

    setBusy(b, true, "Saving...");
    try {
      const r = await apiPost("/winner/done", { user_id: uid }, 15000);
      if (!r?.ok) throw new Error(r?.error || "done_failed");
      await refreshWinners();
    } catch (e2) {
      alert("Done update error: " + (e2?.message || e2));
    } finally {
      setBusy(b, false);
    }
  }
});

/* =========================
   INIT
========================= */

applySettingsUI();
renderPrizeBuilder();
buildWheelPrizes();
drawWheel();
refreshHealth();
refreshPool();