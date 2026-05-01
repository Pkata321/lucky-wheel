const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "cs-winners-smooth-v7",
  PAGE_SIZE: 40,
};

const state = {
  winners: [],
  filtered: [],
  visibleCount: CONFIG.PAGE_SIZE,
  loading: false,
  autoNoticeRunning: false,
  autoNoticeStopRequested: false,
  noticeFailedIds: new Set(),
};

const el = {
  totalWinners: document.getElementById("totalWinners"),
  doneCount: document.getElementById("doneCount"),
  pendingCount: document.getElementById("pendingCount"),
  doneBonusAmount: document.getElementById("doneBonusAmount"),
  noticeSentCount: document.getElementById("noticeSentCount"),
  noticePendingCount: document.getElementById("noticePendingCount"),
  noticeFailedCount: document.getElementById("noticeFailedCount"),
  winnerList: document.getElementById("winnerList"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  autoNoticeBtn: document.getElementById("autoNoticeBtn"),
  autoNoticeStatus: document.getElementById("autoNoticeStatus"),
  autoNoticeTitle: document.getElementById("autoNoticeTitle"),
  autoNoticeText: document.getElementById("autoNoticeText"),
  footerText: document.getElementById("footerText"),
  toast: document.getElementById("toast"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
};

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


function parsePrizeAmount(value) {
  const src = String(value || "").replace(/,/g, "");
  const match = src.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : 0;
}

function formatKs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 KS";
  return `${new Intl.NumberFormat().format(Math.round(n))} KS`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateAutoNoticeStatus(text, running = false) {
  if (el.autoNoticeStatus) el.autoNoticeStatus.classList.remove("hidden");
  if (el.autoNoticeTitle) el.autoNoticeTitle.textContent = running ? "Auto Notice Running" : "Auto Notice Status";
  if (el.autoNoticeText) el.autoNoticeText.textContent = text;
  if (el.autoNoticeBtn) {
    el.autoNoticeBtn.textContent = running ? "Stop Auto Notice" : "Auto Notice All";
    el.autoNoticeBtn.classList.toggle("is-loading", running);
  }
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
  }, 2200);
}

function getApiKey() {
  let key = sessionStorage.getItem("lucky77_admin_api_key") || "";
  if (!key) {
    key = window.prompt("Admin API key ထည့်ပါ") || "";
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
      throw new Error("Unauthorized: API key ပြန်ထည့်ပါ");
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

async function loadWinners() {
  const data = await api("/winners/cs");
  state.winners = Array.isArray(data.winners) ? data.winners : [];
  applyFilter();
}

function applyFilter() {
  const q = (el.searchInput?.value || "").trim().toLowerCase();

  state.filtered = (state.winners || []).filter((w) => {
    if (!q) return true;

    const blob = [
      w.turn,
      w.user_id,
      w.name,
      w.username,
      w.display,
      w.prize,
      w.done ? "done" : "pending",
      w.notice_sent ? "notice sent" : "notice pending",
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });

  state.visibleCount = CONFIG.PAGE_SIZE;
}

function renderStats() {
  const all = state.winners || [];
  const doneRows = all.filter((x) => x.done);
  const done = doneRows.length;
  const pending = all.filter((x) => !x.done).length;
  const doneBonus = doneRows.reduce((sum, row) => sum + parsePrizeAmount(row.prize), 0);
  const noticeSent = all.filter((x) => x.notice_sent).length;
  const noticePending = all.filter((x) => !x.notice_sent).length;
  const noticeFailed = state.noticeFailedIds?.size || 0;

  if (el.totalWinners) el.totalWinners.textContent = String(all.length);
  if (el.doneCount) el.doneCount.textContent = String(done);
  if (el.pendingCount) el.pendingCount.textContent = String(pending);
  if (el.doneBonusAmount) el.doneBonusAmount.textContent = formatKs(doneBonus);
  if (el.noticeSentCount) el.noticeSentCount.textContent = String(noticeSent);
  if (el.noticePendingCount) el.noticePendingCount.textContent = String(noticePending);
  if (el.noticeFailedCount) el.noticeFailedCount.textContent = String(noticeFailed);
  if (el.footerText) {
    el.footerText.textContent = `${Math.min(state.visibleCount, state.filtered.length)} / ${state.filtered.length} item(s) shown`;
  }
}

function renderLoadMore() {
  if (!el.loadMoreBtn) return;

  if (state.filtered.length > state.visibleCount) {
    el.loadMoreBtn.classList.remove("hidden");
    el.loadMoreBtn.disabled = false;
    el.loadMoreBtn.textContent = `Load More (${state.filtered.length - state.visibleCount} left)`;
  } else {
    el.loadMoreBtn.classList.add("hidden");
  }
}

async function toggleDone(userId, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    await api("/winner/done", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, toggle: true }),
    });

    const row = state.winners.find((x) => String(x.user_id) === String(userId));
    if (row) {
      row.done = !row.done;
      row.done_at = new Date().toISOString();
    }

    applyFilter();
    renderWinners();
    showToast("Done updated", "success");
  } catch (err) {
    showToast(err.message || "Done update failed", "error");
  } finally {
    state.loading = false;
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

async function sendNotice(userId, prize, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    const data = await api("/notice", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, prize }),
    });

    const row = state.winners.find((x) => String(x.user_id) === String(userId));
    if (row && data.dm_ok !== false) {
      row.notice_sent = true;
      row.notice_at = new Date().toISOString();
    }

    applyFilter();
    renderWinners();

    if (data.dm_ok === false) {
      showToast("DM failed", "error");
      return;
    }

    showToast("Notice sent", "success");
  } catch (err) {
    showToast(err.message || "Notice failed", "error");
  } finally {
    state.loading = false;
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}


async function runAutoNoticeAll() {
  if (state.autoNoticeRunning) {
    state.autoNoticeStopRequested = true;
    updateAutoNoticeStatus("Stopping after current notice...", true);
    return;
  }

  const queue = (state.winners || []).filter((w) => !w.notice_sent && w.user_id);
  if (!queue.length) {
    updateAutoNoticeStatus("No pending notices. All winners are already notice sent.", false);
    showToast("No pending notices", "normal");
    return;
  }

  state.autoNoticeRunning = true;
  state.autoNoticeStopRequested = false;
  state.noticeFailedIds = new Set();
  const gapMs = Math.max(20000, Math.floor((60 * 60 * 1000) / Math.max(queue.length, 1)));
  let sent = 0;
  let failed = 0;

  try {
    for (let i = 0; i < queue.length; i++) {
      if (state.autoNoticeStopRequested) break;
      const row = queue[i];
      updateAutoNoticeStatus(`Sending ${i + 1}/${queue.length} · Sent ${sent} · Failed ${failed}`, true);
      try {
        const data = await api("/notice", {
          method: "POST",
          body: JSON.stringify({ user_id: row.user_id, prize: row.prize || "" }),
        });
        if (data.dm_ok === false) throw new Error(data.dm_error || "DM failed");
        row.notice_sent = true;
        row.notice_at = new Date().toISOString();
        sent++;
      } catch (err) {
        failed++;
        state.noticeFailedIds.add(String(row.user_id));
      }
      applyFilter();
      renderWinners();
      if (i < queue.length - 1 && !state.autoNoticeStopRequested) {
        const seconds = Math.round(gapMs / 1000);
        updateAutoNoticeStatus(`Sent ${sent}/${queue.length} · Failed ${failed} · Next notice in ${seconds}s`, true);
        await wait(gapMs);
      }
    }
  } finally {
    state.autoNoticeRunning = false;
    state.autoNoticeStopRequested = false;
    updateAutoNoticeStatus(`Finished · Sent ${sent}/${queue.length} · Failed ${failed}`, false);
    renderStats();
  }
}

function bindActionButtons() {
  document.querySelectorAll("[data-done-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-done-user");
      toggleDone(userId, btn);
    };
  });

  document.querySelectorAll("[data-notice-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-notice-user");
      const prize = btn.getAttribute("data-notice-prize") || "";
      sendNotice(userId, prize, btn);
    };
  });
}

function buildWinnerCard(w) {
  const username = String(w.username || "").replace(/^@+/, "");

  return `
    <div class="cs-item">
      <div class="cs-item-top">
        <div>
          <div class="cs-item-title">#${escapeHtml(w.turn)} · ${escapeHtml(w.display || w.user_id || "-")}</div>
          <div class="cs-item-sub">
            Prize: <strong>${escapeHtml(w.prize || "-")}</strong><br>
            User ID: ${escapeHtml(w.user_id || "-")}<br>
            Username: ${username ? "@" + escapeHtml(username) : "-"}<br>
            Time: ${escapeHtml(formatTime(w.at))}
          </div>
        </div>

        <div class="cs-badge ${w.done ? "done" : "pending"}">
          ${w.done ? "DONE" : "PENDING"}
        </div>
      </div>

      <div class="cs-badges">
        <span class="cs-badge ${w.notice_sent ? "done" : "pending"}">
          ${w.notice_sent ? "NOTICE SENT" : "NOTICE PENDING"}
        </span>
        ${w.done_at ? `<span class="cs-badge">Done At: ${escapeHtml(formatTime(w.done_at))}</span>` : ""}
        ${w.notice_at ? `<span class="cs-badge">Notice At: ${escapeHtml(formatTime(w.notice_at))}</span>` : ""}
      </div>

      <div class="cs-item-actions">
        ${username ? `<a class="cs-link-btn secondary" href="https://t.me/${encodeURIComponent(username)}" target="_blank">Telegram</a>` : ""}
        <button class="cs-link-btn notice" data-notice-user="${escapeHtml(w.user_id)}" data-notice-prize="${escapeHtml(w.prize || "")}">
          Notice
        </button>
        <button class="cs-link-btn ${w.done ? "secondary" : "primary"}" data-done-user="${escapeHtml(w.user_id)}">
          ${w.done ? "Undo Done" : "Done"}
        </button>
      </div>
    </div>
  `;
}

function renderWinners() {
  if (!el.winnerList) return;

  renderStats();

  if (!state.filtered.length) {
    el.winnerList.innerHTML = `<div class="cs-empty">No winners found</div>`;
    renderLoadMore();
    return;
  }

  const visibleItems = state.filtered.slice(0, state.visibleCount);
  el.winnerList.innerHTML = visibleItems.map(buildWinnerCard).join("");

  bindActionButtons();
  renderLoadMore();
}

function exportCsv() {
  const rows = [[
    "Turn",
    "At",
    "Prize",
    "User ID",
    "Name",
    "Username",
    "Display",
    "Done",
    "Done At",
    "Notice Sent",
    "Notice At"
  ]];

  (state.winners || []).forEach((w) => {
    rows.push([
      String(w.turn || ""),
      String(w.at || ""),
      String(w.prize || ""),
      String(w.user_id || ""),
      String(w.name || ""),
      String(w.username || ""),
      String(w.display || ""),
      String(w.done ? "YES" : "NO"),
      String(w.done_at || ""),
      String(w.notice_sent ? "YES" : "NO"),
      String(w.notice_at || ""),
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lucky77-cs-winners.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("CSV exported", "success");
}

async function refreshPage() {
  try {
    if (el.refreshBtn) el.refreshBtn.disabled = true;
    await loadWinners();
    renderWinners();
    showToast("Refreshed", "success");
  } catch (err) {
    showToast(err.message || "Load failed", "error");
  } finally {
    if (el.refreshBtn) el.refreshBtn.disabled = false;
  }
}

function handleLoadMore() {
  state.visibleCount += CONFIG.PAGE_SIZE;
  renderWinners();
}

function bindEvents() {
  el.searchInput?.addEventListener("input", () => {
    applyFilter();
    renderWinners();
  });

  el.refreshBtn?.addEventListener("click", refreshPage);
  el.exportBtn?.addEventListener("click", exportCsv);
  el.autoNoticeBtn?.addEventListener("click", runAutoNoticeAll);
  el.loadMoreBtn?.addEventListener("click", handleLoadMore);
}

(async function init() {
  bindEvents();

  try {
    if (el.winnerList) {
      el.winnerList.innerHTML = `<div class="cs-empty">Loading winners...</div>`;
    }

    await loadWinners();
    renderWinners();
    showToast("CS winners loaded", "success");
  } catch (err) {
    showToast(err.message || "Initial load failed", "error");
    if (el.winnerList) {
      el.winnerList.innerHTML = `<div class="cs-empty">Failed to load winner list</div>`;
    }
    if (el.footerText) el.footerText.textContent = "Load failed";
  }
})();
