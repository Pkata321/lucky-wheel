const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "admin-login-clean-role-v1",
  PAGE_SIZE: 40,
};

const state = {
  winners: [],
  filtered: [],
  visibleCount: CONFIG.PAGE_SIZE,
  loading: false,
  activeFilter: "all",
  selectedUserId: "",
};

const el = {
  totalWinners: document.getElementById("totalWinners"),
  doneCount: document.getElementById("doneCount"),
  pendingCount: document.getElementById("pendingCount"),
  doneWinnerCount: document.getElementById("doneWinnerCount"),
  doneAmount: document.getElementById("doneAmount"),

  winnerList: document.getElementById("winnerList"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  footerText: document.getElementById("footerText"),
  toast: document.getElementById("toast"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  filterRow: document.getElementById("filterRow"),

  replyModal: document.getElementById("replyModal"),
  replyModalBackdrop: document.getElementById("replyModalBackdrop"),
  replyModalClose: document.getElementById("replyModalClose"),
  replyModalTitle: document.getElementById("replyModalTitle"),
  replyModalSub: document.getElementById("replyModalSub"),
  replyModalBody: document.getElementById("replyModalBody"),
};

const ADMIN_KEY_STORAGE = "lucky77_admin_api_key";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function parsePrizeAmount(prize) {
  const text = String(prize || "");
  const nums = text.match(/\d+/g);
  if (!nums || !nums.length) return 0;
  return Number(nums.join("")) || 0;
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString()} Ks`;
}

function showToast(message, type = "normal") {
  if (!el.toast) return;

  el.toast.textContent = message;
  el.toast.classList.remove("hidden");

  if (type === "error") {
    el.toast.style.background = "#991b1b";
  } else if (type === "success") {
    el.toast.style.background = "#065f46";
  } else {
    el.toast.style.background = "#111827";
  }

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    el.toast.classList.add("hidden");
  }, 2400);
}

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

  if (!health.ok) throw new Error("Backend connection failed");

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
    await refreshPage();
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

function buildAccountRequestText(prize) {
  const pz = String(prize || "").trim();

  return (
    `မဲပေါက်သည့်ယူနစ် ${pz || "—"} ထည့်သွင်းရန် ဂိမ်းအကောင့်လေးပေးပါရှင့်\n\n` +
    `ပြန်ပို့ပေးရမည့်ပုံစံအား Copy ကူးရန်\n\n` +
    `Account Name -\n` +
    `Telegram Number -\n\n` +
    `ဒီနှစ်ခုကို Copy ကူးပြီး ဂိမ်းအကောင့်လေးနဲ့ ဖုန်းနံပါတ်လေးထည့်ပြီး ပြန်ပို့ပေးထားတာနဲ့ ဆုကြေးငွေလေးထည့်ပေးသွားမှာပါနော်။`
  );
}

async function loadWinners() {
  const data = await api("/winners/cs");

  state.winners = Array.isArray(data.winners)
    ? data.winners.map((w) => ({
        ...w,
        game_account: String(w.game_account || ""),
        game_phone: String(w.game_phone || ""),
        cs_note: String(w.cs_note || ""),
        cs_status: String(w.cs_status || ""),

        last_reply_text: String(w.last_reply_text || ""),
        last_reply_at: String(w.last_reply_at || ""),

        last_outbound_text: String(w.last_outbound_text || ""),
        last_outbound_at: String(w.last_outbound_at || ""),

        message_count: Number(w.message_count || 0) || 0,
        inbound_unread_count: Number(w.inbound_unread_count || 0) || 0,
        last_message_text: String(w.last_message_text || ""),
        last_message_at: String(w.last_message_at || ""),
        last_message_direction: String(w.last_message_direction || ""),
        last_read_at: String(w.last_read_at || ""),
      }))
    : [];

  applyFilter();
}
function filterMatch(w) {
  if (state.activeFilter === "pending") return !w.done;
  if (state.activeFilter === "done") return !!w.done;
  if (state.activeFilter === "notice_pending") return !w.notice_sent;
  if (state.activeFilter === "notice_sent") return !!w.notice_sent;

  if (state.activeFilter === "replied") {
    return (
      Number(w.message_count || 0) > 0 ||
      Number(w.inbound_unread_count || 0) > 0 ||
      !!String(w.last_reply_text || "").trim() ||
      !!String(w.last_message_text || "").trim()
    );
  }

  return true;
}

function applyFilter() {
  const q = (el.searchInput?.value || "").trim().toLowerCase();

  state.filtered = (state.winners || []).filter((w) => {
    if (!filterMatch(w)) return false;

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
      w.game_account,
      w.game_phone,
      w.cs_note,
      w.last_reply_text,
      w.last_outbound_text,
      w.last_message_text,
      w.last_message_direction,
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });

  if (state.activeFilter === "replied") {
    state.filtered.sort((a, b) => {
      const au = Number(a.inbound_unread_count || 0);
      const bu = Number(b.inbound_unread_count || 0);

      if (au !== bu) return bu - au;

      const at = new Date(a.last_message_at || a.last_reply_at || a.at || 0).getTime() || 0;
      const bt = new Date(b.last_message_at || b.last_reply_at || b.at || 0).getTime() || 0;

      return bt - at;
    });
  }

  state.visibleCount = CONFIG.PAGE_SIZE;
}

function renderStats() {
  const all = state.winners || [];
  const done = all.filter((x) => x.done).length;
  const pending = all.filter((x) => !x.done).length;

  const doneAmount = all
    .filter((x) => x.done)
    .reduce((sum, x) => sum + parsePrizeAmount(x.prize), 0);

  if (el.totalWinners) el.totalWinners.textContent = String(all.length);
  if (el.doneCount) el.doneCount.textContent = String(done);
  if (el.pendingCount) el.pendingCount.textContent = String(pending);
  if (el.doneWinnerCount) el.doneWinnerCount.textContent = String(done);
  if (el.doneAmount) el.doneAmount.textContent = formatMoney(doneAmount);

  if (el.footerText) {
    el.footerText.textContent = `${Math.min(state.visibleCount, state.filtered.length)} / ${state.filtered.length} item(s) shown`;
  }
}

function renderFilterButtons() {
  if (!el.filterRow) return;

  const replyTotal = (state.winners || []).filter((w) => {
    return (
      Number(w.message_count || 0) > 0 ||
      Number(w.inbound_unread_count || 0) > 0 ||
      !!String(w.last_reply_text || "").trim() ||
      !!String(w.last_message_text || "").trim()
    );
  }).length;

  const unreadTotal = (state.winners || []).reduce(
    (sum, w) => sum + (Number(w.inbound_unread_count || 0) || 0),
    0
  );

  const filters = [
    ["all", "All"],
    ["pending", "Pending"],
    ["done", "Done"],
    ["notice_pending", "Notice Pending"],
    ["notice_sent", "Notice Sent"],
    [
      "replied",
      `User Reply${unreadTotal ? ` ${unreadTotal}` : replyTotal ? ` ${replyTotal}` : ""}`,
    ],
  ];

  el.filterRow.innerHTML = filters
    .map(([key, label]) => {
      const active = state.activeFilter === key ? "active" : "";
      const badge =
        key === "replied" && unreadTotal
          ? `<span class="inbox-badge">${escapeHtml(unreadTotal)}</span>`
          : "";

      const cleanLabel =
        key === "replied"
          ? "User Reply"
          : label;

      return `
        <button class="filter-btn ${active}" data-filter="${escapeAttr(key)}">
          ${escapeHtml(cleanLabel)}${badge}
        </button>
      `;
    })
    .join("");

  el.filterRow.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.onclick = () => {
      state.activeFilter = btn.getAttribute("data-filter") || "all";
      applyFilter();
      renderWinners();
    };
  });
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

function statusBadges(w) {
  const unread = Number(w.inbound_unread_count || 0) || 0;
  const reply = String(w.last_reply_text || w.last_message_text || "").trim();

  const hasInfo =
    String(w.game_account || "").trim() ||
    String(w.game_phone || "").trim() ||
    String(w.cs_note || "").trim();

  return `
    <div class="badge-row">
      <span class="badge ${w.done ? "done" : "pending"}">${w.done ? "Done" : "Pending"}</span>
      <span class="badge ${w.notice_sent ? "done" : "pending"}">${w.notice_sent ? "Notice Sent" : "Notice Pending"}</span>
      ${reply ? `<span class="badge reply">User Replied</span>` : ""}
      ${unread ? `<span class="badge reply">Unread ${escapeHtml(unread)}</span>` : ""}
      ${hasInfo ? `<span class="badge info">Info Saved</span>` : ""}
    </div>
  `;
}
function unreadBadgeHtml(w) {
  const unread = Number(w.inbound_unread_count || 0) || 0;
  if (!unread) return "";
  return `<span class="inbox-badge">${escapeHtml(unread)}</span>`;
}

function inboxPreviewHtml(w) {
  const text = String(
    w.last_message_text ||
    w.last_reply_text ||
    w.last_outbound_text ||
    ""
  ).trim();

  if (!text) return "";

  const direction = String(w.last_message_direction || "").trim();

  const role =
    direction === "outbound"
      ? "Last message by CS / Bot"
      : "Last message by Customer";

  const at =
    w.last_message_at ||
    w.last_reply_at ||
    w.last_outbound_at ||
    "";

  return `
    <div class="inbox-preview">
      <div class="inbox-preview-top">
        <div class="inbox-preview-role">${escapeHtml(role)}</div>
        <div class="inbox-preview-time">${escapeHtml(formatTime(at))}</div>
      </div>
      <div class="inbox-preview-text">${escapeHtml(text)}</div>
    </div>
  `;
}

function inboxMetaHtml(w) {
  return `
    <div class="inbox-meta-grid">
      <div class="inbox-meta-box">
        <span>User ID</span>
        <strong>${escapeHtml(w.user_id || "-")}</strong>
      </div>

      <div class="inbox-meta-box">
        <span>Username</span>
        <strong>${w.username ? "@" + escapeHtml(w.username) : "-"}</strong>
      </div>

      <div class="inbox-meta-box">
        <span>Prize</span>
        <strong>${escapeHtml(w.prize || "-")}</strong>
      </div>

      <div class="inbox-meta-box">
        <span>Messages</span>
        <strong>${escapeHtml(w.message_count || 0)}</strong>
      </div>
    </div>
  `;
}
function buildWinnerCard(w) {
  const display = w.display || w.name || (w.username ? `@${w.username}` : w.user_id);
  const tgLink = w.username ? `https://t.me/${String(w.username).replace(/^@+/, "")}` : "";
  const unread = Number(w.inbound_unread_count || 0) || 0;

  const isInboxView = state.activeFilter === "replied";

  const cardClass = [
    "winner-card",
    w.done ? "done-card" : "",
    isInboxView ? "inbox-card" : "",
    unread ? "unread" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${cardClass}">
      <div class="winner-head">
        <div>
          <div class="winner-title">
            #${escapeHtml(w.turn || "-")} • ${escapeHtml(display)}
            ${isInboxView ? unreadBadgeHtml(w) : ""}
          </div>

          <div class="winner-sub">
            Role: <b>Winner</b><br />
            User ID: <b>${escapeHtml(w.user_id || "-")}</b><br />
            Username: <b>${w.username ? "@" + escapeHtml(w.username) : "-"}</b><br />
            Win Time: ${escapeHtml(formatTime(w.at))}
          </div>

          ${statusBadges(w)}
        </div>

        <div class="winner-prize">
          <span>Prize Amount</span>
          <strong>${escapeHtml(w.prize || "-")}</strong>
        </div>
      </div>

      ${isInboxView ? inboxPreviewHtml(w) : ""}
      ${isInboxView ? inboxMetaHtml(w) : ""}

      <div class="action-row">
        <button class="cs-btn primary" data-open-reply-user="${escapeAttr(w.user_id)}">
          Customer Reply ${!isInboxView ? unreadBadgeHtml(w) : ""}
        </button>

        ${
          tgLink
            ? `<a class="cs-link-btn secondary" href="${escapeAttr(tgLink)}" target="_blank" rel="noopener">Open Telegram</a>`
            : ""
        }

        <button class="cs-btn secondary" data-copy-id="${escapeAttr(w.user_id)}">
          Copy ID
        </button>
      </div>
    </article>
  `;
}

function renderWinners() {
  renderStats();
  renderFilterButtons();

  if (!el.winnerList) return;

  const rows = state.filtered.slice(0, state.visibleCount);

  if (!rows.length) {
    el.winnerList.innerHTML = `<div class="cs-empty">Winner မရှိသေးပါ</div>`;
    renderLoadMore();
    return;
  }

  el.winnerList.innerHTML = rows.map(buildWinnerCard).join("");

  bindActionButtons();
  renderLoadMore();
}

async function toggleDone(userId, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Updating...";
    }

    await api("/winner/done", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        toggle: true,
      }),
    });

    const row = state.winners.find((x) => String(x.user_id) === String(userId));

    if (row) {
      row.done = !row.done;
      row.done_at = new Date().toISOString();
      row.cs_status = row.done ? "done" : "pending";
    }

    applyFilter();
    renderWinners();

    if (state.selectedUserId) {
      renderReplyModalContent(state.selectedUserId, window.__lastReplyMessages || []);
    }

    showToast("Done updated ✅", "success");
  } catch (err) {
    showToast(err.message || "Done update failed", "error");
  } finally {
    state.loading = false;
  }
}

async function sendNotice(userId, prize, button) {
  if (!userId || state.loading) return;

  try {
    state.loading = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    const data = await api("/notice", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        prize,
      }),
    });

    const row = state.winners.find((x) => String(x.user_id) === String(userId));

    if (row && data.dm_ok !== false) {
      row.notice_sent = true;
      row.notice_at = new Date().toISOString();
      row.cs_status = "notice_sent";
    }

    applyFilter();
    renderWinners();

    if (state.selectedUserId) {
      await openReplyModal(state.selectedUserId, false);
    }

    if (data.dm_ok === false) {
      showToast(data.dm_error || "DM failed", "error");
      return;
    }

    showToast("Notice sent ✅", "success");
  } catch (err) {
    showToast(err.message || "Notice failed", "error");
  } finally {
    state.loading = false;
  }
}

async function sendAccountRequest(userId, prize, button) {
  const uid = String(userId || "");
  const oldText = button ? button.textContent : "";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    const data = await api("/winner/message", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid,
        prize,
        mode: "account_request",
      }),
    });

    if (data.dm_ok === false) {
      showToast(data.dm_error || "DM failed", "error");
      return;
    }

    const text = buildAccountRequestText(prize);
    const w = state.winners.find((x) => String(x.user_id) === uid);

    if (w) {
      w.notice_sent = true;
      w.notice_at = new Date().toISOString();
      w.cs_status = "notice_sent";
      w.last_outbound_text = text;
      w.last_outbound_at = new Date().toISOString();
    }

    applyFilter();
    renderWinners();

    if (state.selectedUserId) {
      await openReplyModal(state.selectedUserId, false);
    }

    showToast("Account request ပို့ပြီးပါပြီ ✅", "success");
  } catch (err) {
    showToast(err.message || "Send failed", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || "Send Account Request";
    }
  }
}

async function saveWinnerInfo(userId, button) {
  const uid = String(userId || "");

  const accountInput = document.querySelector(`[data-modal-account="${cssEscape(uid)}"]`);
  const phoneInput = document.querySelector(`[data-modal-phone="${cssEscape(uid)}"]`);
  const noteInput = document.querySelector(`[data-modal-note="${cssEscape(uid)}"]`);

  const game_account = accountInput ? accountInput.value.trim() : "";
  const game_phone = phoneInput ? phoneInput.value.trim() : "";
  const cs_note = noteInput ? noteInput.value.trim() : "";

  const oldText = button ? button.textContent : "";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    const data = await api("/winner/update", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid,
        game_account,
        game_phone,
        cs_note,
      }),
    });

    if (!data.ok) throw new Error(data.error || "Save failed");

    const w = state.winners.find((x) => String(x.user_id) === uid);

    if (w) {
      w.game_account = game_account;
      w.game_phone = game_phone;
      w.cs_note = cs_note;
    }

    renderReplyModalContent(uid, window.__lastReplyMessages || []);
    applyFilter();
    renderWinners();
    showToast("Game account info saved ✅", "success");
  } catch (err) {
    showToast(err.message || "Save failed", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || "Save Game Acc Info";
    }
  }
}

async function sendModalCustomerMessage(userId, button) {
  const uid = String(userId || "");
  const w = state.winners.find((x) => String(x.user_id) === uid);
  const box = document.querySelector(`[data-modal-message="${cssEscape(uid)}"]`);
  const text = box ? box.value.trim() : "";

  if (!text) {
    showToast("Message ရေးပြီးမှ Send လုပ်ပါ", "error");
    return;
  }

  const oldText = button ? button.textContent : "";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    const data = await api("/winner/message", {
      method: "POST",
      body: JSON.stringify({
        user_id: uid,
        prize: w?.prize || "",
        text,
        mode: "custom",
      }),
    });

    if (data.dm_ok === false) {
      showToast(data.dm_error || "DM failed", "error");
      return;
    }

    if (w) {
      w.notice_sent = true;
      w.last_outbound_text = text;
      w.last_outbound_at = new Date().toISOString();
    }

    if (box) box.value = "";

    await openReplyModal(uid, false);
    applyFilter();
    renderWinners();
    showToast("Customer ဆီ message ပို့ပြီးပါပြီ ✅", "success");
  } catch (err) {
    showToast(err.message || "Send failed", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || "Send To Customer";
    }
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    showToast("Copied ✅", "success");
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = String(text || "");
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("Copied ✅", "success");
  }
}

function savedAccountView(w) {
  const account = String(w.game_account || "").trim();
  const phone = String(w.game_phone || "").trim();
  const note = String(w.cs_note || "").trim();

  if (!account && !phone && !note) {
    return `Saved Info: မရှိသေးပါ`;
  }

  return `Saved Info

Account Name - ${account || "-"}
Telegram Number - ${phone || "-"}
CS Note - ${note || "-"}`;
}

function chatMessagesHtml(messages) {
  if (!messages.length) {
    return `<div class="cs-empty">Reply / Message history မရှိသေးပါ</div>`;
  }

  return messages
    .map((m) => {
      const direction = String(m.direction || "inbound");
      const source = String(m.source || "");
      const ok = m.ok === false ? "Failed" : "OK";
      const role = direction === "outbound" ? "CS / Bot" : "Customer";

      return `
        <div class="chat-row ${escapeAttr(direction)}">
          <div class="chat-bubble">
            ${escapeHtml(m.text || "")}
            <div class="chat-meta">
              Role: ${escapeHtml(role)} • ${escapeHtml(source || "-")} • ${escapeHtml(formatTime(m.at))} • ${escapeHtml(ok)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderReplyModalContent(userId, messages) {
  const uid = String(userId || "");
  const w = state.winners.find((x) => String(x.user_id) === uid);

  if (!w || !el.replyModalBody) return;

  const display = w.display || w.name || (w.username ? `@${w.username}` : uid);

  el.replyModalBody.innerHTML = `
    <section class="role-section">
<div class="role-title">
  <div class="role-title-left">
    <span>Customer Reply / Message History</span>
    ${
      Number(w.inbound_unread_count || 0)
        ? `<span class="reply-modal-unread">${escapeHtml(w.inbound_unread_count)}</span>`
        : ""
    }
  </div>
  <span class="role-tag">Customer Inbox</span>
</div>

      <div class="saved-view">
Winner: ${escapeHtml(display)}
User ID: ${escapeHtml(uid)}
Username: ${w.username ? "@" + escapeHtml(w.username) : "-"}
Prize: ${escapeHtml(w.prize || "-")}
Win Time: ${escapeHtml(formatTime(w.at))}
Status: ${w.done ? "Done" : "Pending"}
      </div>

      <div class="action-row">
        <button class="cs-btn ${w.done ? "danger" : "green"}" data-modal-done="${escapeAttr(uid)}">
          ${w.done ? "Undo Done" : "Mark Done"}
        </button>

        <button
          class="cs-btn secondary"
          data-modal-notice="${escapeAttr(uid)}"
          data-prize="${escapeAttr(w.prize || "")}"
        >
          Notice
        </button>

        <button
          class="cs-btn orange"
          data-modal-send-template="${escapeAttr(uid)}"
          data-prize="${escapeAttr(w.prize || "")}"
        >
          Send Account Request
        </button>
      </div>
    </section>

    <section class="role-section">
      <div class="role-title">
        <span>Winner Game Account Information</span>
        <span class="role-tag">CS Save</span>
      </div>

      <div class="info-grid">
        <div class="field">
          <label>Account Name / Game Account</label>
          <input
            data-modal-account="${escapeAttr(uid)}"
            value="${escapeAttr(w.game_account || "")}"
            placeholder="Account Name -"
          />
        </div>

        <div class="field">
          <label>Telegram Number</label>
          <input
            data-modal-phone="${escapeAttr(uid)}"
            value="${escapeAttr(w.game_phone || "")}"
            placeholder="Telegram Number -"
          />
        </div>

        <div class="field full">
          <label>CS Note</label>
          <textarea
            data-modal-note="${escapeAttr(uid)}"
            placeholder="Winner account info / payment note / CS remark..."
          >${escapeHtml(w.cs_note || "")}</textarea>
        </div>
      </div>

      <div class="saved-view">${escapeHtml(savedAccountView(w))}</div>

      <div class="action-row">
        <button class="cs-btn green" data-modal-save="${escapeAttr(uid)}">
          Save Game Acc Info
        </button>

        <button class="cs-btn secondary" data-copy-template="${escapeAttr(uid)}">
          Copy Account Template
        </button>
      </div>
    </section>

    <section class="role-section">
      <div class="role-title">
        <span>CS Message To Customer</span>
        <span class="role-tag">CS / Bot</span>
      </div>

      <div class="field full">
        <label>Message</label>
        <textarea
          data-modal-message="${escapeAttr(uid)}"
          placeholder="CS message ရေးပြီး Send To Customer နှိပ်ပါ..."
        ></textarea>
      </div>

      <div class="action-row">
        <button class="cs-btn orange" data-modal-fill-template="${escapeAttr(uid)}">
          Fill Account Template
        </button>

        <button class="cs-btn dark" data-modal-send-message="${escapeAttr(uid)}">
          Send To Customer
        </button>
      </div>
    </section>

    <section class="role-section">
      <div class="role-title">
        <span>Customer Reply / Message History</span>
        <span class="role-tag">Customer</span>
      </div>

      <div class="chat-list">
        ${chatMessagesHtml(messages)}
      </div>
    </section>
  `;

  bindModalButtons(uid);
}

function bindModalButtons(uid) {
  const saveBtn = document.querySelector(`[data-modal-save="${cssEscape(uid)}"]`);
  const copyBtn = document.querySelector(`[data-copy-template="${cssEscape(uid)}"]`);
  const fillBtn = document.querySelector(`[data-modal-fill-template="${cssEscape(uid)}"]`);
  const sendBtn = document.querySelector(`[data-modal-send-message="${cssEscape(uid)}"]`);
  const doneBtn = document.querySelector(`[data-modal-done="${cssEscape(uid)}"]`);
  const noticeBtn = document.querySelector(`[data-modal-notice="${cssEscape(uid)}"]`);
  const sendTemplateBtn = document.querySelector(`[data-modal-send-template="${cssEscape(uid)}"]`);

  if (saveBtn) saveBtn.onclick = () => saveWinnerInfo(uid, saveBtn);

  if (copyBtn) {
    copyBtn.onclick = () => {
      const w = state.winners.find((x) => String(x.user_id) === String(uid));
      copyText(buildAccountRequestText(w?.prize || ""));
    };
  }

  if (fillBtn) {
    fillBtn.onclick = () => {
      const w = state.winners.find((x) => String(x.user_id) === String(uid));
      const box = document.querySelector(`[data-modal-message="${cssEscape(uid)}"]`);

      if (box) {
        box.value = buildAccountRequestText(w?.prize || "");
        box.focus();
        showToast("Template ဖြည့်ပြီးပါပြီ ✅", "success");
      }
    };
  }

  if (sendBtn) sendBtn.onclick = () => sendModalCustomerMessage(uid, sendBtn);
  if (doneBtn) doneBtn.onclick = () => toggleDone(uid, doneBtn);

  if (noticeBtn) {
    const w = state.winners.find((x) => String(x.user_id) === String(uid));
    noticeBtn.onclick = () => sendNotice(uid, w?.prize || "", noticeBtn);
  }

  if (sendTemplateBtn) {
    const w = state.winners.find((x) => String(x.user_id) === String(uid));
    sendTemplateBtn.onclick = () => sendAccountRequest(uid, w?.prize || "", sendTemplateBtn);
  }
}

async function openReplyModal(userId, showLoading = true) {
  const uid = String(userId || "");
  state.selectedUserId = uid;

  const w = state.winners.find((x) => String(x.user_id) === uid);

  if (!w || !el.replyModal || !el.replyModalBody) return;

  el.replyModal.classList.remove("hidden");
  el.replyModalBackdrop?.classList.remove("hidden");

  if (el.replyModalTitle) {
    el.replyModalTitle.textContent = `Customer Reply - ${w.display || uid}`;
  }

  if (el.replyModalSub) {
    el.replyModalSub.textContent = `User ID: ${uid} • Prize: ${w.prize || "-"} • Role: Winner`;
  }

  if (showLoading) {
    el.replyModalBody.innerHTML = `<div class="cs-empty">Loading customer reply...</div>`;
  }

  try {
const data = await api(`/winner/messages?user_id=${encodeURIComponent(uid)}&mark_read=1`);
const messages = Array.isArray(data.messages) ? data.messages : [];
window.__lastReplyMessages = messages;

const w = state.winners.find((x) => String(x.user_id) === uid);
if (w) {
  w.inbound_unread_count = Number(data.unread_count || 0) || 0;
  w.last_read_at = data.last_read_at || new Date().toISOString();
}

renderReplyModalContent(uid, messages);
applyFilter();
renderWinners();

function closeReplyModal() {
  state.selectedUserId = "";
  el.replyModal?.classList.add("hidden");
  el.replyModalBackdrop?.classList.add("hidden");
}

function bindActionButtons() {
  document.querySelectorAll("[data-open-reply-user]").forEach((btn) => {
    btn.onclick = () => {
      openReplyModal(btn.getAttribute("data-open-reply-user"));
    };
  });

  document.querySelectorAll("[data-copy-id]").forEach((btn) => {
    btn.onclick = () => {
      copyText(btn.getAttribute("data-copy-id") || "");
    };
  });
}

function exportCsv() {
  const headers = [
    "Turn",
    "Prize",
    "User ID",
    "Display",
    "Name",
    "Username",
    "Done",
    "Notice Sent",
    "Game Account",
    "Telegram Number",
    "CS Note",
    "Last Reply",
    "Last Reply At",
    "Last Sent",
    "Last Sent At",
    "Win Time",
  ];

  const rows = (state.winners || []).map((w) => [
    w.turn || "",
    w.prize || "",
    w.user_id || "",
    w.display || "",
    w.name || "",
    w.username || "",
    w.done ? "YES" : "NO",
    w.notice_sent ? "YES" : "NO",
    w.game_account || "",
    w.game_phone || "",
    w.cs_note || "",
    w.last_reply_text || "",
    w.last_reply_at || "",
    w.last_outbound_text || "",
    w.last_outbound_at || "",
    w.at || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `lucky77-cs-winners-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function refreshPage() {
  try {
    if (el.refreshBtn) {
      el.refreshBtn.disabled = true;
      el.refreshBtn.textContent = "Loading...";
    }

    await loadWinners();
    renderWinners();
    showToast("Refreshed ✅", "success");
  } catch (err) {
    showToast(err.message || "Load failed", "error");

    if (el.winnerList) {
      el.winnerList.innerHTML = `<div class="cs-empty">${escapeHtml(err.message || "Load failed")}</div>`;
    }
  } finally {
    if (el.refreshBtn) {
      el.refreshBtn.disabled = false;
      el.refreshBtn.textContent = "Refresh";
    }
  }
}

function bindEvents() {
  el.refreshBtn?.addEventListener("click", refreshPage);
  el.exportBtn?.addEventListener("click", exportCsv);

  el.logoutBtn?.addEventListener("click", () => {
    forgetApiKey();
    location.reload();
  });

  el.searchInput?.addEventListener("input", () => {
    applyFilter();
    renderWinners();
  });

  el.loadMoreBtn?.addEventListener("click", () => {
    state.visibleCount += CONFIG.PAGE_SIZE;
    renderWinners();
  });

  el.replyModalClose?.addEventListener("click", closeReplyModal);
  el.replyModalBackdrop?.addEventListener("click", closeReplyModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeReplyModal();
  });
}

bindEvents();

requireAdminLoginBeforeLoad().then((ok) => {
  if (ok) refreshPage();
});