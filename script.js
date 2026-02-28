"use strict";

/* ===========================
   HARD DEFAULTS (you can change in Settings)
=========================== */
const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY = "Lucky77_luckywheel_77";

/* ===========================
   DOM
=========================== */
const wheelCanvas = document.getElementById("wheel");
const ctx = wheelCanvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const nextPrizeText = document.getElementById("nextPrizeText");
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
const bgSongFile = document.getElementById("bgSongFile");

const topBannerImg = document.getElementById("topBannerImg");
const bottomBannerImg = document.getElementById("bottomBannerImg");
const topBannerFallback = document.getElementById("topBannerFallback");
const bottomBannerFallback = document.getElementById("bottomBannerFallback");

const bgLayer = document.getElementById("bgLayer");
const wheelWrap = document.getElementById("wheelWrap");

const restartSpinBtn = document.getElementById("restartSpinBtn");
const membersBtn = document.getElementById("membersBtn");
const historyBtn = document.getElementById("historyBtn");

const membersPanel = document.getElementById("membersPanel");
const membersCloseBtn = document.getElementById("membersCloseBtn");
const membersTable = document.getElementById("membersTable");

const historyPanel = document.getElementById("historyPanel");
const historyCloseBtn = document.getElementById("historyCloseBtn");
const historyList = document.getElementById("historyList");

const musicBtn = document.getElementById("musicBtn");
const bgMusic = new Audio();
bgMusic.loop = true;
bgMusic.volume = 0.55;
let musicOn = false;

const refreshMembersInSettingsBtn = document.getElementById(
  "refreshMembersInSettingsBtn"
);
const membersInSettings = document.getElementById("membersInSettings");

/* ✅ Winner Modal DOM */
const winnerModal = document.getElementById("winnerModal");
const modalPrizeTitle = document.getElementById("modalPrizeTitle");
const modalWinnerName = document.getElementById("modalWinnerName");
const modalWinnerSub = document.getElementById("modalWinnerSub");
const modalTelegramBtn = document.getElementById("modalTelegramBtn");
const modalNoticeBtn = document.getElementById("modalNoticeBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalHint = document.getElementById("modalHint");

/* ===========================
   Storage
=========================== */
const STORAGE_KEY = "lucky77_codepen_pro_v1";

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
  bottomBannerDataUrl: ""
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultSettings);
    const data = JSON.parse(raw);
    return { ...structuredClone(defaultSettings), ...data };
  } catch {
    return structuredClone(defaultSettings);
  }
}
function saveSettingsLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

/* ===========================
   Music
=========================== */
function updateMusicBtn() {
  musicBtn.textContent = musicOn ? "🎵 Music: ON" : "🎵 Music: OFF";
  musicBtn.classList.toggle("primary", musicOn);
}
musicBtn.addEventListener("click", async () => {
  musicOn = !musicOn;
  if (musicOn) {
    if (bgMusic.src) {
      try {
        await bgMusic.play();
      } catch {}
    } else {
      alert("Settings ထဲမှာ MP3 Upload လုပ်ပါ");
      musicOn = false;
    }
  } else {
    bgMusic.pause();
  }
  updateMusicBtn();
});

// tick sound (WebAudio)
let audioCtx = null;
function tickSound(freq = 900, dur = 0.02, gain = 0.06) {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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

/* ===========================
   Drawer
=========================== */
function openSettings() {
  drawer.classList.add("open");
}
function closeSettings() {
  drawer.classList.remove("open");
}

settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);

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

async function apiGet(path) {
  const base = getApiBase();
  const key = getApiKey();
  const r = await fetch(`${base}${path}?key=${encodeURIComponent(key)}`);
  return r.json();
}
async function apiPost(path, body) {
  const base = getApiBase();
  const key = getApiKey();
  const r = await fetch(`${base}${path}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body || {})
  });
  return r.json();
}

/* ===========================
   Prize Builder (Stepper)
=========================== */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function buildPrizeText(prizesArr) {
  return prizesArr
    .filter((p) => p && String(p.name || "").trim())
    .map(
      (p) =>
        `${String(p.name).trim()} ${clamp(Number(p.times || 1), 1, 9999)}time`
    )
    .join("\n");
}

function renderPrizeBuilder(prizesArr) {
  prizeBuilder.innerHTML = "";

  prizesArr.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "prize-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="pname">Prize</div>
      <input data-k="name" data-i="${idx}" value="${esc(
      p.name || ""
    )}" placeholder="10000Ks">
    `;

    const right = document.createElement("div");
    right.className = "stepper";
    right.innerHTML = `
      <button data-act="dec" data-i="${idx}">-</button>
      <input data-k="times" data-i="${idx}" type="number" min="1" max="9999" value="${clamp(
      Number(p.times || 1),
      1,
      9999
    )}">
      <button data-act="inc" data-i="${idx}">+</button>
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
    s.prizes.push({ name: "", times: 1 });
    saveSettingsLocal(s);
    renderPrizeBuilder(s.prizes);
  });
  prizeBuilder.appendChild(addBtn);

  prizeBuilder.querySelectorAll("button[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      const s = loadSettings();
      const cur = clamp(Number(s.prizes[i]?.times || 1), 1, 9999);
      s.prizes[i].times = clamp(cur + (act === "inc" ? 1 : -1), 1, 9999);
      saveSettingsLocal(s);
      renderPrizeBuilder(s.prizes);
    });
  });

  prizeBuilder.querySelectorAll("input[data-k]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = Number(inp.dataset.i);
      const k = String(inp.dataset.k);
      const s = loadSettings();
      if (!s.prizes[i]) return;
      if (k === "times")
        s.prizes[i].times = clamp(Number(inp.value || 1), 1, 9999);
      if (k === "name") s.prizes[i].name = String(inp.value || "");
      saveSettingsLocal(s);
    });
  });
}

/* ===========================
   ✅ Wheel prizes should be UNIQUE (no 3time/4time duplicates on wheel)
=========================== */
function uniquePrizeNames(prizesArr) {
  const seen = new Set();
  const out = [];
  (prizesArr || []).forEach((p) => {
    const name = String(p?.name || "").trim();
    if (!name) return;
    if (seen.has(name)) return;
    seen.add(name);
    out.push(name);
  });
  return out;
}
function nextPrizeLabelFromSettings(prizesArr) {
  const u = uniquePrizeNames(prizesArr);
  return u.length ? `${u[0]} Winner` : "-";
}

/* ===========================
   Wheel drawing
=========================== */
let wheelPrizes = [];
let sliceColors = [];
let currentAngle = 0;
let spinning = false;

function parseWheelColors(text) {
  const colors = String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return colors.length ? colors : ["#ffffff", "#f1f5ff"];
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

  const slice = (Math.PI * 2) / wheelPrizes.length;

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
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

    const c = sliceColors[i % sliceColors.length] || "#fff";
    ctx.fillStyle = c;
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
    ctx.fillText(wheelPrizes[i], radius - 18, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(214,178,94,0.45)";
  ctx.lineWidth = 5;
  ctx.stroke();
}

function getPointerPrize() {
  const slice = (Math.PI * 2) / wheelPrizes.length;
  let a = currentAngle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const pointerAngle = (Math.PI * 3) / 2;
  let index = Math.floor(
    ((pointerAngle - a + Math.PI * 2) % (Math.PI * 2)) / slice
  );
  index = index % wheelPrizes.length;
  return wheelPrizes[index];
}

/* ===========================
   ✅ Winner Popup Modal + Rules
   - Username ရှိ => Telegram button တစ်ခုပဲ
   - Username မရှိ => Notice button တစ်ခုပဲ
   - Spin ရပ်တာနဲ့ popup ချက်ချင်းပေါ် (Loading...)
=========================== */
let lastWinner = null;

function getDisplayWinner(w) {
  const name = String(w?.name || "").trim();
  const u = String(w?.username || "").replace("@", "").trim();
  if (name) return name;
  if (u) return `@${u}`;
  return String(w?.id || "-");
}

function openWinnerModal() {
  winnerModal.classList.remove("hidden");
}
function closeWinnerModal() {
  winnerModal.classList.add("hidden");
  lastWinner = null;
}
modalCloseBtn.addEventListener("click", closeWinnerModal);

// click outside close
winnerModal.addEventListener("click", (e) => {
  if (e.target === winnerModal) closeWinnerModal();
});

function showWinnerModalLoading(pointerPrize) {
  lastWinner = null;
  modalPrizeTitle.textContent = `${pointerPrize} Winner`;
  modalWinnerName.textContent = "Loading...";
  modalWinnerSub.textContent = "Please wait...";
  modalHint.textContent = "";

  modalTelegramBtn.style.display = "none";
  modalNoticeBtn.style.display = "none";

  openWinnerModal();
}

function buildCongratsTextMM(winnerDisplay, prize) {
  // user requested Burmese congrat message
  return (
`Congratulation 🥳🥳🥳ပါအကိုရှင့်
လက်ကီး77 ရဲ့ လစဉ်ဗလာမပါလက်ကီးဝှီး အစီစဉ်မှာ ယူနစ် ${prize} ကံထူးသွားပါတယ်ရှင့်☘️
ဂိမ်းယူနစ်လေး ထည့်ပေးဖို့ အကို့ဂိမ်းအကောင့်လေး ပို့ပေးပါရှင့်`
  );
}

function showWinnerModalFinal(prize, winnerObj) {
  lastWinner = { prize, winner: winnerObj };

  const display = getDisplayWinner(winnerObj);
  const u = String(winnerObj?.username || "").replace("@", "").trim();
  const hasUsername = !!u;

  modalPrizeTitle.textContent = `${prize} Winner`;
  modalWinnerName.textContent = display;

  const id = String(winnerObj?.id || "-");
  modalWinnerSub.textContent = hasUsername ? `@${u}  |  ID: ${id}` : `ID: ${id}`;

  // buttons
  if (hasUsername) {
    modalTelegramBtn.style.display = "inline-block";
    modalNoticeBtn.style.display = "none";
    modalHint.textContent = "✅ Username ရှိလို့ Telegram ကိုတန်းဖွင့်နိုင်ပါတယ်";
  } else {
    modalTelegramBtn.style.display = "none";
    modalNoticeBtn.style.display = "inline-block";
    modalHint.textContent = winnerObj?.dm_ready
      ? "✅ DM Enable ဖြစ်ပြီးသားပါ။ Notice နှိပ်ရင် DM ပို့မယ်"
      : "⚠️ DM Enable မဖြစ်သေးပါ (Start Bot Register လုပ်ရန်လိုပါသည်)";
  }

  winChime();
}

modalTelegramBtn.addEventListener("click", () => {
  if (!lastWinner) return;
  const u = String(lastWinner.winner?.username || "").replace("@", "").trim();
  if (!u) return;
  window.open(`https://t.me/${u}`, "_blank");
});

modalNoticeBtn.addEventListener("click", async () => {
  if (!lastWinner) return;
  const w = lastWinner.winner;
  const prize = lastWinner.prize;
  const disp = getDisplayWinner(w);

  const text = buildCongratsTextMM(disp, prize);

  try {
    const r = await apiPost("/notice", { user_id: w.id, text });
    if (!r?.ok) throw new Error(r?.error || "notice failed");
    if (r.dm_ok) alert("✅ DM ပို့ပြီးပါပြီ");
    else alert("⚠️ DM မပို့နိုင်သေးပါ။ User က Bot ကို Start မလုပ်သေးနိုင်ပါတယ်");
  } catch (e) {
    alert("Notice error: " + (e.message || e));
  }
});

/* ===========================
   Panels
=========================== */
function showMembersPanel() {
  membersPanel.classList.remove("hidden");
}
function hideMembersPanel() {
  membersPanel.classList.add("hidden");
}
membersCloseBtn.addEventListener("click", hideMembersPanel);

function showHistoryPanel() {
  historyPanel.classList.remove("hidden");
}
function hideHistoryPanel() {
  historyPanel.classList.add("hidden");
}
historyCloseBtn.addEventListener("click", hideHistoryPanel);

/* ===========================
   Member List UI
   ✅ faster feel: open panel immediately + loading + cache (30s)
=========================== */
let membersCache = { at: 0, data: null };

async function refreshPoolUI() {
  try {
    const data = await apiGet("/pool");
    if (!data?.ok) throw new Error(data?.error || "pool error");
    poolText.textContent = `${data.count || 0} people in pool`;
  } catch {
    poolText.textContent = "Pool: error";
  }
}

function actionButtonHTML(m) {
  const username = m.username ? String(m.username).replace("@", "") : "";
  const hasName = !!(m.name && String(m.name).trim());
  const idOnly = !username && !hasName;

  if (username) {
    return `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`;
  }
  // id-only => Notice
  if (idOnly || m.id) {
    return `<button class="btn mini js-notice"
              data-id="${esc(String(m.id))}"
              data-name="${esc(String(m.display || "-"))}">
              Notice
            </button>`;
  }
  return `<span class="small">-</span>`;
}

async function fetchMembersWithCache() {
  const now = Date.now();
  if (membersCache.data && now - membersCache.at < 30_000) return membersCache.data;
  const data = await apiGet("/members");
  membersCache = { at: now, data };
  return data;
}

async function loadMembersUI() {
  showMembersPanel();
  membersTable.innerHTML = `<div class="small">Loading members...</div>`;

  try {
    const data = await fetchMembersWithCache();
    if (!data?.ok) throw new Error(data?.error || "members error");

    const list = Array.isArray(data.members) ? data.members : [];
    const total = list.length;

    const rows = list
      .map((m, i) => {
        const username = m.username
          ? `@${String(m.username).replace("@", "")}`
          : "-";
        const won = m.isWinner ? "✅" : "";
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(m.display || "-")}</td>
          <td>${esc(username)}</td>
          <td>${esc(String(m.id || "-"))}</td>
          <td>${won}</td>
          <td>${actionButtonHTML(m)}</td>
        </tr>`;
      })
      .join("");

    membersTable.innerHTML = `
      <div class="small" style="margin-bottom:10px; font-weight:900;">
        ✅ Total Members: ${esc(String(total))}
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>No.</th><th>Name</th><th>Username</th><th>ID</th><th>Won</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">No members yet</td></tr>`}</tbody>
      </table>
    `;
  } catch (e) {
    membersTable.innerHTML = `<div class="small">Error: ${esc(
      e.message || e
    )}</div>`;
  }
}

async function loadMembersInSettings() {
  try {
    const data = await fetchMembersWithCache();
    if (!data?.ok) throw new Error(data?.error || "members error");
    const list = Array.isArray(data.members) ? data.members : [];
    membersInSettings.innerHTML = list.length
      ? list
          .map(
            (m, i) =>
              `${i + 1}. ${esc(m.display)} ${
                m.username ? `(@${esc(String(m.username).replace("@",""))})` : ""
              } [${esc(String(m.id))}]`
          )
          .join("<br>")
      : "No members yet";
  } catch (e) {
    membersInSettings.innerHTML = `Error: ${esc(e.message || e)}`;
  }
}

/* ===========================
   History UI
   ✅ Must show: Prize + Name + Username + ID + (Telegram OR Notice)
=========================== */
async function loadHistoryUI() {
  showHistoryPanel();
  historyList.innerHTML = `<div class="small">Loading history...</div>`;

  try {
    const data = await apiGet("/history");
    if (!data?.ok) throw new Error(data?.error || "history error");

    const list = Array.isArray(data.history) ? data.history : [];
    historyList.innerHTML = list.length
      ? list
          .map((h) => {
            const winnerObj = h?.winner ?? h?.member ?? h?.user ?? {};

            const prize =
              h?.prize ??
              h?.prize_name ??
              h?.prizeName ??
              h?.item ??
              "-";

            const id =
              winnerObj?.id ??
              h?.winner_id ??
              h?.user_id ??
              h?.id ??
              "";

            const name =
              String(winnerObj?.name || h?.winner_name || h?.name || "").trim();

            const usernameRaw =
              winnerObj?.username ??
              h?.winner_username ??
              h?.username ??
              "";

            const username = String(usernameRaw || "").replace("@", "").trim();

            const display = name
              ? name
              : username
                ? `@${username}`
                : String(id || "-");

            const at = h?.at ? new Date(h.at).toLocaleString() : "";

            const btn = username
              ? `<button class="btn mini js-telegram" data-user="${esc(username)}">Telegram</button>`
              : `<button class="btn mini js-notice"
                    data-id="${esc(String(id))}"
                    data-name="${esc(String(display))}"
                    data-prize="${esc(String(prize))}">
                    Notice
                  </button>`;

            return `
              <div style="padding:10px 0; border-bottom:1px solid rgba(16,19,24,0.10)">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                  <b>${esc(String(prize))}</b>
                  <span>${esc(String(display))}</span>
                  <span class="small">(${username ? "@" + esc(username) : "no username"})</span>
                  <span class="small">ID: ${esc(String(id || "-"))}</span>
                  ${btn}
                </div>
                <div style="font-size:12px; color:rgba(16,19,24,0.60); margin-top:6px;">
                  ${esc(String(at))}
                </div>
              </div>
            `;
          })
          .join("")
      : `<div class="small">No winners yet</div>`;
  } catch (e) {
    historyList.innerHTML = `<div class="small">Error: ${esc(
      e.message || e
    )}</div>`;
  }
}

membersBtn.addEventListener("click", loadMembersUI);
historyBtn.addEventListener("click", loadHistoryUI);
refreshMembersInSettingsBtn.addEventListener("click", async () => {
  // force refresh cache
  membersCache = { at: 0, data: null };
  await loadMembersInSettings();
});

/* ✅ Event Delegation for Buttons (Members + History) */
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
    const name = btn.dataset.name || "-";
    const prize = btn.dataset.prize || (lastWinner?.prize || "-");
    if (!userId) return;

    const text = buildCongratsTextMM(name, prize);

    try {
      const r = await apiPost("/notice", { user_id: userId, text });
      if (r?.dm_ok) alert("✅ DM ပို့ပြီးပါပြီ");
      else alert("⚠️ DM မပို့နိုင်သေးပါ");
    } catch (err) {
      alert("Notice error: " + (err.message || err));
    }
  }
});

/* ===========================
   Restart Spin
=========================== */
restartSpinBtn.addEventListener("click", async () => {
  try {
    const data = await apiPost("/restart-spin", {});
    if (!data?.ok) throw new Error(data?.error || "restart error");
    closeWinnerModal();
    await refreshPoolUI();
    // refresh cache too
    membersCache = { at: 0, data: null };
    await loadMembersInSettings();
    alert("Restart Spin ✅");
  } catch (e) {
    alert("Restart error: " + (e.message || e));
  }
});

/* ===========================
   Spin
   ✅ spin stops => show popup immediately (Loading...) then update from server
=========================== */
async function spin() {
  if (spinning) return;

  if (wheelPrizes.length < 2) {
    alert("Settings ထဲမှာ Prize (အနည်းဆုံး 2 ခု) ထည့်ပါ");
    return;
  }

  spinning = true;
  spinBtn.disabled = true;

  if (musicOn && bgMusic.src) bgMusic.play().catch(() => {});

  const extraSpins = 7 + Math.random() * 6;
  const finalAngle =
    currentAngle + extraSpins * Math.PI * 2 + Math.random() * Math.PI * 2;
  const duration = 3000; // ✅ 조금 faster
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
      const prizeFromWheel = getPointerPrize();

      // ✅ show popup immediately
      showWinnerModalLoading(prizeFromWheel);

      // server winner
      finalizeSpinFromServer(prizeFromWheel);
    }
  }
  requestAnimationFrame(animate);
}

async function finalizeSpinFromServer(pointerPrize) {
  try {
    const data = await apiPost("/spin", {});
    if (!data?.ok) throw new Error(data?.error || "spin error");

    const prize = data.prize || pointerPrize || "-";
    const winner = data.winner || {};

    showWinnerModalFinal(prize, winner);
    nextPrizeText.textContent = `${prize} Winner`;

    await refreshPoolUI();
    // refresh members cache (because winner status changed)
    membersCache = { at: 0, data: null };
    await loadMembersInSettings();
  } catch (e) {
    alert("Spin error: " + (e.message || e));
    closeWinnerModal();
  } finally {
    spinning = false;
    spinBtn.disabled = false;
  }
}

spinBtn.addEventListener("click", spin);

/* ===========================
   Save / Reset / Upload
=========================== */
async function pushPrizeConfigToRender(prizeText) {
  const r = await apiPost("/config/prizes", { prizeText });
  if (!r?.ok) throw new Error(r?.error || "config/prizes error");
  return r;
}

saveBtn.addEventListener("click", async () => {
  const s = loadSettings();

  s.apiBase = (apiBaseInput.value || DEFAULT_API_BASE).trim();
  s.apiKey = (apiKeyInput.value || DEFAULT_API_KEY).trim();

  s.uiColor = uiColorInput.value || "#ffffff";
  s.wheelAccent = wheelAccentInput.value || "#d6b25e";
  s.wheelColorsText = wheelColorsInput.value || defaultSettings.wheelColorsText;

  saveSettingsLocal(s);

  applyThemeUI(s.uiColor, s.wheelAccent);

  sliceColors = parseWheelColors(s.wheelColorsText);

  const prizeText = buildPrizeText(s.prizes);

  // ✅ Wheel only unique prizes
  wheelPrizes = uniquePrizeNames(s.prizes);

  drawWheel();
  nextPrizeText.textContent = nextPrizeLabelFromSettings(s.prizes);

  closeSettings();

  try {
    await pushPrizeConfigToRender(prizeText); // ✅ keep times for server bag
    await refreshPoolUI();
    membersCache = { at: 0, data: null };
    await loadMembersInSettings();
  } catch (e) {
    alert("Save to Render error: " + (e.message || e));
  }
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset settings လုပ်မလား?")) return;
  saveSettingsLocal(structuredClone(defaultSettings));
  init();
  alert("Reset done ✅");
});

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

bgSongFile.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  bgMusic.src = url;
  if (musicOn) bgMusic.play().catch(() => {});
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
  applyBanner(
    s.bottomBannerDataUrl || "",
    bottomBannerImg,
    bottomBannerFallback
  );

  renderPrizeBuilder(s.prizes || structuredClone(defaultSettings.prizes));

  sliceColors = parseWheelColors(s.wheelColorsText);

  // ✅ Wheel only unique prizes
  wheelPrizes = uniquePrizeNames(s.prizes || []);
  drawWheel();

  nextPrizeText.textContent = nextPrizeLabelFromSettings(s.prizes);

  updateMusicBtn();

  refreshPoolUI();
  loadMembersInSettings();
}

init();

/* ===========================
   Utils
=========================== */
function esc(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}