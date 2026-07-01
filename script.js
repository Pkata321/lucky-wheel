const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "admin-login-spin-v1",
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
  logoutBtn: document.getElementById("logoutBtn"),

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

const ADMIN_KEY_STORAGE = "lucky77_admin_api_key";

function getApiKey() {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
}

function setApiKey(key) {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, String(key || "").trim());
}

function forgetApiKey() {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

function showLoginScreen(message = "") {
  const login = document.getElementById("adminLoginScreen");
  const app = document.getElementById("adminApp");
  const error = document.getElementById("adminLoginError");

  if (login) login.classList.remove("hidden");
  if (app) app.classList.add("hidden");
  if (error) error.textContent = message || "";
}

function showAdminApp() {
  const login = document.getElementById("adminLoginScreen");
  const app = document.getElementById("adminApp");
  const error = document.getElementById("adminLoginError");

  if (login) login.classList.add("hidden");
  if (app) app.classList.remove("hidden");
  if (error) error.textContent = "";
}

async function testAdminApiKey(key) {
  const cleanKey = String(key || "").trim();
  if (!cleanKey) return false;

  const health = await fetch(`${CONFIG.BASE_URL}/health?_=${Date.now()}`, {
    cache: "no-store",
  });

  if (!health.ok) {
    throw new Error("Backend connection failed");
  }

  const check = await fetch(`${CONFIG.BASE_URL}/config?_=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "x-api-key": cleanKey,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (check.status === 401) return false;
  if (!check.ok) throw new Error("Login check failed");

  const data = await check.json().catch(() => ({}));
  return data.ok !== false;
}

async function handleAdminLogin() {
  const input = document.getElementById("adminApiInput");
  const btn = document.getElementById("adminLoginBtn");
  const error = document.getElementById("adminLoginError");

  const key = String(input?.value || "").trim();

  if (!key) {
    if (error) error.textContent = "Admin Api Code ထည့်ပါ";
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking...";
    }

    if (error) error.textContent = "";

    const ok = await testAdminApiKey(key);

    if (!ok) {
      forgetApiKey();
      if (error) error.textContent = "Api Code မမှန်ပါ";
      if (input) {
        input.value = "";
        input.focus();
      }
      return;
    }

    setApiKey(key);
    showAdminApp();

    await firstLoad();
  } catch (err) {
    if (error) error.textContent = err.message || "Login failed";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  }
}

function bindAdminLogin() {
  const input = document.getElementById("adminApiInput");
  const btn = document.getElementById("adminLoginBtn");

  if (btn) btn.addEventListener("click", handleAdminLogin);

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAdminLogin();
    });
  }
}

async function requireAdminLoginBeforeLoad() {
  bindAdminLogin();

  const key = getApiKey();

  if (!key) {
    showLoginScreen();
    return false;
  }

  try {
    const ok = await testAdminApiKey(key);

    if (!ok) {
      forgetApiKey();
      showLoginScreen("Api Code မမှန်ပါ");
      return false;
    }

    showAdminApp();
    return true;
  } catch (_) {
    showLoginScreen("Backend connection failed");
    return false;
  }
}

async function api(path, options = {}) {
  const key = getApiKey();

  if (!key) {
    showLoginScreen();
    throw new Error("Login required");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  const separator = path.includes("?") ? "&" : "?";
  const url = `${CONFIG.BASE_URL}${path}${separator}_=${Date.now()}&v=${encodeURIComponent(CONFIG.CACHE_BUSTER)}`;

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        "x-api-key": key,
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
      showLoginScreen("Api Code မမှန်ပါ");
      throw new Error("Unauthorized");
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
function memberStatusText(m) {
  if (m.removed) return "removed";
  if (m.rejoin_required) return "rejoin required";
  if (!m.active) return "left";
  if (m.isWinner) return "winner";
  return "active";
}

function renderMembers() {
  const q = getSearchQuery();

  const rows = (state.members || []).filter((m) =>
    matchesSearch(
      [
        m.id,
        m.name,
        m.username,
        m.display,
        m.status,
        m.left_reason,
      ],
      q
    )
  );

  if (el.membersCountText) {
    el.membersCountText.textContent = `${rows.length} users`;
  }

  if (!el.memberList) return;

  if (!rows.length) {
    el.memberList.innerHTML = `<div class="empty-list">No members found</div>`;
    return;
  }

  el.memberList.innerHTML = rows
    .map((m) => {
      const username = m.username ? `@${escapeHtml(m.username)}` : "-";
      const status = memberStatusText(m);

      return `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">${escapeHtml(m.display || m.name || m.id)}</div>
            <div class="list-sub">
              ID: ${escapeHtml(m.id)} · Username: ${username} · Status: ${escapeHtml(status)}
            </div>
          </div>

          <div class="list-meta">
            ${m.dm_ready ? "DM Ready" : "DM Not Ready"}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderWinners() {
  const q = getSearchQuery();

  const rows = (state.winners || []).filter((w) =>
    matchesSearch(
      [
        w.turn,
        w.user_id,
        w.name,
        w.username,
        w.display,
        w.prize,
        w.done ? "done" : "pending",
      ],
      q
    )
  );

  if (el.winnersCountText) {
    el.winnersCountText.textContent = `${rows.length} winners`;
  }

  if (!el.winnerList) return;

  if (!rows.length) {
    el.winnerList.innerHTML = `<div class="empty-list">No winners found</div>`;
    return;
  }

  el.winnerList.innerHTML = rows
    .map((w) => {
      const display =
        w.display ||
        w.name ||
        (w.username ? `@${w.username}` : w.user_id || "-");

      return `
        <div class="list-item winner-row">
          <div class="list-main">
            <div class="list-title">
              #${escapeHtml(w.turn || "-")} · ${escapeHtml(display)}
            </div>

            <div class="list-sub">
              Prize: <b>${escapeHtml(w.prize || "-")}</b>
              · ID: ${escapeHtml(w.user_id || "-")}
              · Username: ${w.username ? "@" + escapeHtml(w.username) : "-"}
              · Time: ${escapeHtml(formatTime(w.at))}
            </div>
          </div>

          <div class="list-meta">
            ${w.done ? "Done ✅" : "Pending"}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHistory() {
  const q = getSearchQuery();

  const rows = (state.history || []).filter((h) => {
    const w = h.winner || {};
    return matchesSearch(
      [
        h.turn,
        h.prize,
        h.at,
        w.id,
        w.name,
        w.username,
        w.display,
      ],
      q
    );
  });

  if (el.historyCountText) {
    el.historyCountText.textContent = `${rows.length} logs`;
  }

  if (!el.historyList) return;

  if (!rows.length) {
    el.historyList.innerHTML = `<div class="empty-list">No history found</div>`;
    return;
  }

  el.historyList.innerHTML = rows
    .map((h) => {
      const w = h.winner || {};
      const display =
        w.display ||
        w.name ||
        (w.username ? `@${w.username}` : w.id || "-");

      return `
        <div class="list-item history-row">
          <div class="list-main">
            <div class="list-title">
              #${escapeHtml(h.turn || "-")} · ${escapeHtml(display)}
            </div>

            <div class="list-sub">
              Won: <b>${escapeHtml(h.prize || "-")}</b>
              · ID: ${escapeHtml(w.id || "-")}
              · ${escapeHtml(formatTime(h.at))}
            </div>
          </div>

          <div class="list-meta">History</div>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  renderHealth();
  renderScan();
  renderMembers();
  renderWinners();
  renderHistory();
  updateButtons();
}

function updateButtons() {
  const poolCount = Number(state.pool?.count || state.health?.pool || 0);
  const prizeCount = Number(state.health?.remaining_prizes || 0);

  if (el.spinBtn) {
    el.spinBtn.disabled = state.spinning || poolCount <= 0 || prizeCount <= 0;
  }

  if (el.autoSpinBtn) {
    if (state.autoSpinning) {
      el.autoSpinBtn.textContent = "STOP AUTO";
      el.autoSpinBtn.classList.add("danger-outline");
    } else {
      el.autoSpinBtn.textContent = "AUTO SPIN";
      el.autoSpinBtn.classList.remove("danger-outline");
    }
  }
}

function showSection(section) {
  state.currentSection = section;

  const map = {
    wheel: el.wheelHomeSection,
    live: el.liveDashboardSection,
    prize: el.prizeBuilderSection,
    lists: el.listsSection,
  };

  Object.values(map).forEach((node) => {
    if (node) node.classList.add("hidden");
  });

  if (map[section]) {
    map[section].classList.remove("hidden");
  }

  closeQuickMenu();
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

function applySettingsToUi() {
  document.body.dataset.theme = settings.theme || "white";

  document.documentElement.style.setProperty("--custom-bg", settings.bgColor);
  document.documentElement.style.setProperty("--custom-card", settings.cardColor);
  document.documentElement.style.setProperty("--accent-1", settings.accent1);
  document.documentElement.style.setProperty("--accent-2", settings.accent2);
  document.documentElement.style.setProperty("--arrow-color", settings.arrowColor);

  if (el.themeSelect) el.themeSelect.value = settings.theme;
  if (el.bgColorInput) el.bgColorInput.value = settings.bgColor;
  if (el.cardColorInput) el.cardColorInput.value = settings.cardColor;
  if (el.accent1Input) el.accent1Input.value = settings.accent1;
  if (el.accent2Input) el.accent2Input.value = settings.accent2;
  if (el.arrowColorInput) el.arrowColorInput.value = settings.arrowColor;

  if (el.bannerTitleInput) el.bannerTitleInput.value = settings.bannerTitle || "";
  if (el.bannerSubInput) el.bannerSubInput.value = settings.bannerSub || "";

  if (el.bannerTitleText) el.bannerTitleText.textContent = settings.bannerTitle || "Lucky77 Event";
  if (el.bannerSubText) el.bannerSubText.textContent = settings.bannerSub || "Spin & Win premium prizes";

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
    el.bgMusicPlayer.loop = true;
  }
}

function saveSettingsFromUi() {
  settings.theme = el.themeSelect?.value || "white";
  settings.bgColor = el.bgColorInput?.value || defaultSettings.bgColor;
  settings.cardColor = el.cardColorInput?.value || defaultSettings.cardColor;
  settings.accent1 = el.accent1Input?.value || defaultSettings.accent1;
  settings.accent2 = el.accent2Input?.value || defaultSettings.accent2;
  settings.arrowColor = el.arrowColorInput?.value || defaultSettings.arrowColor;
  settings.bannerTitle = el.bannerTitleInput?.value || defaultSettings.bannerTitle;
  settings.bannerSub = el.bannerSubInput?.value || defaultSettings.bannerSub;

  persistSettings();
  applySettingsToUi();
  showToast("Settings saved ✅", "success");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function handleTopLogoFile(file) {
  if (!file) return;
  settings.topLogo = await readFileAsDataUrl(file);
  persistSettings();
  applySettingsToUi();
}

async function handleWheelLogoFile(file) {
  if (!file) return;
  settings.wheelLogo = await readFileAsDataUrl(file);
  persistSettings();
  applySettingsToUi();
}

async function handleMusicFile(file) {
  if (!file) return;
  settings.musicDataUrl = await readFileAsDataUrl(file);
  settings.musicOn = true;
  persistSettings();
  applySettingsToUi();
  playMusic();
}

function playMusic() {
  if (!el.bgMusicPlayer || !settings.musicDataUrl) {
    showToast("Music file မရှိသေးပါ", "error");
    return;
  }

  settings.musicOn = true;
  persistSettings();

  el.bgMusicPlayer
    .play()
    .then(() => showToast("Music ON ✅", "success"))
    .catch(() => showToast("Browser က Music ကို block လုပ်ထားပါတယ်", "error"));
}

function stopMusic() {
  settings.musicOn = false;
  persistSettings();

  if (el.bgMusicPlayer) {
    el.bgMusicPlayer.pause();
  }

  showToast("Music OFF", "success");
}

function playTickSound() {
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 760;
    gain.gain.value = 0.045;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  } catch (_) {}
}

function startSpinLoopVisual() {
  stopSpinLoopVisual();

  state.spinLoopTimer = setInterval(() => {
    state.wheelDeg += state.spinLoopDegStep;
    if (el.wheelCanvas) {
      el.wheelCanvas.style.transform = `rotate(${state.wheelDeg}deg)`;
    }
  }, 28);

  state.tickTimer = setInterval(playTickSound, 88);
}

function stopSpinLoopVisual() {
  if (state.spinLoopTimer) {
    clearInterval(state.spinLoopTimer);
    state.spinLoopTimer = null;
  }

  if (state.tickTimer) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }
}

function animateWheelToPrize(prize) {
  return new Promise((resolve) => {
    stopSpinLoopVisual();

    const target = computeTargetRotationDeg(prize);
    const current = ((state.wheelDeg % 360) + 360) % 360;
    const diff = (target - current + 360) % 360;
    const extra = 360 * 8;
    const finalDeg = state.wheelDeg + extra + diff;

    if (el.wheelCanvas) {
      el.wheelCanvas.style.transition = `transform ${settings.spinDurationMs}ms cubic-bezier(.12,.74,.12,1)`;
      requestAnimationFrame(() => {
        state.wheelDeg = finalDeg;
        el.wheelCanvas.style.transform = `rotate(${finalDeg}deg)`;
      });
    }

    setTimeout(() => {
      if (el.wheelCanvas) {
        el.wheelCanvas.style.transition = "";
      }
      resolve();
    }, settings.spinDurationMs + 80);
  });
}

function createConfetti() {
  if (!el.confettiLayer) return;

  el.confettiLayer.innerHTML = "";

  const colors = ["#ff5f6d", "#ffc371", "#23d5ab", "#23a6d5", "#8b5dff", "#ffd166"];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.animationDuration = `${1.2 + Math.random() * 1.4}s`;
    el.confettiLayer.appendChild(piece);
  }
}

function showWinnerPopup(winner, prize) {
  if (!el.winnerPopup) return;

  const display =
    winner?.display ||
    winner?.name ||
    (winner?.username ? `@${winner.username}` : winner?.id || "-");

  if (el.winnerPopupName) el.winnerPopupName.textContent = display;
  if (el.winnerPopupPrize) el.winnerPopupPrize.textContent = prize || "-";

  el.winnerPopup.classList.remove("hidden");
  createConfetti();

  clearTimeout(state.autoCloseTimer);
  state.autoCloseTimer = setTimeout(closeWinnerPopup, 4200);
}

function closeWinnerPopup() {
  el.winnerPopup?.classList.add("hidden");
  if (el.confettiLayer) el.confettiLayer.innerHTML = "";
}

function updateWinnerFlash(winner, prize) {
  const display =
    winner?.display ||
    winner?.name ||
    (winner?.username ? `@${winner.username}` : winner?.id || "-");

  if (el.winnerFlashName) el.winnerFlashName.textContent = display;
  if (el.winnerFlashPrize) el.winnerFlashPrize.textContent = prize || "-";
  el.winnerFlash?.classList.remove("hidden");
}

async function spinOnce() {
  if (state.spinning) return null;

  try {
    state.spinning = true;
    updateButtons();
    startSpinLoopVisual();

    const data = await api("/spin", { method: "POST" });

    if (!data.ok) {
      throw new Error(data.error || "Spin failed");
    }

    await animateWheelToPrize(data.prize);

    updateWinnerFlash(data.winner, data.prize);
    showWinnerPopup(data.winner, data.prize);

    state.health = {
      ...(state.health || {}),
      pool: Math.max(0, Number(state.health?.pool || state.pool?.count || 0) - 1),
      winners: Number(state.health?.winners || 0) + 1,
      remaining_prizes: Math.max(0, Number(state.health?.remaining_prizes || 0) - 1),
    };

    state.pool = {
      ...(state.pool || {}),
      count: Math.max(0, Number(state.pool?.count || 0) - 1),
    };

    await refreshAfterSpin();

    return data;
  } catch (err) {
    stopSpinLoopVisual();
    showToast(err.message || "Spin failed", "error");
    return null;
  } finally {
    state.spinning = false;
    stopSpinLoopVisual();
    updateButtons();
  }
}

async function autoSpinLoop() {
  if (!state.autoSpinning) return;

  while (state.autoSpinning && !state.autoSpinStopRequested) {
    const poolCount = Number(state.pool?.count || state.health?.pool || 0);
    const prizeCount = Number(state.health?.remaining_prizes || 0);

    if (poolCount <= 0 || prizeCount <= 0) {
      state.autoSpinning = false;
      state.autoSpinStopRequested = false;
      updateButtons();
      showToast("Auto spin completed", "success");
      return;
    }

    const result = await spinOnce();

    if (!result) {
      state.autoSpinning = false;
      state.autoSpinStopRequested = false;
      updateButtons();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  state.autoSpinning = false;
  state.autoSpinStopRequested = false;
  updateButtons();
}

function toggleAutoSpin() {
  if (state.autoSpinning) {
    state.autoSpinStopRequested = true;
    state.autoSpinning = false;
    updateButtons();
    showToast("Auto spin stopping...", "success");
    return;
  }

  state.autoSpinning = true;
  state.autoSpinStopRequested = false;
  updateButtons();
  autoSpinLoop();
}

async function savePrizeConfig() {
  if (!el.prizeText) return;

  try {
    if (el.savePrizeBtn) {
      el.savePrizeBtn.disabled = true;
      el.savePrizeBtn.textContent = "Saving...";
    }

    const data = await api("/config/prizes", {
      method: "POST",
      body: JSON.stringify({
        prizeText: el.prizeText.value,
      }),
    });

    buildWheelPrizeSegments();
    drawWheel();

    await refreshAllData();

    showToast(`Prize saved: ${data.total} item(s)`, "success");
  } catch (err) {
    showToast(err.message || "Save failed", "error");
  } finally {
    if (el.savePrizeBtn) {
      el.savePrizeBtn.disabled = false;
      el.savePrizeBtn.textContent = "Save Prize";
    }
  }
}

async function scanMembers() {
  try {
    if (el.scanBtn) {
      el.scanBtn.disabled = true;
      el.scanBtn.textContent = "Scanning...";
    }

    const data = await api("/scan/members", {
      method: "POST",
    });

    state.scan = {
      status: "completed",
      summary: data.summary || null,
      last_scan_at: data.summary?.scanned_at || "",
    };

    await refreshAfterScan();

    showToast("Scan completed ✅", "success");
  } catch (err) {
    showToast(err.message || "Scan failed", "error");
  } finally {
    if (el.scanBtn) {
      el.scanBtn.disabled = false;
      el.scanBtn.textContent = "Scan Channel Member";
    }
  }
}

async function restartEvent() {
  const ok = window.confirm(
    "Restart Event လုပ်မလား?\n\nWinner/History ကို reset လုပ်မယ်။ Member memory မဖျက်ပါ။"
  );

  if (!ok) return;

  try {
    if (el.restartBtn) {
      el.restartBtn.disabled = true;
      el.restartBtn.textContent = "Restarting...";
    }

    await api("/restart-spin", {
      method: "POST",
      body: JSON.stringify({
        mode: "safe_restart",
      }),
    });

    await refreshAllData();

    showToast("Restart complete ✅", "success");
  } catch (err) {
    showToast(err.message || "Restart failed", "error");
  } finally {
    if (el.restartBtn) {
      el.restartBtn.disabled = false;
      el.restartBtn.textContent = "Restart Event";
    }
  }
}