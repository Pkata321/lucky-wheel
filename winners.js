"use strict";

/* =========================================================
   Lucky77 Winner Inbox
   Respond-style CS Inbox + Media Chat + Broadcast
   Free-safe frontend: manual refresh by default
========================================================= */

const APP = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  CACHE_BUSTER: "winner-inbox-v1",
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

function setLoading(text = "Loading...") {
  const badge = $("connectionBadge");
  if (!badge) return;
  badge.innerHTML = `<span></span>${esc(text)}`;
}

function setOnline(text = "Online") {
  const badge = $("connectionBadge");
  if (!badge) return;
  badge.innerHTML = `<span></span>${esc(text)}`;
}

function setOffline(text = "Offline") {
  const badge = $("connectionBadge");
  if (!badge) return;
  badge.innerHTML = `<span></span>${esc(text)}`;
  badge.classList.add("is-offline");
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
  setOnline("Cache rebuilt");

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
    if (error) error.textContent = "Admin code မှားနေပါတယ် / Backend connection failed.";
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
        w.cs_status,
        w.game_account,
        w.game_phone,
      ]
        .map((x) => safeText(x).toLowerCase())
        .join(" ");

      return hay.includes(search);
    });
  }

  state.filtered = arr;
}

function getCounts() {
  const total = state.winners.length;
  const unread = state.winners.filter((w) => Number(w.inbound_unread_count || 0) > 0).length;
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
  return (
    safeText(w.last_message_text) ||
    safeText(w.last_reply_text) ||
    safeText(w.last_outbound_text) ||
    "No message yet"
  );
}

function getStatusLabel(w) {
  if (w.done) return "Done";
  if (Number(w.inbound_unread_count || 0) > 0) return "Unread";
  if (w.cs_status) return w.cs_status;
  if (w.notice_sent) return "Notice Sent";
  return "Pending";
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
        <button class="cs-winner-item ${selected ? "is-active" : ""}" data-user-id="${esc(w.user_id)}">
          <div class="cs-avatar">${esc(avatarText(w))}</div>

          <div class="cs-winner-main">
            <div class="cs-winner-title">
              <b>${esc(w.display || w.name || w.user_id)}</b>
              <span>${esc(fmtDate(w.last_message_at || w.at))}</span>
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

  qsa(".cs-winner-item", box).forEach((btn) => {
    btn.addEventListener("click", () => {
      selectWinner(btn.dataset.userId);
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

  if (m.message_type === "photo" || safeText(media.mime_type).startsWith("image/")) {
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
  if ($("detailCsStatus")) $("detailCsStatus").textContent = w.cs_status || "Pending";
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
      cs_status: "Notice Sent",
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
      cs_status: next ? "Done" : "Pending",
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
      cs_status: checked ? "Done" : "Pending",
    });

    toast("Done status updated", "success");
  } catch (err) {
    console.error(err);
    toast(`Done update failed: ${err.message}`, "error");
    if ($("detailDoneCheckbox")) $("detailDoneCheckbox").checked = !checked;
  }
}
/* ================= Event Binding ================= */
function bindEvents() {
  const loginForm = $("adminLoginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const refreshBtn = $("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
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
    sidebarRefreshBtn.addEventListener("click", async () => {
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
    forceRebuildBtn.addEventListener("click", async () => {
      const ok = window.confirm("Winner cache ကို force rebuild လုပ်မယ်။ ဆက်လုပ်မလား?");
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
      renderWinnerList();
    });
  }

  qsa(".cs-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter || "all";
      state.visibleCount = APP.PAGE_SIZE;
      updateTabActive();
      applyFilter();
      renderWinnerList();
    });
  });

  const loadMoreBtn = $("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      state.visibleCount += APP.PAGE_SIZE;
      renderWinnerList();
    });
  }

  const sendReplyBtn = $("sendReplyBtn");
  if (sendReplyBtn) {
    sendReplyBtn.addEventListener("click", sendReply);
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
    clearSelectedFileBtn.addEventListener("click", () => {
      state.selectedFile = null;
      if ($("mediaInput")) $("mediaInput").value = "";
      renderSelectedFile();
    });
  }

  const quickAccountRequestBtn = $("quickAccountRequestBtn");
  if (quickAccountRequestBtn) {
    quickAccountRequestBtn.addEventListener("click", insertAccountRequest);
  }

  const sendNoticeBtn = $("sendNoticeBtn");
  if (sendNoticeBtn) {
    sendNoticeBtn.addEventListener("click", sendNotice);
  }

  const markDoneBtn = $("markDoneBtn");
  if (markDoneBtn) {
    markDoneBtn.addEventListener("click", markDone);
  }

  const saveNoteBtn = $("saveNoteBtn");
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener("click", saveWinnerNote);
  }

  const detailDoneCheckbox = $("detailDoneCheckbox");
  if (detailDoneCheckbox) {
    detailDoneCheckbox.addEventListener("change", setDoneFromCheckbox);
  }

  const broadcastBtn = $("broadcastBtn");
  if (broadcastBtn) {
    broadcastBtn.addEventListener("click", () => openModal("broadcastModal"));
  }

  const openBroadcastNavBtn = $("openBroadcastNavBtn");
  if (openBroadcastNavBtn) {
    openBroadcastNavBtn.addEventListener("click", () => openModal("broadcastModal"));
  }

  const openTemplatesNavBtn = $("openTemplatesNavBtn");
  if (openTemplatesNavBtn) {
    openTemplatesNavBtn.addEventListener("click", () => openModal("broadcastModal"));
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
    previewBroadcastBtn.addEventListener("click", previewBroadcast);
  }

  const saveTemplateBtn = $("saveTemplateBtn");
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener("click", saveTemplateFromBroadcastForm);
  }

  const sendBroadcastBtn = $("sendBroadcastBtn");
  if (sendBroadcastBtn) {
    sendBroadcastBtn.addEventListener("click", sendBroadcastNow);
  }

  const scheduleBroadcastBtn = $("scheduleBroadcastBtn");
  if (scheduleBroadcastBtn) {
    scheduleBroadcastBtn.addEventListener("click", scheduleBroadcast);
  }

  const refreshCampaignsBtn = $("refreshCampaignsBtn");
  if (refreshCampaignsBtn) {
    refreshCampaignsBtn.addEventListener("click", async () => {
      await loadCampaigns();
      toast("Campaigns refreshed", "success");
    });
  }

  const exportBtn = $("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportCurrentWinnersCsv);
  }

  const backupBtn = $("backupBtn");
  if (backupBtn) {
    backupBtn.addEventListener("click", sendBackupToOwner);
  }

  const assignBtn = $("assignBtn");
  if (assignBtn) {
    assignBtn.addEventListener("click", () => {
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
}

/* ================= Final Boot ================= */
document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("Boot failed:", err);
    toast(`Boot failed: ${err.message}`, "error");
    showLogin();
  });
});