const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot.onrender.com",
  API_KEY: "Lucky77_luckywheel_77",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "v6",
};

const SETTINGS_KEY = "lucky77_premium_settings_v6";

const defaultSettings = {
  theme: "white",
  bannerTitle: "Lucky77 Event",
  bannerSub: "Spin & Win premium prizes",
  topLogo: "",
  wheelLogo: "",
  musicDataUrl: "",
  musicOn: false,
};

const state = {
  health: null,
  members: [],
  winners: [],
  history: [],
  pool: { count: 0, ids: [] },
  scan: { status: "idle", summary: null, last_scan_at: "" },
  spinning: false,
  wheelDeg: 0,
  prizes: [],
};

const el = {
  serverTimeText: document.getElementById("serverTimeText"),
  healthBadge: document.getElementById("healthBadge"),
  statMembers: document.getElementById("statMembers"),
  statPool: document.getElementById("statPool"),
  statWinners: document.getElementById("statWinners"),
  statPrizes: document.getElementById("statPrizes"),

  scanStatusBadge: document.getElementById("scanStatusBadge"),
  scanSummaryText: document.getElementById("scanSummaryText"),
  scanBtn: document.getElementById("scanBtn"),

  wheelCanvas: document.getElementById("wheelCanvas"),
  spinBtn: document.getElementById("spinBtn"),
  restartBtn: document.getElementById("restartBtn"),
  refreshBtn: document.getElementById("refreshBtn"),

  winnerFlash: document.getElementById("winnerFlash"),
  winnerFlashName: document.getElementById("winnerFlashName"),
  winnerFlashPrize: document.getElementById("winnerFlashPrize"),
  poolEmptyText: document.getElementById("poolEmptyText"),

  prizeText: document.getElementById("prizeText"),
  savePrizeBtn: document.getElementById("savePrizeBtn"),

  searchInput: document.getElementById("searchInput"),
  showRemovedToggle: document.getElementById("showRemovedToggle"),

  memberList: document.getElementById("memberList"),
  winnerList: document.getElementById("winnerList"),
  historyList: document.getElementById("historyList"),

  membersCountText: document.getElementById("membersCountText"),
  winnersCountText: document.getElementById("winnersCountText"),
  historyCountText: document.getElementById("historyCountText"),

  toast: document.getElementById("toast"),

  settingsBtn: document.getElementById("settingsBtn"),
  settingsDrawer: document.getElementById("settingsDrawer"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsCloseBtn: document.getElementById("settingsCloseBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),

  themeSelect: document.getElementById("themeSelect"),
  bannerTitleInput: document.getElementById("bannerTitleInput"),
  bannerSubInput: document.getElementById("bannerSubInput"),
  bannerTitleText: document.getElementById("bannerTitleText"),
  bannerSubText: document.getElementById("bannerSubText"),

  topLogoInput: document.getElementById("topLogoInput"),
  wheelLogoInput: document.getElementById("wheelLogoInput"),
  brandLogoImg: document.getElementById("brandLogoImg"),
  brandLogoFallback: document.getElementById("brandLogoFallback"),
  wheelCenterLogoImg: document.getElementById("wheelCenterLogoImg"),
  wheelCenterFallback: document.getElementById("wheelCenterFallback"),

  musicFileInput: document.getElementById("musicFileInput"),
  musicOnBtn: document.getElementById("musicOnBtn"),
  musicOffBtn: document.getElementById("musicOffBtn"),
  bgMusicPlayer: document.getElementById("bgMusicPlayer"),

  exportHistoryBtn: document.getElementById("exportHistoryBtn"),

  winnerPopup: document.getElementById("winnerPopup"),
  winnerPopupBackdrop: document.getElementById("winnerPopupBackdrop"),
  winnerPopupName: document.getElementById("winnerPopupName"),
  winnerPopupPrize: document.getElementById("winnerPopupPrize"),
  winnerPopupCloseBtn: document.getElementById("winnerPopupCloseBtn"),
  confettiLayer: document.getElementById("confettiLayer"),

  quickMenuBtn: document.getElementById("quickMenuBtn"),
  quickMenuDrawer: document.getElementById("quickMenuDrawer"),
  quickMenuBackdrop: document.getElementById("quickMenuBackdrop"),
  quickMenuCloseBtn: document.getElementById("quickMenuCloseBtn"),
};

const wheelCtx = el.wheelCanvas ? el.wheelCanvas.getContext("2d") : null;
let settings = loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function setPill(node, text, type) {
  if (!node) return;
  node.textContent = text;
  node.className = `pill ${type}`;
}

function showToast(message, type = "normal") {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");

  if (type === "error") {
    el.toast.style.borderColor = "rgba(224,79,106,0.35)";
  } else if (type === "success") {
    el.toast.style.borderColor = "rgba(27,179,107,0.35)";
  } else {
    el.toast.style.borderColor = "rgba(0,0,0,0.08)";
  }

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    el.toast.classList.add("hidden");
  }, 2600);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  const separator = path.includes("?") ? "&" : "?";
  const url = `${CONFIG.BASE_URL}${path}${separator}_=${Date.now()}&v=${encodeURIComponent(CONFIG.CACHE_BUSTER)}`;

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "x-api-key": CONFIG.API_KEY,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...(options.method && options.method !== "GET"
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Request timeout");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parsePrizeLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m =
        line.match(/^(.+?)\s+(\d+)\s*time$/i) ||
        line.match(/^(.+?)\s+(\d+)$/i);
      if (!m) return null;
      return { name: m[1].trim(), times: Number(m[2]) || 1 };
    })
    .filter(Boolean);
}

function buildWheelPrizeSegments() {
  if (!el.prizeText) return;
  const parsed = parsePrizeLines(el.prizeText.value);
  const names = parsed.map((p) => p.name).filter(Boolean);
  state.prizes = names.length ? names : ["10000Ks", "20000Ks", "30000Ks", "Lucky", "Prize", "Spin"];
}

function drawWheel() {
  if (!el.wheelCanvas || !wheelCtx) return;

  const canvas = el.wheelCanvas;
  const ctx = wheelCtx;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 8;

  ctx.clearRect(0, 0, w, h);

  const prizes = state.prizes.length ? state.prizes : ["Lucky77"];
  const count = prizes.length;
  const anglePer = (Math.PI * 2) / count;

  const colors = [
    "#ff5f6d", "#ffc371", "#23d5ab", "#23a6d5", "#8b5dff",
    "#ff4fd8", "#1bb36b", "#ffd166", "#7b5cff", "#18d2ff",
  ];

  for (let i = 0; i < count; i++) {
    const start = -Math.PI / 2 + i * anglePer;
    const end = start + anglePer;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + anglePer / 2);

    const text = prizes[i];
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 23px Inter, sans-serif";

    const maxWidth = radius * 0.48;
    let shown = text;
    while (ctx.measureText(shown).width > maxWidth && shown.length > 6) {
      shown = shown.slice(0, -1);
    }
    if (shown !== text) shown = shown.slice(0, -1) + "…";

    ctx.fillText(shown, radius - 34, 8);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function getPrizeIndexByName(prizeName) {
  return state.prizes.findIndex(
    (name) => String(name).trim() === String(prizeName).trim()
  );
}

function computeTargetRotationDeg(prizeName) {
  const count = state.prizes.length || 1;
  const idx = getPrizeIndexByName(prizeName);
  const safeIdx = idx >= 0 ? idx : 0;

  const slice = 360 / count;
  const sliceCenter = safeIdx * slice + slice / 2;
  let target = 360 - sliceCenter;

  while (target < 0) target += 360;
  while (target >= 360) target -= 360;

  return target;
}

async function loadHealth() {
  state.health = await api("/health");
}

async function loadPrizeConfig() {
  const data = await api("/config");
  if (data?.prize_source && String(data.prize_source).trim() && el.prizeText) {
    el.prizeText.value = String(data.prize_source).trim();
  }
}

async function loadMembers() {
  const includeRemoved = el.showRemovedToggle?.checked ? "1" : "0";
  const data = await api(`/members?include_removed=${includeRemoved}&backfill=0`);
  state.members = Array.isArray(data.members) ? data.members : [];
}

async function loadWinners() {
  const data = await api("/winners");
  state.winners = Array.isArray(data.winners) ? data.winners : [];
}

async function loadHistory() {
  const data = await api("/history");
  state.history = Array.isArray(data.history) ? data.history : [];
}

async function loadPool() {
  const data = await api("/pool");
  state.pool = {
    count: Number(data.count || 0),
    ids: Array.isArray(data.ids) ? data.ids : [],
  };
}

async function loadScanStatus() {
  const data = await api("/scan/status");
  state.scan = {
    status: data.status || "idle",
    summary: data.summary || null,
    last_scan_at: data.last_scan_at || "",
  };
}

async function firstLoad() {
  await loadHealth().catch(() => { state.health = null; });
  await loadPrizeConfig().catch(() => {});
  await loadMembers().catch(() => { state.members = []; });
  await loadWinners().catch(() => { state.winners = []; });
  await loadHistory().catch(() => { state.history = []; });
  await loadPool().catch(() => { state.pool = { count: 0, ids: [] }; });
  await loadScanStatus().catch(() => {
    state.scan = { status: "idle", summary: null, last_scan_at: "" };
  });

  buildWheelPrizeSegments();
  drawWheel();
  renderAll();
}

async function refreshAllData() {
  await loadHealth().catch(() => {});
  await loadPrizeConfig().catch(() => {});
  await loadMembers().catch(() => {});
  await loadWinners().catch(() => {});
  await loadHistory().catch(() => {});
  await loadPool().catch(() => {});
  await loadScanStatus().catch(() => {});
  buildWheelPrizeSegments();
  drawWheel();
  renderAll();
}

async function refreshAfterScan() {
  await loadScanStatus().catch(() => {});
  await loadMembers().catch(() => {});
  await loadPool().catch(() => {});
  await loadHealth().catch(() => {});
  renderAll();
}

async function refreshAfterSpin() {
  await loadWinners().catch(() => {});
  await loadHistory().catch(() => {});
  await loadPool().catch(() => {});
  await loadHealth().catch(() => {});
  renderAll();
}

async function refreshAfterWinnerAction() {
  await loadWinners().catch(() => {});
  renderWinners();
}

function renderHealth() {
  const h = state.health || {};
  const poolCount = Number(state.pool?.count || h.pool || 0);

  if (el.statMembers) el.statMembers.textContent = h.members ?? 0;
  if (el.statPool) el.statPool.textContent = poolCount;
  if (el.statWinners) el.statWinners.textContent = h.winners ?? 0;
  if (el.statPrizes) el.statPrizes.textContent = h.remaining_prizes ?? 0;

  if (el.serverTimeText) {
    el.serverTimeText.textContent = h.time ? `Server: ${formatTime(h.time)}` : "Connected";
  }

  if (h.scan_status === "completed") setPill(el.healthBadge, "Healthy", "success");
  else if (h.scan_status === "scanning") setPill(el.healthBadge, "Scanning", "warning");
  else if (h.scan_status === "error") setPill(el.healthBadge, "Error", "danger");
  else setPill(el.healthBadge, "Live", "neutral");

  if (!el.poolEmptyText) return;
  if (poolCount <= 0) el.poolEmptyText.classList.remove("hidden");
  else el.poolEmptyText.classList.add("hidden");
}

function renderScan() {
  const s = state.scan || {};
  const summary = s.summary || null;

  if (s.status === "completed") setPill(el.scanStatusBadge, "completed", "success");
  else if (s.status === "scanning") setPill(el.scanStatusBadge, "scanning", "warning");
  else if (s.status === "error") setPill(el.scanStatusBadge, "error", "danger");
  else setPill(el.scanStatusBadge, "idle", "neutral");

  if (!el.scanSummaryText) return;
  if (summary) {
    el.scanSummaryText.textContent =
      `Active ${summary.active ?? 0} · Left ${summary.left ?? 0} · Pool ${summary.pool ?? 0}`;
  } else if (s.last_scan_at) {
    el.scanSummaryText.textContent = `Last scan ${formatTime(s.last_scan_at)}`;
  } else {
    el.scanSummaryText.textContent = "No scan yet";
  }
}

function renderMembers() {
  if (!el.memberList || !el.membersCountText) return;

  const q = (el.searchInput?.value || "").trim().toLowerCase();
  const showRemoved = !!el.showRemovedToggle?.checked;

  const filtered = (state.members || []).filter((m) => {
    if (!showRemoved && m.removed) return false;
    if (!q) return true;

    const blob = [m.display, m.name, m.username, m.id, m.left_reason]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });

  el.membersCountText.textContent = `${filtered.length} users`;

  if (!filtered.length) {
    el.memberList.innerHTML = `<div class="empty">No members found</div>`;
    return;
  }

  el.memberList.innerHTML = filtered.map((m) => {
    const statusText = m.removed ? "removed" : m.active ? "active" : "left";
    const statusClass = m.removed ? "removed" : m.active ? "active" : "left";

    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(m.display || m.id)}</div>
            <div class="item-sub">
              ID: ${escapeHtml(m.id)} · ${m.username ? "@" + escapeHtml(m.username) : "no username"}
            </div>
          </div>
          <div class="badge ${statusClass}">${escapeHtml(statusText)}</div>
        </div>

        <div class="badges">
          ${m.isWinner ? `<span class="badge winner">winner</span>` : ""}
          ${m.dm_ready ? `<span class="badge active">dm ready</span>` : `<span class="badge left">dm off</span>`}
          ${m.registered_at ? `<span class="badge">reg ${escapeHtml(formatTime(m.registered_at))}</span>` : ""}
          ${m.left_at ? `<span class="badge">left ${escapeHtml(formatTime(m.left_at))}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderWinners() {
  if (!el.winnerList || !el.winnersCountText) return;

  const winners = state.winners || [];
  el.winnersCountText.textContent = `${winners.length} winners`;

  if (!winners.length) {
    el.winnerList.innerHTML = `<div class="empty">No winners yet</div>`;
    return;
  }

  el.winnerList.innerHTML = winners.map((w) => {
    const username = String(w.username || "").replace(/^@+/, "");

    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">#${escapeHtml(w.turn)} · ${escapeHtml(w.display || w.user_id)}</div>
            <div class="item-sub">
              Prize: ${escapeHtml(w.prize || "-")} · ${escapeHtml(formatTime(w.at))}
            </div>
          </div>
          <div class="badge ${w.done ? "active" : "left"}">${w.done ? "done" : "pending"}</div>
        </div>

        <div class="badges">
          ${w.notice_sent ? `<span class="badge active">notice sent</span>` : `<span class="badge left">notice pending</span>`}
          ${username ? `<span class="badge">@${escapeHtml(username)}</span>` : ""}
          ${w.done_at ? `<span class="badge">done ${escapeHtml(formatTime(w.done_at))}</span>` : ""}
        </div>

        <div class="item-actions">
          ${username ? `<button class="small-btn telegram" data-tg-user="${escapeHtml(username)}">Telegram</button>` : ""}
          <button class="small-btn notice" data-notice-user="${escapeHtml(w.user_id)}" data-notice-prize="${escapeHtml(w.prize || "")}">Notice</button>
          <button class="small-btn done" data-done-user="${escapeHtml(w.user_id)}">${w.done ? "Undo Done" : "Done"}</button>
        </div>
      </div>
    `;
  }).join("");

  bindWinnerActionButtons();
}

function renderHistory() {
  if (!el.historyList || !el.historyCountText) return;

  const history = state.history || [];
  el.historyCountText.textContent = `${history.length} logs`;

  if (!history.length) {
    el.historyList.innerHTML = `<div class="empty">No history yet</div>`;
    return;
  }

  el.historyList.innerHTML = history.map((h) => {
    const winnerDisplay =
      h?.winner?.display ||
      h?.winner?.name ||
      h?.winner?.username ||
      h?.winner?.id ||
      h?.display ||
      h?.user_id ||
      "-";

    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">#${escapeHtml(h.turn || "-")} · ${escapeHtml(winnerDisplay)}</div>
            <div class="item-sub">
              Prize: ${escapeHtml(h.prize || "-")} · ${escapeHtml(formatTime(h.at))}
            </div>
          </div>
          <div class="badge">history</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderHealth();
  renderScan();
  renderMembers();
  renderWinners();
  renderHistory();
}

function openSettings() {
  if (el.settingsDrawer) el.settingsDrawer.classList.add("open");
}

function closeSettings() {
  if (el.settingsDrawer) el.settingsDrawer.classList.remove("open");
}

function openQuickMenu() {
  if (el.quickMenuDrawer) el.quickMenuDrawer.classList.add("open");
}

function closeQuickMenu() {
  if (el.quickMenuDrawer) el.quickMenuDrawer.classList.remove("open");
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function applySettingsToUI() {
  document.documentElement.setAttribute("data-theme", settings.theme || "white");

  if (el.bannerTitleText) {
    el.bannerTitleText.textContent = settings.bannerTitle || defaultSettings.bannerTitle;
  }
  if (el.bannerSubText) {
    el.bannerSubText.textContent = settings.bannerSub || defaultSettings.bannerSub;
  }

  if (el.bannerTitleInput) el.bannerTitleInput.value = settings.bannerTitle || "";
  if (el.bannerSubInput) el.bannerSubInput.value = settings.bannerSub || "";
  if (el.themeSelect) el.themeSelect.value = settings.theme || "white";

  if (settings.topLogo && el.brandLogoImg && el.brandLogoFallback) {
    el.brandLogoImg.src = settings.topLogo;
    el.brandLogoImg.classList.remove("hidden");
    el.brandLogoFallback.classList.add("hidden");
  } else if (el.brandLogoImg && el.brandLogoFallback) {
    el.brandLogoImg.classList.add("hidden");
    el.brandLogoFallback.classList.remove("hidden");
  }

  if (settings.wheelLogo && el.wheelCenterLogoImg && el.wheelCenterFallback) {
    el.wheelCenterLogoImg.src = settings.wheelLogo;
    el.wheelCenterLogoImg.classList.remove("hidden");
    el.wheelCenterFallback.classList.add("hidden");
  } else if (el.wheelCenterLogoImg && el.wheelCenterFallback) {
    el.wheelCenterLogoImg.classList.add("hidden");
    el.wheelCenterFallback.classList.remove("hidden");
  }

  if (settings.musicDataUrl && el.bgMusicPlayer) {
    el.bgMusicPlayer.src = settings.musicDataUrl;
  }
}

function playWinnerTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1320, 1760];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.12;
      osc.start(start);
      osc.stop(start + 0.12);
    });
  } catch {}
}

function launchConfetti() {
  if (!el.confettiLayer) return;

  el.confettiLayer.innerHTML = "";
  const colors = ["#ff5a7d", "#ffd166", "#7b5cff", "#18d2ff", "#1bb36b", "#ff8fab"];
  const count = 70;

  for (let i = 0; i < count; i++) {
    const node = document.createElement("div");
    node.className = "confetti";
    node.style.left = `${Math.random() * 100}%`;
    node.style.background = colors[Math.floor(Math.random() * colors.length)];
    node.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
    node.style.animationDelay = `${Math.random() * 0.4}s`;
    node.style.transform = `rotate(${Math.random() * 180}deg)`;
    el.confettiLayer.appendChild(node);
  }

  setTimeout(() => {
    if (el.confettiLayer) el.confettiLayer.innerHTML = "";
  }, 4800);
}

function showWinnerPopup(name, prize) {
  if (el.winnerPopupName) el.winnerPopupName.textContent = name || "-";
  if (el.winnerPopupPrize) el.winnerPopupPrize.textContent = prize || "-";
  if (el.winnerPopup) el.winnerPopup.classList.remove("hidden");
  launchConfetti();
  playWinnerTone();
}

function hideWinnerPopup() {
  if (el.winnerPopup) el.winnerPopup.classList.add("hidden");
  if (el.confettiLayer) el.confettiLayer.innerHTML = "";
}

async function handleScan() {
  if (state.spinning) {
    showToast("Spin နေချိန် scan မလုပ်ရပါ", "error");
    return;
  }

  try {
    if (el.scanBtn) el.scanBtn.disabled = true;
    setPill(el.scanStatusBadge, "scanning", "warning");
    if (el.scanSummaryText) el.scanSummaryText.textContent = "Checking registered member IDs...";

    await api("/scan/members", {
      method: "POST",
      body: JSON.stringify({}),
    });

    await refreshAfterScan();
    showToast("Scan completed", "success");
  } catch (err) {
    showToast(err.message || "Scan failed", "error");
    await loadScanStatus().catch(() => {});
    renderScan();
  } finally {
    if (el.scanBtn) el.scanBtn.disabled = false;
  }
}

async function handleSpin() {
  if (state.spinning) return;

  try {
    if (Number(state.pool?.count || 0) <= 0) {
      showToast("No members left in pool", "error");
      return;
    }

    state.spinning = true;
    if (el.spinBtn) el.spinBtn.disabled = true;
    if (el.scanBtn) el.scanBtn.disabled = true;
    if (el.winnerFlash) el.winnerFlash.classList.add("hidden");

    buildWheelPrizeSegments();
    drawWheel();

    if (el.wheelCanvas) {
      el.wheelCanvas.style.transition = "transform 0.25s linear";
      state.wheelDeg += 40;
      el.wheelCanvas.style.transform = `rotate(${state.wheelDeg}deg)`;
    }

    const result = await api("/spin", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const winnerName = result?.winner?.display || result?.winner?.id || "Unknown";
    const prize = result?.prize || "—";

    const targetDeg = computeTargetRotationDeg(prize);
    const currentBase = state.wheelDeg % 360;
    let needed = targetDeg - currentBase;
    if (needed < 0) needed += 360;

    const extraRounds = 360 * (6 + Math.floor(Math.random() * 3));
    const finalDeg = state.wheelDeg + extraRounds + needed;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el.wheelCanvas) {
          el.wheelCanvas.style.transition =
            "transform 4.8s cubic-bezier(0.12, 0.8, 0.18, 1)";
          state.wheelDeg = finalDeg;
          el.wheelCanvas.style.transform = `rotate(${state.wheelDeg}deg)`;
        }
      });
    });

    setTimeout(async () => {
      if (el.winnerFlash) el.winnerFlash.classList.remove("hidden");
      if (el.winnerFlashName) el.winnerFlashName.textContent = winnerName;
      if (el.winnerFlashPrize) el.winnerFlashPrize.textContent = prize;

      showWinnerPopup(winnerName, prize);
      await refreshAfterSpin();
      showToast(`Winner: ${winnerName}`, "success");
    }, 4900);
  } catch (err) {
    showToast(err.message || "Spin failed", "error");
    await refreshAllData().catch(() => {});
  } finally {
    setTimeout(() => {
      state.spinning = false;
      if (el.spinBtn) el.spinBtn.disabled = false;
      if (el.scanBtn) el.scanBtn.disabled = false;
    }, 5200);
  }
}

async function handleSavePrize() {
  const prizeText = el.prizeText?.value.trim();
  if (!prizeText) {
    showToast("Prize text required", "error");
    return;
  }

  try {
    if (el.savePrizeBtn) el.savePrizeBtn.disabled = true;
    await api("/config/prizes", {
      method: "POST",
      body: JSON.stringify({ prizeText }),
    });

    await loadPrizeConfig().catch(() => {});
    buildWheelPrizeSegments();
    drawWheel();

    await loadHealth().catch(() => {});
    renderHealth();
    showToast("Prize bag saved", "success");
  } catch (err) {
    showToast(err.message || "Save prize failed", "error");
  } finally {
    if (el.savePrizeBtn) el.savePrizeBtn.disabled = false;
  }
}

async function handleRestart() {
  const ok = window.confirm("Restart event now?");
  if (!ok) return;

  try {
    if (el.restartBtn) el.restartBtn.disabled = true;
    await api("/restart-spin", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (el.winnerFlash) el.winnerFlash.classList.add("hidden");
    hideWinnerPopup();
    await refreshAllData();
    showToast("Event restarted", "success");
  } catch (err) {
    showToast(err.message || "Restart failed", "error");
  } finally {
    if (el.restartBtn) el.restartBtn.disabled = false;
  }
}

async function sendNotice(userId, prize) {
  try {
    const data = await api("/notice", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, prize }),
    });

    await refreshAfterWinnerAction();

    if (data.dm_ok === false) {
      showToast("DM failed", "error");
      return;
    }

    showToast("Notice sent", "success");
  } catch (err) {
    showToast(err.message || "Notice failed", "error");
  }
}

async function toggleDone(userId) {
  try {
    await api("/winner/done", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, toggle: true }),
    });

    await refreshAfterWinnerAction();
    showToast("Winner updated", "success");
  } catch (err) {
    showToast(err.message || "Done update failed", "error");
  }
}

function bindWinnerActionButtons() {
  document.querySelectorAll("[data-notice-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-notice-user");
      const prize = btn.getAttribute("data-notice-prize") || "";
      sendNotice(userId, prize);
    };
  });

  document.querySelectorAll("[data-done-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-done-user");
      toggleDone(userId);
    };
  });

  document.querySelectorAll("[data-tg-user]").forEach((btn) => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-tg-user");
      if (!username) return;
      window.open(`https://t.me/${username}`, "_blank");
    };
  });
}

function bindTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((p) => p.classList.toggle("active", p.id === `tab-${target}`));
    });
  });
}

function exportHistoryCsv() {
  const rows = [["Turn", "Winner", "Prize", "Time"]];

  (state.history || []).forEach((h) => {
    const winnerDisplay =
      h?.winner?.display ||
      h?.winner?.name ||
      h?.winner?.username ||
      h?.winner?.id ||
      h?.display ||
      h?.user_id ||
      "-";

    rows.push([
      String(h.turn || ""),
      String(winnerDisplay || ""),
      String(h.prize || ""),
      String(h.at || ""),
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lucky77-history.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  el.refreshBtn?.addEventListener("click", async () => {
    try {
      el.refreshBtn.disabled = true;
      await refreshAllData();
      showToast("Refreshed", "success");
    } catch (err) {
      showToast(err.message || "Refresh failed", "error");
    } finally {
      el.refreshBtn.disabled = false;
    }
  });

  el.scanBtn?.addEventListener("click", handleScan);
  el.spinBtn?.addEventListener("click", handleSpin);
  el.restartBtn?.addEventListener("click", handleRestart);
  el.savePrizeBtn?.addEventListener("click", handleSavePrize);

  el.searchInput?.addEventListener("input", renderMembers);

  el.showRemovedToggle?.addEventListener("change", async () => {
    await loadMembers().catch(() => {
      state.members = [];
    });
    renderMembers();
  });

  el.settingsBtn?.addEventListener("click", openSettings);
  el.settingsBackdrop?.addEventListener("click", closeSettings);
  el.settingsCloseBtn?.addEventListener("click", closeSettings);

  el.quickMenuBtn?.addEventListener("click", openQuickMenu);
  el.quickMenuBackdrop?.addEventListener("click", closeQuickMenu);
  el.quickMenuCloseBtn?.addEventListener("click", closeQuickMenu);

  document.querySelectorAll(".quick-link").forEach((link) => {
    link.addEventListener("click", () => closeQuickMenu());
  });

  el.saveSettingsBtn?.addEventListener("click", () => {
    settings.theme = el.themeSelect?.value || defaultSettings.theme;
    settings.bannerTitle = el.bannerTitleInput?.value.trim() || defaultSettings.bannerTitle;
    settings.bannerSub = el.bannerSubInput?.value.trim() || defaultSettings.bannerSub;

    persistSettings();
    applySettingsToUI();
    closeSettings();
    showToast("Settings saved", "success");
  });

  el.topLogoInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    settings.topLogo = await fileToDataUrl(file);
    persistSettings();
    applySettingsToUI();
    showToast("Top logo updated", "success");
  });

  el.wheelLogoInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    settings.wheelLogo = await fileToDataUrl(file);
    persistSettings();
    applySettingsToUI();
    showToast("Wheel logo updated", "success");
  });

  el.musicFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    settings.musicDataUrl = await fileToDataUrl(file);
    persistSettings();
    applySettingsToUI();
    showToast("Music uploaded", "success");
  });

  el.musicOnBtn?.addEventListener("click", async () => {
    if (!settings.musicDataUrl || !el.bgMusicPlayer) {
      showToast("Upload MP3 first", "error");
      return;
    }

    try {
      settings.musicOn = true;
      persistSettings();
      el.bgMusicPlayer.src = settings.musicDataUrl;
      el.bgMusicPlayer.loop = true;
      await el.bgMusicPlayer.play();
      showToast("Music ON", "success");
    } catch {
      showToast("Music play blocked", "error");
    }
  });

  el.musicOffBtn?.addEventListener("click", () => {
    settings.musicOn = false;
    persistSettings();
    el.bgMusicPlayer?.pause();
    showToast("Music OFF", "success");
  });

  el.exportHistoryBtn?.addEventListener("click", () => {
    exportHistoryCsv();
    showToast("History exported", "success");
  });

  el.winnerPopupBackdrop?.addEventListener("click", hideWinnerPopup);
  el.winnerPopupCloseBtn?.addEventListener("click", hideWinnerPopup);
}

(function resizeWheelCanvas() {
  if (!el.wheelCanvas) return;
  const size = 520;
  el.wheelCanvas.width = size;
  el.wheelCanvas.height = size;
})();

(async function init() {
  applySettingsToUI();
  bindTabs();
  bindEvents();
  buildWheelPrizeSegments();
  drawWheel();

  try {
    await firstLoad();
  } catch (err) {
    showToast(err.message || "Initial load failed", "error");
  }
})();
