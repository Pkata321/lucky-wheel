"use strict";

/* =========================================================
   Lucky77 Winner Inbox Dashboard
   Version: clean-stable-login-v3.1.0
   Backend: Render
   Frontend: Vercel
========================================================= */

/* ================= App Config ================= */
const APP = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  CACHE_BUSTER: "winner-inbox-login-v3-1-0",
  STORAGE_KEY: "lucky77_admin_api_key",
  ACCOUNT_KEY: "lucky77_dashboard_account",
  PAGE_SIZE: 60,
};

const ACCOUNT_REQUEST_TEXT = [
  "မင်္ဂလာပါ Lucky77 မှ ဆက်သွယ်ခြင်းဖြစ်ပါတယ်။",
  "",
  "SpinWheel ဆုငွေထုတ်ယူရန် အောက်ပါအချက်အလက်များကို ပြန်ပို့ပေးပါရှင့်။",
  "",
  "Account Name -",
  "Account Number -",
  "Payment Type -",
  "",
  "ကျေးဇူးတင်ပါတယ်။"
].join("\n");

const PRIZE_NOTICE_TEXT = [
  "🎉 Congratulations ပါရှင့်",
  "",
  "Lucky77 SpinWheel မှ ဆုရရှိထားပါတယ်။",
  "ဆုငွေထုတ်ယူရန် Account information ပြန်ပို့ပေးပါရှင့်။"
].join("\n");

/* ================= State ================= */
const state = {
  apiKey: localStorage.getItem(APP.STORAGE_KEY) || "",
  account: localStorage.getItem(APP.ACCOUNT_KEY) || "lucky77autospin",

  winners: [],
  filtered: [],
  messages: [],

  selectedUserId: "",
  selectedWinner: null,
  selectedFile: null,

  filter: "all",
  search: "",
  visibleCount: APP.PAGE_SIZE,

  templates: [],
  campaigns: [],
  broadcastFile: null,

  booted: false,
  loading: false,
};

/* ================= DOM Helpers ================= */
function $(id) {
  return document.getElementById(id);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function safeText(value) {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
}

function esc(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactText(value, max = 120) {
  const s = safeText(value).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function moneyText(value) {
  const raw = safeText(value).trim();
  if (!raw) return "-";
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return raw;
  return `${n.toLocaleString("en-US")} Ks`;
}

function fmtDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarText(winner) {
  const display = safeText(winner?.display || winner?.name || winner?.username || "77").trim();
  if (!display) return "77";
  const clean = display.replace("@", "").trim();
  if (!clean) return "77";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return clean.slice(0, 2).toUpperCase();
}

function usernameText(username) {
  const u = safeText(username).replace(/^@+/, "").trim();
  return u ? `@${u}` : "-";
}

function setHidden(el, hidden) {
  if (!el) return;
  el.hidden = !!hidden;
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = safeText(text);
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = safeText(value);
}

function getValue(id) {
  const el = $(id);
  return el ? safeText(el.value) : "";
}

function toast(message, type = "info") {
  const el = $("toast");
  if (!el) {
    console.log(message);
    return;
  }

  el.textContent = safeText(message);
  el.className = `cs-toast is-${type}`;
  el.hidden = false;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

function setOnline(text = "Online") {
  const badge = $("statusBadge");
  const label = $("statusText");

  if (badge) {
    badge.classList.remove("is-offline");
    badge.classList.add("is-online");
  }

  if (label) label.textContent = text;
}

function setOffline(text = "Offline") {
  const badge = $("statusBadge");
  const label = $("statusText");

  if (badge) {
    badge.classList.remove("is-online");
    badge.classList.add("is-offline");
  }

  if (label) label.textContent = text;
}

function setLoading(loading, label = "Loading...") {
  state.loading = !!loading;

  const buttons = [
    "refreshBtn",
    "sidebarRefreshBtn",
    "forceRebuildBtn",
    "sendReplyBtn",
    "sendNoticeBtn",
    "markDoneBtn",
    "sendBroadcastBtn",
    "scheduleBroadcastBtn",
    "previewBroadcastBtn",
    "saveTemplateBtn",
    "backupOwnerBtn",
    "exportBtn",
  ];

  buttons.forEach((id) => {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = !!loading;
  });

  if (loading) setOnline(label);
  else setOnline("Online");
}

function showLoginError(message) {
  const el = $("loginError");
  if (!el) return;
  el.textContent = safeText(message);
  el.hidden = !message;
}

/* ================= API Helper ================= */
async function api(path, options = {}) {
  const method = options.method || "GET";
  const isFormData = options.body instanceof FormData;

  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";

  if (state.apiKey) {
    headers["x-api-key"] = state.apiKey;
  }

  const url = `${APP.BASE_URL}${path}`;

  const fetchOptions = {
    method,
    headers,
  };

  if (typeof options.body !== "undefined") {
    fetchOptions.body = isFormData ? options.body : JSON.stringify(options.body || {});
  }

  const res = await fetch(url, fetchOptions);

  let data = null;
  const text = await res.text();

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { ok: false, raw: text };
  }

  if (!res.ok || data.ok === false) {
    const error = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function authLogin(account, apiPass) {
  const res = await fetch(`${APP.BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account,
      api_pass: apiPass,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || "Login failed");
  }

  return data;
}

async function authCheck() {
  if (!state.apiKey) return false;

  try {
    const data = await api("/auth/check");
    return !!data.ok;
  } catch (_) {
    return false;
  }
}

async function requestForgotPass(account) {
  const res = await fetch(`${APP.BASE_URL}/auth/forgot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account: account || getValue("accountInput") || "lucky77autospin",
      requester: "dashboard-login",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || "Forgot Api Pass request failed");
  }

  return data;
}

/* ================= Login / App View ================= */
function showLogin() {
  setHidden($("loginView"), false);
  setHidden($("appView"), true);

  const accountInput = $("accountInput");
  if (accountInput) accountInput.value = state.account || "lucky77autospin";

  const passInput = $("apiPassInput");
  if (passInput && !passInput.value) {
    passInput.focus();
  }
}

function showApp() {
  setHidden($("loginView"), true);
  setHidden($("appView"), false);

  setText("accountNameText", state.account || "lucky77autospin");
}

async function handleLogin(event) {
  event?.preventDefault?.();

  const account = getValue("accountInput").trim();
  const pass = getValue("apiPassInput").trim();

  showLoginError("");

  if (!account) {
    showLoginError("Account လိုအပ်ပါတယ်။");
    return;
  }

  if (!pass) {
    showLoginError("Api Pass လိုအပ်ပါတယ်။");
    return;
  }

  const loginBtn = $("loginBtn");
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.querySelector("strong").textContent = "Checking...";
  }

  try {
    const data = await authLogin(account, pass);

    state.account = account;
    state.apiKey = data.api_key || pass;

    localStorage.setItem(APP.ACCOUNT_KEY, state.account);
    localStorage.setItem(APP.STORAGE_KEY, state.apiKey);

    showApp();
    await loadInitialData();

    toast("Login success", "success");
  } catch (err) {
    showLoginError(err.message || "Login failed");
    toast("Login failed", "error");
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.querySelector("strong").textContent = "Login";
    }
  }
}

function logout() {
  stopNotificationWatcher();
  document.title = notificationState.originalTitle;

  state.apiKey = "";
  state.account = "lucky77autospin";
  
  
  localStorage.removeItem(APP.STORAGE_KEY);
  localStorage.removeItem(APP.ACCOUNT_KEY);

  state.winners = [];
  state.filtered = [];
  state.selectedUserId = "";
  state.selectedWinner = null;
  state.messages = [];

  showLogin();
  toast("Logged out", "info");
}

async function boot() {
  initStableLayout();
  bindEvents();

  const passInput = $("apiPassInput");
  if (passInput) passInput.value = "";

  if (state.apiKey) {
    const ok = await authCheck();
    if (ok) {
      showApp();
      await loadInitialData();
      return;
    }

    localStorage.removeItem(APP.STORAGE_KEY);
    state.apiKey = "";
  }

  showLogin();
}


/* ================= New Message Notification Sound ================= */
const notificationState = {
  audioCtx: null,
  unlocked: false,
  timer: null,
  previousUnreadTotal: null,
  originalTitle: document.title || "Lucky77 Winner Inbox",
};

function getUnreadTotal(list = state.winners) {
  return list.reduce((sum, w) => sum + Number(w.unread || 0), 0);
}

function unlockNotificationSound() {
  if (notificationState.unlocked) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    notificationState.audioCtx = notificationState.audioCtx || new AudioContextClass();

    if (notificationState.audioCtx.state === "suspended") {
      notificationState.audioCtx.resume();
    }

    notificationState.unlocked = true;
  } catch (_) {}
}

function playNotificationSound() {
  if (!notificationState.unlocked || !notificationState.audioCtx) return;

  try {
    const ctx = notificationState.audioCtx;
    const now = ctx.currentTime;

    function beep(start, frequency) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }

    beep(now, 880);
    beep(now + 0.22, 1175);
  } catch (_) {}
}

function updateNotificationTitle() {
  const unread = getUnreadTotal();

  if (unread > 0) {
    document.title = `(${unread}) ${notificationState.originalTitle}`;
  } else {
    document.title = notificationState.originalTitle;
  }
}

async function pollNewMessagesForNotification() {
  if (!state.apiKey) return;
  if (!$("appView") || $("appView").hidden) return;

  try {
    const oldUnread = getUnreadTotal();

    const data = await api(`/winners/cs?_=${Date.now()}`);
    const nextWinners = Array.isArray(data.winners) ? data.winners : [];

    const newUnread = getUnreadTotal(nextWinners);

    state.winners = nextWinners;

    if (state.selectedUserId) {
      const selected = state.winners.find((w) => String(w.user_id) === String(state.selectedUserId));
      if (selected) {
        state.selectedWinner = selected;
        renderChatHeader();
        renderDetails();
      }
    }

    applyFilter({ keepVisible: true });
    renderStats();
    updateNotificationTitle();

    if (
      notificationState.previousUnreadTotal !== null &&
      newUnread > oldUnread &&
      newUnread > notificationState.previousUnreadTotal
    ) {
      playNotificationSound();
      toast(`New message received (${newUnread} unread)`, "info");
    }

    notificationState.previousUnreadTotal = newUnread;
  } catch (err) {
    console.warn("Notification poll failed", err);
  }
}

function startNotificationWatcher() {
  stopNotificationWatcher();

  notificationState.previousUnreadTotal = getUnreadTotal();
  updateNotificationTitle();

  notificationState.timer = setInterval(() => {
    pollNewMessagesForNotification();
  }, 25000);
}

function stopNotificationWatcher() {
  if (notificationState.timer) {
    clearInterval(notificationState.timer);
    notificationState.timer = null;
  }
}

/* ================= Data Load ================= */
async function loadInitialData() {
  if (!state.apiKey) {
    showLogin();
    return;
  }

  setLoading(true, "Loading");

  try {
    await Promise.all([
      loadWinners(false),
      loadTemplates(),
      loadCampaigns(),
    ]);

    setOnline("Online");
    state.booted = true;
    startNotificationWatcher ();
  } catch (err) {
    console.error(err);
    setOffline("Error");
    toast(err.message || "Load failed", "error");

    if (err.status === 401) {
      logout();
    }
  } finally {
    setLoading(false);
  }
}

async function loadWinners(rebuild = false) {
  const query = rebuild ? "?rebuild=1" : `?_=${Date.now()}`;
  const data = await api(`/winners/cs${query}`);

  state.winners = Array.isArray(data.winners) ? data.winners : [];
  state.visibleCount = APP.PAGE_SIZE;

  setText("cacheInfoText", data.cache_at ? `Cache: ${fmtTime(data.cache_at)}` : "Cache ready");

  applyFilter();
  renderStats();

  return state.winners;
}

async function rebuildCache() {
  setLoading(true, "Rebuilding");

  try {
    const data = await api("/cache/winners/rebuild", {
      method: "POST",
      body: {},
    });

    toast(`Cache rebuilt: ${data.total || 0}`, "success");
    await loadWinners(false);
  } catch (err) {
    toast(err.message || "Rebuild failed", "error");
  } finally {
    setLoading(false);
  }
}

async function loadMessages(userId, markRead = true) {
  if (!userId) return;

  const data = await api(
    `/winner/messages?user_id=${encodeURIComponent(userId)}&mark_read=${markRead ? "1" : "0"}&_=${Date.now()}`
  );

  state.messages = Array.isArray(data.messages) ? data.messages : [];

  const summary = data.summary || {};
  syncSelectedWinnerPatch({
    unread: summary.unread || 0,
    note: summary.note || "",
    cs_status: summary.status || "pending",
    last_reply_at: summary.last_reply_at || "",
    last_message_at: summary.last_message_at || "",
    last_preview: summary.last_preview || "",
  });

  renderMessages();
  renderDetails();

  if (markRead) {
    applyFilter({ keepVisible: true });
    renderStats();
  }
}

/* ================= Filtering / Sorting ================= */
function applyFilter(options = {}) {
  const filter = state.filter;
  const term = state.search.trim().toLowerCase();

  let list = [...state.winners];

  if (filter === "unread") {
    list = list.filter((w) => Number(w.unread || 0) > 0);
  } else if (filter === "pending") {
    list = list.filter((w) => safeText(w.cs_status || "pending") !== "done");
  } else if (filter === "done") {
    list = list.filter((w) => safeText(w.cs_status) === "done");
  }

  if (term) {
    list = list.filter((w) => {
      const text = [
        w.user_id,
        w.id,
        w.name,
        w.username,
        w.display,
        w.prize,
        w.note,
        w.last_preview,
      ]
        .map(safeText)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }

  list.sort((a, b) => {
    const au = Number(a.unread || 0);
    const bu = Number(b.unread || 0);
    if (bu !== au) return bu - au;

    const ad = Date.parse(a.last_reply_at || a.last_message_at || a.at || 0) || 0;
    const bd = Date.parse(b.last_reply_at || b.last_message_at || b.at || 0) || 0;
    if (bd !== ad) return bd - ad;

    return Number(b.turn || 0) - Number(a.turn || 0);
  });

  state.filtered = list;

  if (!options.keepVisible) {
    state.visibleCount = APP.PAGE_SIZE;
  }

  renderWinnerList();
}

function getCounts() {
  const total = state.winners.length;
  const unread = state.winners.filter((w) => Number(w.unread || 0) > 0).length;
  const done = state.winners.filter((w) => safeText(w.cs_status) === "done").length;
  const pending = total - done;

  return {
    total,
    unread,
    pending,
    done,
  };
}

function renderStats() {
  const c = getCounts();

  setText("statTotal", c.total);
  setText("statUnread", c.unread);
  setText("statPending", c.pending);
  setText("statDone", c.done);
  setText("listCount", state.filtered.length);
}
/* ================= Winner List Render ================= */
function renderWinnerList() {
  const listEl = $("winnerList");
  if (!listEl) return;

  const visible = state.filtered.slice(0, state.visibleCount);

  if (!visible.length) {
    listEl.innerHTML = `<div class="cs-empty">No winners found.</div>`;
    setHidden($("loadMoreBtn"), true);
    return;
  }

  listEl.innerHTML = visible
    .map((w) => {
      const active = String(w.user_id) === String(state.selectedUserId);
      const unread = Number(w.unread || 0);
      const status = safeText(w.cs_status || "pending");
      const done = status === "done";

      const preview =
        w.last_preview ||
        (unread ? "New message received" : "No message yet");

      return `
        <button
          type="button"
          class="cs-winner-item ${active ? "is-active" : ""} ${unread ? "has-unread" : ""}"
          data-user-id="${esc(w.user_id)}"
        >
          <div class="cs-avatar">${esc(avatarText(w))}</div>

          <div class="cs-winner-main">
            <div class="cs-winner-title">
              <b>${esc(w.display || w.name || w.username || w.user_id)}</b>
              ${unread ? `<span class="cs-unread-badge">${unread}</span>` : ""}
            </div>

            <div class="cs-winner-sub">
              <span>${esc(usernameText(w.username))}</span>
              <span>•</span>
              <span>ID ${esc(w.user_id)}</span>
            </div>

            <div class="cs-winner-preview">${esc(compactText(preview, 64))}</div>
          </div>

          <div class="cs-winner-side">
            <strong class="cs-prize-badge">${esc(moneyText(w.prize))}</strong>
            <span class="cs-mini-status ${done ? "is-done" : "is-pending"}">
              ${done ? "Done" : "Pending"}
            </span>
            <small>${esc(fmtTime(w.last_message_at || w.at))}</small>
          </div>
        </button>
      `;
    })
    .join("");

  qsa(".cs-winner-item", listEl).forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.userId;
      if (uid) selectWinner(uid);
    });
  });

  setHidden($("loadMoreBtn"), state.visibleCount >= state.filtered.length);
}

function updateTabActive() {
  qsa(".cs-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
  });
}

/* ================= Winner Select / Chat ================= */
async function selectWinner(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return;

  const winner = state.winners.find((w) => String(w.user_id) === uid);
  if (!winner) return;

  state.selectedUserId = uid;
  state.selectedWinner = winner;
  state.messages = [];

  renderWinnerList();
  renderChatHeader();
  renderDetails();

  setHidden($("emptyChat"), true);
  setHidden($("chatActive"), false);

  await loadMessages(uid, true);
}

function renderChatHeader() {
  const w = state.selectedWinner;
  if (!w) return;

  setText("chatAvatar", avatarText(w));
  setText("chatName", w.display || w.name || w.username || w.user_id);

  const sub = [
    usernameText(w.username),
    `ID ${w.user_id}`,
    moneyText(w.prize),
  ]
    .filter(Boolean)
    .join(" • ");

  setText("chatSub", sub);
}

function mediaUrl(fileId) {
  if (!fileId) return "";
  const key = encodeURIComponent(state.apiKey || "");
  return `${APP.BASE_URL}/winner/media/${encodeURIComponent(fileId)}?api_key=${key}`;
}

function renderMedia(media) {
  if (!media || !media.file_id) return "";

  const type = safeText(media.type || "document");
  const fileName = safeText(media.file_name || type);
  const url = mediaUrl(media.file_id);

  if (type === "photo") {
    return `
      <a href="${esc(url)}" target="_blank" rel="noreferrer">
        <img class="cs-chat-image" src="${esc(url)}" alt="photo" loading="lazy" />
      </a>
    `;
  }

  if (type === "video") {
    return `
      <video class="cs-chat-video" src="${esc(url)}" controls preload="metadata"></video>
    `;
  }

  return `
    <a class="cs-file-link" href="${esc(url)}" target="_blank" rel="noreferrer">
      📎 ${esc(fileName)}
    </a>
  `;
}

function renderMessages() {
  const box = $("chatMessages");
  if (!box) return;

  if (!state.messages.length) {
    box.innerHTML = `<div class="cs-empty">No messages yet.</div>`;
    return;
  }

  box.innerHTML = state.messages
    .map((m) => {
      const out = m.direction === "out";
      const media = renderMedia(m.media);
      const text = safeText(m.text || "");

      return `
        <div class="cs-message-row ${out ? "is-out" : "is-in"}">
          <div class="cs-message-bubble">
            ${media ? `<div class="cs-message-media">${media}</div>` : ""}
            ${text ? `<div class="cs-message-text">${esc(text).replaceAll("\n", "<br>")}</div>` : ""}
            <div class="cs-message-meta">
              <span>${out ? "CS" : "Customer"}</span>
              <span>${esc(fmtTime(m.at))}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  box.scrollTop = box.scrollHeight;
}

function renderDetails() {
  const w = state.selectedWinner;

  if (!w) {
    setText("detailName", "-");
    setText("detailUsername", "-");
    setText("detailUserId", "-");
    setText("detailPrize", "-");
    setText("detailTurn", "-");
    setText("detailStatus", "-");
    setValue("detailNote", "");
    const cb = $("detailDoneCheckbox");
    if (cb) cb.checked = false;
    return;
  }

  setText("detailName", w.name || w.display || "-");
  setText("detailUsername", usernameText(w.username));
  setText("detailUserId", w.user_id || "-");
  setText("detailPrize", moneyText(w.prize));
  setText("detailTurn", w.turn || "-");

  const status = safeText(w.cs_status || "pending");
  setText("detailStatus", status === "done" ? "Done" : "Pending");

  setValue("detailNote", w.note || "");

  const cb = $("detailDoneCheckbox");
  if (cb) cb.checked = status === "done";
}

function syncSelectedWinnerPatch(patch) {
  if (!state.selectedUserId) return;

  const uid = String(state.selectedUserId);
  state.winners = state.winners.map((w) => {
    if (String(w.user_id) !== uid) return w;
    return {
      ...w,
      ...patch,
    };
  });

  state.selectedWinner = {
    ...(state.selectedWinner || {}),
    ...patch,
  };
}

/* ================= Winner Actions ================= */
async function sendTextMessage(text, source = "cs") {
  const uid = state.selectedUserId;
  if (!uid) {
    toast("Select winner first", "error");
    return;
  }

  const clean = safeText(text).trim();
  if (!clean) {
    toast("Message empty", "error");
    return;
  }

  setLoading(true, "Sending");

  try {
    const data = await api("/winner/message", {
      method: "POST",
      body: {
        user_id: uid,
        text: clean,
        source,
      },
    });

    if (data.message) {
      state.messages.push(data.message);
      renderMessages();
    }

    setValue("replyText", "");
    syncSelectedWinnerPatch({
      last_preview: compactText(clean, 120),
      last_message_at: new Date().toISOString(),
    });

    applyFilter({ keepVisible: true });
    renderStats();

    toast("Message sent", "success");
  } catch (err) {
    toast(err.message || "Send failed", "error");
  } finally {
    setLoading(false);
  }
}

async function sendMediaMessage(file, caption = "") {
  const uid = state.selectedUserId;
  if (!uid) {
    toast("Select winner first", "error");
    return;
  }

  if (!file) {
    toast("Choose file first", "error");
    return;
  }

  const form = new FormData();
  form.append("user_id", uid);
  form.append("caption", caption || "");
  form.append("source", "cs_media");
  form.append("file", file);

  setLoading(true, "Sending media");

  try {
    const data = await api("/winner/message/media", {
      method: "POST",
      body: form,
    });

    if (data.message) {
      state.messages.push(data.message);
      renderMessages();
    }

    state.selectedFile = null;
    renderSelectedFile();

    setValue("replyText", "");

    syncSelectedWinnerPatch({
      last_preview: caption || "[media]",
      last_message_at: new Date().toISOString(),
    });

    applyFilter({ keepVisible: true });
    renderStats();

    toast("Media sent", "success");
  } catch (err) {
    toast(err.message || "Media send failed", "error");
  } finally {
    setLoading(false);
  }
}

function renderSelectedFile() {
  const box = $("selectedFilePreview");
  const name = $("selectedFileName");

  if (!box || !name) return;

  if (!state.selectedFile) {
    box.hidden = true;
    name.textContent = "";
    const input = $("mediaInput");
    if (input) input.value = "";
    return;
  }

  box.hidden = false;
  name.textContent = state.selectedFile.name || "Selected file";
}

async function sendReply() {
  const text = getValue("replyText").trim();

  if (state.selectedFile) {
    await sendMediaMessage(state.selectedFile, text);
    return;
  }

  await sendTextMessage(text, "cs");
}

function insertAccountRequest() {
  const el = $("replyText");
  if (!el) return;

  el.value = ACCOUNT_REQUEST_TEXT;
  el.focus();
}

async function sendNotice() {
  const w = state.selectedWinner;
  if (!w) {
    toast("Select winner first", "error");
    return;
  }

  const text = [
    PRIZE_NOTICE_TEXT,
    "",
    `Winner: ${w.display || w.name || w.user_id}`,
    `Prize: ${moneyText(w.prize)}`,
    "",
    "Account Name -",
    "Account Number -",
    "Payment Type -",
  ].join("\n");

  await sendTextMessage(text, "notice");
}

async function markDone() {
  const uid = state.selectedUserId;
  if (!uid) {
    toast("Select winner first", "error");
    return;
  }

  setLoading(true, "Saving");

  try {
    await api("/winner/status", {
      method: "POST",
      body: {
        user_id: uid,
        status: "done",
      },
    });

    syncSelectedWinnerPatch({
      cs_status: "done",
      unread: 0,
    });

    applyFilter({ keepVisible: true });
    renderStats();
    renderDetails();

    toast("Marked done", "success");
  } catch (err) {
    toast(err.message || "Mark done failed", "error");
  } finally {
    setLoading(false);
  }
}

async function setDoneFromCheckbox() {
  const uid = state.selectedUserId;
  if (!uid) return;

  const cb = $("detailDoneCheckbox");
  const done = !!cb?.checked;

  setLoading(true, "Saving");

  try {
    await api("/winner/status", {
      method: "POST",
      body: {
        user_id: uid,
        status: done ? "done" : "pending",
      },
    });

    syncSelectedWinnerPatch({
      cs_status: done ? "done" : "pending",
      unread: done ? 0 : Number(state.selectedWinner?.unread || 0),
    });

    applyFilter({ keepVisible: true });
    renderStats();
    renderDetails();

    toast(done ? "Marked done" : "Marked pending", "success");
  } catch (err) {
    toast(err.message || "Status save failed", "error");
  } finally {
    setLoading(false);
  }
}

async function saveWinnerNote() {
  const uid = state.selectedUserId;
  if (!uid) {
    toast("Select winner first", "error");
    return;
  }

  const note = getValue("detailNote");

  setLoading(true, "Saving note");

  try {
    await api("/winner/note", {
      method: "POST",
      body: {
        user_id: uid,
        note,
      },
    });

    syncSelectedWinnerPatch({
      note,
    });

    applyFilter({ keepVisible: true });
    toast("Note saved", "success");
  } catch (err) {
    toast(err.message || "Save note failed", "error");
  } finally {
    setLoading(false);
  }
}

/* ================= Export / Backup ================= */
function exportCsv() {
  const rows = [
    [
      "Turn",
      "Name",
      "Username",
      "User ID",
      "Prize",
      "Status",
      "Unread",
      "Note",
      "Last Message",
      "Created At",
    ],
    ...state.winners.map((w) => [
      w.turn || "",
      w.name || w.display || "",
      w.username ? `@${w.username}` : "",
      w.user_id || "",
      w.prize || "",
      w.cs_status || "pending",
      w.unread || 0,
      w.note || "",
      w.last_preview || "",
      w.at || "",
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${safeText(cell).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lucky77_winners_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  toast("CSV exported", "success");
}

async function sendBackupOwner() {
  setLoading(true, "Backup");

  try {
    await api("/backup/send-owner", {
      method: "POST",
      body: {},
    });

    toast("Backup sent to owner Telegram", "success");
  } catch (err) {
    toast(err.message || "Backup failed", "error");
  } finally {
    setLoading(false);
  }
}

/* ================= Broadcast Templates / Campaigns ================= */
async function loadTemplates() {
  const data = await api("/broadcast/templates");
  state.templates = Array.isArray(data.templates) ? data.templates : [];
  renderTemplates();
}

function renderTemplates() {
  const select = $("broadcastTemplateSelect");
  if (!select) return;

  const current = select.value;

  select.innerHTML = `
    <option value="">No template / Custom message</option>
    ${state.templates
      .map((t) => `<option value="${esc(t.id)}">${esc(t.name || "Untitled")}</option>`)
      .join("")}
  `;

  select.value = current;
}

function applySelectedTemplate() {
  const id = getValue("broadcastTemplateSelect");
  if (!id) return;

  const tpl = state.templates.find((t) => String(t.id) === String(id));
  if (!tpl) return;

  setValue("broadcastText", tpl.text || "");
  setValue("broadcastCaption", tpl.caption || "");
}

async function saveTemplate() {
  const name = getValue("broadcastName").trim() || "Untitled Template";
  const text = getValue("broadcastText");
  const caption = getValue("broadcastCaption");

  setLoading(true, "Saving template");

  try {
    const data = await api("/broadcast/templates", {
      method: "POST",
      body: {
        name,
        text,
        caption,
      },
    });

    if (data.template) {
      state.templates.unshift(data.template);
      renderTemplates();
      $("broadcastTemplateSelect").value = data.template.id;
    }

    toast("Template saved", "success");
  } catch (err) {
    toast(err.message || "Template save failed", "error");
  } finally {
    setLoading(false);
  }
}

async function loadCampaigns() {
  const data = await api("/broadcast/campaigns");
  state.campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  renderCampaigns();
}

function renderCampaigns() {
  const box = $("campaignList");
  if (!box) return;

  if (!state.campaigns.length) {
    box.innerHTML = `<div class="cs-empty">No campaigns yet.</div>`;
    return;
  }

  box.innerHTML = state.campaigns
    .map((c) => {
      return `
        <div class="cs-campaign-item">
          <b>${esc(c.name || "Campaign")}</b>
          <span>${esc(c.status || "-")} • ${Number(c.sent || 0)}/${Number(c.total || 0)}</span>
          <small>Failed: ${Number(c.failed || 0)} • ${esc(fmtTime(c.updated_at || c.created_at))}</small>
        </div>
      `;
    })
    .join("");
}
/* ================= Broadcast Preview / Send ================= */
function getBroadcastPayload() {
  return {
    name: getValue("broadcastName").trim() || "Broadcast Campaign",
    target: getValue("broadcastTarget") || "selected",
    selected_user_id: state.selectedUserId || "",
    text: getValue("broadcastText"),
    caption: getValue("broadcastCaption"),
    scheduled_at: getValue("broadcastScheduleAt"),
  };
}

async function previewBroadcast() {
  const payload = getBroadcastPayload();

  if (payload.target === "selected" && !payload.selected_user_id) {
    toast("Selected Winner Only သုံးမယ်ဆို winner တစ်ယောက်ရွေးထားရမယ်", "error");
    return;
  }

  setLoading(true, "Preview");

  try {
    const data = await api("/broadcast/preview", {
      method: "POST",
      body: {
        target: payload.target,
        selected_user_id: payload.selected_user_id,
      },
    });

    renderBroadcastPreview(data.total || 0, data.sample || []);
    toast(`Target: ${data.total || 0}`, "success");
  } catch (err) {
    toast(err.message || "Preview failed", "error");
  } finally {
    setLoading(false);
  }
}

function renderBroadcastPreview(total, sample) {
  setText("broadcastPreviewTarget", `Target: ${Number(total || 0)}`);

  const box = $("broadcastPreviewList");
  if (!box) return;

  if (!Array.isArray(sample) || !sample.length) {
    box.innerHTML = `<div class="cs-empty">No targets.</div>`;
    return;
  }

  box.innerHTML = sample
    .map((w) => {
      return `
        <div class="cs-preview-user">
          <b>${esc(w.display || w.name || w.user_id)}</b>
          <span>${esc(usernameText(w.username))}</span>
          <strong>${esc(moneyText(w.prize))}</strong>
        </div>
      `;
    })
    .join("");
}

function requireBroadcastConfirm(payload) {
  const target = payload.target;

  if (target === "selected") return true;

  const label = {
    all: "All Winners",
    pending: "Pending / Not Done",
    unread: "Unread Winners",
    done: "Done Winners",
  }[target] || target;

  return window.confirm(
    `Broadcast target is "${label}".\n\nဒီ message ကို selected မဟုတ်ဘဲ target group ဆီ ပို့မှာပါ။ သေချာလား?`
  );
}

async function sendBroadcastNow() {
  const payload = getBroadcastPayload();

  if (payload.target === "selected" && !payload.selected_user_id) {
    toast("Winner တစ်ယောက်ရွေးပြီးမှ Selected Winner Only ပို့ပါ", "error");
    return;
  }

  if (!payload.text.trim() && !payload.caption.trim() && !state.broadcastFile) {
    toast("Message or file required", "error");
    return;
  }

  if (!requireBroadcastConfirm(payload)) return;

  setLoading(true, "Broadcast");

  try {
    let data;

    if (state.broadcastFile) {
      const form = new FormData();
      form.append("name", payload.name);
      form.append("target", payload.target);
      form.append("selected_user_id", payload.selected_user_id);
      form.append("text", payload.text);
      form.append("caption", payload.caption || payload.text);
      form.append("file", state.broadcastFile);

      data = await api("/broadcast/send-media", {
        method: "POST",
        body: form,
      });
    } else {
      data = await api("/broadcast/send", {
        method: "POST",
        body: payload,
      });
    }

    toast(
      `Broadcast done: ${data?.campaign?.sent || 0}/${data?.campaign?.total || 0}`,
      "success"
    );

    await loadCampaigns();
    await loadWinners(false);
  } catch (err) {
    toast(err.message || "Broadcast failed", "error");
  } finally {
    setLoading(false);
  }
}

async function scheduleBroadcast() {
  const payload = getBroadcastPayload();

  if (!payload.scheduled_at) {
    toast("Schedule time လိုအပ်ပါတယ်", "error");
    return;
  }

  if (payload.target === "selected" && !payload.selected_user_id) {
    toast("Winner တစ်ယောက်ရွေးပြီးမှ schedule လုပ်ပါ", "error");
    return;
  }

  if (!payload.text.trim() && !payload.caption.trim() && !state.broadcastFile) {
    toast("Message or file required", "error");
    return;
  }

  if (!requireBroadcastConfirm(payload)) return;

  setLoading(true, "Scheduling");

  try {
    let data;

    const form = new FormData();
    form.append("name", payload.name);
    form.append("target", payload.target);
    form.append("selected_user_id", payload.selected_user_id);
    form.append("text", payload.text);
    form.append("caption", payload.caption || payload.text);
    form.append("scheduled_at", payload.scheduled_at);

    if (state.broadcastFile) {
      form.append("file", state.broadcastFile);
    }

    data = await api("/broadcast/schedule", {
      method: "POST",
      body: form,
    });

    toast(`Scheduled: ${data?.campaign?.name || "Campaign"}`, "success");
    await loadCampaigns();
  } catch (err) {
    toast(err.message || "Schedule failed", "error");
  } finally {
    setLoading(false);
  }
}

function syncBroadcastTargetOnOpen() {
  const target = $("broadcastTarget");
  if (!target) return;

  if (state.selectedUserId) {
    target.value = "selected";
  } else {
    target.value = "all";
  }

  renderBroadcastPreview(0, []);
}

function openBroadcastModal() {
  syncBroadcastTargetOnOpen();
  setHidden($("broadcastModal"), false);

  const text = $("broadcastText");
  if (text && !text.value.trim()) {
    text.value = "Hello {{display}}, congratulations! Prize: {{prize}}";
  }

  setTimeout(() => {
    $("broadcastName")?.focus?.();
  }, 50);
}

function closeBroadcastModal() {
  setHidden($("broadcastModal"), true);
}

function clearBroadcastFile() {
  state.broadcastFile = null;
  const input = $("broadcastFile");
  if (input) input.value = "";
}


/* ================= Simple Winner List Modal ================= */
const simpleWinnerState = {
  search: "",
  status: "all",
};

function openSimpleWinnerList() {
  setHidden($("simpleWinnerModal"), false);
  renderSimpleWinnerList();

  setTimeout(() => {
    $("simpleWinnerSearch")?.focus?.();
  }, 50);
}

function closeSimpleWinnerList() {
  setHidden($("simpleWinnerModal"), true);
}

function simpleWinnerFilteredList() {
  const term = safeText(simpleWinnerState.search).trim().toLowerCase();
  const status = safeText(simpleWinnerState.status || "all");

  let list = [...state.winners];

  if (status === "done") {
    list = list.filter((w) => safeText(w.cs_status) === "done");
  }

  if (status === "undone") {
    list = list.filter((w) => safeText(w.cs_status || "pending") !== "done");
  }

  if (term) {
    list = list.filter((w) => {
      const text = [
        w.name,
        w.display,
        w.username,
        w.user_id,
        w.prize,
        w.cs_status,
      ]
        .map(safeText)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }

  list.sort((a, b) => {
    const adone = safeText(a.cs_status) === "done" ? 1 : 0;
    const bdone = safeText(b.cs_status) === "done" ? 1 : 0;

    if (adone !== bdone) return adone - bdone;

    return Number(a.turn || 0) - Number(b.turn || 0);
  });

  return list;
}

function renderSimpleWinnerList() {
  const box = $("simpleWinnerList");
  if (!box) return;

  const list = simpleWinnerFilteredList();

  if (!list.length) {
    box.innerHTML = `<div class="cs-empty">No winners found.</div>`;
    return;
  }

  box.innerHTML = list
    .map((w) => {
      const done = safeText(w.cs_status) === "done";
      const name = w.name || w.display || "-";
      const username = usernameText(w.username);
      const userId = w.user_id || "-";
      const prize = moneyText(w.prize);

      return `
        <div class="cs-simple-winner-row" data-user-id="${esc(userId)}">
          <div class="cs-simple-name">
            <b>${esc(name)}</b>
            <small>Turn ${esc(w.turn || "-")}</small>
          </div>

          <div class="cs-simple-username">${esc(username)}</div>

          <div class="cs-simple-userid">
            <button
              type="button"
              class="cs-copy-id-btn"
              data-copy-user-id="${esc(userId)}"
              title="Copy User ID"
            >
              ${esc(userId)}
            </button>
          </div>

          <div class="cs-simple-prize">${esc(prize)}</div>

          <div class="cs-simple-status">
            <button
              type="button"
              class="cs-simple-status-btn ${done ? "is-done" : "is-undone"}"
              data-toggle-user-id="${esc(userId)}"
              data-next-status="${done ? "pending" : "done"}"
            >
              ${done ? "Done" : "Undone"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  qsa("[data-toggle-user-id]", box).forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const userId = btn.dataset.toggleUserId;
      const nextStatus = btn.dataset.nextStatus || "pending";

      await toggleSimpleWinnerStatus(userId, nextStatus);
    });
  });

  qsa("[data-copy-user-id]", box).forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const userId = btn.dataset.copyUserId || "";
      try {
        await navigator.clipboard.writeText(userId);
        toast("User ID copied", "success");
      } catch (_) {
        toast(userId, "info");
      }
    });
  });

  qsa(".cs-simple-winner-row", box).forEach((row) => {
    row.addEventListener("click", async () => {
      const userId = row.dataset.userId;
      closeSimpleWinnerList();

      if (userId) {
        await selectWinner(userId);
      }
    });
  });
}

async function toggleSimpleWinnerStatus(userId, nextStatus) {
  const uid = safeText(userId).trim();
  const status = nextStatus === "done" ? "done" : "pending";

  if (!uid) return;

  setLoading(true, "Saving");

  try {
    await api("/winner/status", {
      method: "POST",
      body: {
        user_id: uid,
        status,
      },
    });

    state.winners = state.winners.map((w) => {
      if (String(w.user_id) !== String(uid)) return w;

      return {
        ...w,
        cs_status: status,
        unread: status === "done" ? 0 : Number(w.unread || 0),
      };
    });

    if (String(state.selectedUserId) === String(uid)) {
      syncSelectedWinnerPatch({
        cs_status: status,
        unread: status === "done" ? 0 : Number(state.selectedWinner?.unread || 0),
      });

      renderDetails();
    }

    applyFilter({ keepVisible: true });
    renderStats();
    renderSimpleWinnerList();

    toast(status === "done" ? "Marked Done" : "Marked Undone", "success");
  } catch (err) {
    toast(err.message || "Status update failed", "error");
  } finally {
    setLoading(false);
  }
}

/* ================= Modal Helpers ================= */
function openReplyModal(html) {
  const body = $("replyModalBody");
  if (body) body.innerHTML = html || "";
  setHidden($("replyModal"), false);
}

function closeReplyModal() {
  setHidden($("replyModal"), true);
}

/* ================= Layout Stability ================= */
function initStableLayout() {
  try {
    qsa(".cs-grid-resizer").forEach((el) => el.remove());

    localStorage.removeItem("lucky77_cs_left_width");
    localStorage.removeItem("lucky77_cs_detail_width");

    document.documentElement.classList.remove("cs-is-resizing");
    document.body.classList.remove("cs-is-resizing");
  } catch (_) {}
}

/* ================= Event Binding ================= */
function bindEvents() {
  document.addEventListener("click", unlockNotificationSound, { once: true });
  document.addEventListener("touchstart", unlockNotificationSound, { once: true });

  /* ---------- Login ---------- */
  $("loginForm")?.addEventListener("submit", handleLogin);
  $("togglePassBtn")?.addEventListener("click", () => {
    const input = $("apiPassInput");
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";
  });

  $("forgotPassBtn")?.addEventListener("click", async () => {
    const account = getValue("accountInput").trim() || "lucky77autospin";

    try {
      await requestForgotPass(account);
      toast("Login info sent to admin Telegram bot", "success");
      showLoginError("Admin Telegram bot ဆီ Login Info ပို့ထားပါပြီ။");
    } catch (err) {
      toast(err.message || "Forgot request failed", "error");
      showLoginError(err.message || "Forgot request failed");
    }
  });

  $("contactBotBtn")?.addEventListener("click", async () => {
    const account = getValue("accountInput").trim() || "lucky77autospin";

    try {
      await requestForgotPass(account);
      toast("Admin bot contacted", "success");
      showLoginError("Admin Telegram bot ဆီ Account / ApiPass ပို့ထားပါပြီ။");
    } catch (err) {
      toast(err.message || "Contact bot failed", "error");
      showLoginError(err.message || "Contact bot failed");
    }
  });

  $("logoutBtn")?.addEventListener("click", logout);

  /* ---------- Top / sidebar ---------- */
  $("refreshBtn")?.addEventListener("click", () => loadWinners(false));
  $("sidebarRefreshBtn")?.addEventListener("click", () => loadWinners(false));
  $("forceRebuildBtn")?.addEventListener("click", rebuildCache);
  $("broadcastBtn")?.addEventListener("click", openBroadcastModal);
  $("openBroadcastNavBtn")?.addEventListener("click", openBroadcastModal);
  $("openTemplatesNavBtn")?.addEventListener("click", openBroadcastModal);
  $("exportBtn")?.addEventListener("click", exportCsv);
  $("backupOwnerBtn")?.addEventListener("click", sendBackupOwner);
$("openSimpleWinnerListBtn")?.addEventListener("click", openSimpleWinnerList);
$("closeSimpleWinnerBtn")?.addEventListener("click", closeSimpleWinnerList);

qsa("[data-close-modal='simple-winner']").forEach((el) => {
  el.addEventListener("click", closeSimpleWinnerList);
});

$("simpleWinnerSearch")?.addEventListener("input", (e) => {
  simpleWinnerState.search = e.target.value || "";
  renderSimpleWinnerList();
});

$("simpleWinnerStatusFilter")?.addEventListener("change", (e) => {
  simpleWinnerState.status = e.target.value || "all";
  renderSimpleWinnerList();
});

$("simpleWinnerRefreshBtn")?.addEventListener("click", async () => {
  await loadWinners(false);
  renderSimpleWinnerList();
});
  /* ---------- Search / tabs ---------- */
  $("searchInput")?.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    applyFilter();
    renderStats();
  });

  qsa(".cs-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter || "all";
      updateTabActive();
      applyFilter();
      renderStats();
    });
  });

  $("loadMoreBtn")?.addEventListener("click", () => {
    state.visibleCount += APP.PAGE_SIZE;
    renderWinnerList();
  });

  /* ---------- Chat actions ---------- */
  $("quickAccountRequestBtn")?.addEventListener("click", insertAccountRequest);
  $("sendNoticeBtn")?.addEventListener("click", sendNotice);
  $("markDoneBtn")?.addEventListener("click", markDone);
  $("sendReplyBtn")?.addEventListener("click", sendReply);
  $("saveNoteBtn")?.addEventListener("click", saveWinnerNote);
  $("detailDoneCheckbox")?.addEventListener("change", setDoneFromCheckbox);

  $("assignBtn")?.addEventListener("click", () => {
    toast("Assigned to current CS", "success");
  });

  $("replyText")?.addEventListener("keydown", (e) => {
    const isSend = (e.ctrlKey || e.metaKey) && e.key === "Enter";
    if (!isSend) return;

    e.preventDefault();
    sendReply();
  });

  $("mediaInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0] || null;
    state.selectedFile = file;
    renderSelectedFile();
  });

  $("clearSelectedFileBtn")?.addEventListener("click", () => {
    state.selectedFile = null;
    renderSelectedFile();
  });

  /* ---------- Broadcast modal ---------- */
  $("closeBroadcastBtn")?.addEventListener("click", closeBroadcastModal);

  qsa("[data-close-modal='broadcast']").forEach((el) => {
    el.addEventListener("click", closeBroadcastModal);
  });

  $("broadcastTemplateSelect")?.addEventListener("change", applySelectedTemplate);

  $("broadcastTarget")?.addEventListener("change", () => {
    renderBroadcastPreview(0, []);
  });

  $("broadcastFile")?.addEventListener("change", (e) => {
    state.broadcastFile = e.target.files?.[0] || null;
    if (state.broadcastFile) {
      toast(`Selected: ${state.broadcastFile.name}`, "info");
    }
  });

  $("previewBroadcastBtn")?.addEventListener("click", previewBroadcast);
  $("saveTemplateBtn")?.addEventListener("click", saveTemplate);
  $("sendBroadcastBtn")?.addEventListener("click", sendBroadcastNow);
  $("scheduleBroadcastBtn")?.addEventListener("click", scheduleBroadcast);
  $("refreshCampaignsBtn")?.addEventListener("click", loadCampaigns);

  $("broadcastScheduleToggle")?.addEventListener("change", (e) => {
    const input = $("broadcastScheduleAt");
    if (!input) return;

    if (e.target.checked) {
      input.focus();
    } else {
      input.value = "";
    }
  });

  /* ---------- Reply modal ---------- */
  $("closeReplyModalBtn")?.addEventListener("click", closeReplyModal);

  qsa("[data-close-modal='reply']").forEach((el) => {
    el.addEventListener("click", closeReplyModal);
  });

  document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeBroadcastModal();
    closeSimpleWinnerList();
    closeReplyModal();
  }
});
}

/* ================= Start ================= */
document.addEventListener("DOMContentLoaded", boot);