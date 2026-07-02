"use strict";

/* =========================================================
   Lucky77 Winner Inbox
   Clean stable version
   Respond-style CS Inbox + Media Chat + Broadcast
   Free-safe: manual refresh by default
========================================================= */

const APP = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  CACHE_BUSTER: "winner-inbox-clean-v2",
  STORAGE_KEY: "lucky77_admin_api_key",
  PAGE_SIZE: 60,
};

const ACCOUNT_REQUEST_TEXT = [
  "ဆုထုတ်ရန်အတွက် အောက်က information ၂ ခုကို ပြန်ပို့ပေးပါ။",
  "",
  "Account Name -",
  "Telegram Number -",
].join("\n");

const state = {
  apiKey: "",
  winners: [],
  filtered: [],
  selectedUserId: "",
  selectedWinner: null,
  messages: [],
  filter: "all",
  search: "",
  visibleCount: APP.PAGE_SIZE,
  templates: [],
  campaigns: [],
  selectedFile: null,
  broadcastFile: null,
  booted: false,
};

/* ================= DOM Helpers ================= */
const $ = (id) => document.getElementById(id);

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function safeText(v) {
  return String(v ?? "");
}

function esc(v) {
  return safeText(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactText(v, max = 80) {
  const s = safeText(v).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function moneyText(v) {
  const raw = safeText(v).trim();
  if (!raw) return "-";

  const n = Number(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return raw;

  return `${n.toLocaleString("en-US")} Ks`;
}

function fmtDate(v) {
  if (!v) return "-";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);

  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(v) {
  if (!v) return "";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return safeText(v);

  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarText(w) {
  const name = safeText(w?.display || w?.name || w?.username || w?.user_id).trim();
  if (!name) return "?";

  const parts = name
    .replace("@", "")
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function usernameText(w) {
  const u = safeText(w?.username).replace(/^@+/, "");
  return u ? `@${u}` : "-";
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("is-hidden", !!hidden);
}

function toast(text, type = "info") {
  const el = $("toast");
  if (!el) return;

  el.textContent = text;
  el.className = `cs-toast ${type ? `is-${type}` : ""}`;

  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => {
    el.classList.add("is-hidden");
  }, 3200);
}

function setBadge(text, mode = "online") {
  const badge = $("connectionBadge");
  if (!badge) return;

  badge.classList.remove("is-offline", "is-online");

  if (mode === "offline") {
    badge.classList.add("is-offline");
  } else {
    badge.classList.add("is-online");
  }

  badge.innerHTML = `<span></span>${esc(text)}`;
}

function setLoading(text = "Loading...") {
  setBadge(text, "online");
}

function setOnline(text = "Online") {
  setBadge(text, "online");
}

function setOffline(text = "Offline") {
  setBadge(text, "offline");
}

function clearSelectionVisualBug() {
  try {
    window.getSelection()?.removeAllRanges();
  } catch (_) {}
}

/* ================= API Helpers ================= */
async function api(path, options = {}) {
  const url = `${APP.BASE_URL}${path}`;

  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (state.apiKey) {
    headers["x-api-key"] = state.apiKey;
  }

  const resp = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.body instanceof FormData
        ? options.body
        : typeof options.body === "undefined"
          ? undefined
          : JSON.stringify(options.body),
  });

  const contentType = resp.headers.get("content-type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await resp.json();
  } else {
    data = {
      ok: resp.ok,
      text: await resp.text(),
    };
  }

  if (!resp.ok || data?.ok === false) {
    const err = new Error(data?.error || data?.text || `HTTP ${resp.status}`);
    err.data = data;
    throw err;
  }

  return data;
}

async function authCheck(apiKey) {
  state.apiKey = apiKey;
  return api("/auth/check");
}

async function loadWinners(force = false) {
  setLoading(force ? "Rebuilding..." : "Loading...");

  const data = await api(`/winners/cs${force ? "?force=1" : ""}`);

  state.winners = Array.isArray(data.winners) ? data.winners : [];

  applyFilter();
  renderStats();
  renderWinnerList();

  if (state.selectedUserId) {
    const found = state.winners.find(
      (x) => String(x.user_id) === String(state.selectedUserId)
    );

    if (found) {
      state.selectedWinner = found;
      renderDetails(found);
      renderChatHeader(found);
    }
  }

  setOnline(data.cached ? "Cached" : "Online");
  return data;
}

async function rebuildCache() {
  setLoading("Rebuilding...");

  const data = await api("/cache/winners/rebuild", {
    method: "POST",
    body: {},
  });

  state.winners = Array.isArray(data.winners) ? data.winners : [];

  applyFilter();
  renderStats();
  renderWinnerList();

  setOnline("Cached");
  return data;
}

async function loadMessages(userId, markRead = true) {
  const data = await api(
    `/winner/messages?user_id=${encodeURIComponent(userId)}${
      markRead ? "&mark_read=1" : ""
    }`
  );

  state.messages = Array.isArray(data.messages) ? data.messages : [];
  renderMessages();

  if (markRead) {
    const w = state.winners.find((x) => String(x.user_id) === String(userId));

    if (w) {
      w.inbound_unread_count = 0;
    }

    if (
      state.selectedWinner &&
      String(state.selectedWinner.user_id) === String(userId)
    ) {
      state.selectedWinner.inbound_unread_count = 0;
    }

    applyFilter();
    renderStats();
    renderWinnerList();
  }

  return data;
}

/* ================= Login ================= */
function showLogin() {
  setHidden($("adminLoginScreen"), false);
  setHidden($("adminApp"), true);
}

function showApp() {
  setHidden($("adminLoginScreen"), true);
  setHidden($("adminApp"), false);
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const input = $("adminApiKey");
  const error = $("adminLoginError");
  const btn = $("adminLoginBtn");

  const key = safeText(input?.value).trim();

  if (!key) {
    if (error) error.textContent = "Admin code ထည့်ပါ။";
    return;
  }

  try {
    if (btn) btn.disabled = true;
    if (error) error.textContent = "Checking...";

    await authCheck(key);

    localStorage.setItem(APP.STORAGE_KEY, key);
    state.apiKey = key;

    if (error) error.textContent = "";

    showApp();
    await loadInitialData();
  } catch (err) {
    console.error(err);
    if (error) {
      error.textContent = "Admin code မှားနေပါတယ် / Backend connection failed.";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem(APP.STORAGE_KEY);

  state.apiKey = "";
  state.winners = [];
  state.filtered = [];
  state.selectedUserId = "";
  state.selectedWinner = null;
  state.messages = [];

  showLogin();
}

/* ================= Initial Load ================= */
async function loadInitialData() {
  try {
    await loadWinners(false);
    await Promise.allSettled([loadTemplates(), loadCampaigns()]);
  } catch (err) {
    console.error(err);
    toast(`Load failed: ${err.message}`, "error");
    setOffline("Error");
  }
}

async function boot() {
  if (state.booted) return;
  state.booted = true;

  bindEvents();

  const saved = localStorage.getItem(APP.STORAGE_KEY) || "";

  if (saved) {
    try {
      state.apiKey = saved;
      await authCheck(saved);
      showApp();
      await loadInitialData();
      return;
    } catch (err) {
      console.warn("Saved login failed:", err);
      localStorage.removeItem(APP.STORAGE_KEY);
    }
  }

  showLogin();
}

/* ================= Filtering ================= */
function applyFilter() {
  const search = state.search.trim().toLowerCase();
  const filter = state.filter;

  let arr = [...state.winners];

  if (filter === "unread") {
    arr = arr.filter((w) => Number(w.inbound_unread_count || 0) > 0);
  } else if (filter === "pending") {
    arr = arr.filter((w) => !w.done);
  } else if (filter === "done") {
    arr = arr.filter((w) => !!w.done);
  }

  if (search) {
    arr = arr.filter((w) => {
      const hay = [
        w.display,
        w.name,
        w.username,
        w.user_id,
        w.prize,
        w.last_message_text,
        w.last_reply_text,
        w.last_outbound_text,
        w.cs_status,
        w.game_account,
        w.game_phone,
      ]
        .map((x) => safeText(x).toLowerCase())
        .join(" ");

      return hay.includes(search);
    });
  }

  arr.sort((a, b) => {
    const au = Number(a.inbound_unread_count || 0);
    const bu = Number(b.inbound_unread_count || 0);
    if (au !== bu) return bu - au;

    const ar =
      Date.parse(a.last_reply_at || a.last_message_at || a.at || "") || 0;
    const br =
      Date.parse(b.last_reply_at || b.last_message_at || b.at || "") || 0;
    if (ar !== br) return br - ar;

    return Number(b.turn || 0) - Number(a.turn || 0);
  });

  state.filtered = arr;
}

function getCounts() {
  const total = state.winners.length;

  const unread = state.winners.filter(
    (w) => Number(w.inbound_unread_count || 0) > 0
  ).length;

  const pending = state.winners.filter((w) => !w.done).length;
  const done = state.winners.filter((w) => !!w.done).length;

  const doneAmount = state.winners
    .filter((w) => !!w.done)
    .reduce((sum, w) => {
      const n = Number(safeText(w.prize).replace(/[^\d.-]/g, ""));
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

  return {
    total,
    unread,
    pending,
    done,
    doneAmount,
  };
}

function renderStats() {
  const c = getCounts();

  if ($("totalWinners")) $("totalWinners").textContent = c.total;
  if ($("unreadCount")) $("unreadCount").textContent = c.unread;
  if ($("pendingCount")) $("pendingCount").textContent = c.pending;
  if ($("doneCount")) $("doneCount").textContent = c.done;
  if ($("doneWinnerCount")) $("doneWinnerCount").textContent = `Done: ${c.done}`;
  if ($("doneAmount")) $("doneAmount").textContent = moneyText(c.doneAmount);

  if ($("footerText")) {
    $("footerText").textContent = `Showing ${Math.min(
      state.visibleCount,
      state.filtered.length
    )} of ${state.filtered.length}`;
  }
}
/* ================= Winner List Render ================= */
function getWinnerPreviewText(w) {
  const t =
    safeText(w.last_message_text) ||
    safeText(w.last_reply_text) ||
    safeText(w.last_outbound_text);

  if (t) return t;

  return "No message yet";
}

function getStatusLabel(w) {
  if (w.done) return "done";
  if (Number(w.inbound_unread_count || 0) > 0) return "unread";
  if (w.cs_status) return w.cs_status;
  if (w.notice_sent) return "notice_sent";
  return "pending";
}

function renderWinnerList() {
  const box = $("winnerList");
  if (!box) return;

  const visible = state.filtered.slice(0, state.visibleCount);

  if (!visible.length) {
    box.innerHTML = `<div class="cs-empty">No winners found.</div>`;
    renderStats();
    return;
  }

  box.innerHTML = visible
    .map((w) => {
      const selected = String(w.user_id) === String(state.selectedUserId);
      const unread = Number(w.inbound_unread_count || 0);
      const preview = getWinnerPreviewText(w);
      const status = getStatusLabel(w);

      return `
        <button type="button" class="cs-winner-item ${selected ? "is-active" : ""} ${unread ? "has-unread" : ""}" data-user-id="${esc(w.user_id)}">
          <div class="cs-avatar">${esc(avatarText(w))}</div>

          <div class="cs-winner-main">
            <div class="cs-winner-title">
              <b>${esc(w.display || w.name || w.user_id)}</b>
              <span>${esc(fmtDate(w.last_message_at || w.last_reply_at || w.at))}</span>
            </div>

            <div class="cs-winner-sub">
              ${esc(usernameText(w))}
            </div>

            <div class="cs-winner-preview">
              ${esc(compactText(preview, 58))}
            </div>
          </div>

          <div class="cs-winner-side">
            <span class="cs-prize-badge">${esc(moneyText(w.prize))}</span>
            ${unread ? `<span class="cs-unread-badge">${unread}</span>` : ""}
            <span class="cs-mini-status ${w.done ? "is-done" : ""}">${esc(status)}</span>
          </div>
        </button>
      `;
    })
    .join("");

  box.querySelectorAll(".cs-winner-item").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      clearSelectionVisualBug();
      await selectWinner(btn.dataset.userId);
    });
  });

  renderStats();
}

async function selectWinner(userId) {
  const w = state.winners.find((x) => String(x.user_id) === String(userId));

  if (!w) {
    toast("Winner not found", "error");
    return;
  }

  state.selectedUserId = String(userId);
  state.selectedWinner = w;
  state.messages = [];
  state.selectedFile = null;

  if ($("mediaInput")) $("mediaInput").value = "";
  renderSelectedFile();

  renderWinnerList();
  renderChatHeader(w);
  renderDetails(w);

  setHidden($("chatEmptyState"), true);
  setHidden($("chatActivePanel"), false);

  if ($("chatMessages")) {
    $("chatMessages").innerHTML = `<div class="cs-empty">Loading messages...</div>`;
  }

  try {
    await loadMessages(userId, true);
  } catch (err) {
    console.error(err);
    toast(`Messages failed: ${err.message}`, "error");
  }
}

/* ================= Chat Render ================= */
function renderChatHeader(w) {
  if (!w) return;

  if ($("activeAvatar")) $("activeAvatar").textContent = avatarText(w);
  if ($("activeName")) $("activeName").textContent = w.display || w.name || w.user_id;
  if ($("activeUsername")) $("activeUsername").textContent = usernameText(w);
  if ($("activeUserId")) $("activeUserId").textContent = `User ID: ${w.user_id}`;
}

function mediaUrl(fileId) {
  return `${APP.BASE_URL}/winner/media/${encodeURIComponent(fileId)}?api_key=${encodeURIComponent(state.apiKey)}`;
}

function renderMediaBubble(m) {
  const media = m.media || {};
  const fileId = media.file_id || "";

  if (!fileId) {
    return `<div class="cs-media-missing">[media unavailable]</div>`;
  }

  const mime = safeText(media.mime_type).toLowerCase();
  const isImage =
    m.message_type === "photo" ||
    mime.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(media.file_name || "");

  if (isImage) {
    return `
      <a class="cs-image-link" href="${esc(mediaUrl(fileId))}" target="_blank" rel="noopener">
        <img class="cs-chat-image" src="${esc(mediaUrl(fileId))}" alt="image message" loading="lazy" />
      </a>
    `;
  }

  return `
    <a class="cs-file-link" href="${esc(mediaUrl(fileId))}" target="_blank" rel="noopener">
      📎 ${esc(media.file_name || m.message_type || "file")}
    </a>
  `;
}

function renderMessages() {
  const box = $("chatMessages");
  if (!box) return;

  if (!state.selectedWinner) {
    box.innerHTML = `<div class="cs-empty">Select a winner.</div>`;
    return;
  }

  if (!state.messages.length) {
    box.innerHTML = `
      <div class="cs-date-separator">No messages yet</div>
      <div class="cs-empty">Send notice or reply to start conversation.</div>
    `;
    return;
  }

  let lastDate = "";

  box.innerHTML = state.messages
    .map((m) => {
      const dateKey = safeText(m.at).slice(0, 10);
      let sep = "";

      if (dateKey && dateKey !== lastDate) {
        lastDate = dateKey;
        sep = `<div class="cs-date-separator">${esc(dateKey)}</div>`;
      }

      const outbound = m.direction === "outbound";
      const text = m.text || m.caption || "";
      const hasMedia = m.media && m.media.file_id;

      return `
        ${sep}
        <div class="cs-message-row ${outbound ? "is-outbound" : "is-inbound"}">
          ${!outbound ? `<div class="cs-message-avatar">${esc(avatarText(state.selectedWinner))}</div>` : ""}

          <div class="cs-message-bubble">
            ${hasMedia ? renderMediaBubble(m) : ""}
            ${text ? `<div class="cs-message-text">${esc(text).replaceAll("\n", "<br>")}</div>` : ""}
            <div class="cs-message-meta">
              ${esc(fmtTime(m.at))}
              ${outbound ? " ✓✓" : ""}
            </div>
          </div>

          ${outbound ? `<div class="cs-message-avatar is-cs">CS</div>` : ""}
        </div>
      `;
    })
    .join("");

  box.scrollTop = box.scrollHeight;
}

/* ================= Details Render ================= */
function renderDetails(w) {
  if (!w) {
    if ($("detailName")) $("detailName").textContent = "-";
    if ($("detailUsername")) $("detailUsername").textContent = "-";
    if ($("detailUserId")) $("detailUserId").textContent = "-";
    if ($("detailStatus")) $("detailStatus").textContent = "-";
    if ($("detailPrize")) $("detailPrize").textContent = "-";
    if ($("detailNotice")) $("detailNotice").textContent = "-";
    if ($("detailCsStatus")) $("detailCsStatus").textContent = "-";
    if ($("detailLastReply")) $("detailLastReply").textContent = "-";
    if ($("detailDoneCheckbox")) $("detailDoneCheckbox").checked = false;
    if ($("detailNote")) $("detailNote").value = "";
    if ($("detailGameAccount")) $("detailGameAccount").value = "";
    if ($("detailGamePhone")) $("detailGamePhone").value = "";
    return;
  }

  if ($("detailName")) $("detailName").textContent = w.display || w.name || "-";
  if ($("detailUsername")) $("detailUsername").textContent = usernameText(w);
  if ($("detailUserId")) $("detailUserId").textContent = w.user_id || "-";
  if ($("detailStatus")) $("detailStatus").textContent = getStatusLabel(w);
  if ($("detailPrize")) $("detailPrize").textContent = moneyText(w.prize);
  if ($("detailNotice")) $("detailNotice").textContent = w.notice_sent ? fmtDate(w.notice_at || w.at) : "Not sent";
  if ($("detailCsStatus")) $("detailCsStatus").textContent = w.cs_status || "pending";
  if ($("detailLastReply")) $("detailLastReply").textContent = fmtDate(w.last_reply_at || w.last_message_at);
  if ($("detailDoneCheckbox")) $("detailDoneCheckbox").checked = !!w.done;
  if ($("detailNote")) $("detailNote").value = safeText(w.cs_note);
  if ($("detailGameAccount")) $("detailGameAccount").value = safeText(w.game_account);
  if ($("detailGamePhone")) $("detailGamePhone").value = safeText(w.game_phone);
}

function syncSelectedWinnerPatch(patch) {
  if (!state.selectedWinner) return;

  Object.assign(state.selectedWinner, patch);

  const idx = state.winners.findIndex(
    (x) => String(x.user_id) === String(state.selectedWinner.user_id)
  );

  if (idx >= 0) {
    Object.assign(state.winners[idx], patch);
  }

  applyFilter();
  renderStats();
  renderWinnerList();
  renderDetails(state.selectedWinner);
}

/* ================= CS Actions ================= */
async function sendTextMessage(text) {
  if (!state.selectedWinner) {
    toast("Winner select လုပ်ပါ။", "error");
    return;
  }

  const clean = safeText(text).trim();

  if (!clean) {
    toast("Message text ထည့်ပါ။", "error");
    return;
  }

  const btn = $("sendReplyBtn");

  try {
    if (btn) btn.disabled = true;

    const data = await api("/winner/message", {
      method: "POST",
      body: {
        user_id: state.selectedWinner.user_id,
        text: clean,
      },
    });

    if (data.log) {
      state.messages.push(data.log);
      renderMessages();
    } else {
      await loadMessages(state.selectedWinner.user_id, false);
    }

    if ($("replyText")) $("replyText").value = "";

    toast("Message sent", "success");
    await loadWinners(false);
  } catch (err) {
    console.error(err);
    toast(`Send failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function sendMediaMessage() {
  if (!state.selectedWinner) {
    toast("Winner select လုပ်ပါ။", "error");
    return;
  }

  if (!state.selectedFile) {
    toast("Image/File ရွေးပါ။", "error");
    return;
  }

  const caption = safeText($("replyText")?.value).trim();
  const fd = new FormData();

  fd.append("user_id", state.selectedWinner.user_id);
  fd.append("caption", caption);
  fd.append("kind", state.selectedFile.type?.startsWith("image/") ? "photo" : "document");
  fd.append("file", state.selectedFile);

  const btn = $("sendReplyBtn");

  try {
    if (btn) btn.disabled = true;

    const data = await api("/winner/message/media", {
      method: "POST",
      body: fd,
    });

    if (data.log) {
      state.messages.push(data.log);
      renderMessages();
    } else {
      await loadMessages(state.selectedWinner.user_id, false);
    }

    state.selectedFile = null;

    if ($("mediaInput")) $("mediaInput").value = "";
    if ($("replyText")) $("replyText").value = "";

    renderSelectedFile();

    toast("Media sent", "success");
    await loadWinners(false);
  } catch (err) {
    console.error(err);
    toast(`Media failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderSelectedFile() {
  const box = $("selectedFilePreview");
  const name = $("selectedFileName");

  if (!box || !name) return;

  if (!state.selectedFile) {
    setHidden(box, true);
    name.textContent = "";
    return;
  }

  name.textContent = `${state.selectedFile.name} (${Math.round(state.selectedFile.size / 1024)} KB)`;
  setHidden(box, false);
}

async function sendReply() {
  clearSelectionVisualBug();

  if (state.selectedFile) {
    await sendMediaMessage();
    return;
  }

  await sendTextMessage($("replyText")?.value || "");
}

async function sendNotice() {
  if (!state.selectedWinner) {
    toast("Winner select လုပ်ပါ။", "error");
    return;
  }

  const btn = $("sendNoticeBtn");

  try {
    if (btn) btn.disabled = true;

    const data = await api("/notice", {
      method: "POST",
      body: {
        user_id: state.selectedWinner.user_id,
      },
    });

    if (data.log) {
      state.messages.push(data.log);
      renderMessages();
    }

    syncSelectedWinnerPatch({
      notice_sent: true,
      notice_at: new Date().toISOString(),
      cs_status: "notice_sent",
    });

    toast("Notice sent", "success");
    await loadWinners(false);
  } catch (err) {
    console.error(err);
    toast(`Notice failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function markDone() {
  if (!state.selectedWinner) {
    toast("Winner select လုပ်ပါ။", "error");
    return;
  }

  const next = !state.selectedWinner.done;

  try {
    await api("/winner/done", {
      method: "POST",
      body: {
        user_id: state.selectedWinner.user_id,
        done: next ? "1" : "0",
      },
    });

    syncSelectedWinnerPatch({
      done: next,
      done_at: next ? new Date().toISOString() : "",
      cs_status: next ? "done" : "pending",
    });

    toast(next ? "Marked done" : "Marked pending", "success");
    await loadWinners(false);
  } catch (err) {
    console.error(err);
    toast(`Update failed: ${err.message}`, "error");
  }
}

async function saveWinnerNote() {
  if (!state.selectedWinner) {
    toast("Winner select လုပ်ပါ။", "error");
    return;
  }

  const patch = {
    user_id: state.selectedWinner.user_id,
    cs_note: $("detailNote")?.value || "",
    game_account: $("detailGameAccount")?.value || "",
    game_phone: $("detailGamePhone")?.value || "",
  };

  try {
    await api("/winner/update", {
      method: "POST",
      body: patch,
    });

    syncSelectedWinnerPatch({
      cs_note: patch.cs_note,
      game_account: patch.game_account,
      game_phone: patch.game_phone,
    });

    toast("Saved", "success");
  } catch (err) {
    console.error(err);
    toast(`Save failed: ${err.message}`, "error");
  }
}

async function setDoneFromCheckbox() {
  if (!state.selectedWinner) return;

  const checked = !!$("detailDoneCheckbox")?.checked;

  try {
    await api("/winner/update", {
      method: "POST",
      body: {
        user_id: state.selectedWinner.user_id,
        done: checked ? "1" : "0",
      },
    });

    syncSelectedWinnerPatch({
      done: checked,
      done_at: checked ? new Date().toISOString() : "",
      cs_status: checked ? "done" : "pending",
    });

    toast("Done status updated", "success");
  } catch (err) {
    console.error(err);
    toast(`Done update failed: ${err.message}`, "error");

    if ($("detailDoneCheckbox")) {
      $("detailDoneCheckbox").checked = !checked;
    }
  }
}
/* ================= Broadcast Templates ================= */
async function loadTemplates() {
  try {
    const data = await api("/broadcast/templates");

    state.templates = Array.isArray(data.templates) ? data.templates : [];

    renderTemplateOptions();
    return state.templates;
  } catch (err) {
    console.warn("loadTemplates failed:", err);
    return [];
  }
}

function renderTemplateOptions() {
  const sel = $("broadcastTemplateSelect");
  if (!sel) return;

  const current = sel.value || "";

  sel.innerHTML = `
    <option value="">No template / Custom message</option>
    ${state.templates
      .map(
        (t) => `
          <option value="${esc(t.id)}">
            ${esc(t.name || "Untitled")} ${t.type === "photo" ? "🖼" : ""}
          </option>
        `
      )
      .join("")}
  `;

  if (current) sel.value = current;
}

function applySelectedTemplate() {
  const id = $("broadcastTemplateSelect")?.value || "";
  if (!id) return;

  const t = state.templates.find((x) => String(x.id) === String(id));
  if (!t) return;

  if ($("broadcastText")) $("broadcastText").value = safeText(t.text);
  if ($("broadcastCaption")) $("broadcastCaption").value = safeText(t.caption);

  toast("Template loaded", "success");
}

async function saveTemplateFromBroadcastForm() {
  const name =
    safeText($("broadcastName")?.value).trim() || "Broadcast Template";

  const text = safeText($("broadcastText")?.value).trim();
  const caption = safeText($("broadcastCaption")?.value).trim();
  const file = $("broadcastFile")?.files?.[0] || null;

  try {
    let data;

    if (file) {
      const fd = new FormData();

      fd.append("name", name);
      fd.append("text", text);
      fd.append("caption", caption || text);
      fd.append("file", file);

      data = await api("/broadcast/templates/media", {
        method: "POST",
        body: fd,
      });
    } else {
      if (!text && !caption) {
        toast("Template message ထည့်ပါ။", "error");
        return;
      }

      data = await api("/broadcast/templates", {
        method: "POST",
        body: {
          name,
          type: "text",
          text,
          caption,
        },
      });
    }

    if (data.template) {
      const idx = state.templates.findIndex((x) => x.id === data.template.id);

      if (idx >= 0) state.templates[idx] = data.template;
      else state.templates.unshift(data.template);
    }

    renderTemplateOptions();
    toast("Template saved", "success");
  } catch (err) {
    console.error(err);
    toast(`Template save failed: ${err.message}`, "error");
  }
}

/* ================= Broadcast Campaigns ================= */
async function loadCampaigns() {
  try {
    const data = await api("/broadcast/campaigns");

    state.campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

    renderCampaigns();
    return state.campaigns;
  } catch (err) {
    console.warn("loadCampaigns failed:", err);
    return [];
  }
}

function campaignStatusClass(status) {
  const s = safeText(status).toLowerCase();

  if (s === "completed") return "is-done";
  if (s === "running") return "is-running";
  if (s === "queued") return "is-queued";
  if (s === "cancelled") return "is-cancelled";

  return "";
}

function renderCampaigns() {
  const box = $("broadcastCampaignList");
  if (!box) return;

  if (!state.campaigns.length) {
    box.innerHTML = `<div class="cs-empty">No campaigns yet.</div>`;
    return;
  }

  box.innerHTML = state.campaigns
    .slice(0, 20)
    .map((c) => {
      const failed = Number(c.failed || 0);
      const sent = Number(c.sent || 0);
      const total = Number(c.total || 0);

      return `
        <div class="cs-campaign-item">
          <div>
            <b>${esc(c.name || "Broadcast")}</b>
            <p>${esc(compactText(c.text || c.caption || c.type || "", 70))}</p>
            <small>
              ${esc(c.target || "all")} • ${esc(fmtDate(c.created_at))}
              ${c.schedule_at ? ` • schedule ${esc(fmtDate(c.schedule_at))}` : ""}
            </small>
          </div>

          <div class="cs-campaign-meta">
            <span class="cs-mini-status ${campaignStatusClass(c.status)}">${esc(c.status || "draft")}</span>
            <span>${sent}/${total}</span>
            ${failed ? `<span class="cs-fail">${failed} failed</span>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

async function previewBroadcast() {
  const target = $("broadcastTarget")?.value || "all";

  const selectedIds =
    target === "selected" && state.selectedWinner
      ? [String(state.selectedWinner.user_id)]
      : [];

  try {
    const data = await api("/broadcast/campaigns/preview", {
      method: "POST",
      body: {
        target,
        selected_user_ids: selectedIds,
      },
    });

    if ($("broadcastPreviewCount")) {
      $("broadcastPreviewCount").textContent = `Target: ${data.total || 0}`;
    }

    const box = $("broadcastPreviewList");

    if (box) {
      const sample = Array.isArray(data.sample) ? data.sample : [];

      box.innerHTML = sample.length
        ? sample
            .map(
              (w) => `
                <div class="cs-preview-user">
                  <b>${esc(w.display || w.name || w.user_id)}</b>
                  <span>${esc(usernameText(w))}</span>
                  <em>${esc(moneyText(w.prize))}</em>
                </div>
              `
            )
            .join("")
        : `<div class="cs-empty">No target winners.</div>`;
    }

    toast(`Target count: ${data.total || 0}`, "success");
    return data;
  } catch (err) {
    console.error(err);
    toast(`Preview failed: ${err.message}`, "error");
    return null;
  }
}

function getBroadcastFormPayload(sendNow = false, schedule = false) {
  const target = $("broadcastTarget")?.value || "all";

  const selectedIds =
    target === "selected" && state.selectedWinner
      ? [String(state.selectedWinner.user_id)]
      : [];

  const name = safeText($("broadcastName")?.value).trim() || "Broadcast";
  const text = safeText($("broadcastText")?.value).trim();
  const caption = safeText($("broadcastCaption")?.value).trim();

  const scheduleToggle = !!$("broadcastScheduleToggle")?.checked;
  const scheduleAtLocal = $("broadcastScheduleAt")?.value || "";

  let scheduleAt = "";

  if (schedule || scheduleToggle) {
    if (!scheduleAtLocal) {
      throw new Error("Schedule date/time ရွေးပါ။");
    }

    scheduleAt = new Date(scheduleAtLocal).toISOString();
  }

  return {
    name,
    target,
    selected_user_ids: selectedIds,
    type: "text",
    text,
    caption,
    schedule_at: scheduleAt,
    timezone: "Asia/Yangon",
    send_now: sendNow,
  };
}

async function createTextBroadcast(sendNow = false, schedule = false) {
  const payload = getBroadcastFormPayload(sendNow, schedule);

  if (!payload.text && !payload.caption) {
    throw new Error("Broadcast message ထည့်ပါ။");
  }

  const data = await api("/broadcast/campaigns", {
    method: "POST",
    body: payload,
  });

  await loadCampaigns();
  return data;
}

async function createMediaBroadcast(sendNow = false, schedule = false) {
  const payload = getBroadcastFormPayload(sendNow, schedule);
  const file = $("broadcastFile")?.files?.[0] || null;

  if (!file) {
    throw new Error("Broadcast image/file ရွေးပါ။");
  }

  const fd = new FormData();

  fd.append("name", payload.name);
  fd.append("target", payload.target);
  fd.append("selected_user_ids", JSON.stringify(payload.selected_user_ids || []));
  fd.append("text", payload.text || "");
  fd.append("caption", payload.caption || payload.text || "");
  fd.append("schedule_at", payload.schedule_at || "");
  fd.append("timezone", payload.timezone || "Asia/Yangon");
  fd.append("send_now", sendNow ? "true" : "false");
  fd.append("file", file);

  const data = await api("/broadcast/campaigns/media", {
    method: "POST",
    body: fd,
  });

  await loadCampaigns();
  return data;
}

async function sendBroadcastNow() {
  const btn = $("sendBroadcastBtn");
  const file = $("broadcastFile")?.files?.[0] || null;

  const ok = window.confirm(
    "Broadcast ကို ပို့မယ်။ Target filter သေချာစစ်ပြီးပြီလား?"
  );

  if (!ok) return;

  try {
    if (btn) btn.disabled = true;

    toast("Broadcast sending...", "info");

    const data = file
      ? await createMediaBroadcast(true, false)
      : await createTextBroadcast(true, false);

    const result = data.result || {};

    toast(
      `Broadcast done: sent ${result.sent || 0}, failed ${result.failed || 0}`,
      result.failed ? "info" : "success"
    );

    await loadWinners(false);
  } catch (err) {
    console.error(err);
    toast(`Broadcast failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function scheduleBroadcast() {
  const btn = $("scheduleBroadcastBtn");
  const file = $("broadcastFile")?.files?.[0] || null;

  try {
    if (btn) btn.disabled = true;

    const data = file
      ? await createMediaBroadcast(false, true)
      : await createTextBroadcast(false, true);

    toast(`Broadcast scheduled: ${data.campaign?.name || "campaign"}`, "success");

    await loadCampaigns();
  } catch (err) {
    console.error(err);
    toast(`Schedule failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ================= Modal Helpers ================= */
function openModal(id) {
  const el = $(id);
  if (!el) return;

  setHidden(el, false);

  if (id === "broadcastModal") {
    loadTemplates();
    loadCampaigns();
    previewBroadcast().catch(() => {});
  }
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;

  setHidden(el, true);
}

/* ================= Export / Backup ================= */
function exportCurrentWinnersCsv() {
  const rows = state.winners || [];

  const headers = [
    "turn",
    "prize",
    "user_id",
    "display",
    "name",
    "username",
    "done",
    "notice_sent",
    "cs_status",
    "game_account",
    "game_phone",
    "message_count",
    "inbound_unread_count",
    "last_message_text",
    "last_message_at",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((w) =>
      headers
        .map((h) => {
          const val = safeText(w[h]).replaceAll('"', '""');
          return `"${val}"`;
        })
        .join(",")
    ),
  ].join("\n");

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
}

async function sendBackupToOwner() {
  const ok = window.confirm(
    "Light backup ကို Owner Telegram ဆီပို့မယ်။ ဆက်လုပ်မလား?"
  );

  if (!ok) return;

  try {
    await api("/backup/send-owner", {
      method: "POST",
      body: {
        mode: "light",
      },
    });

    toast("Backup sent to owner Telegram", "success");
  } catch (err) {
    console.error(err);
    toast(`Backup failed: ${err.message}`, "error");
  }
}

/* ================= UI Small Actions ================= */
function insertAccountRequest() {
  const el = $("replyText");
  if (!el) return;

  const current = safeText(el.value).trim();

  el.value = current
    ? `${current}\n\n${ACCOUNT_REQUEST_TEXT}`
    : ACCOUNT_REQUEST_TEXT;

  el.focus();
  clearSelectionVisualBug();
}

function updateTabActive() {
  qsa(".cs-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
  });
}
/* ================= Stable Layout Guard ================= */
function initStableLayout() {
  const grid = document.querySelector(".cs-grid");
  if (!grid) return;

  grid.style.gridTemplateColumns = "";
  grid.dataset.resizableReady = "";

  document
    .querySelectorAll(".cs-grid-resizer")
    .forEach((el) => el.remove());

  localStorage.removeItem("lucky77_cs_left_width");
  localStorage.removeItem("lucky77_cs_right_width");
}

/* ================= Event Binding ================= */
function bindEvents() {
  initStableLayout();

  const loginForm = $("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  const refreshBtn = $("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await loadWinners(false);
        toast("Refreshed", "success");
      } catch (err) {
        console.error(err);
        toast(`Refresh failed: ${err.message}`, "error");
      }
    });
  }

  const sidebarRefreshBtn = $("sidebarRefreshBtn");
  if (sidebarRefreshBtn) {
    sidebarRefreshBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await loadWinners(false);
        toast("Refreshed", "success");
      } catch (err) {
        console.error(err);
        toast(`Refresh failed: ${err.message}`, "error");
      }
    });
  }

  const forceRebuildBtn = $("forceRebuildBtn");
  if (forceRebuildBtn) {
    forceRebuildBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const ok = window.confirm(
        "Winner cache ကို force rebuild လုပ်မယ်။ ဆက်လုပ်မလား?"
      );

      if (!ok) return;

      try {
        await rebuildCache();
        toast("Cache rebuilt", "success");
      } catch (err) {
        console.error(err);
        toast(`Rebuild failed: ${err.message}`, "error");
      }
    });
  }

  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      state.visibleCount = APP.PAGE_SIZE;

      applyFilter();
      updateTabActive();
      renderWinnerList();
      renderStats();
    });
  }

  qsa(".cs-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      state.filter = btn.dataset.filter || "all";
      state.visibleCount = APP.PAGE_SIZE;

      updateTabActive();
      applyFilter();
      renderWinnerList();
      renderStats();
      clearSelectionVisualBug();
    });
  });

  const loadMoreBtn = $("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();

      state.visibleCount += APP.PAGE_SIZE;
      renderWinnerList();
    });
  }

  const sendReplyBtn = $("sendReplyBtn");
  if (sendReplyBtn) {
    sendReplyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await sendReply();
    });
  }

  const replyText = $("replyText");
  if (replyText) {
    replyText.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendReply();
      }
    });
  }

  const mediaInput = $("mediaInput");
  if (mediaInput) {
    mediaInput.addEventListener("change", () => {
      state.selectedFile = mediaInput.files?.[0] || null;
      renderSelectedFile();
    });
  }

  const clearSelectedFileBtn = $("clearSelectedFileBtn");
  if (clearSelectedFileBtn) {
    clearSelectedFileBtn.addEventListener("click", (e) => {
      e.preventDefault();

      state.selectedFile = null;

      if ($("mediaInput")) {
        $("mediaInput").value = "";
      }

      renderSelectedFile();
    });
  }

  const quickAccountRequestBtn = $("quickAccountRequestBtn");
  if (quickAccountRequestBtn) {
    quickAccountRequestBtn.addEventListener("click", (e) => {
      e.preventDefault();
      insertAccountRequest();
    });
  }

  const sendNoticeBtn = $("sendNoticeBtn");
  if (sendNoticeBtn) {
    sendNoticeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await sendNotice();
    });
  }

  const markDoneBtn = $("markDoneBtn");
  if (markDoneBtn) {
    markDoneBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await markDone();
    });
  }

  const saveNoteBtn = $("saveNoteBtn");
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await saveWinnerNote();
    });
  }

  const detailDoneCheckbox = $("detailDoneCheckbox");
  if (detailDoneCheckbox) {
    detailDoneCheckbox.addEventListener("change", async () => {
      await setDoneFromCheckbox();
    });
  }

  const broadcastBtn = $("broadcastBtn");
  if (broadcastBtn) {
    broadcastBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("broadcastModal");
    });
  }

  const openBroadcastNavBtn = $("openBroadcastNavBtn");
  if (openBroadcastNavBtn) {
    openBroadcastNavBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("broadcastModal");
    });
  }

  const openTemplatesNavBtn = $("openTemplatesNavBtn");
  if (openTemplatesNavBtn) {
    openTemplatesNavBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal("broadcastModal");
    });
  }

  qsa("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      closeModal(el.dataset.closeModal);
    });
  });

  const broadcastTemplateSelect = $("broadcastTemplateSelect");
  if (broadcastTemplateSelect) {
    broadcastTemplateSelect.addEventListener("change", applySelectedTemplate);
  }

  const broadcastTarget = $("broadcastTarget");
  if (broadcastTarget) {
    broadcastTarget.addEventListener("change", () => {
      previewBroadcast().catch(() => {});
    });
  }

  const broadcastFile = $("broadcastFile");
  if (broadcastFile) {
    broadcastFile.addEventListener("change", () => {
      state.broadcastFile = broadcastFile.files?.[0] || null;

      if (state.broadcastFile) {
        toast(`Broadcast file selected: ${state.broadcastFile.name}`, "info");
      }
    });
  }

  const previewBroadcastBtn = $("previewBroadcastBtn");
  if (previewBroadcastBtn) {
    previewBroadcastBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await previewBroadcast();
    });
  }

  const saveTemplateBtn = $("saveTemplateBtn");
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await saveTemplateFromBroadcastForm();
    });
  }

  const sendBroadcastBtn = $("sendBroadcastBtn");
  if (sendBroadcastBtn) {
    sendBroadcastBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await sendBroadcastNow();
    });
  }

  const scheduleBroadcastBtn = $("scheduleBroadcastBtn");
  if (scheduleBroadcastBtn) {
    scheduleBroadcastBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await scheduleBroadcast();
    });
  }

  const refreshCampaignsBtn = $("refreshCampaignsBtn");
  if (refreshCampaignsBtn) {
    refreshCampaignsBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      await loadCampaigns();
      toast("Campaigns refreshed", "success");
    });
  }

  const exportBtn = $("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      exportCurrentWinnersCsv();
    });
  }

  const backupBtn = $("backupBtn");
  if (backupBtn) {
    backupBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await sendBackupToOwner();
    });
  }

  const assignBtn = $("assignBtn");
  if (assignBtn) {
    assignBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Assigned to CS Team", "success");
    });
  }

  const replyModalClose = $("replyModalClose");
  if (replyModalClose) {
    replyModalClose.addEventListener("click", () => closeModal("replyModal"));
  }

  const replyModalBackdrop = $("replyModalBackdrop");
  if (replyModalBackdrop) {
    replyModalBackdrop.addEventListener("click", () => closeModal("replyModal"));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("broadcastModal");
      closeModal("replyModal");
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) clearSelectionVisualBug();
  });
}

/* ================= Final Boot ================= */
document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("Boot failed:", err);
    toast(`Boot failed: ${err.message}`, "error");
    showLogin();
  });
});