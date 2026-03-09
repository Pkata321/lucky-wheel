const CONFIG = {
  BASE_URL: "https://YOUR-RENDER-URL",
  API_KEY: "YOUR_API_KEY",
  REQUEST_TIMEOUT: 20000,
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
  activeTab: "members",
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

  wheel: document.getElementById("wheel"),
  spinBtn: document.getElementById("spinBtn"),
  restartBtn: document.getElementById("restartBtn"),
  refreshAllBtn: document.getElementById("refreshAllBtn"),
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
};

function headers() {
  return {
    "Content-Type": "application/json",
    "x-api-key": CONFIG.API_KEY,
  };
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${CONFIG.BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(options.method && options.method !== "GET" ? { "Content-Type": "application/json" } : {}),
        "x-api-key": CONFIG.API_KEY,
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      const err = new Error(data.error || `HTTP ${response.status}`);
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function showToast(message, type = "normal") {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  el.toast.style.borderColor =
    type === "error"
      ? "rgba(255,95,122,0.4)"
      : type === "success"
      ? "rgba(24,195,126,0.4)"
      : "rgba(255,255,255,0.12)";

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.toast.classList.add("hidden");
  }, 2600);
}

function setBadge(node, text, tone) {
  node.textContent = text;
  node.className = `status-pill ${tone}`;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function memberStatusClass(member) {
  if (member.removed) return "removed";
  if (member.active) return "active";
  return "left";
}

function memberStatusText(member) {
  if (member.removed) return "removed";
  if (member.active) return "active";
  return "left";
}

function renderHealth() {
  const h = state.health || {};
  el.statMembers.textContent = h.members ?? 0;
  el.statPool.textContent = h.pool ?? 0;
  el.statWinners.textContent = h.winners ?? 0;
  el.statPrizes.textContent = h.remaining_prizes ?? 0;
  el.serverTimeText.textContent = h.time ? `Server: ${formatTime(h.time)}` : "Connected";

  if (h.scan_status === "completed") setBadge(el.healthBadge, "Healthy", "success");
  else if (h.scan_status === "scanning") setBadge(el.healthBadge, "Scanning", "warning");
  else setBadge(el.healthBadge, "Live", "neutral");

  if ((state.pool?.count || 0) <= 0) {
    el.poolEmptyText.classList.remove("hidden");
  } else {
    el.poolEmptyText.classList.add("hidden");
  }
}

function renderScan() {
  const s = state.scan || {};
  const summary = s.summary || {};

  if (s.status === "completed") setBadge(el.scanStatusBadge, "completed", "success");
  else if (s.status === "scanning") setBadge(el.scanStatusBadge, "scanning", "warning");
  else if (s.status === "error") setBadge(el.scanStatusBadge, "error", "danger");
  else setBadge(el.scanStatusBadge, "idle", "neutral");

  if (summary && Object.keys(summary).length) {
    el.scanSummaryText.textContent =
      `Active ${summary.active ?? 0} · Left ${summary.left ?? 0} · Pool ${summary.pool ?? 0}`;
  } else if (s.last_scan_at) {
    el.scanSummaryText.textContent = `Last scan ${formatTime(s.last_scan_at)}`;
  } else {
    el.scanSummaryText.textContent = "No scan yet";
  }
}

function renderMembers() {
  const q = (el.searchInput.value || "").trim().toLowerCase();
  const showRemoved = el.showRemovedToggle.checked;

  const members = state.members.filter((m) => {
    if (!showRemoved && m.removed) return false;
    if (!q) return true;

    const blob = [
      m.display,
      m.name,
      m.username,
      m.id,
      m.left_reason,
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });

  el.membersCountText.textContent = `${members.length} users`;

  if (!members.length) {
    el.memberList.innerHTML = `<div class="empty-state">No members found</div>`;
    return;
  }

  el.memberList.innerHTML = members
    .map((m) => {
      const statusText = memberStatusText(m);
      const statusClass = memberStatusClass(m);

      return `
        <div class="item-card">
          <div class="item-top">
            <div>
              <div class="item-name">${escapeHtml(m.display || m.id)}</div>
              <div class="item-sub">
                ID: ${escapeHtml(m.id)} · ${m.username ? "@" + escapeHtml(m.username) : "no username"}
              </div>
            </div>
            <div class="badge ${statusClass}">${escapeHtml(statusText)}</div>
          </div>

          <div class="badge-row">
            ${m.isWinner ? `<span class="badge winner">winner</span>` : ""}
            ${m.dm_ready ? `<span class="badge active">dm ready</span>` : `<span class="badge left">dm off</span>`}
            ${m.registered_at ? `<span class="badge">reg ${escapeHtml(formatTime(m.registered_at))}</span>` : ""}
            ${m.left_at ? `<span class="badge">left ${escapeHtml(formatTime(m.left_at))}</span>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderWinners() {
  const winners = state.winners || [];
  el.winnersCountText.textContent = `${winners.length} winners`;

  if (!winners.length) {
    el.winnerList.innerHTML = `<div class="empty-state">No winners yet</div>`;
    return;
  }

  el.winnerList.innerHTML = winners
    .map((w) => {
      return `
        <div class="item-card">
          <div class="item-top">
            <div>
              <div class="item-name">#${escapeHtml(w.turn)} · ${escapeHtml(w.display || w.user_id)}</div>
              <div class="item-sub">
                Prize: ${escapeHtml(w.prize || "-")} · ${escapeHtml(formatTime(w.at))}
              </div>
            </div>
            <div class="badge ${w.done ? "active" : "left"}">${w.done ? "done" : "pending"}</div>
          </div>

          <div class="badge-row">
            ${w.notice_sent ? `<span class="badge active">notice sent</span>` : `<span class="badge left">notice pending</span>`}
            ${w.username ? `<span class="badge">@${escapeHtml(w.username)}</span>` : ""}
            ${w.done_at ? `<span class="badge">done ${escapeHtml(formatTime(w.done_at))}</span>` : ""}
          </div>

          <div class="action-row">
            <button class="small-btn notice" onclick="sendNotice('${escapeHtml(w.user_id)}', '${escapeHtml(String(w.prize || "").replace(/'/g, "\\'"))}')">
              Notice
            </button>
            <button class="small-btn done" onclick="toggleDone('${escapeHtml(w.user_id)}')">
              ${w.done ? "Undo Done" : "Done"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHistory() {
  const history = state.history || [];
  el.historyCountText.textContent = `${history.length} logs`;

  if (!history.length) {
    el.historyList.innerHTML = `<div class="empty-state">No history yet</div>`;
    return;
  }

  el.historyList.innerHTML = history
    .map((h) => {
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
              <div class="item-name">#${escapeHtml(h.turn || "-")} · ${escapeHtml(winnerDisplay)}</div>
              <div class="item-sub">
                Prize: ${escapeHtml(h.prize || "-")} · ${escapeHtml(formatTime(h.at))}
              </div>
            </div>
            <div class="badge">history</div>
          </div>
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
}

async function loadHealth() {
  state.health = await api("/health", { method: "GET" });
}

async function loadMembers() {
  const includeRemoved = el.showRemovedToggle.checked ? "1" : "0";
  const data = await api(`/members?include_removed=${includeRemoved}&backfill=1`, { method: "GET" });
  state.members = data.members || [];
}

async function loadWinners() {
  const data = await api("/winners", { method: "GET" });
  state.winners = data.winners || [];
}

async function loadHistory() {
  const data = await api("/history", { method: "GET" });
  state.history = data.history || [];
}

async function loadPool() {
  state.pool = await api("/pool", { method: "GET" });
}

async function loadScanStatus() {
  state.scan = await api("/scan/status", { method: "GET" });
}

async function initialLoad() {
  try {
    await Promise.all([
      loadHealth(),
      loadMembers(),
      loadWinners(),
      loadHistory(),
      loadPool(),
      loadScanStatus(),
    ]);
    renderAll();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Load failed", "error");
  }
}

async function refreshAfterScan() {
  await Promise.all([loadScanStatus(), loadMembers(), loadPool(), loadHealth()]);
  renderAll();
}

async function refreshAfterSpin() {
  await Promise.all([loadWinners(), loadHistory(), loadPool(), loadHealth()]);
  renderAll();
}

async function refreshAfterNoticeOrDone() {
  await loadWinners();
  renderAll();
}

async function refreshEverything() {
  await Promise.all([
    loadHealth(),
    loadMembers(),
    loadWinners(),
    loadHistory(),
    loadPool(),
    loadScanStatus(),
  ]);
  renderAll();
}

function startWheelAnimation() {
  const extra = 360 * (5 + Math.floor(Math.random() * 3));
  const offset = Math.floor(Math.random() * 360);
  state.wheelDeg += extra + offset;
  el.wheel.style.transform = `rotate(${state.wheelDeg}deg)`;
}

async function runScan() {
  if (state.spinning) {
    showToast("Spin နေချိန် scan မလုပ်ရပါ", "error");
    return;
  }

  try {
    el.scanBtn.disabled = true;
    setBadge(el.scanStatusBadge, "scanning", "warning");
    el.scanSummaryText.textContent = "Checking registered member IDs...";

    await api("/scan/members", {
      method: "POST",
      body: JSON.stringify({}),
    });

    await refreshAfterScan();
    showToast("Scan completed", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Scan failed", "error");
    await loadScanStatus().catch(() => {});
    renderScan();
  } finally {
    el.scanBtn.disabled = false;
  }
}

async function runSpin() {
  if (state.spinning) return;

  try {
    state.spinning = true;
    el.spinBtn.disabled = true;
    el.scanBtn.disabled = true;

    startWheelAnimation();

    const result = await api("/spin", {
      method: "POST",
      body: JSON.stringify({}),
    });

    setTimeout(async () => {
      el.winnerFlash.classList.remove("hidden");
      el.winnerFlashName.textContent = result?.winner?.display || result?.winner?.id || "Unknown";
      el.winnerFlashPrize.textContent = result?.prize || "—";

      await refreshAfterSpin();
      showToast(`Winner: ${result?.winner?.display || result?.winner?.id}`, "success");
    }, 4800);
  } catch (err) {
    console.error(err);
    showToast(err.message || "Spin failed", "error");
  } finally {
    setTimeout(() => {
      state.spinning = false;
      el.spinBtn.disabled = false;
      el.scanBtn.disabled = false;
    }, 5000);
  }
}

async function savePrizes() {
  const prizeText = el.prizeText.value.trim();
  if (!prizeText) {
    showToast("Prize text required", "error");
    return;
  }

  try {
    el.savePrizeBtn.disabled = true;
    await api("/config/prizes", {
      method: "POST",
      body: JSON.stringify({ prizeText }),
    });

    await loadHealth();
    renderHealth();
    showToast("Prize bag saved", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Save prize failed", "error");
  } finally {
    el.savePrizeBtn.disabled = false;
  }
}

async function restartEvent() {
  const ok = window.confirm("Restart event now?");
  if (!ok) return;

  try {
    el.restartBtn.disabled = true;
    await api("/restart-spin", {
      method: "POST",
      body: JSON.stringify({}),
    });

    el.winnerFlash.classList.add("hidden");
    await refreshEverything();
    showToast("Event restarted", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Restart failed", "error");
  } finally {
    el.restartBtn.disabled = false;
  }
}

window.sendNotice = async function sendNotice(userId, prize) {
  try {
    await api("/notice", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        prize,
      }),
    });

    await refreshAfterNoticeOrDone();
    showToast("Notice sent", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Notice failed", "error");
  }
};

window.toggleDone = async function toggleDone(userId) {
  try {
    await api("/winner/done", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        toggle: true,
      }),
    });

    await refreshAfterNoticeOrDone();
    showToast("Winner updated", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Done update failed", "error");
  }
};

function bindTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;

      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    });
  });
}

function bindEvents() {
  el.refreshAllBtn.addEventListener("click", async () => {
    try {
      el.refreshAllBtn.disabled = true;
      await refreshEverything();
      showToast("Refreshed", "success");
    } catch (err) {
      showToast(err.message || "Refresh failed", "error");
    } finally {
      el.refreshAllBtn.disabled = false;
    }
  });

  el.scanBtn.addEventListener("click", runScan);
  el.spinBtn.addEventListener("click", runSpin);
  el.savePrizeBtn.addEventListener("click", savePrizes);
  el.restartBtn.addEventListener("click", restartEvent);

  el.searchInput.addEventListener("input", renderMembers);
  el.showRemovedToggle.addEventListener("change", async () => {
    await loadMembers();
    renderMembers();
  });
}

(async function init() {
  bindTabs();
  bindEvents();
  await initialLoad();
})();