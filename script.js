const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "full-polished-v1",
};

const SETTINGS_KEY = "lucky77_premium_settings_full_v1";

const defaultSettings = {
  theme: "white",
  bannerTitle: "Lucky77 Event",
  bannerSub: "Spin & Win premium prizes",
  topLogo: "",
  wheelLogo: "",
  musicDataUrl: "",
  musicOn: false,
  bgColor: "#f6f7fb",
  cardColor: "#ffffff",
  accent1: "#7b5cff",
  accent2: "#18d2ff",
  arrowColor: "#ffe6a8",
  spinDurationMs: 5600,
};

const state = {
  health: null,
  members: [],
  winners: [],
  history: [],
  pool: { count: 0, ids: [] },
  scan: { status: "idle", summary: null, last_scan_at: "" },
  event: { open: true, limit: 0, name: "Lucky77 Event", active_register_count: 0 },
  spinning: false,
  autoSpinning: false,
  autoSpinStopRequested: false,
  wheelDeg: 0,
  spinLoopTimer: null,
  tickTimer: null,
  audioCtx: null,
  autoCloseTimer: null,
  spinLoopDegStep: 18,
  prizes: [],
  currentSection: "wheel",
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
  autoSpinBtn: document.getElementById("autoSpinBtn"),
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
  bgColorInput: document.getElementById("bgColorInput"),
  cardColorInput: document.getElementById("cardColorInput"),
  accent1Input: document.getElementById("accent1Input"),
  accent2Input: document.getElementById("accent2Input"),
  arrowColorInput: document.getElementById("arrowColorInput"),

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
  eventOpenToggle: document.getElementById("eventOpenToggle"),
  eventNameInput: document.getElementById("eventNameInput"),
  eventLimitInput: document.getElementById("eventLimitInput"),
  eventStatusText: document.getElementById("eventStatusText"),
  saveEventBtn: document.getElementById("saveEventBtn"),
  backupExportBtn: document.getElementById("backupExportBtn"),
  backupRestoreInput: document.getElementById("backupRestoreInput"),
  backupRestoreBtn: document.getElementById("backupRestoreBtn"),

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

  wheelHomeSection: document.getElementById("wheelHomeSection"),
  liveDashboardSection: document.getElementById("liveDashboardSection"),
  prizeBuilderSection: document.getElementById("prizeBuilderSection"),
  listsSection: document.getElementById("listsSection"),
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

function getApiKey() {
  let key = sessionStorage.getItem("lucky77_admin_api_key") || "";
  if (!key) {
    key = window.prompt("Admin API key ááá·áºáá«") || "";
    key = key.trim();
    if (key) sessionStorage.setItem("lucky77_admin_api_key", key);
  }
  return key;
}

function forgetApiKey() {
  sessionStorage.removeItem("lucky77_admin_api_key");
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
        "x-api-key": getApiKey(),
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

    if (response.status === 401) {
      forgetApiKey();
      throw new Error("Unauthorized: API key áá¼ááºááá·áºáá«");
    }

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
  state.prizes = names.length
    ? names
    : ["10000Ks", "20000Ks", "30000Ks", "Lucky", "Prize", "Spin"];
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
    if (shown !== text) shown = shown.slice(0, -1) + "â¦";

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
  if (state.health?.event) {
    state.event = { ...state.event, ...state.health.event, active_register_count: Number(state.health.active_register_count || 0) };
  }
}

async function loadPrizeConfig() {
  const data = await api("/config");
  if (data?.prize_source && String(data.prize_source).trim() && el.prizeText) {
    el.prizeText.value = String(data.prize_source).trim();
  }
  if (data?.event) {
    state.event = { ...state.event, ...data.event, active_register_count: Number(data.active_register_count || 0) };
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
  try {
    await Promise.all([loadWinners(), loadHistory(), loadPool(), loadHealth()]);
  } catch (_) {
    // Optimistic UI already updated; keep controls fast if one refresh is slow.
  }

  renderAll();
}

async function refreshAfterWinnerAction() {
  await loadWinners().catch(() => {});
  await loadHistory().catch(() => {});
  renderWinners();
  renderHistory();
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

function renderEventControl() {
  const e = state.event || {};
  if (el.eventOpenToggle) el.eventOpenToggle.checked = e.open !== false;
  if (el.eventNameInput && document.activeElement !== el.eventNameInput) el.eventNameInput.value = e.name || "Lucky77 Event";
  if (el.eventLimitInput && document.activeElement !== el.eventLimitInput) el.eventLimitInput.value = Number(e.limit || 0);
  if (el.eventStatusText) {
    const count = Number(e.active_register_count || 0);
    const limit = Number(e.limit || 0);
    el.eventStatusText.textContent = `${e.open !== false ? "OPEN" : "CLOSED"} Â· Registered ${count}${limit ? ` / ${limit}` : ""} Â· Memory kept after event restart`;
  }
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
      `Active ${summary.active ?? 0} Â· Left ${summary.left ?? 0} Â· Needs Register ${summary.needs_register ?? 0} Â· Pool ${summary.pool ?? 0}`;
  } else if (s.last_scan_at) {
    el.scanSummaryText.textContent = `Last scan ${formatTime(s.last_scan_at)}`;
  } else {
    el.scanSummaryText.textContent = "No scan yet";
  }
}

function getSearchQuery() {
  return (el.searchInput?.value || "").trim().toLowerCase();
}

function matchesSearch(fields, q) {
  if (!q) return true;
  return fields
    .map((x) => String(x ?? ""))
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function debounce(fn, delay = 140) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedRenderAll = debounce(renderAll, 120);

function renderChunked(listEl, htmlItems, emptyHtml, chunkSize = 40) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!htmlItems.length) {
    listEl.innerHTML = emptyHtml;
    return;
  }
  let index = 0;
  const append = () => {
    listEl.insertAdjacentHTML("beforeend", htmlItems.slice(index, index + chunkSize).join(""));
    index += chunkSize;
    if (index < htmlItems.length) requestAnimationFrame(append);
  };
  append();
}

function renderMembers() {
  if (!el.memberList || !el.membersCountText) return;

  const q = getSearchQuery();
  const showRemoved = !!el.showRemovedToggle?.checked;

  const filtered = (state.members || []).filter((m) => {
    if (!showRemoved && m.removed) return false;
    if (!q) return true;
    return matchesSearch([
      m.display,
      m.name,
      m.username,
      m.id,
      m.left_reason,
      m.status,
      m.isWinner ? "winner" : "",
    ], q);
  });

  el.membersCountText.textContent = `${filtered.length} users`;

  const items = filtered.map((m) => {
    const statusText = m.removed ? "removed" : m.active ? "active" : "left";
    const statusClass = m.removed ? "removed" : m.rejoin_required ? "left" : m.active ? "active" : "left";

    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(m.display || m.id)}</div>
            <div class="item-sub">
              ID: ${escapeHtml(m.id)} Â· ${m.username ? "@" + escapeHtml(m.username) : "no username"}
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
  });

  renderChunked(el.memberList, items, `<div class="empty">No members found</div>`);
}

function renderWinners() {
  if (!el.winnerList || !el.winnersCountText) return;

  const q = getSearchQuery();
  const winners = (state.winners || []).filter((w) =>
    matchesSearch([
      w.turn,
      w.user_id,
      w.name,
      w.username,
      w.display,
      w.prize,
      w.done ? "done" : "pending",
      w.notice_sent ? "notice sent" : "notice pending",
    ], q)
  );
  el.winnersCountText.textContent = q
    ? `${winners.length} / ${(state.winners || []).length} winners`
    : `${winners.length} winners`;

  const items = winners.map((w) => {
    const username = String(w.username || "").replace(/^@+/, "");

    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-title">#${escapeHtml(w.turn)} Â· ${escapeHtml(w.display || w.user_id)}</div>
            <div class="item-sub">
              Prize: ${escapeHtml(w.prize || "-")} Â· ${escapeHtml(formatTime(w.at))}
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
  });

  renderChunked(el.winnerList, items, `<div class="empty">No winners found</div>`);
}

function renderHistory() {
  if (!el.historyList || !el.historyCountText) return;

  const q = getSearchQuery();
  const history = (state.history || []).filter((h) => {
    const winner = h?.winner || {};
    return matchesSearch([
      h.turn,
      h.prize,
      h.at,
      winner.id,
      winner.name,
      winner.username,
      winner.display,
      h.display,
      h.user_id,
    ], q);
  });
  el.historyCountText.textContent = q
    ? `${history.length} / ${(state.history || []).length} logs`
    : `${history.length} logs`;

  const items = history.map((h) => {
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
            <div class="item-title">#${escapeHtml(h.turn || "-")} Â· ${escapeHtml(winnerDisplay)}</div>
            <div class="item-sub">
              Prize: ${escapeHtml(h.prize || "-")} Â· ${escapeHtml(formatTime(h.at))}
            </div>
          </div>
          <div class="badge">history</div>
        </div>
      </div>
    `;
  });

  renderChunked(el.historyList, items, `<div class="empty">No history found</div>`);
}

function renderAll() {
  renderHealth();
  renderScan();
  renderEventControl();
  renderMembers();
  renderWinners();
  renderHistory();
}

function showSection(section) {
  state.currentSection = section;

  const allSections = [
    el.liveDashboardSection,
    el.prizeBuilderSection,
    el.listsSection,
  ];

  allSections.forEach((node) => node?.classList.add("hidden"));

  if (section === "live") el.liveDashboardSection?.classList.remove("hidden");
  if (section === "prize") el.prizeBuilderSection?.classList.remove("hidden");
  if (section === "lists") el.listsSection?.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSettings() {
  el.settingsDrawer?.classList.add("open");
}

function closeSettings() {
  el.settingsDrawer?.classList.remove("open");
}

function openQuickMenu() {
  el.quickMenuDrawer?.classList.add("open");
}

function closeQuickMenu() {
  el.quickMenuDrawer?.classList.remove("open");
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function applyCustomColors() {
  document.documentElement.style.setProperty("--bg", settings.bgColor || defaultSettings.bgColor);
  document.documentElement.style.setProperty("--card-solid", settings.cardColor || defaultSettings.cardColor);
  document.documentElement.style.setProperty("--bg-soft", settings.cardColor || defaultSettings.cardColor);
  document.documentElement.style.setProperty("--primary-1", settings.accent1 || defaultSettings.accent1);
  document.documentElement.style.setProperty("--primary-2", settings.accent2 || defaultSettings.accent2);
  document.documentElement.style.setProperty("--arrow-color", settings.arrowColor || defaultSettings.arrowColor);
}

function applySettingsToUI() {
  document.documentElement.setAttribute("data-theme", settings.theme || "white");
  applyCustomColors();

  if (el.bannerTitleText) el.bannerTitleText.textContent = settings.bannerTitle || defaultSettings.bannerTitle;
  if (el.bannerSubText) el.bannerSubText.textContent = settings.bannerSub || defaultSettings.bannerSub;

  if (el.bannerTitleInput) el.bannerTitleInput.value = settings.bannerTitle || "";
  if (el.bannerSubInput) el.bannerSubInput.value = settings.bannerSub || "";
  if (el.themeSelect) el.themeSelect.value = settings.theme || "white";

  if (el.bgColorInput) el.bgColorInput.value = settings.bgColor || defaultSettings.bgColor;
  if (el.cardColorInput) el.cardColorInput.value = settings.cardColor || defaultSettings.cardColor;
  if (el.accent1Input) el.accent1Input.value = settings.accent1 || defaultSettings.accent1;
  if (el.accent2Input) el.accent2Input.value = settings.accent2 || defaultSettings.accent2;
  if (el.arrowColorInput) el.arrowColorInput.value = settings.arrowColor || defaultSettings.arrowColor;

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

function clearAutoCloseTimer() {
  if (state.autoCloseTimer) {
    clearTimeout(state.autoCloseTimer);
    state.autoCloseTimer = null;
  }
}

function autoCloseWinnerPopup(delayMs = 3000) {
  clearAutoCloseTimer();
  state.autoCloseTimer = setTimeout(() => {
    state.autoCloseTimer = null;
    hideWinnerPopup();
  }, delayMs);
}

function showWinnerPopup(name, prize) {
  clearAutoCloseTimer();
  if (el.winnerPopupName) el.winnerPopupName.textContent = name || "-";
  if (el.winnerPopupPrize) el.winnerPopupPrize.textContent = prize || "-";
  if (el.winnerPopup) el.winnerPopup.classList.remove("hidden");
  launchConfetti();
  playWinnerTone();
}

function hideWinnerPopup() {
  clearAutoCloseTimer();
  if (el.winnerPopup) el.winnerPopup.classList.add("hidden");
  if (el.confettiLayer) el.confettiLayer.innerHTML = "";
}

function getAudioContext() {
  try {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audioCtx.state === "suspended") state.audioCtx.resume().catch(() => {});
    return state.audioCtx;
  } catch {
    return null;
  }
}

function playTickTone(intensity = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 900 + Math.random() * 260;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035 * intensity, ctx.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

function startTickSound() {
  stopTickSound();
  let interval = 52;
  const run = () => {
    if (!state.spinning) return;
    playTickTone(0.75);
    interval = Math.min(160, interval + 3.8);
    state.tickTimer = setTimeout(run, interval);
  };
  run();
}

function stopTickSound() {
  if (state.tickTimer) {
    clearTimeout(state.tickTimer);
    state.tickTimer = null;
  }
}

function startWheelLoop() {
  if (!el.wheelCanvas) return;
  stopWheelLoop();
  el.wheelCanvas.style.transition = "none";
  let last = performance.now();
  let speedDegPerSecond = 160;
  const maxSpeed = 980;
  const accel = 2600;
  const tick = (now) => {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    speedDegPerSecond = Math.min(maxSpeed, speedDegPerSecond + accel * dt);
    state.wheelDeg += speedDegPerSecond * dt;
    el.wheelCanvas.style.transform = `rotate(${state.wheelDeg}deg)`;
    state.spinLoopTimer = requestAnimationFrame(tick);
  };
  startTickSound();
  state.spinLoopTimer = requestAnimationFrame(tick);
}

function stopWheelLoop() {
  if (state.spinLoopTimer) {
    cancelAnimationFrame(state.spinLoopTimer);
    state.spinLoopTimer = null;
  }
}

async function handleScan() {
  if (state.spinning) {
    showToast("Spin áá±áá»á­ááº scan ááá¯ááºááá«", "error");
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

async function handleSpin(options = {}) {
  const autoMode = !!options.auto;
  if (state.spinning) return false;

  try {
    if (!autoMode) {
      const poolCount = Number(state.pool?.count || 0);
      const prizeCount = Number(state.health?.remaining_prizes || 0);
      if (!window.confirm(`Spin áá¯ááºááá¬á¸?
Pool: ${poolCount}
Prizes Left: ${prizeCount}
Last Scan: ${state.scan?.last_scan_at ? formatTime(state.scan.last_scan_at) : "No scan"}`)) {
        return false;
      }
    }
    if (Number(state.pool?.count || 0) <= 0) {
      showToast("No members left in pool", "error");
      return;
    }

    state.spinning = true;
    if (el.spinBtn) {
      el.spinBtn.disabled = true;
      el.spinBtn.classList.add("is-loading");
      el.spinBtn.textContent = "SPINNING...";
    }
    if (el.scanBtn) el.scanBtn.disabled = true;
    if (el.winnerFlash) el.winnerFlash.classList.add("hidden");

    buildWheelPrizeSegments();
    drawWheel();

    startWheelLoop();
    const spinStartedAt = performance.now();

    const result = await api("/spin", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const winnerName = result?.winner?.display || result?.winner?.id || "Unknown";
    const prize = result?.prize || "â";

    const optimisticItem = {
      turn: result?.turn || 0,
      at: new Date().toISOString(),
      prize,
      winner: {
        id: result?.winner?.id || "",
        name: result?.winner?.name || "",
        username: result?.winner?.username || "",
        display: winnerName,
      },
    };

    state.history = [optimisticItem, ...(state.history || [])];

    state.winners = [
      {
        turn: result?.turn || 0,
        at: optimisticItem.at,
        prize,
        user_id: result?.winner?.id || "",
        name: result?.winner?.name || "",
        username: result?.winner?.username || "",
        display: winnerName,
        done: false,
        done_at: "",
        notice_sent: false,
        notice_at: "",
      },
      ...(state.winners || []),
    ];

    state.pool.count = Math.max(0, Number(state.pool?.count || 0) - 1);
    renderAll();

    stopWheelLoop();

    const targetDeg = computeTargetRotationDeg(prize);
    const currentBase = state.wheelDeg % 360;
    let needed = targetDeg - currentBase;
    if (needed < 0) needed += 360;

    const targetTotalDuration = Number(settings.spinDurationMs || defaultSettings.spinDurationMs || 5600);
    const elapsedBeforeStop = performance.now() - spinStartedAt;
    const spinDuration = Math.max(1800, Math.min(targetTotalDuration, targetTotalDuration - elapsedBeforeStop));
    const extraRounds = 360 * (spinDuration < 2600 ? 2 : 4 + Math.floor(Math.random() * 2));
    const finalDeg = state.wheelDeg + extraRounds + needed;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el.wheelCanvas) {
          el.wheelCanvas.style.transition =
            `transform ${spinDuration}ms cubic-bezier(0.06, 0.82, 0.08, 1)`;
          state.wheelDeg = finalDeg;
          el.wheelCanvas.style.transform = `rotate(${state.wheelDeg}deg)`;
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, spinDuration + 120));

    if (el.winnerFlash) el.winnerFlash.classList.remove("hidden");
    if (el.winnerFlashName) el.winnerFlashName.textContent = winnerName;
    if (el.winnerFlashPrize) el.winnerFlashPrize.textContent = prize;

    showWinnerPopup(winnerName, prize);
    await refreshAfterSpin();
    showToast(`Winner: ${winnerName}`, "success");
    stopTickSound();
  } catch (err) {
    stopWheelLoop();
    stopTickSound();
    showToast(err.message || "Spin failed", "error");
    await refreshAllData().catch(() => {});
  } finally {
    state.spinning = false;
    if (el.spinBtn) {
      el.spinBtn.disabled = false;
      el.spinBtn.classList.remove("is-loading");
      el.spinBtn.textContent = "SPIN";
    }
    if (el.scanBtn && !state.autoSpinning) el.scanBtn.disabled = false;
  }

  return true;
}

function interruptibleSleep(ms) {
  return new Promise((resolve) => {
    const step = 100;
    let elapsed = 0;
    const tick = () => {
      if (!state.autoSpinning || state.autoSpinStopRequested) return resolve(false);
      elapsed += step;
      if (elapsed >= ms) return resolve(true);
      setTimeout(tick, step);
    };
    setTimeout(tick, step);
  });
}

async function runAutoSpin() {
  if (state.autoSpinning) return;
  state.autoSpinning = true;
  state.autoSpinStopRequested = false;
  if (el.autoSpinBtn) {
    el.autoSpinBtn.textContent = "STOP AUTO";
    el.autoSpinBtn.classList.add("is-loading");
  }
  if (el.scanBtn) el.scanBtn.disabled = true;

  try {
    while (state.autoSpinning && !state.autoSpinStopRequested) {
      if (Number(state.pool?.count || 0) <= 0) {
        showToast("Auto Spin stopped: pool empty", "error");
        break;
      }
      const ok = await handleSpin({ auto: true });
      if (!ok || !state.autoSpinning || state.autoSpinStopRequested) break;
      autoCloseWinnerPopup(3000);
      await interruptibleSleep(3000);
      if (!state.autoSpinning || state.autoSpinStopRequested) break;
    }
  } finally {
    state.autoSpinning = false;
    state.autoSpinStopRequested = false;
    if (el.autoSpinBtn) {
      el.autoSpinBtn.textContent = "AUTO SPIN";
      el.autoSpinBtn.classList.remove("is-loading");
      el.autoSpinBtn.disabled = false;
    }
    if (el.spinBtn) el.spinBtn.disabled = false;
    if (el.scanBtn) el.scanBtn.disabled = false;
  }
}

function toggleAutoSpin() {
  if (state.autoSpinning) {
    state.autoSpinStopRequested = true;
    state.autoSpinning = false;
    clearAutoCloseTimer();
    hideWinnerPopup();
    if (el.autoSpinBtn) {
      el.autoSpinBtn.textContent = "AUTO SPIN";
      el.autoSpinBtn.classList.remove("is-loading");
      el.autoSpinBtn.disabled = false;
    }
    showToast("Auto Spin stopped", "normal");
    return;
  }
  runAutoSpin();
}

async function handleSavePrize() {
  const prizeText = el.prizeText?.value.trim();
  if (!prizeText) {
    showToast("Prize text required", "error");
    return;
  }

  try {
    if (el.savePrizeBtn) {
      el.savePrizeBtn.disabled = true;
      el.savePrizeBtn.classList.add("is-loading");
      el.savePrizeBtn.textContent = "Saving...";
    }

    buildWheelPrizeSegments();
    drawWheel();
    showToast("Saving prize bag...", "normal");

    await api("/config/prizes", {
      method: "POST",
      body: JSON.stringify({ prizeText }),
    });

    const parsedTotal = parsePrizeLines(prizeText).reduce((sum, p) => sum + Number(p.times || 0), 0);
    if (state.health) state.health.remaining_prizes = parsedTotal;
    await loadHealth().catch(() => {});
    renderHealth();
    showToast("Prize bag saved", "success");
  } catch (err) {
    showToast(err.message || "Save prize failed", "error");
  } finally {
    if (el.savePrizeBtn) {
      el.savePrizeBtn.disabled = false;
      el.savePrizeBtn.classList.remove("is-loading");
      el.savePrizeBtn.textContent = "Save Prize";
    }
  }
}

async function handleRestart() {
  if (state.spinning || state.autoSpinning) {
    showToast("Spin/Auto Spin áááºáá¼á®á¸áá¾ restart áá¯ááºáá«", "error");
    return;
  }

  const choice = window.prompt(
    "Restart mode áá½á±á¸áá«:\n" +
      "1 = Safe Restart (winners/history clear, members keep, pool rebuild, prizes reload)\n" +
      "2 = Prize Reload Only (members/winners/history/pool ááá­)\n" +
      "3 = Full Reset (old behavior: winners/history clear, pool empty until scan)\n\n" +
      "1, 2, 3 áá²ááááºáá¯áá­á¯ááºáá«",
    "1"
  );
  if (!choice) return;
  const modeMap = { "1": "safe_restart", "2": "prize_reload", "3": "full_reset" };
  const mode = modeMap[String(choice).trim()];
  if (!mode) {
    showToast("Invalid restart mode", "error");
    return;
  }
  const label = mode === "safe_restart" ? "Safe Restart" : mode === "prize_reload" ? "Prize Reload Only" : "Full Reset";
  if (mode === "full_reset") {
    const typed = window.prompt("Full Reset á pool áá­á¯ scan ááá¯ááºááá»ááºá¸ empty áá¬á¸áá«áááºá áááºáá¯ááºáááº FULL RESET áá­á¯á·áá­á¯ááºáá«á", "");
    if (typed !== "FULL RESET") return;
  } else {
    const ok = window.confirm(`${label} áá¯ááºáá¾á¬áá±áá»á¬áá¬á¸?`);
    if (!ok) return;
  }

  try {
    if (el.restartBtn) {
      el.restartBtn.disabled = true;
      el.restartBtn.textContent = "Restarting...";
    }
    await api("/restart-spin", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    if (el.winnerFlash) el.winnerFlash.classList.add("hidden");
    hideWinnerPopup();
    await refreshAllData();
    showToast(`${label} complete`, "success");
  } catch (err) {
    showToast(err.message || "Restart failed", "error");
  } finally {
    if (el.restartBtn) {
      el.restartBtn.disabled = false;
      el.restartBtn.textContent = "Restart Event";
    }
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

function bindSectionMenu() {
  document.querySelectorAll(".quick-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      showSection(target);
      closeQuickMenu();
    });
  });
}

async function handleSaveEventSettings() {
  try {
    if (el.saveEventBtn) el.saveEventBtn.disabled = true;
    const body = {
      open: !!el.eventOpenToggle?.checked,
      name: el.eventNameInput?.value?.trim() || "Lucky77 Event",
      limit: Number(el.eventLimitInput?.value || 0) || 0,
    };
    const data = await api("/event/settings", { method: "POST", body: JSON.stringify(body) });
    state.event = { ...state.event, ...data.event, active_register_count: Number(data.active_register_count || 0) };
    renderEventControl();
    showToast("Event settings saved", "success");
  } catch (err) {
    showToast(err.message || "Event save failed", "error");
  } finally {
    if (el.saveEventBtn) el.saveEventBtn.disabled = false;
  }
}

async function handleBackupExport() {
  try {
    const data = await api("/backup/export");
    const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lucky77-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported", "success");
  } catch (err) {
    showToast(err.message || "Backup failed", "error");
  }
}

async function handleBackupRestore() {
  const file = el.backupRestoreInput?.files?.[0];
  if (!file) return showToast("Backup JSON file áá½á±á¸áá«", "error");
  const confirmText = window.prompt("Restore áá¯ááºáááº current event data áá­á¯ backup data áá²á·á¡áá¬á¸áá­á¯á¸áá«áááºá RESTORE áá­á¯á·áá­á¯ááºáá«á", "");
  if (confirmText !== "RESTORE") return;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    await api("/backup/restore", { method: "POST", body: JSON.stringify({ backup }) });
    await refreshAllData();
    showToast("Backup restored", "success");
  } catch (err) {
    showToast(err.message || "Restore failed", "error");
  }
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
  el.spinBtn?.addEventListener("click", () => handleSpin());
  el.autoSpinBtn?.addEventListener("click", toggleAutoSpin);
  el.restartBtn?.addEventListener("click", handleRestart);
  el.savePrizeBtn?.addEventListener("click", handleSavePrize);

  el.searchInput?.addEventListener("input", debouncedRenderAll);

  el.winnerList?.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;

    if (btn.matches("[data-notice-user]")) {
      sendNotice(btn.getAttribute("data-notice-user"), btn.getAttribute("data-notice-prize") || "");
      return;
    }

    if (btn.matches("[data-done-user]")) {
      toggleDone(btn.getAttribute("data-done-user"));
      return;
    }

    if (btn.matches("[data-tg-user]")) {
      const username = btn.getAttribute("data-tg-user");
      if (username) window.open(`https://t.me/${username}`, "_blank");
    }
  });

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

  el.saveSettingsBtn?.addEventListener("click", () => {
    settings.theme = el.themeSelect?.value || defaultSettings.theme;
    settings.bannerTitle = el.bannerTitleInput?.value.trim() || defaultSettings.bannerTitle;
    settings.bannerSub = el.bannerSubInput?.value.trim() || defaultSettings.bannerSub;
    settings.bgColor = el.bgColorInput?.value || defaultSettings.bgColor;
    settings.cardColor = el.cardColorInput?.value || defaultSettings.cardColor;
    settings.accent1 = el.accent1Input?.value || defaultSettings.accent1;
    settings.accent2 = el.accent2Input?.value || defaultSettings.accent2;
    settings.arrowColor = el.arrowColorInput?.value || defaultSettings.arrowColor;

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

    if (!file.type.startsWith("audio/") && !file.name.toLowerCase().endsWith(".mp3")) {
      showToast("Please choose an MP3/audio file", "error");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (el.bgMusicPlayer) {
      el.bgMusicPlayer.src = objectUrl;
      el.bgMusicPlayer.loop = true;
    }

    try {
      if (file.size <= 4 * 1024 * 1024) {
        settings.musicDataUrl = await fileToDataUrl(file);
        persistSettings();
      } else {
        settings.musicDataUrl = "";
        persistSettings();
        showToast("Large MP3 loaded for this session only", "normal");
      }
      showToast("Music uploaded", "success");
    } catch {
      settings.musicDataUrl = "";
      showToast("MP3 loaded for this session only", "normal");
    }
  });

  el.musicOnBtn?.addEventListener("click", async () => {
    if (!el.bgMusicPlayer || (!settings.musicDataUrl && !el.bgMusicPlayer.src)) {
      showToast("Upload MP3 first", "error");
      return;
    }

    try {
      settings.musicOn = true;
      persistSettings();
      if (settings.musicDataUrl) el.bgMusicPlayer.src = settings.musicDataUrl;
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

  el.saveEventBtn?.addEventListener("click", handleSaveEventSettings);
  el.backupExportBtn?.addEventListener("click", handleBackupExport);
  el.backupRestoreBtn?.addEventListener("click", handleBackupRestore);

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
  bindSectionMenu();

  showSection("wheel");

  buildWheelPrizeSegments();
  drawWheel();

  try {
    await firstLoad();
  } catch (err) {
    showToast(err.message || "Initial load failed", "error");
  }
})();
