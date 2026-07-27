"use strict";

const PLAYER = {
  API_BASE: "https://lucky77-wheel-bot-548i.onrender.com",
  DEMO: new URLSearchParams(location.search).get("demo") === "1",
  SOUND_KEY: "lucky77_player_sound_v5",
};

const state = {
  event: null,
  counts: { registered: 0, winners: 0, prizes_left: 0 },
  recent: [],
  wheelPrizes: ["5,000 Ks", "10,000 Ks", "20,000 Ks", "30,000 Ks", "50,000 Ks", "100,000 Ks", "Bonus", "Jackpot"],
  user: null,
  initData: "",
  channel: { joined: false },
  registered: false,
  preregistered: false,
  spun: false,
  result: null,
  rotation: 0,
  spinning: false,
  sound: localStorage.getItem(PLAYER.SOUND_KEY) !== "off",
};

const $ = (id) => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function safe(value) {
  return value == null ? "" : String(value);
}

function esc(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatPrize(value) {
  const text = safe(value).trim();
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0
    ? `${numeric.toLocaleString("en-US")} Ks`
    : text || "Premium Prize";
}

function initials(user) {
  const text = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.username || "77";
  const parts = text.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : text.slice(0, 2).toUpperCase();
}

function toast(message, type = "info") {
  const node = $("toast");
  node.textContent = safe(message);
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
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
    if (error?.name === "AbortError") throw new Error("Connection timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function telegramIdentity() {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor("#080913");
      webApp.setBackgroundColor("#080913");
    } catch (_) {}
  }

  const user = webApp?.initDataUnsafe?.user || null;
  const initData = webApp?.initData || "";
  if (user?.id && initData) return { user, initData };

  if (PLAYER.DEMO) {
    return {
      user: {
        id: "770077",
        first_name: "Rose",
        last_name: "Gold",
        username: "luckymember",
      },
      initData: "",
      demo: true,
    };
  }

  return { user: null, initData: "" };
}

function applyTheme(event) {
  document.body.dataset.theme = event?.theme || "obsidian-rose";
  if (event?.accent) document.documentElement.style.setProperty("--accent", event.accent);
  if (event?.accent_2) document.documentElement.style.setProperty("--gold", event.accent_2);
}

function renderHeader() {
  const name = state.user
    ? `${state.user.first_name || ""} ${state.user.last_name || ""}`.trim() ||
      `@${state.user.username || "member"}`
    : "Lucky Member";

  $("memberName").textContent = name;
  $("memberAvatar").textContent = initials(state.user);
  $("memberStatus").textContent = state.registered
    ? state.spun ? "Spin completed" : "Premium member"
    : state.user ? "Verification required" : "Connect Telegram";

  const live = !!state.event?.event_live;
  const badge = $("liveBadge");
  badge.classList.toggle("is-live", live);
  badge.classList.toggle("is-waiting", !live);
  badge.querySelector("span").textContent = live ? "EVENT LIVE" : "EVENT WAITING";
}

function renderEvent() {
  const event = state.event || {};
  $("eventTitle").textContent = event.title || "Lucky77 Grand Spin";
  $("eventSubtitle").textContent = event.subtitle || "One member · One code · One premium spin";
  $("announcementText").textContent = event.announcement || "Register now and keep your one-time code ready.";
  applyTheme(event);
  renderHeader();
}

function revealGate(id) {
  ["browserGate", "joinGate", "registerGate", "readyGate"].forEach((gate) => {
    $(gate).classList.toggle("hidden", gate !== id);
  });
}

function renderAccess() {
  const spinBtn = $("spinBtn");

  if (!state.user) {
    $("accessTitle").textContent = "Open inside Telegram";
    revealGate("browserGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Secure Telegram verification required";
    return;
  }

  if (!state.channel?.joined) {
    $("accessTitle").textContent = "Channel verification";
    revealGate("joinGate");
    spinBtn.disabled = true;
    $("spinHint").textContent = "Join and verify to unlock the wheel";
    return;
  }

  if (!state.registered) {
    $("accessTitle").textContent = state.event?.registration_open
      ? "Complete registration"
      : "Pre-register next event";
    revealGate("registerGate");
    q(".premium-field span").textContent = state.event?.promo_required
      ? "One-time promotion code"
      : "Promotion code (not required)";
    spinBtn.disabled = true;
    $("spinHint").textContent = state.event?.registration_open
      ? "Register to unlock your one live spin"
      : "Current registration is closed";
    return;
  }

  $("accessTitle").textContent = state.spun ? "Spin completed" : "Premium access ready";
  revealGate("readyGate");
  $("readyText").textContent = state.spun
    ? `Result saved: ${formatPrize(state.result?.prize)}`
    : state.event?.event_live
      ? "Your one premium spin is ready now."
      : "Registration confirmed. Wait for the event to go live.";

  spinBtn.disabled = state.spun || !state.event?.event_live || state.spinning;
  $("spinHint").textContent = state.spun
    ? "Your result is permanently saved"
    : state.event?.event_live
      ? "One spin available · tap SPIN to reveal your prize"
      : "Registered · waiting for Event Live";
}

function renderMetrics() {
  $("metricMembers").textContent = formatNumber(state.counts.registered);
  $("metricWinners").textContent = formatNumber(state.counts.winners);
  $("metricPrizes").textContent = formatNumber(state.counts.prizes_left);
}

function prizeInventory() {
  const counts = new Map();
  state.wheelPrizes.forEach((prize) => {
    const label = formatPrize(prize);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries()).slice(0, 4);
}

function renderPrizes() {
  const rows = prizeInventory();
  $("prizePool").innerHTML = rows.length
    ? rows.map(([prize, count], index) => `
      <article class="prize-row">
        <span class="prize-medal">${index === 0 ? "77" : "✦"}</span>
        <div><strong>${esc(prize)}</strong><small>${index === 0 ? "Featured reward" : "Premium prize"}</small></div>
        <b>${count}<small> left</small></b>
      </article>`).join("")
    : `<div class="empty-copy">Prize list will appear when the event opens.</div>`;
}

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function renderWinners() {
  const items = state.recent || [];
  $("recentWinners").innerHTML = items.length
    ? items.slice(0, 3).map((item) => `
      <article class="recent-row">
        <span>${esc(initials({ first_name: item.display || "77" }))}</span>
        <div><strong>${esc(item.display || "Lucky Member")}</strong><small>${esc(timeAgo(item.at))}</small></div>
        <b>${esc(formatPrize(item.prize))}</b>
      </article>`).join("")
    : `<div class="empty-copy">Waiting for the first winner…</div>`;

  const ticker = items.length ? [...items, ...items] : [
    { display: "Lucky77 Grand Spin", prize: "Event opening soon" },
    { display: "Premium Wheel", prize: "One member · One spin" },
  ];

  $("tickerTrack").innerHTML = ticker.map((item) => `
    <span><b>${esc(item.display || "Lucky Member")}</b><i>won</i><strong>${esc(formatPrize(item.prize))}</strong></span>
  `).join("");
}

function drawWheel() {
  const canvas = $("wheelCanvas");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 28;
  const prizes = state.wheelPrizes.length ? state.wheelPrizes : ["Lucky77"];
  const colors = state.event?.wheel_colors?.length
    ? state.event.wheel_colors
    : ["#75183f", "#21151c", "#9d2859", "#302028", "#c84272", "#171820"];
  const slice = Math.PI * 2 / prizes.length;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(-Math.PI / 2);

  prizes.forEach((prize, index) => {
    const start = index * slice;
    const end = start + slice;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.18, 0, 0, radius);
    gradient.addColorStop(0, colors[(index + 1) % colors.length]);
    gradient.addColorStop(1, colors[index % colors.length]);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(229,197,139,.78)";
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + slice / 2);
    ctx.translate(radius * 0.69, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#f8eddf";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = formatPrize(prize).replace(" Ks", "");
    ctx.font = `700 ${prizes.length > 10 ? 21 : 26}px Manrope, sans-serif`;
    ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}…` : label, 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(229,197,139,.92)";
  ctx.stroke();
  ctx.restore();
}

function setWheelRotation(degrees, animate = true) {
  const frame = q(".wheel-frame");
  frame.style.transition = animate
    ? "transform 5.6s cubic-bezier(.12,.72,.08,1)"
    : "none";
  frame.style.transform = `rotate(${degrees}deg)`;
}

function targetRotation(prize) {
  const needle = safe(prize).replace(/[^\w\d]/g, "").toLowerCase();
  let index = state.wheelPrizes.findIndex((item) =>
    safe(item).replace(/[^\w\d]/g, "").toLowerCase() === needle
  );
  if (index < 0) index = Math.floor(Math.random() * state.wheelPrizes.length);
  const slice = 360 / state.wheelPrizes.length;
  const center = index * slice + slice / 2;
  const currentTurns = Math.ceil(state.rotation / 360);
  return (currentTurns + 7) * 360 + (360 - center);
}

function simpleTone(frequency, duration = 0.08, volume = 0.04) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = simpleTone.context || (simpleTone.context = new AudioContext());
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function winSound() {
  if (state.event?.win_sound_url && state.sound) {
    new Audio(state.event.win_sound_url).play().catch(() => {});
    return;
  }
  [523, 659, 784, 1046].forEach((note, index) => {
    setTimeout(() => simpleTone(note, 0.34, 0.06), index * 150);
  });
}

function confetti() {
  const layer = $("confettiLayer");
  layer.innerHTML = "";
  for (let i = 0; i < 46; i += 1) {
    const bit = document.createElement("i");
    bit.style.setProperty("--x", `${Math.random() * 100}%`);
    bit.style.setProperty("--delay", `${Math.random() * 0.7}s`);
    bit.style.setProperty("--fall", `${80 + Math.random() * 180}px`);
    bit.style.setProperty("--color", ["#e5c58b", "#d83b75", "#f8eddf", "#9f4dce"][i % 4]);
    layer.appendChild(bit);
  }
}

function showResult(result) {
  state.result = result;
  state.spun = true;
  const name = `${state.user?.first_name || ""} ${state.user?.last_name || ""}`.trim() ||
    state.user?.username || "Lucky Member";
  $("resultName").textContent = name;
  $("resultPrize").textContent = formatPrize(result?.prize);
  $("resultModal").classList.remove("hidden");
  confetti();
  winSound();
  renderAccess();
  renderHeader();
}

async function refreshPlayerStatus() {
  if (!state.user || PLAYER.DEMO) return;
  const data = await api("/api/player/status", {
    method: "POST",
    body: { init_data: state.initData },
  });
  state.channel = data.channel || { joined: false };
  state.registered = !!data.registered;
  state.preregistered = !!data.preregistered;
  state.spun = !!data.spun;
  state.result = data.result || null;
  state.event = { ...state.event, ...(data.event || {}) };
}

async function registerPlayer() {
  if (PLAYER.DEMO) {
    state.channel = { joined: true };
    state.registered = true;
    state.event.event_live = true;
    renderAll();
    toast("Demo registration ready", "success");
    return;
  }

  const button = $("registerBtn");
  button.disabled = true;
  button.textContent = "Registering…";
  try {
    const data = await api("/api/player/register", {
      method: "POST",
      body: {
        init_data: state.initData,
        promo_code: $("promoInput").value.trim(),
      },
    });
    state.registered = !!data.registered;
    state.preregistered = !!data.preregistered;
    await refreshPlayerStatus();
    renderAll();
    toast(data.message || "Registration completed", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Register & Continue";
  }
}

async function verifyPlayer() {
  const button = $("verifyBtn");
  button.disabled = true;
  button.textContent = "Verifying…";
  try {
    if (PLAYER.DEMO) {
      state.channel = { joined: true };
    } else {
      await refreshPlayerStatus();
    }
    renderAll();
    toast(state.channel?.joined ? "Channel verified" : "Join the channel first",
      state.channel?.joined ? "success" : "error");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Verify Membership";
  }
}

async function spin() {
  if (state.spinning || $("spinBtn").disabled) return;
  state.spinning = true;
  $("spinBtn").disabled = true;
  $("spinBtn").classList.add("is-spinning");
  $("spinBtn").querySelector("span").textContent = "SPINNING";
  $("spinHint").textContent = "Your premium result is being secured…";

  if (state.event?.spin_sound_url && state.sound) {
    new Audio(state.event.spin_sound_url).play().catch(() => {});
  } else {
    simpleTone(220, 0.2, 0.04);
  }

  try {
    let winner;
    if (PLAYER.DEMO) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      winner = {
        prize: state.wheelPrizes[Math.floor(Math.random() * state.wheelPrizes.length)],
        at: new Date().toISOString(),
      };
    } else {
      const data = await api("/api/player/spin", {
        method: "POST",
        body: { init_data: state.initData },
      });
      winner = data.winner;
    }

    state.rotation = targetRotation(winner?.prize);
    setWheelRotation(state.rotation, true);
    await new Promise((resolve) => setTimeout(resolve, 5750));
    showResult(winner);
    state.counts.prizes_left = Math.max(0, Number(state.counts.prizes_left || 0) - 1);
    state.counts.winners = Number(state.counts.winners || 0) + 1;
    renderMetrics();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.spinning = false;
    $("spinBtn").classList.remove("is-spinning");
    $("spinBtn").querySelector("span").textContent = "SPIN";
    renderAccess();
  }
}

function renderCountdown() {
  const end = new Date(state.event?.ends_at || "");
  let remaining = Number.isNaN(end.getTime()) ? 0 : Math.max(0, end.getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  remaining %= 86400000;
  const hours = Math.floor(remaining / 3600000);
  remaining %= 3600000;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  $("countDays").textContent = String(days).padStart(2, "0");
  $("countHours").textContent = String(hours).padStart(2, "0");
  $("countMinutes").textContent = String(minutes).padStart(2, "0");
  $("countSeconds").textContent = String(seconds).padStart(2, "0");
}

function renderAll() {
  renderEvent();
  renderAccess();
  renderMetrics();
  renderPrizes();
  renderWinners();
  drawWheel();
  renderCountdown();
}

function bind() {
  $("verifyBtn").addEventListener("click", verifyPlayer);
  $("registerBtn").addEventListener("click", registerPlayer);
  $("spinBtn").addEventListener("click", spin);
  $("resultCloseBtn").addEventListener("click", () => $("resultModal").classList.add("hidden"));
  q(".result-backdrop").addEventListener("click", () => $("resultModal").classList.add("hidden"));
  $("soundToggle").addEventListener("click", () => {
    state.sound = !state.sound;
    localStorage.setItem(PLAYER.SOUND_KEY, state.sound ? "on" : "off");
    $("soundToggle").classList.toggle("is-muted", !state.sound);
    toast(state.sound ? "Sound on" : "Sound off");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") $("resultModal").classList.add("hidden");
  });
}

async function boot() {
  bind();
  const identity = telegramIdentity();
  state.user = identity.user;
  state.initData = identity.initData;
  $("soundToggle").classList.toggle("is-muted", !state.sound);

  if (PLAYER.DEMO) {
    state.event = {
      title: "Lucky77 Grand Spin",
      subtitle: "One member · One code · One premium spin",
      announcement: "July Premium Event · one verified member receives one secured live spin.",
      registration_open: true,
      event_live: true,
      ends_at: new Date(Date.now() + 2 * 86400000 + 18 * 3600000 + 42 * 60000).toISOString(),
      theme: "obsidian-rose",
      wheel_colors: ["#75183f", "#21151c", "#9d2859", "#302028", "#c84272", "#171820"],
    };
    state.channel = { joined: true };
    state.registered = true;
    state.counts = { registered: 12480, winners: 386, prizes_left: 24 };
    state.recent = [
      { display: "May Zin", prize: "50,000 Ks", at: new Date(Date.now() - 120000).toISOString() },
      { display: "Aung Ko", prize: "25,000 Ks", at: new Date(Date.now() - 420000).toISOString() },
      { display: "Thu Thu", prize: "10,000 Ks", at: new Date(Date.now() - 720000).toISOString() },
    ];
  } else {
    try {
      const data = await api("/api/player/event");
      state.event = data.event || {};
      state.counts = {
        registered: data.counts?.registered || 0,
        winners: data.counts?.winners || 0,
        prizes_left: data.counts?.prizes_left || 0,
      };
      state.recent = data.recent_winners || [];
      if (Array.isArray(data.wheel_prizes) && data.wheel_prizes.length) {
        state.wheelPrizes = data.wheel_prizes;
      }
      if (data.channel_link) {
        $("joinChannelBtn").href = data.channel_link;
        $("openTelegramBtn").href = data.channel_link;
      }
      if (state.user) await refreshPlayerStatus();
    } catch (error) {
      state.event = {
        title: "Lucky77 Grand Spin",
        subtitle: "One member · One code · One premium spin",
        announcement: "Secure event connection is being restored.",
        registration_open: true,
        event_live: false,
        theme: "obsidian-rose",
        wheel_colors: ["#75183f", "#21151c", "#9d2859", "#302028", "#c84272", "#171820"],
      };
      toast(error.message, "error");
    }
  }

  renderAll();
  setInterval(renderCountdown, 1000);
}

boot();
