const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot.onrender.com",
  API_KEY: "Lucky77_luckywheel_77",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "cs-winners-fast-v3",
  PAGE_SIZE: 40,
};

const state = {
  winners: [],
  filtered: [],
  visibleCount: CONFIG.PAGE_SIZE,
  loading: false,
};

const el = {
  totalWinners: document.getElementById("totalWinners"),
  doneCount: document.getElementById("doneCount"),
  pendingCount: document.getElementById("pendingCount"),
  winnerList: document.getElementById("winnerList"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
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
  const done = all.filter((x) => x.done).length;
  const pending = all.filter((x) => !x.done).length;

  if (el.totalWinners) el.totalWinners.textContent = String(all.length);
  if (el.doneCount) el.doneCount.textContent = String(done);
  if (el.pendingCount) el.pendingCount.textContent = String(pending);
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
    if (button) button.disabled = true;

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
    if (button) button.disabled = false;
  }
}

async function sendNotice(userId, prize, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;
    if (button) button.disabled = true;

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
    if (button) button.disabled = false;
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