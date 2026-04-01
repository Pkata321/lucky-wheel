const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot.onrender.com",
  API_KEY: "Lucky77_luckywheel_77",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "winners-only-v1",
  MAIN_UI_URL: "./index.html",
};

const state = {
  winners: [],
  filtered: [],
};

const el = {
  list: document.getElementById("list"),
  countText: document.getElementById("countText"),
  updatedText: document.getElementById("updatedText"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  exportBtn: document.getElementById("exportBtn"),
  openMainBtn: document.getElementById("openMainBtn"),
  baseUrlText: document.getElementById("baseUrlText"),
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
  state.filtered = [...state.winners];
}

function applySearch() {
  const q = String(el.searchInput?.value || "").trim().toLowerCase();

  if (!q) {
    state.filtered = [...state.winners];
    return;
  }

  state.filtered = state.winners.filter((w) => {
    const blob = [
      w.turn,
      w.at,
      w.prize,
      w.user_id,
      w.name,
      w.username,
      w.display,
      w.done ? "done" : "pending",
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });
}

async function markDone(userId) {
  await api("/winner/done", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, toggle: true }),
  });
  await refreshAll();
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
  ]];

  state.filtered.forEach((w) => {
    rows.push([
      String(w.turn || ""),
      String(w.at || ""),
      String(w.prize || ""),
      String(w.user_id || ""),
      String(w.name || ""),
      String(w.username || ""),
      String(w.display || ""),
      w.done ? "1" : "0",
      String(w.done_at || ""),
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lucky77-winners-cs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function render() {
  if (el.baseUrlText) {
    el.baseUrlText.textContent = CONFIG.BASE_URL;
  }

  if (el.countText) {
    el.countText.textContent = `${state.filtered.length} winners`;
  }

  if (el.updatedText) {
    el.updatedText.textContent = `Updated: ${new Date().toLocaleString()}`;
  }

  if (!el.list) return;

  if (!state.filtered.length) {
    el.list.innerHTML = `<div class="empty">No winners found</div>`;
    return;
  }

  el.list.innerHTML = state.filtered
    .map((w) => {
      const username = String(w.username || "").replace(/^@+/, "");
      const tgButton = username
        ? `<button class="small-btn" data-tg="${escapeHtml(username)}">Telegram</button>`
        : "";

      return `
        <div class="winner">
          <div class="winner-top">
            <div>
              <div class="winner-name">
                #${escapeHtml(w.turn)} · ${escapeHtml(w.display || w.name || w.user_id || "-")}
              </div>
              <div class="winner-sub">
                Prize: ${escapeHtml(w.prize || "-")} · ${escapeHtml(formatTime(w.at))}
                <br />
                ID: ${escapeHtml(w.user_id || "-")}
                ${username ? ` · @${escapeHtml(username)}` : ""}
              </div>
            </div>

            <div class="badge ${w.done ? "success" : "warn"}">
              ${w.done ? "done" : "pending"}
            </div>
          </div>

          <div class="badges">
            ${w.done
              ? `<span class="badge success">done ${escapeHtml(formatTime(w.done_at))}</span>`
              : `<span class="badge warn">not done yet</span>`}
          </div>

          <div class="actions">
            ${tgButton}
            <button class="small-btn done" data-done="${escapeHtml(w.user_id)}">
              ${w.done ? "Undo Done" : "Done"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll("[data-done]").forEach((btn) => {
    btn.onclick = async () => {
      const userId = btn.getAttribute("data-done");
      if (!userId) return;
      btn.disabled = true;
      try {
        await markDone(userId);
      } catch (err) {
        alert(err.message || "Done update failed");
        btn.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-tg]").forEach((btn) => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-tg");
      if (!username) return;
      window.open(`https://t.me/${username}`, "_blank");
    };
  });
}

async function refreshAll() {
  el.list.innerHTML = `<div class="loading">Loading winners...</div>`;
  await loadWinners();
  applySearch();
  render();
}

function bindEvents() {
  el.searchInput?.addEventListener("input", () => {
    applySearch();
    render();
  });

  el.refreshBtn?.addEventListener("click", refreshAll);
  el.reloadBtn?.addEventListener("click", refreshAll);
  el.exportBtn?.addEventListener("click", exportCsv);

  el.openMainBtn?.addEventListener("click", () => {
    window.location.href = CONFIG.MAIN_UI_URL;
  });
}

(async function init() {
  bindEvents();
  try {
    await refreshAll();
  } catch (err) {
    el.list.innerHTML = `<div class="empty">Load failed: ${escapeHtml(err.message || "Unknown error")}</div>`;
  }
})();