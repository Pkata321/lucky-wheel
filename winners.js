const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "cs-chat-v1",
  PAGE_SIZE: 40,
};

const state = {
  winners: [],
  filtered: [],
  visibleCount: CONFIG.PAGE_SIZE,
  loading: false,
  activeFilter: "all",
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

  chatModal: document.getElementById("chatModal"),
  chatModalBackdrop: document.getElementById("chatModalBackdrop"),
  chatModalClose: document.getElementById("chatModalClose"),
  chatModalTitle: document.getElementById("chatModalTitle"),
  chatModalSub: document.getElementById("chatModalSub"),
  chatMessages: document.getElementById("chatMessages"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function safeCssValue(value) {
  const raw = String(value || "");
  if (window.CSS && typeof window.CSS.escape === "function") {
    return CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
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

function buildAccountRequestText(prize) {
  const pz = String(prize || "").trim();

  return (
    `မဲပေါက်သည့်ယူနစ် ${pz || "—"} ထည့်သွင်းရန် ဂိမ်းအကောင့်လေးပေးပါရှင့်\n\n` +
    `ပြန်ပို့ပေးရမည့်ပုံစံအား Copy ကူးရန်\n\n` +
    `Account Name -\n` +
    `Telegram Number -\n\n` +
    `ဒီနှစ်ခုကို Copy ကူးပြီး ဂိမ်းအကောင့်လေးနဲ့ ဖုန်းနံပါတ်လေးထည့်ပြီး ပြန်ပို့ပေးထားတာနဲ့ ဆုကြေးငွေလေးထည့်ပေးသွားမှာပါနော်`
  );
}

function getApiKey() {
  let key = sessionStorage.getItem("lucky77_admin_api_key") || "";

  if (!key) {
    key = window.prompt("Admin API key ထည့်ပါ") || "";
    key = key.trim();

    if (key) {
      sessionStorage.setItem("lucky77_admin_api_key", key);
    }
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
    if (err?.name === "AbortError") {
      throw new Error("Request timeout");
    }

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

function winnerStatusText(w) {
  const csStatus = String(w.cs_status || "").trim();

  if (w.done) return "done";
  if (csStatus) return csStatus;
  if (w.notice_sent) return "notice_sent";
  return "pending";
}

function applyFilter() {
  const q = (el.searchInput?.value || "").trim().toLowerCase();
  const filter = String(state.activeFilter || "all");

  state.filtered = (state.winners || []).filter((w) => {
    const status = winnerStatusText(w);
    const hasReply = !!String(w.last_reply_text || "").trim();

    if (filter === "pending" && w.done) return false;
    if (filter === "done" && !w.done) return false;
    if (filter === "notice_pending" && w.notice_sent) return false;
    if (filter === "notice_sent" && !w.notice_sent) return false;
    if (filter === "user_replied" && !hasReply && status !== "user_replied") return false;

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
      w.game_phone,
      w.last_reply_text,
      w.last_outbound_text,
      status,
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

function renderFilterButtons() {
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === state.activeFilter);
  });
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

      if (row.done) {
        row.cs_status = "done";
      } else if (row.notice_sent) {
        row.cs_status = "notice_sent";
      } else {
        row.cs_status = "pending";
      }
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
      row.cs_status = "notice_sent";
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

async function sendCustomerMessage(userId, prize, button) {
  if (!userId || state.loading) return;

  const selector = `[data-message-input="${safeCssValue(userId)}"]`;
  const textarea = document.querySelector(selector);
  const text = String(textarea?.value || "").trim();

  if (!text) {
    showToast("Message text required", "error");
    return;
  }

  try {
    state.loading = true;

    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    const data = await api("/winner/message", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        prize,
        text,
        mode: "custom",
      }),
    });

    if (data.dm_ok === false) {
      showToast("DM failed", "error");
      return;
    }

    if (textarea) textarea.value = "";

    const row = state.winners.find((x) => String(x.user_id) === String(userId));

    if (row) {
      row.notice_sent = true;
      row.notice_at = new Date().toISOString();
      row.last_outbound_text = text;
      row.last_outbound_at = new Date().toISOString();

      if (!row.done) {
        row.cs_status = "notice_sent";
      }
    }

    applyFilter();
    renderWinners();
    showToast("Message sent", "success");
  } catch (err) {
    showToast(err.message || "Message failed", "error");
  } finally {
    state.loading = false;

    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

function fillAccountRequest(userId, prize) {
  const selector = `[data-message-input="${safeCssValue(userId)}"]`;
  const textarea = document.querySelector(selector);

  if (!textarea) return;

  textarea.value = buildAccountRequestText(prize);
  textarea.focus();
}

async function sendAccountRequest(userId, prize, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;

    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
    }

    const data = await api("/winner/message", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        prize,
        mode: "account_request",
      }),
    });

    if (data.dm_ok === false) {
      showToast("DM failed", "error");
      return;
    }

    const row = state.winners.find((x) => String(x.user_id) === String(userId));

    if (row) {
      row.notice_sent = true;
      row.notice_at = new Date().toISOString();
      row.last_outbound_text = buildAccountRequestText(prize);
      row.last_outbound_at = new Date().toISOString();

      if (!row.done) {
        row.cs_status = "notice_sent";
      }
    }

    applyFilter();
    renderWinners();
    showToast("Account request sent", "success");
  } catch (err) {
    showToast(err.message || "Account request failed", "error");
  } finally {
    state.loading = false;

    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

async function openCustomerReply(userId, display) {
  if (!userId) return;

  if (el.chatModalTitle) {
    el.chatModalTitle.textContent = display || "Customer Reply";
  }

  if (el.chatModalSub) {
    el.chatModalSub.textContent = `User ID: ${userId}`;
  }

  if (el.chatMessages) {
    el.chatMessages.innerHTML = `<div class="cs-empty">Loading messages...</div>`;
  }

  if (el.chatModal) {
    el.chatModal.classList.remove("hidden");
  }

  try {
    const data = await api(`/winner/messages?user_id=${encodeURIComponent(userId)}`);
    const messages = Array.isArray(data.messages) ? data.messages : [];

    if (!messages.length) {
      if (el.chatMessages) {
        el.chatMessages.innerHTML = `<div class="cs-empty">No messages yet</div>`;
      }
      return;
    }

    if (el.chatMessages) {
      el.chatMessages.innerHTML = messages
        .map((m) => {
          const direction = m.direction === "outbound" ? "outbound" : "inbound";
          const label = direction === "outbound" ? "Bot / CS Sent" : "Customer Reply";

          return `
            <div class="cs-chat-row ${direction}">
              <span class="cs-chat-meta">${escapeHtml(label)} · ${escapeHtml(formatTime(m.at))}</span>
              ${escapeHtml(m.text || "-")}
              ${m.ok === false ? `<span class="cs-chat-failed">Failed: ${escapeHtml(m.error || "")}</span>` : ""}
            </div>
          `;
        })
        .join("");

      el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    }
  } catch (err) {
    if (el.chatMessages) {
      el.chatMessages.innerHTML = `<div class="cs-empty">Failed to load messages</div>`;
    }

    showToast(err.message || "Message load failed", "error");
  }
}

function closeCustomerReply() {
  el.chatModal?.classList.add("hidden");
}

function copyText(text) {
  const value = String(text || "");

  if (!value) {
    showToast("Nothing to copy", "error");
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value)
      .then(() => showToast("Copied", "success"))
      .catch(() => fallbackCopyText(value));
    return;
  }

  fallbackCopyText(value);
}

function fallbackCopyText(text) {
  const node = document.createElement("textarea");
  node.value = String(text || "");
  node.style.position = "fixed";
  node.style.opacity = "0";
  document.body.appendChild(node);
  node.select();

  try {
    document.execCommand("copy");
    showToast("Copied", "success");
  } catch (_) {
    showToast("Copy failed", "error");
  }

  node.remove();
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

  document.querySelectorAll("[data-message-user]").forEach((btn) => {
    btn.onclick = () => {
      sendCustomerMessage(
        btn.getAttribute("data-message-user"),
        btn.getAttribute("data-message-prize") || "",
        btn
      );
    };
  });

  document.querySelectorAll("[data-template-user]").forEach((btn) => {
    btn.onclick = () => {
      fillAccountRequest(
        btn.getAttribute("data-template-user"),
        btn.getAttribute("data-template-prize") || ""
      );
    };
  });

  document.querySelectorAll("[data-send-template-user]").forEach((btn) => {
    btn.onclick = () => {
      sendAccountRequest(
        btn.getAttribute("data-send-template-user"),
        btn.getAttribute("data-send-template-prize") || "",
        btn
      );
    };
  });

  document.querySelectorAll("[data-open-chat-user]").forEach((btn) => {
    btn.onclick = () => {
      openCustomerReply(
        btn.getAttribute("data-open-chat-user"),
        btn.getAttribute("data-open-chat-display") || ""
      );
    };
  });

  document.querySelectorAll("[data-copy-user]").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.getAttribute("data-copy-user") || "";
      copyText(userId);
    };
  });
}

function statusBadgeHtml(w) {
  const status = winnerStatusText(w);

  if (w.done) {
    return `<div class="cs-badge done">DONE</div>`;
  }

  if (status === "user_replied") {
    return `<div class="cs-badge reply">USER REPLIED</div>`;
  }

  if (w.notice_sent) {
    return `<div class="cs-badge done">NOTICE SENT</div>`;
  }

  return `<div class="cs-badge pending">PENDING</div>`;
}

function buildWinnerCard(w) {
  const username = String(w.username || "").replace(/^@+/, "");
  const display = String(w.display || w.user_id || "-");
  const lastReply = String(w.last_reply_text || "").trim();
  const lastReplyAt = String(w.last_reply_at || "").trim();
  const lastOutbound = String(w.last_outbound_text || "").trim();
  const lastOutboundAt = String(w.last_outbound_at || "").trim();
  const csStatus = winnerStatusText(w);

  return `
    <div class="cs-item">
      <div class="cs-item-top">
        <div>
          <div class="cs-item-title">#${escapeHtml(w.turn)} · ${escapeHtml(display)}</div>
          <div class="cs-item-sub">
            Prize: <strong>${escapeHtml(w.prize || "-")}</strong><br>
            User ID: ${escapeHtml(w.user_id || "-")}<br>
            Username: ${username ? "@" + escapeHtml(username) : "-"}<br>
            Time: ${escapeHtml(formatTime(w.at))}
          </div>
        </div>

        ${statusBadgeHtml(w)}
      </div>

      <div class="cs-badges">
        <span class="cs-badge ${w.notice_sent ? "done" : "pending"}">
          ${w.notice_sent ? "NOTICE SENT" : "NOTICE PENDING"}
        </span>

        ${csStatus ? `<span class="cs-badge">${escapeHtml(csStatus.replace(/_/g, " ").toUpperCase())}</span>` : ""}
        ${lastReply ? `<span class="cs-badge reply">HAS REPLY</span>` : ""}
        ${w.done_at ? `<span class="cs-badge">Done At: ${escapeHtml(formatTime(w.done_at))}</span>` : ""}
        ${w.notice_at ? `<span class="cs-badge">Notice At: ${escapeHtml(formatTime(w.notice_at))}</span>` : ""}
      </div>

      ${lastReply ? `
        <div class="cs-last-line">
          <strong>Latest Customer Reply:</strong>
          ${escapeHtml(lastReply.slice(0, 160))}${lastReply.length > 160 ? "..." : ""}
          ${lastReplyAt ? `<br><span>${escapeHtml(formatTime(lastReplyAt))}</span>` : ""}
        </div>
      ` : ""}

      ${lastOutbound ? `
        <div class="cs-last-line">
          <strong>Latest Bot / CS Sent:</strong>
          ${escapeHtml(lastOutbound.slice(0, 160))}${lastOutbound.length > 160 ? "..." : ""}
          ${lastOutboundAt ? `<br><span>${escapeHtml(formatTime(lastOutboundAt))}</span>` : ""}
        </div>
      ` : ""}

      <div class="cs-message-box">
        <div class="cs-message-title">Send Message To Customer</div>

        <textarea
          class="cs-message-textarea"
          data-message-input="${escapeAttr(w.user_id)}"
          placeholder="Customer ဆီ Bot နဲ့ပို့မယ့်စာရေးရန်..."
        ></textarea>

        <div class="cs-item-actions">
          <button
            class="cs-link-btn secondary"
            data-template-user="${escapeAttr(w.user_id)}"
            data-template-prize="${escapeAttr(w.prize || "")}"
            type="button"
          >
            Fill Account Template
          </button>

          <button
            class="cs-link-btn notice"
            data-send-template-user="${escapeAttr(w.user_id)}"
            data-send-template-prize="${escapeAttr(w.prize || "")}"
            type="button"
          >
            Send Account Request
          </button>

          <button
            class="cs-link-btn primary"
            data-message-user="${escapeAttr(w.user_id)}"
            data-message-prize="${escapeAttr(w.prize || "")}"
            type="button"
          >
            Send to Customer
          </button>

          <button
            class="cs-link-btn secondary"
            data-open-chat-user="${escapeAttr(w.user_id)}"
            data-open-chat-display="${escapeAttr(display)}"
            type="button"
          >
            Customer Reply
          </button>
        </div>
      </div>

      <div class="cs-item-actions">
        ${username ? `<a class="cs-link-btn secondary" href="https://t.me/${encodeURIComponent(username)}" target="_blank">Telegram</a>` : ""}

        <button
          class="cs-link-btn secondary"
          data-copy-user="${escapeAttr(w.user_id)}"
          type="button"
        >
          Copy ID
        </button>

        <button
          class="cs-link-btn notice"
          data-notice-user="${escapeAttr(w.user_id)}"
          data-notice-prize="${escapeAttr(w.prize || "")}"
          type="button"
        >
          Notice
        </button>

        <button
          class="cs-link-btn ${w.done ? "secondary" : "primary"}"
          data-done-user="${escapeAttr(w.user_id)}"
          type="button"
        >
          ${w.done ? "Undo Done" : "Done"}
        </button>
      </div>
    </div>
  `;
}

function renderWinners() {
  if (!el.winnerList) return;

  renderStats();
  renderFilterButtons();

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
    "CS Status",
    "Done",
    "Done At",
    "Notice Sent",
    "Notice At",
    "Last Reply",
    "Last Reply At",
    "Last Outbound",
    "Last Outbound At",
    "CS Note",
    "Game Account",
    "Game Phone"
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
      String(w.cs_status || ""),
      String(w.done ? "YES" : "NO"),
      String(w.done_at || ""),
      String(w.notice_sent ? "YES" : "NO"),
      String(w.notice_at || ""),
      String(w.last_reply_text || ""),
      String(w.last_reply_at || ""),
      String(w.last_outbound_text || ""),
      String(w.last_outbound_at || ""),
      String(w.cs_note || ""),
      String(w.game_account || ""),
      String(w.game_phone || ""),
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

  el.chatModalClose?.addEventListener("click", closeCustomerReply);
  el.chatModalBackdrop?.addEventListener("click", closeCustomerReply);

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeFilter = btn.getAttribute("data-filter") || "all";
      applyFilter();
      renderWinners();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomerReply();
    }
  });
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

    if (el.footerText) {
      el.footerText.textContent = "Load failed";
    }
  }
})();