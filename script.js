"use strict";

const PLAYER = {
  API_BASE: "/backend",
  DEMO: new URLSearchParams(location.search).get("demo") === "1",
  ACCESS_TOKEN: new URLSearchParams(location.search).get("access") || "",
  TEST_TOKEN: new URLSearchParams(location.search).get("token") || "",
  SOUND_KEY: "lucky77_player_sound_v6",
  REQUEST_TIMEOUT_MS: 15000,
};
PLAYER.TEST_MODE = Boolean(
  PLAYER.TEST_TOKEN
  || /^\/test(?:\.html|\/|$)/.test(location.pathname)
  || new URLSearchParams(location.search).get("test") === "1"
);

const state = {
  event: null,
  branding: null,
  counts: { registered: 0, winners: 0, prizes_left: 0 },
  recent: [],
  wheelPrizes: ["5,000 Ks", "10,000 Ks", "20,000 Ks", "30,000 Ks", "50,000 Ks", "100,000 Ks"],
  user: null,
  initData: "",
  channel: { joined: false },
  registered: false,
  preregistered: false,
  spun: false,
  result: null,
  access: { account_ready: false, promo_code: "", promo_sent_at: "" },
  rotation: 0,
  spinning: false,
  spinRequestKey: "",
  localPromoConfirmedCode: "",
  promoConfirming: false,
  promoConfirmation: null,
  previewAccountPending: false,
  accessToken: PLAYER.ACCESS_TOKEN,
  testMode: PLAYER.TEST_MODE,
  sound: localStorage.getItem(PLAYER.SOUND_KEY) !== "off",
  supportLink: "",
};

const $ = (id) => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const safe = (value) => value == null ? "" : String(value);
const esc = (value) => safe(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

function normalizePromoCode(value) {
  return safe(value)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function playerErrorMessage(error) {
  const code = safe(error?.data?.error || "");
  const messages = {
    registration_required: "\u1012\u102e Event \u1021\u1010\u103d\u1000\u103a Register \u101c\u102f\u1015\u103a\u1011\u102c\u1038\u1019\u103e Spin \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
    invalid_unique_code: "Promo Code \u1019\u1019\u103e\u1014\u103a\u1015\u102b\u104b Telegram Bot \u1019\u103e\u1015\u102d\u102f\u1037\u1011\u102c\u1038\u101e\u1031\u102c Code \u1000\u102d\u102f \u1015\u103c\u1014\u103a\u1005\u1005\u103a\u1015\u102b\u104b",
    promo_not_started: "Promo Code \u1000\u102d\u102f \u1021\u101e\u102f\u1036\u1038\u1015\u103c\u102f\u1014\u102d\u102f\u1004\u103a\u101e\u100a\u1037\u103a\u1021\u1001\u103b\u102d\u1014\u103a \u1019\u101b\u1031\u102c\u1000\u103a\u101e\u1031\u1038\u1015\u102b\u104b",
    promo_expired: "Promo Code \u101e\u1000\u103a\u1010\u1019\u103a\u1038\u1000\u102f\u1014\u103a\u1006\u102f\u1036\u1038\u101e\u103d\u102c\u1038\u1015\u102b\u1015\u103c\u102e\u104b",
    event_not_live: "Event \u1019\u1005\u1010\u1004\u103a\u101e\u1031\u1038\u1015\u102b\u104b Event Live \u1016\u103c\u1005\u103a\u101e\u100a\u1037\u103a\u1021\u1001\u103b\u102d\u1014\u103a \u1015\u103c\u1014\u103a\u101c\u103e\u100a\u1037\u103a\u1015\u102b\u104b",
    channel_membership_required: "Lucky77 Channel \u1000\u102d\u102f Join \u1011\u102c\u1038\u1019\u103e Spin \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
    telegram_verification_required: "Official Telegram Bot \u1019\u103e Player Link \u1000\u102d\u102f \u1015\u103c\u1014\u103a\u1016\u103d\u1004\u1037\u103a\u1015\u102b\u104b",
    spin_in_progress: "Spin \u101c\u103e\u100a\u1037\u103a\u1014\u1031\u1006\u1032\u1016\u103c\u1005\u103a\u1015\u102b\u101e\u100a\u103a\u104b \u1001\u100f\u1005\u1031\u102c\u1004\u1037\u103a\u1015\u102b\u104b",
    no_prize_left: "\u1012\u102e Event \u1021\u1010\u103d\u1000\u103a \u1006\u102f\u1019\u103b\u102c\u1038\u1000\u102f\u1014\u103a\u1006\u102f\u1036\u1038\u101e\u103d\u102c\u1038\u1015\u102b\u1015\u103c\u102e\u104b",
    account_after_spin_required: "Spin \u101c\u103e\u100a\u1037\u103a\u1015\u103c\u102e\u1038 \u1006\u102f\u101b\u101b\u103e\u102d\u1019\u103e Game Account Name \u1011\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
    promo_already_used: "\u1012\u102e Promo Code \u1000\u102d\u102f \u1021\u101e\u102f\u1036\u1038\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b",
    test_link_required: "Test access \u1000\u102d\u102f Test Event Link \u1016\u103c\u1004\u1037\u103a\u101e\u102c\u1016\u103d\u1004\u1037\u103a\u1015\u102b\u104b",
  };
  return messages[code] || safe(error?.message || "\u101c\u102f\u1015\u103a\u1006\u1031\u102c\u1004\u103a\u1019\u103e\u102f\u1019\u1021\u1031\u102c\u1004\u103a\u1019\u103c\u1004\u103a\u1015\u102b\u104b \u1015\u103c\u1014\u103a\u1005\u1019\u103a\u1038\u1015\u102b\u104b");
}

function formatPrize(value) {
  const text = safe(value).trim();
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toLocaleString("en-US")} Ks` : text || "Premium Prize";
}

function yangonDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not configured" : new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
}

function initials(user) {
  const text = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "77";
  const parts = text.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : text.slice(0, 2).toUpperCase();
}

function toast(message, type = "info") {
  const node = $("toast");
  node.textContent = safe(message);
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3400);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAYER.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${PLAYER.API_BASE}${path}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
  if (error?.name === "AbortError") throw new Error("\u1001\u103b\u102d\u1010\u103a\u1006\u1000\u103a\u1001\u103b\u102d\u1014\u103a \u1000\u103b\u1031\u102c\u103a\u101c\u103d\u1014\u103a\u101e\u103d\u102c\u1038\u1015\u102b\u1015\u103c\u102e");
    throw error;
  } finally { clearTimeout(timer); }
}

function telegramIdentity() {
  if (PLAYER.TEST_MODE) {
    return {
      user: { id: "test-player", first_name: "Lucky77", last_name: "Test", username: "test_player" },
      initData: "",
      test: true,
    };
  }
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try { webApp.ready(); webApp.expand(); webApp.setHeaderColor("#eaf3ff"); webApp.setBackgroundColor("#f5f9ff"); } catch (_) {}
  }
  const user = webApp?.initDataUnsafe?.user || null;
  const initData = webApp?.initData || "";
  if (user?.id && initData) return { user, initData };
  if (PLAYER.DEMO) return { user: { id: "770077", first_name: "Lucky", last_name: "Preview", username: "previewmember" }, initData: "", demo: true };
  return { user: null, initData: "" };
}

function applyTheme(event) {
  document.body.dataset.theme = event?.theme || "sky-white";
  if (event?.accent) document.documentElement.style.setProperty("--accent", event.accent);
  if (event?.accent_2) document.documentElement.style.setProperty("--accent-2", event.accent_2);
}

function applyBranding(branding) {
  state.branding = branding || {};
  if (branding?.primary) document.documentElement.style.setProperty("--accent", branding.primary);
  if (branding?.secondary) document.documentElement.style.setProperty("--accent-2", branding.secondary);
  const rawLogo = branding?.member_logo_url || branding?.logo_url || "./assets/lucky77-logo.png";
  let logo = rawLogo;
  try {
    logo = new URL(rawLogo, `${location.origin}/`).href;
  } catch (_) {}
  document.querySelectorAll(".brand-seal img, #wheelLogo").forEach((image) => { image.src = logo; });
}

function renderHeader() {
  const name = state.user ? `${state.user.first_name || ""} ${state.user.last_name || ""}`.trim() || `@${state.user.username || "member"}` : "Lucky Member";
  $("memberName").textContent = name;
  $("memberAvatar").textContent = initials(state.user);
  $("memberStatus").textContent = state.testMode
    ? state.user ? "Test Member" : "Telegram \u1001\u103b\u102d\u1010\u103a\u1006\u1000\u103a\u101b\u1014\u103a"
    : state.spun
      ? state.access.account_ready ? "\u1006\u102f\u101b\u101a\u1030\u101b\u1014\u103a\u1021\u1006\u1004\u103a\u101e\u1004\u1037\u103a" : "Game Account \u1011\u100a\u1037\u103a\u101b\u1014\u103a"
      : state.registered ? "Event Member" : state.user ? "\u1021\u1010\u100a\u103a\u1015\u103c\u102f\u101b\u1014\u103a\u101c\u102d\u102f\u1021\u1015\u103a\u101e\u100a\u103a" : "Telegram \u1001\u103b\u102d\u1010\u103a\u1006\u1000\u103a\u101b\u1014\u103a";
  const live = !!state.event?.event_live;
  $("liveBadge").classList.toggle("is-live", live);
  $("liveBadge").classList.toggle("is-waiting", !live);
  $("liveBadge").querySelector("span").textContent = live ? "EVENT LIVE" : `EVENT ${safe(state.event?.phase || "WAITING").toUpperCase()}`;
}

function renderEvent() {
  const event = state.event || {};
  $("eventTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("eventSubtitle").textContent = event.subtitle || "One member \u00b7 One code \u00b7 One premium spin";
  $("announcementText").textContent = event.announcement || "Register now. Your private code will arrive when the event starts.";
  $("eventStartText").textContent = `\u1005\u1010\u1004\u103a\u1001\u103b\u102d\u1014\u103a: ${yangonDate(event.starts_at)}`;
  $("eventEndText").textContent = `\u1015\u103c\u102e\u1038\u1006\u102f\u1036\u1038\u1001\u103b\u102d\u1014\u103a: ${yangonDate(event.ends_at)}`;
  $("wheelEventId").textContent = safe(event.event_id || "EVENT");
  const phaseCopy = {
    registration: "\u101c\u1000\u103a\u101b\u103e\u102d\u101c\u1005\u1009\u103a Event \u1021\u1010\u103d\u1000\u103a Register \u101c\u102f\u1015\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u1015\u103c\u102e\u104b",
    scheduled: "Register \u1005\u102c\u101b\u1004\u103a\u1038\u1015\u102d\u1010\u103a\u1015\u103c\u102e\u1038 Event \u1000\u102d\u102f \u1021\u101c\u102d\u102f\u1021\u101c\u103b\u1031\u102c\u1000\u103a\u1005\u1010\u1004\u103a\u1015\u102b\u1019\u100a\u103a\u104b",
    live: "Event \u1005\u1010\u1004\u103a\u1014\u1031\u1015\u102b\u1015\u103c\u102e\u104b \u1021\u1006\u1004\u103a\u101e\u1004\u1037\u103a\u1016\u103c\u1005\u103a\u101e\u1031\u102c Member \u1019\u103b\u102c\u1038 Promo Code \u1016\u103c\u1004\u1037\u103a \u1010\u1005\u103a\u1000\u103c\u102d\u1019\u103a Spin \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
    ended: "\u101c\u1000\u103a\u101b\u103e\u102d Event \u1015\u103c\u102e\u1038\u1006\u102f\u1036\u1038\u1015\u102b\u1015\u103c\u102e\u104b \u1014\u1031\u102c\u1000\u103a Event \u1021\u1010\u103d\u1000\u103a \u1000\u103c\u102d\u102f\u1010\u1004\u103a Register \u101c\u102f\u1015\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
    blocked: event.lifecycle_error || "Event \u1019\u1005\u1010\u1004\u103a\u1019\u102e Admin \u1019\u103e \u1005\u1005\u103a\u1006\u1031\u1038\u101b\u1014\u103a\u101c\u102d\u102f\u1021\u1015\u103a\u1015\u102b\u101e\u100a\u103a\u104b",
  };
  $("phaseNotice").textContent = phaseCopy[event.phase] || event.lifecycle_error || "Waiting for event settings.";
  applyTheme(event);
  renderHeader();
}

function revealGate(id) {
  ["browserGate", "joinGate", "registerGate", "accountGate", "readyGate"].forEach((gate) => $(gate).classList.toggle("hidden", gate !== id));
}


function setPromoConfirmUi(enteredCode, confirmed) {
  const btn = $("promoConfirmBtn");
  const msg = $("promoConfirmMsg");
  const line = $("promoReadyLine");
  if (!btn || !msg) return;
  const hasCode = enteredCode.length > 0;
  btn.disabled = !hasCode || confirmed || state.promoConfirming || state.spinning || state.spun;
  btn.textContent = state.promoConfirming
    ? "\u1005\u1005\u103a\u1006\u1031\u1038\u1014\u1031\u1015\u102b\u101e\u100a\u103a..."
    : confirmed ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038" : "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a";
  msg.textContent = !hasCode
    ? "Bot \u1019\u103e\u1015\u102d\u102f\u1037\u1011\u102c\u1038\u101e\u1031\u102c Promo Code \u1000\u102d\u102f popup \u1010\u103d\u1004\u103a\u1011\u100a\u1037\u103a\u1015\u102b\u104b"
    : confirmed
      ? "Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b \u1021\u1001\u102f SPIN \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b"
      : state.promoConfirming ? "Promo Code \u1000\u102d\u102f\u1005\u1005\u103a\u1006\u1031\u1038\u1014\u1031\u1015\u102b\u101e\u100a\u103a..." : "Code \u1011\u100a\u1037\u103a\u1015\u103c\u102e\u1038 \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a\u1000\u102d\u102f\u1014\u103e\u102d\u1015\u103a\u1015\u102b\u104b";
  if (line) line.textContent = confirmed ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e" : "Promo Code Popup \u1019\u103e \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u101b\u1014\u103a\u101c\u102d\u102f\u1021\u1015\u103a\u101e\u100a\u103a";
}

function promoRequired() {
  return state.testMode || state.event?.require_unique_code !== false;
}

function promoConfirmedForCurrentInput(enteredCode) {
  if (!promoRequired()) return true;
  return enteredCode.length > 0 && state.localPromoConfirmedCode === enteredCode;
}


function promoModalElements() {
  return {
    modal: $("promoVerifyModal"),
    input: $("promoPopupCodeInput"),
    button: $("promoPopupConfirmBtn"),
    stateNode: $("promoPopupState"),
  };
}

function setPromoPopupState(kind, title, copy) {
  const { stateNode } = promoModalElements();
  if (!stateNode) return;
  stateNode.classList.remove("is-checking", "is-verified", "is-error");
  if (kind) stateNode.classList.add(`is-${kind}`);
  const icon = stateNode.querySelector(".state-icon");
  const strong = stateNode.querySelector("strong");
  const small = stateNode.querySelector("small");
  if (icon) icon.textContent = kind === "verified" ? "\u2713" : kind === "error" ? "!" : "77";
  if (strong) strong.textContent = title;
  if (small) small.textContent = copy;
}

function setPromoModalOpen(open) {
  const { modal, input } = promoModalElements();
  if (!modal) return;
  modal.classList.toggle("hidden", !open);
  document.body.classList.toggle("promo-gate-open", !!open);
  if (open) {
    const current = normalizePromoCode($("spinCodeInput")?.value || state.access?.promo_code || "");
    if (input && !input.value && current) input.value = current;
    syncPromoPopupUi();
    requestAnimationFrame(() => input?.focus());
  }
}

function syncPromoPopupUi() {
  const { input, button } = promoModalElements();
  if (!input || !button) return;
  const code = normalizePromoCode(input.value);
  if (input.value !== code) input.value = code;
  const confirmed = promoConfirmedForCurrentInput(code);
  button.disabled = !code || confirmed || state.promoConfirming || state.spinning || state.spun;
  button.querySelector("span").textContent = state.promoConfirming
    ? "\u1005\u1005\u103a\u1006\u1031\u1038\u1014\u1031\u1015\u102b\u101e\u100a\u103a..."
    : confirmed ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038" : "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a";
  if (!code) setPromoPopupState("", "Code \u1019\u1011\u100a\u1037\u103a\u101b\u101e\u1031\u1038\u1015\u102b", "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1019\u103e SPIN \u1001\u101c\u102f\u1010\u103a\u1021\u101e\u1000\u103a\u101d\u1004\u103a\u1015\u102b\u1019\u100a\u103a\u104b");
  else if (confirmed) setPromoPopupState("verified", "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e", "Popup \u1015\u102d\u1010\u103a\u1015\u103c\u102e\u1038 Wheel \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u1015\u103c\u102e\u104b");
  else if (state.promoConfirming) setPromoPopupState("checking", "Code \u1005\u1005\u103a\u1006\u1031\u1038\u1014\u1031\u1015\u102b\u101e\u100a\u103a", "\u1001\u100f\u1005\u1031\u102c\u1004\u1037\u103a\u1015\u102b\u104b");
  else setPromoPopupState("", "Code \u1011\u100a\u1037\u103a\u1011\u102c\u1038\u1015\u102b\u101e\u100a\u103a", "\u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a\u1000\u102d\u102f\u1014\u103e\u102d\u1015\u103a\u1015\u102b\u104b");
}

function shouldShowPromoPopup() {
  if (!state.user || !state.channel?.joined || !state.registered) return false;
  if (state.spun || state.access?.account_ready || state.previewAccountPending) return false;
  if (!promoRequired()) return false;
  if (!state.testMode && !PLAYER.DEMO && !state.event?.event_live) return false;
  const entered = normalizePromoCode($("spinCodeInput")?.value || "");
  return !promoConfirmedForCurrentInput(entered);
}

async function confirmPromoCodeFrom(code, source = "inline") {
  code = normalizePromoCode(code);
  if (!code) {
    toast("Promo Code \u1011\u100a\u1037\u103a\u1015\u1031\u1038\u1015\u102b\u104b", "error");
    return false;
  }
  state.promoConfirming = true;
  state.localPromoConfirmedCode = "";
  state.promoConfirmation = null;
  if ($("spinCodeInput")) $("spinCodeInput").value = code;
  syncPromoPopupUi();
  renderAccess();
  try {
    if (PLAYER.DEMO || state.testMode) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      state.localPromoConfirmedCode = code;
      state.promoConfirmation = { confirmed: true, test: true };
    } else {
      const data = await api("/api/player/promo/confirm", {
        method: "POST",
        body: { init_data: state.initData, promo_code: code, access_token: state.accessToken },
      });
      const latest = normalizePromoCode(source === "popup" ? $("promoPopupCodeInput")?.value : $("spinCodeInput")?.value);
      if (latest && latest !== code) return false;
      if (!data.confirmed) throw new Error("Promo Code confirmation failed.");
      state.localPromoConfirmedCode = code;
      state.promoConfirmation = data.promo || { confirmed: true };
    }
    setPromoPopupState("verified", "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e", "Popup \u1015\u102d\u1010\u103a\u1015\u103c\u102e\u1038 Wheel \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u1015\u103c\u102e\u104b");
    toast("Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b", "success");
    setTimeout(() => setPromoModalOpen(false), 350);
    return true;
  } catch (error) {
    state.localPromoConfirmedCode = "";
    state.promoConfirmation = null;
    setPromoPopupState("error", "Promo Code \u1019\u1021\u1031\u102c\u1004\u103a\u1019\u103c\u1004\u103a\u1015\u102b", playerErrorMessage(error));
    toast(playerErrorMessage(error), "error");
    return false;
  } finally {
    state.promoConfirming = false;
    syncPromoPopupUi();
    renderAccess();
  }
}

function renderAccess() {
  const spinBtn = $("spinBtn");
  const enteredCode = normalizePromoCode($("spinCodeInput").value);
  const promoConfirmed = promoConfirmedForCurrentInput(enteredCode);

  if (!state.user) {
    $("accessTitle").textContent = "Telegram \u1019\u103e \u1016\u103d\u1004\u1037\u103a\u1015\u102b";
    revealGate("browserGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Official Telegram Bot \u1019\u103e Player Link \u1000\u102d\u102f \u1016\u103d\u1004\u1037\u103a\u101b\u1014\u103a\u101c\u102d\u102f\u1021\u1015\u103a\u101e\u100a\u103a";
    setPromoModalOpen(false);
    return;
  }

  if (!state.channel?.joined) {
    $("accessTitle").textContent = "Channel \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u101b\u1014\u103a";
    revealGate("joinGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Lucky77 Channel \u1000\u102d\u102f Join \u1015\u103c\u102e\u1038 Member \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u102b";
    setPromoModalOpen(false);
    return;
  }

  if (state.testMode && state.previewAccountPending && !state.access.account_ready) {
    $("accessTitle").textContent = "Test Result \u00b7 Game Account Preview";
    $("accountPhoneField").classList.remove("hidden");
    revealGate("accountGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Test flow \u1021\u1010\u103d\u1000\u103a Game Account Name UI \u1000\u102d\u102f \u1005\u1019\u103a\u1038\u101e\u1015\u103a\u1015\u102b\u104b Data \u1019\u101e\u102d\u1019\u103a\u1038\u1015\u102b\u104b";
    setPromoModalOpen(false);
    return;
  }

  if (state.testMode) {
    $("accessTitle").textContent = "Test Promo Code";
    revealGate("readyGate");
    $("spinCodeField").classList.remove("hidden");
    setPromoConfirmUi(enteredCode, promoConfirmed);
    $("readyText").textContent = "Unlimited Test Spin \u00b7 Promo Code \u1011\u100a\u1037\u103a\u1015\u103c\u102e\u1038 \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u102b\u104b Result \u1000\u102d\u102f Real Data \u1011\u1032\u1019\u101e\u102d\u1019\u103a\u1038\u1015\u102b\u104b";
    spinBtn.disabled = state.spinning || !promoConfirmed;
    $("spinHint").textContent = promoConfirmed
      ? "Test Spin \u101c\u103e\u100a\u1037\u103a\u101b\u1014\u103a \u1021\u101e\u1004\u1037\u103a\u1016\u103c\u1005\u103a\u101e\u100a\u103a \u00b7 Result \u1019\u101e\u102d\u1019\u103a\u1038\u1015\u102b"
      : enteredCode.length ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a\u1000\u102d\u102f\u1014\u103e\u102d\u1015\u103a\u1015\u102b" : "\u1005\u1019\u103a\u1038\u101e\u1015\u103a\u101b\u1014\u103a Promo Code \u1010\u1005\u103a\u1001\u102f\u1001\u102f\u1011\u100a\u1037\u103a\u1015\u102b";
    setPromoModalOpen(shouldShowPromoPopup());
    return;
  }

  if (!state.registered) {
    const open = !!state.event?.registration_open;
    $("accessTitle").textContent = open
      ? "Event Register \u101c\u102f\u1015\u103a\u101b\u1014\u103a"
      : state.event?.next_event_id ? "\u1014\u1031\u102c\u1000\u103a Event \u1000\u103c\u102d\u102f\u1010\u1004\u103a Register" : "Register \u1015\u102d\u1010\u103a\u1011\u102c\u1038\u101e\u100a\u103a";
    $("registerCopy").textContent = open
      ? "\u1012\u102e Event \u1021\u1010\u103d\u1000\u103a Register \u101c\u102f\u1015\u103a\u1015\u102b\u104b Event \u1005\u1001\u103b\u102d\u1014\u103a\u1010\u103d\u1004\u103a \u101e\u1004\u1037\u103a Promo Code \u1000\u102d\u102f Telegram Bot \u1019\u103e \u101e\u102e\u1038\u101e\u1014\u1037\u103a\u1015\u102d\u102f\u1037\u1015\u102b\u1019\u100a\u103a\u104b"
      : state.event?.next_event_id
        ? `\u101c\u1000\u103a\u101b\u103e\u102d Event \u1015\u102d\u1010\u103a\u1011\u102c\u1038\u1015\u102b\u1015\u103c\u102e\u104b ${state.event.next_event_id} \u1021\u1010\u103d\u1000\u103a \u1000\u103c\u102d\u102f\u1010\u1004\u103a Register \u101c\u102f\u1015\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a\u104b`
        : "Register \u1015\u102d\u1010\u103a\u1011\u102c\u1038\u1015\u103c\u102e\u1038 \u1014\u1031\u102c\u1000\u103a Event \u1000\u102d\u102f \u1019\u101e\u1010\u103a\u1019\u103e\u1010\u103a\u101b\u101e\u1031\u1038\u1015\u102b\u104b";
    $("registerBtn").textContent = open ? "\u101c\u1000\u103a\u101b\u103e\u102d Event \u1000\u102d\u102f Register \u101c\u102f\u1015\u103a\u1019\u100a\u103a" : "\u1014\u1031\u102c\u1000\u103a Event \u1000\u102d\u102f \u1000\u103c\u102d\u102f\u1010\u1004\u103a Register \u101c\u102f\u1015\u103a\u1019\u100a\u103a";
    $("registerBtn").disabled = !open && !state.event?.next_event_id;
    revealGate("registerGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Event Register \u101c\u102f\u1015\u103a\u1015\u103c\u102e\u1038\u1019\u103e Promo Code \u1016\u103c\u1004\u1037\u103a Spin \u101c\u103e\u100a\u1037\u103a\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u101e\u100a\u103a";
    setPromoModalOpen(false);
    return;
  }

  // Confirmed flow: player spins with Promo Code first, then submits Game Account Name.
  if (state.spun && !state.access.account_ready) {
    $("accessTitle").textContent = "\u1006\u102f\u101b\u101a\u1030\u101b\u1014\u103a Game Account \u1011\u100a\u1037\u103a\u1015\u102b";
    $("accountPhoneField").classList.remove("hidden");
    $("accountPromoInput").value = state.access.promo_code || enteredCode;
    $("accountNameInput").value = state.access.account_name || $("accountNameInput").value || "";
    $("accountPhoneInput").value = state.access.phone || $("accountPhoneInput").value || "";
    revealGate("accountGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "\u1000\u1036\u1011\u1030\u1038\u1006\u102f\u101b\u101a\u1030\u101b\u1014\u103a Game Account Name \u1000\u102d\u102f \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u102b";
    setPromoModalOpen(false);
    return;
  }

  $("accessTitle").textContent = state.spun ? "Spin \u101c\u103e\u100a\u1037\u103a\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e" : "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u101b\u1014\u103a";
  revealGate("readyGate");
  $("spinCodeField").classList.toggle("hidden", !state.event?.require_unique_code);
  if (state.access.promo_code && !$("spinCodeInput").value) {
    $("spinCodeInput").value = state.access.promo_code;
  }

  $("readyText").textContent = state.spun
    ? `\u1000\u1036\u1011\u1030\u1038\u1006\u102f: ${formatPrize(state.result?.prize)} \u00b7 Game Account \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b`
    : state.event?.event_live
      ? state.access.promo_sent_at
        ? "Telegram Bot \u1019\u103e\u1015\u102d\u102f\u1037\u1011\u102c\u1038\u101e\u1031\u102c Promo Code \u1000\u102d\u102f \u1011\u100a\u1037\u103a\u1015\u103c\u102e\u1038 Spin \u101c\u103e\u100a\u1037\u103a\u1015\u102b\u104b"
        : "Promo Code \u1000\u102d\u102f \u1011\u100a\u1037\u103a\u1015\u103c\u102e\u1038 Spin \u101c\u103e\u100a\u1037\u103a\u1015\u102b\u104b"
      : "Register \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b Event \u1005\u1010\u1004\u103a\u1001\u103b\u102d\u1014\u103a\u1000\u102d\u102f \u1005\u1031\u102c\u1004\u1037\u103a\u1015\u1031\u1038\u1015\u102b\u104b";

  setPromoConfirmUi(enteredCode, promoConfirmed);
  const codeReady = promoConfirmed;
  spinBtn.disabled = state.spun || !state.event?.event_live || state.spinning || !codeReady;
  $("spinHint").textContent = state.spun
    ? "\u1012\u102e Event \u1021\u1010\u103d\u1000\u103a Spin \u101c\u103e\u100a\u1037\u103a\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e"
    : state.event?.event_live
      ? codeReady ? "Spin \u101c\u103e\u100a\u1037\u103a\u101b\u1014\u103a \u1021\u101e\u1004\u1037\u103a\u1016\u103c\u1005\u103a\u101e\u100a\u103a" : enteredCode.length ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a\u1000\u102d\u102f\u1014\u103e\u102d\u1015\u103a\u1015\u102b" : "Promo Code \u1011\u100a\u1037\u103a\u1015\u102b"
      : "Event Live \u1016\u103c\u1005\u103a\u101e\u100a\u1037\u103a\u1021\u1001\u103b\u102d\u1014\u103a \u1015\u103c\u1014\u103a\u101c\u103e\u100a\u1037\u103a\u1015\u102b";
  setPromoModalOpen(shouldShowPromoPopup());
}

function renderMetrics() {
  $("metricMembers").textContent = formatNumber(state.counts.registered);
  $("metricWinners").textContent = formatNumber(state.counts.winners);
  $("metricPrizes").textContent = formatNumber(state.counts.prizes_left);
}

function renderPrizes() {
  const counts = new Map();
  state.wheelPrizes.forEach((prize) => counts.set(formatPrize(prize), (counts.get(formatPrize(prize)) || 0) + 1));
  $("prizePool").innerHTML = counts.size ? Array.from(counts.entries()).slice(0, 5).map(([prize, count], index) => `<article class="prize-row"><span class="prize-medal">${index === 0 ? "77" : "\u2726"}</span><div><strong>${esc(prize)}</strong><small>${index === 0 ? "Featured reward" : "Configured prize type"}</small></div><b>${count}</b></article>`).join("") : `<div class="empty-copy">Prize list appears after admin configuration.</div>`;
}

function timeAgo(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}

function renderWinners() {
  $("recentWinners").innerHTML = state.recent.length ? state.recent.slice(0, 4).map((item) => `<article class="recent-row"><span>${esc(initials({ first_name: item.display || "77" }))}</span><div><strong>${esc(item.display || "Lucky Member")}</strong><small>${esc(timeAgo(item.at))}</small></div><b>${esc(formatPrize(item.prize))}</b></article>`).join("") : `<div class="empty-copy">Waiting for the first live winner.</div>`;
}

function drawWheel() {
  const canvas = $("wheelCanvas"), ctx = canvas.getContext("2d"), size = canvas.width, center = size / 2, radius = center - 28;
  const prizes = state.wheelPrizes.length ? state.wheelPrizes : ["Lucky77"];
  const colors = state.event?.wheel_colors?.length ? state.event.wheel_colors : ["#3578f6", "#77a7ff", "#e8f2ff", "#174ea6", "#a8c9ff", "#4f8cff"];
  const slice = Math.PI * 2 / prizes.length;
  ctx.clearRect(0, 0, size, size); ctx.save(); ctx.translate(center, center); ctx.rotate(-Math.PI / 2);
  prizes.forEach((prize, index) => {
    const start = index * slice, end = start + slice;
    const gradient = ctx.createRadialGradient(0, 0, radius * .18, 0, 0, radius);
    gradient.addColorStop(0, colors[(index + 1) % colors.length]); gradient.addColorStop(1, colors[index % colors.length]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, start, end); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.stroke();
    ctx.save(); ctx.rotate(start + slice / 2); ctx.translate(radius * .69, 0); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = index % 3 === 2 ? "#16345f" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = formatPrize(prize).replace(" Ks", ""); ctx.font = `800 ${prizes.length > 10 ? 20 : 25}px system-ui, sans-serif`;
    ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}\u2026` : label, 0, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(0, 0, radius - 4, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke(); ctx.restore();
}

function simpleTone(frequency, duration = .08, volume = .04) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
  const context = simpleTone.context || (simpleTone.context = new AudioContext());
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
}

function targetRotation(prize) {
  const needle = safe(prize).replace(/[^\w\d]/g, "").toLowerCase();
  let index = state.wheelPrizes.findIndex((item) => safe(item).replace(/[^\w\d]/g, "").toLowerCase() === needle);
  if (index < 0) index = Math.floor(Math.random() * state.wheelPrizes.length);
  const slice = 360 / state.wheelPrizes.length, center = index * slice + slice / 2, turns = Math.ceil(state.rotation / 360);
  return (turns + 7) * 360 + (360 - center);
}

function confetti() {
  const layer = $("confettiLayer"); layer.innerHTML = "";
  for (let i = 0; i < 42; i += 1) {
    const bit = document.createElement("i"); bit.style.setProperty("--x", `${Math.random() * 100}%`);
    bit.style.setProperty("--delay", `${Math.random() * .7}s`); bit.style.setProperty("--fall", `${80 + Math.random() * 180}px`);
    bit.style.setProperty("--color", ["#3478f6", "#86b5ff", "#f7c94b", "#f06aa6"][i % 4]); layer.appendChild(bit);
  }
}

function showResult(result) {
  state.result = result;
  state.spun = !state.testMode;
  state.previewAccountPending = !!state.testMode;
  $("resultName").textContent = `${state.user?.first_name || ""} ${state.user?.last_name || ""}`.trim() || state.user?.username || "Lucky Member";
  $("resultPrize").textContent = formatPrize(result?.prize);
  $("resultSaveLabel").textContent = state.testMode ? "TEST RESULT \u00b7 NOT SAVED" : "Lucky77 Result \u101e\u102d\u1019\u103a\u1038\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e";
  $("resultCopy").textContent = state.testMode
    ? "Test Mode Result \u1016\u103c\u1005\u103a\u1015\u103c\u102e\u1038 Member\u104a Promo\u104a Prize Stock\u104a Winner\u104a Report \u101e\u102d\u102f\u1037\u1019\u101f\u102f\u1010\u103a Spin Count \u1010\u1005\u103a\u1001\u102f\u1019\u103b\u103e \u1019\u101e\u102d\u1019\u103a\u1038\u1015\u102b\u104b"
    : "\u1002\u102f\u100f\u103a\u101a\u1030\u1015\u102b\u1010\u101a\u103a\u101b\u103e\u1004\u1037\u103a\u104b \u101a\u1030\u1014\u1005\u103a\u1006\u102f\u101b\u101a\u1030\u101b\u1014\u103a \u1021\u1031\u102c\u1000\u103a\u1015\u102b\u1001\u101c\u102f\u1010\u103a\u1000\u102d\u102f\u1014\u103e\u102d\u1015\u103a\u1015\u103c\u102e\u1038 Game Account Name \u1000\u102d\u102f \u1011\u100a\u1037\u103a\u1015\u1031\u1038\u1015\u102b\u104b";
  $("resultModal").classList.remove("hidden");
  confetti(); [523, 659, 784, 1046].forEach((note, i) => setTimeout(() => simpleTone(note, .34, .06), i * 150));
  renderAccess(); renderHeader();
}

async function refreshPlayerStatus() {
  if (!state.user || PLAYER.DEMO || state.testMode) return;
  const data = await api("/api/player/status", {
    method: "POST",
    body: { init_data: state.initData, access_token: state.accessToken },
  });
  state.channel = data.channel || { joined: false }; state.registered = !!data.registered; state.preregistered = !!data.preregistered;
  state.spun = !!data.spun; state.result = data.result || null; state.event = { ...state.event, ...(data.event || {}) };
  state.access = { ...state.access, ...(data.access || {}) };
}

async function registerPlayer() {
  const button = $("registerBtn"); button.disabled = true;
  try {
    if (PLAYER.DEMO) { state.channel = { joined: true }; state.registered = true; state.access = { account_ready: false, promo_code: "L77-DEMO-2026", promo_sent_at: new Date().toISOString() }; }
    else {
      const data = await api("/api/player/register", { method: "POST", body: { init_data: state.initData } });
      state.registered = !!data.registered; state.preregistered = !!data.preregistered; await refreshPlayerStatus();
      toast(data.message || "Register \u101c\u102f\u1015\u103a\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e", "success");
    }
    renderAll();
  } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

async function saveAccount(event) {
  event.preventDefault();
  const body = {
    account_name: $("accountNameInput").value.trim(),
    phone: $("accountPhoneInput").value.trim(),
  };
  if (!body.account_name) {
    return toast("Game Account Name \u1011\u100a\u1037\u103a\u1015\u1031\u1038\u1015\u102b\u104b", "error");
  }
  try {
    if (PLAYER.DEMO || state.testMode) {
      state.access = {
        ...state.access,
        ...body,
        account_ready: true,
        account_verified_at: new Date().toISOString(),
        test_member: state.testMode,
      };
    } else {
      const data = await api("/api/player/account", {
        method: "POST",
        body: { init_data: state.initData, ...body },
      });
      state.access = { ...state.access, ...(data.access || {}) };
    }
    toast("Game Account Name \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b", "success");
    if (state.testMode) {
      state.previewAccountPending = false;
      setTimeout(() => {
        state.access = { account_ready: false, promo_code: "", test_member: true };
        state.localPromoConfirmedCode = "";
        state.promoConfirmation = null;
        if ($("spinCodeInput")) $("spinCodeInput").value = "";
        if ($("promoPopupCodeInput")) $("promoPopupCodeInput").value = "";
        renderAll();
      }, 900);
    }
    renderAll();
  } catch (error) {
    toast(playerErrorMessage(error), "error");
  }
}

async function verifyPlayer() {
  try {
    if (PLAYER.DEMO) state.channel = { joined: true }; else await refreshPlayerStatus();
    renderAll(); toast(state.channel?.joined ? "Channel \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e" : "Channel \u1000\u102d\u102f \u1021\u101b\u1004\u103a Join \u1015\u1031\u1038\u1015\u102b", state.channel?.joined ? "success" : "error");
  } catch (error) { toast(error.message, "error"); }
}

async function spin() {
  const code = normalizePromoCode($("spinCodeInput").value);
  if (promoRequired() && !promoConfirmedForCurrentInput(code)) {
    return toast(code ? "Promo Code \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1019\u100a\u103a\u1000\u102d\u102f \u1021\u101b\u1004\u103a\u1014\u103e\u102d\u1015\u103a\u1015\u102b\u104b" : "Promo Code \u1011\u100a\u1037\u103a\u1015\u1031\u1038\u1015\u102b\u104b", "error");
  }
  if (state.spinning || $("spinBtn").disabled) return;
  setPromoModalOpen(false);
  state.spinning = true; $("spinBtn").disabled = true; $("spinBtn").classList.add("is-spinning"); $("spinBtn").querySelector("span").textContent = "SPINNING";
  try {
    let winner;
    if (PLAYER.DEMO || state.testMode) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      winner = {
        prize: state.wheelPrizes[Math.floor(Math.random() * state.wheelPrizes.length)],
        at: new Date().toISOString(),
        test: true,
        persisted: false,
      };
    } else {
      if (!state.spinRequestKey) {
        state.spinRequestKey = window.crypto?.randomUUID?.()
          || `spin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const data = await api("/api/player/spin", {
        method: "POST",
        headers: { "X-Idempotency-Key": state.spinRequestKey },
        body: {
          init_data: state.initData,
          promo_code: normalizePromoCode($("spinCodeInput").value),
          access_token: state.accessToken,
        },
      });
      winner = data.winner;
      state.spinRequestKey = "";
    }
    state.rotation = targetRotation(winner?.prize);
    q(".wheel-frame").style.transition = "transform 4.8s cubic-bezier(.12,.72,.08,1)";
    q(".wheel-frame").style.transform = `rotate(${state.rotation}deg)`;
    await new Promise((resolve) => setTimeout(resolve, 5000)); showResult(winner);
    if (!winner?.test) {
      state.counts.prizes_left = Math.max(0, Number(state.counts.prizes_left || 0) - 1);
      state.counts.winners = Number(state.counts.winners || 0) + 1;
    }
  } catch (error) { toast(playerErrorMessage(error), "error"); }
  finally { state.spinning = false; $("spinBtn").classList.remove("is-spinning"); $("spinBtn").querySelector("span").textContent = "SPIN"; renderAccess(); renderMetrics(); }
}

function renderCountdown() {
  const live = !!state.event?.event_live;
  const target = new Date(live ? state.event?.ends_at || "" : state.event?.starts_at || "");
  $("countdownLabel").textContent = live ? "Event ends in" : state.event?.phase === "ended" ? "Event ended" : "Event starts in";
  let remaining = Number.isNaN(target.getTime()) ? 0 : Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(remaining / 86400000); remaining %= 86400000;
  const hours = Math.floor(remaining / 3600000); remaining %= 3600000;
  const minutes = Math.floor(remaining / 60000), seconds = Math.floor((remaining % 60000) / 1000);
  [["countDays", days], ["countHours", hours], ["countMinutes", minutes], ["countSeconds", seconds]].forEach(([id, value]) => $(id).textContent = String(value).padStart(2, "0"));
}

function renderAll() { renderEvent(); renderAccess(); renderMetrics(); renderPrizes(); renderWinners(); drawWheel(); renderCountdown(); }

function bind() {
  $("verifyBtn").addEventListener("click", verifyPlayer);
  $("registerBtn").addEventListener("click", registerPlayer);
  $("accountGate").addEventListener("submit", saveAccount);
  $("spinBtn").addEventListener("click", spin);
  $("spinCodeInput").addEventListener("input", (event) => {
    const normalized = normalizePromoCode(event.target.value);
    if (event.target.value !== normalized) event.target.value = normalized;
    if (state.localPromoConfirmedCode !== normalized) {
      state.localPromoConfirmedCode = "";
      state.promoConfirmation = null;
    }
    renderAccess();
  });
  $("promoConfirmBtn")?.addEventListener("click", () => {
    confirmPromoCodeFrom($("spinCodeInput").value, "inline");
  });
  $("promoPopupCodeInput")?.addEventListener("input", (event) => {
    const normalized = normalizePromoCode(event.target.value);
    if (event.target.value !== normalized) event.target.value = normalized;
    if (state.localPromoConfirmedCode !== normalized) {
      state.localPromoConfirmedCode = "";
      state.promoConfirmation = null;
    }
    if ($("spinCodeInput")) $("spinCodeInput").value = normalized;
    syncPromoPopupUi();
    renderAccess();
  });
  $("promoPopupConfirmBtn")?.addEventListener("click", () => {
    confirmPromoCodeFrom($("promoPopupCodeInput").value, "popup");
  });
  $("resultCloseBtn").addEventListener("click", () => {
    $("resultModal").classList.add("hidden");
    renderAccess();
    $("accountNameInput")?.focus();
  });
  q(".result-backdrop").addEventListener("click", () => {
    if (state.testMode) $("resultModal").classList.add("hidden");
  });
  $("soundToggle").addEventListener("click", () => { state.sound = !state.sound; localStorage.setItem(PLAYER.SOUND_KEY, state.sound ? "on" : "off"); toast(state.sound ? "Sound on" : "Sound off"); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $("resultModal").classList.add("hidden"); });
}

async function boot() {
  bind();
  const identity = telegramIdentity(); state.user = identity.user; state.initData = identity.initData;
  try {
    const [data, brandingPack] = await Promise.all([
      api("/api/player/event"),
      api("/api/public/branding").catch(() => ({ branding: null })),
    ]);
    applyBranding(brandingPack.branding);
    state.event = data.event || {}; state.counts = { registered: data.counts?.registered || 0, winners: data.counts?.winners || 0, prizes_left: data.counts?.prizes_left || 0 };
    state.recent = data.recent_winners || []; if (data.wheel_prizes?.length) state.wheelPrizes = data.wheel_prizes;
    state.supportLink = state.event.cs_link || data.support_link || data.channel_link || "https://t.me/Lucky77autoSpin_bot";
    $("joinChannelBtn").href = data.channel_link || "#"; $("openTelegramBtn").href = data.support_link || data.channel_link || "#";
    $("selfSignupBtn").href = state.event.self_signup_link || "#";
    $("contactCsBtn").href = state.supportLink;
    $("playerSupportLink").href = state.supportLink; $("resultSupportLink").href = state.supportLink;
    if (state.testMode) {
      state.channel = { joined: true };
      state.registered = true;
      state.access = { account_ready: false, promo_code: "", test_member: true };
      state.event = { ...state.event, event_live: true, registration_open: true, phase: "live" };
    } else if (PLAYER.DEMO) {
      state.channel = { joined: true }; state.registered = true; state.access = { account_ready: false, promo_code: "L77-DEMO-2026", promo_sent_at: new Date().toISOString(), test_member: true };
    } else if (state.user) await refreshPlayerStatus();
  } catch (error) {
    state.event = { title: "Lucky77 Grand Spin", subtitle: "Connection unavailable", registration_open: false, event_live: false, phase: "blocked", lifecycle_error: "Event data could not be loaded.", theme: "sky-white" };
    toast(error.message, "error");
  }
  renderAll();
  setInterval(renderCountdown, 1000);
  if (!PLAYER.DEMO && !state.testMode) {
    setInterval(() => api("/api/player/event").then((data) => {
      state.event = data.event || state.event;
      state.counts = { ...state.counts, ...(data.counts || {}) };
      renderAll();
    }).catch(() => {}), 30000);
  }
}

boot();
