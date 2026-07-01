const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "cs-winners-round-timer-fix",
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

function getApiKey() {
  let key = sessionStorage.getItem("lucky77_admin_api_key") || "";
  if (!key) {
    key = window.prompt("Admin API key") || "";
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
      throw new Error("Unauthorized: Enter API key again");
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
      w.cs_status,
      w.cs_note,
      w.game_account,
      w.last_reply_text,
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

async function updateWinnerMeta(userId, button) {
  if (!userId || state.loading) return;
  const statusEl = document.querySelector(`[data-status-input="${CSS.escape(String(userId))}"]`);
  const noteEl = document.querySelector(`[data-note-input="${CSS.escape(String(userId))}"]`);
  const gameEl = document.querySelector(`[data-game-input="${CSS.escape(String(userId))}"]`);

  try {
    state.loading = true;
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }
    const body = {
      user_id: userId,
      cs_status: statusEl?.value || "pending",
      cs_note: noteEl?.value || "",
      game_account: gameEl?.value || "",
    };
    await api("/winner/update", { method: "POST", body: JSON.stringify(body) });
    const row = state.winners.find((x) => String(x.user_id) === String(userId));
    if (row) Object.assign(row, body, { done: body.cs_status === "done" ? true : row.done });
    applyFilter();
    renderWinners();
    showToast("Winner saved", "success");
  } catch (err) {
    showToast(err.message || "Winner save failed", "error");
  } finally {
    state.loading = false;
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
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

  document.querySelectorAll("[data-save-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-save-user");
      updateWinnerMeta(userId, btn);
    };
  });
}

function buildWinnerCard(w) {
  const username = String(w.username || "").replace(/^@+/, "");

  return `
    <div class="cs-item">
      <div class="cs-item-top">
        <div>
          <div class="cs-item-title">#${escapeHtml(w.turn)} - ${escapeHtml(w.display || w.user_id || "-")}</div>
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
        <span class="cs-badge">Status: ${escapeHtml(w.cs_status || (w.done ? "done" : "pending"))}</span>
        ${w.done_at ? `<span class="cs-badge">Done At: ${escapeHtml(formatTime(w.done_at))}</span>` : ""}
        ${w.notice_at ? `<span class="cs-badge">Notice At: ${escapeHtml(formatTime(w.notice_at))}</span>` : ""}
        ${w.last_reply_at ? `<span class="cs-badge done">User Replied: ${escapeHtml(formatTime(w.last_reply_at))}</span>` : ""}
      </div>

      ${w.last_reply_text ? `<div class="cs-reply">Last Reply: ${escapeHtml(w.last_reply_text)}</div>` : ""}

      <div class="cs-edit-grid">
        <select class="cs-input" data-status-input="${escapeHtml(w.user_id)}">
          ${["pending","notice_sent","user_replied","account_received","prize_added","problem","done"].map((x) => `<option value="${x}" ${(w.cs_status || (w.done ? "done" : "pending")) === x ? "selected" : ""}>${x.replace(/_/g, " ").toUpperCase()}</option>`).join("")}
        </select>
        <input class="cs-input" data-game-input="${escapeHtml(w.user_id)}" value="${escapeHtml(w.game_account || "")}" placeholder="Game account / ID" />
        <textarea class="cs-input cs-note" data-note-input="${escapeHtml(w.user_id)}" placeholder="CS note">${escapeHtml(w.cs_note || "")}</textarea>
      </div>

      <div class="cs-item-actions">
        ${username ? `<a class="cs-link-btn secondary" href="https://t.me/${encodeURIComponent(username)}" target="_blank">Telegram</a>` : ""}
        <button class="cs-link-btn notice" data-notice-user="${escapeHtml(w.user_id)}" data-notice-prize="${escapeHtml(w.prize || "")}">
          Notice
        </button>
        <button class="cs-link-btn secondary" data-save-user="${escapeHtml(w.user_id)}">Save CS</button>
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
    "Notice At",
    "CS Status",
    "CS Note",
    "Game Account",
    "Last Reply",
    "Last Reply At"
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
      String(w.cs_status || ""),
      String(w.cs_note || ""),
      String(w.game_account || ""),
      String(w.last_reply_text || ""),
      String(w.last_reply_at || ""),
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