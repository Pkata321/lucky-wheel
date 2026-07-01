const CONFIG = {
  BASE_URL: "https://lucky77-wheel-bot-548i.onrender.com",
  API_KEY: "",
  TIMEOUT_MS: 60000,
  CACHE_BUSTER: "cs-note-done-amount-v1",
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
  doneWinnerCount: document.getElementById("doneWinnerCount"),
  doneAmount: document.getElementById("doneAmount"),

  winnerList: document.getElementById("winnerList"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  footerText: document.getElementById("footerText"),
  toast: document.getElementById("toast"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  filterRow: document.getElementById("filterRow"),

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
  return escapeHtml(value).replace(/'/g, "&#039;");
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
  if (CONFIG.API_KEY) return CONFIG.API_KEY;

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
      }))
    : [];

  applyFilter();
}

function filterMatch(w) {
  if (state.activeFilter === "pending") return !w.done;
  if (state.activeFilter === "done") return !!w.done;
  if (state.activeFilter === "notice_pending") return !w.notice_sent;
  if (state.activeFilter === "notice_sent") return !!w.notice_sent;
  if (state.activeFilter === "replied") return !!String(w.last_reply_text || "").trim();
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
      w.cs_status,
      w.last_reply_text,
      w.last_outbound_text,
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

  const filters = [
    ["all", "All"],
    ["pending", "Pending"],
    ["done", "Done"],
    ["notice_pending", "Notice Pending"],
    ["notice_sent", "Notice Sent"],
    ["replied", "User Replied"],
  ];

  el.filterRow.innerHTML = filters
    .map(([key, label]) => {
      const active = state.activeFilter === key ? "active" : "";
      return `<button class="filter-btn ${active}" data-filter="${escapeAttr(key)}">${escapeHtml(label)}</button>`;
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

function statusBadgeHtml(w) {
  const doneClass = w.done ? "done" : "pending";
  const doneText = w.done ? "Done" : "Pending";
  const noticeText = w.notice_sent ? "Notice Sent" : "Notice Pending";
  const noticeClass = w.notice_sent ? "done" : "pending";
  const reply = String(w.last_reply_text || "").trim();

  return `
    <div class="cs-badges">
      <span class="cs-badge ${doneClass}">${doneText}</span>
      <span class="cs-badge ${noticeClass}">${noticeText}</span>
      ${reply ? `<span class="cs-badge reply">User Replied</span>` : ""}
    </div>
  `;
}

function savedPreviewHtml(w) {
  const account = String(w.game_account || "").trim();
  const phone = String(w.game_phone || "").trim();
  const note = String(w.cs_note || "").trim();

  if (!account && !phone && !note) {
    return `<div class="saved-preview">Saved Info: မရှိသေးပါ</div>`;
  }

  return `
    <div class="saved-preview">
Account Name - ${escapeHtml(account || "-")}
Telegram Number - ${escapeHtml(phone || "-")}
CS Note - ${escapeHtml(note || "-")}
    </div>
  `;
}

function buildWinnerCard(w) {
  const display = w.display || w.name || (w.username ? `@${w.username}` : w.user_id);
  const tgLink = w.username ? `https://t.me/${String(w.username).replace(/^@+/, "")}` : "";
  const replyText = String(w.last_reply_text || "").trim();
  const outboundText = String(w.last_outbound_text || "").trim();

  const accountTemplate = buildAccountRequestText(w.prize);

  return `
    <article class="cs-item ${w.done ? "done-card" : ""}">
      <div class="cs-item-top">
        <div>
          <div class="cs-item-title">
            #${escapeHtml(w.turn || "-")} • ${escapeHtml(display)}
          </div>

          <div class="cs-item-sub">
            Prize: <b>${escapeHtml(w.prize || "-")}</b><br />
            User ID: <b>${escapeHtml(w.user_id || "-")}</b><br />
            Username: <b>${w.username ? "@" + escapeHtml(w.username) : "-"}</b><br />
            Win Time: ${escapeHtml(formatTime(w.at))}
          </div>

          ${statusBadgeHtml(w)}
        </div>
      </div>

      <div class="winner-info-box">
        <div class="winner-info-title">Winner Game Acc Information</div>

        <div class="input-grid">
          <div class="field">
            <label>Account Name / Game Account</label>
            <input
              data-game-account-user="${escapeAttr(w.user_id)}"
              value="${escapeAttr(w.game_account || "")}"
              placeholder="Account Name -"
            />
          </div>

          <div class="field">
            <label>Telegram Number</label>
            <input
              data-game-phone-user="${escapeAttr(w.user_id)}"
              value="${escapeAttr(w.game_phone || "")}"
              placeholder="Telegram Number -"
            />
          </div>

          <div class="field full">
            <label>CS Note</label>
            <textarea
              data-note-user="${escapeAttr(w.user_id)}"
              placeholder="Winner account info / payment note / CS remark..."
            >${escapeHtml(w.cs_note || "")}</textarea>
          </div>
        </div>

        ${savedPreviewHtml(w)}

        <div class="cs-item-actions">
          <button class="cs-btn green" data-save-info-user="${escapeAttr(w.user_id)}">
            Save Game Acc Info
          </button>

          <button class="cs-btn secondary" data-copy-template-user="${escapeAttr(w.user_id)}">
            Copy Account Template
          </button>
        </div>
      </div>

      <div class="message-box">
        <div class="message-box-title">Send Message To Customer</div>

        <textarea
          data-message-text-user="${escapeAttr(w.user_id)}"
          placeholder="CS message ရေးပြီး Send To Customer နှိပ်ပါ..."
        ></textarea>

        <div class="cs-item-actions">
          <button class="cs-btn orange" data-fill-template-user="${escapeAttr(w.user_id)}">
            Fill Account Template
          </button>

          <button
            class="cs-btn primary"
            data-send-template-user="${escapeAttr(w.user_id)}"
            data-prize="${escapeAttr(w.prize || "")}"
          >
            Send Account Request
          </button>

          <button
            class="cs-btn dark"
            data-message-user="${escapeAttr(w.user_id)}"
            data-prize="${escapeAttr(w.prize || "")}"
          >
            Send To Customer
          </button>
        </div>
      </div>

      ${
        outboundText
          ? `<div class="saved-preview">Last Sent: ${escapeHtml(outboundText)}\nAt: ${escapeHtml(formatTime(w.last_outbound_at))}</div>`
          : ""
      }

      ${
        replyText
          ? `<div class="saved-preview">Last Reply: ${escapeHtml(replyText)}\nAt: ${escapeHtml(formatTime(w.last_reply_at))}</div>`
          : ""
      }

      <div class="cs-item-actions">
        <button class="cs-btn secondary" data-open-chat-user="${escapeAttr(w.user_id)}">
          Customer Reply
        </button>

        <button class="cs-btn secondary" data-copy-id="${escapeAttr(w.user_id)}">
          Copy User ID
        </button>

        ${
          tgLink
            ? `<a class="cs-link-btn secondary" href="${escapeAttr(tgLink)}" target="_blank" rel="noopener">Open Telegram</a>`
            : ""
        }

        <button
          class="cs-btn secondary"
          data-notice-user="${escapeAttr(w.user_id)}"
          data-prize="${escapeAttr(w.prize || "")}"
        >
          Notice
        </button>

        <button class="cs-btn ${w.done ? "danger" : "green"}" data-done-user="${escapeAttr(w.user_id)}">
          ${w.done ? "Undo Done" : "Mark Done"}
        </button>
      </div>

      <script type="application/json" data-template-json="${escapeAttr(w.user_id)}">${JSON.stringify(accountTemplate)}</script>
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
    showToast("Done updated ✅", "success");
  } catch (err) {
    showToast(err.message || "Done update failed", "error");
  } finally {
    state.loading = false;
  }
}

async function saveWinnerInfo(userId, button) {
  const uid = String(userId || "");

  const accountInput = document.querySelector(`[data-game-account-user="${CSS.escape(uid)}"]`);
  const phoneInput = document.querySelector(`[data-game-phone-user="${CSS.escape(uid)}"]`);
  const noteInput = document.querySelector(`[data-note-user="${CSS.escape(uid)}"]`);

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

async function sendCustomerMessage(userId, prize, button) {
  const uid = String(userId || "");
  const box = document.querySelector(`[data-message-text-user="${CSS.escape(uid)}"]`);
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
        prize,
        text,
        mode: "custom",
      }),
    });

    if (data.dm_ok === false) {
      showToast(data.dm_error || "DM failed", "error");
      return;
    }

    const w = state.winners.find((x) => String(x.user_id) === uid);

    if (w) {
      w.notice_sent = true;
      w.last_outbound_text = text;
      w.last_outbound_at = new Date().toISOString();
    }

    if (box) box.value = "";

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

function fillAccountTemplate(userId) {
  const uid = String(userId || "");
  const w = state.winners.find((x) => String(x.user_id) === uid);
  const box = document.querySelector(`[data-message-text-user="${CSS.escape(uid)}"]`);

  if (!box || !w) return;

  box.value = buildAccountRequestText(w.prize);
  box.focus();
  showToast("Template ဖြည့်ပြီးပါပြီ ✅", "success");
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

function copyAccountTemplate(userId) {
  const uid = String(userId || "");
  const w = state.winners.find((x) => String(x.user_id) === uid);
  if (!w) return;
  copyText(buildAccountRequestText(w.prize));
}

async function openCustomerReply(userId) {
  const uid = String(userId || "");
  const w = state.winners.find((x) => String(x.user_id) === uid);

  if (!el.chatModal || !el.chatMessages) return;

  el.chatModal.classList.remove("hidden");
  el.chatModalBackdrop?.classList.remove("hidden");

  if (el.chatModalTitle) {
    el.chatModalTitle.textContent = `Customer Reply - ${w?.display || uid}`;
  }

  if (el.chatModalSub) {
    el.chatModalSub.textContent = `User ID: ${uid} • Prize: ${w?.prize || "-"}`;
  }

  el.chatMessages.innerHTML = `<div class="cs-empty">Loading messages...</div>`;

  try {
    const data = await api(`/winner/messages?user_id=${encodeURIComponent(uid)}`);
    const messages = Array.isArray(data.messages) ? data.messages : [];

    if (!messages.length) {
      el.chatMessages.innerHTML = `<div class="cs-empty">Reply / message history မရှိသေးပါ</div>`;
      return;
    }

    el.chatMessages.innerHTML = messages
      .map((m) => {
        const direction = String(m.direction || "inbound");
        const source = String(m.source || "");
        const ok = m.ok === false ? "Failed" : "OK";

        return `
          <div class="chat-row ${escapeAttr(direction)}">
            <div class="chat-bubble">
              ${escapeHtml(m.text || "")}
              <div class="chat-meta">
                ${escapeHtml(direction)} • ${escapeHtml(source || "-")} • ${escapeHtml(formatTime(m.at))} • ${escapeHtml(ok)}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  } catch (err) {
    el.chatMessages.innerHTML = `<div class="cs-empty">${escapeHtml(err.message || "Load failed")}</div>`;
  }
}

function closeCustomerReply() {
  el.chatModal?.classList.add("hidden");
  el.chatModalBackdrop?.classList.add("hidden");
}

function bindActionButtons() {
  document.querySelectorAll("[data-done-user]").forEach((btn) => {
    btn.onclick = () => {
      toggleDone(btn.getAttribute("data-done-user"), btn);
    };
  });

  document.querySelectorAll("[data-save-info-user]").forEach((btn) => {
    btn.onclick = () => {
      saveWinnerInfo(btn.getAttribute("data-save-info-user"), btn);
    };
  });

  document.querySelectorAll("[data-notice-user]").forEach((btn) => {
    btn.onclick = () => {
      sendNotice(
        btn.getAttribute("data-notice-user"),
        btn.getAttribute("data-prize") || "",
        btn
      );
    };
  });

  document.querySelectorAll("[data-message-user]").forEach((btn) => {
    btn.onclick = () => {
      sendCustomerMessage(
        btn.getAttribute("data-message-user"),
        btn.getAttribute("data-prize") || "",
        btn
      );
    };
  });

  document.querySelectorAll("[data-send-template-user]").forEach((btn) => {
    btn.onclick = () => {
      sendAccountRequest(
        btn.getAttribute("data-send-template-user"),
        btn.getAttribute("data-prize") || "",
        btn
      );
    };
  });

  document.querySelectorAll("[data-fill-template-user]").forEach((btn) => {
    btn.onclick = () => {
      fillAccountTemplate(btn.getAttribute("data-fill-template-user"));
    };
  });

  document.querySelectorAll("[data-copy-template-user]").forEach((btn) => {
    btn.onclick = () => {
      copyAccountTemplate(btn.getAttribute("data-copy-template-user"));
    };
  });

  document.querySelectorAll("[data-open-chat-user]").forEach((btn) => {
    btn.onclick = () => {
      openCustomerReply(btn.getAttribute("data-open-chat-user"));
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

  el.searchInput?.addEventListener("input", () => {
    applyFilter();
    renderWinners();
  });

  el.loadMoreBtn?.addEventListener("click", () => {
    state.visibleCount += CONFIG.PAGE_SIZE;
    renderWinners();
  });

  el.chatModalClose?.addEventListener("click", closeCustomerReply);
  el.chatModalBackdrop?.addEventListener("click", closeCustomerReply);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCustomerReply();
  });
}

bindEvents();
refreshPage();