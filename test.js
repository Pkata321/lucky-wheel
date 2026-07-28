"use strict";

const meta = document.querySelector('meta[name="lucky77-api-base"]')?.content || "";
const API_BASE = meta.includes("%VITE_") ? location.origin : meta.replace(/\/+$/, "") || location.origin;
const token = new URLSearchParams(location.search).get("token") || "";
const state = {
  initData: "",
  user: null,
  prizes: [],
  rotation: 0,
  spinning: false,
};
const $ = (id) => document.getElementById(id);

function toast(message, type = "info") {
  const node = $("testToast");
  node.textContent = String(message || "");
  node.className = `app-toast is-${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function telegramIdentity() {
  const app = window.Telegram?.WebApp;
  try {
    app?.ready();
    app?.expand();
  } catch (_) {}
  return {
    user: app?.initDataUnsafe?.user || null,
    initData: app?.initData || "",
  };
}

function drawWheel() {
  const canvas = $("testWheel");
  const ctx = canvas.getContext("2d");
  const prizes = state.prizes.length ? state.prizes : ["5,000 Ks", "10,000 Ks", "20,000 Ks", "30,000 Ks"];
  const colors = ["#087eea", "#04c7f2", "#ffffff", "#c7ecff", "#065eab", "#f7cf45"];
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 20;
  ctx.clearRect(0, 0, size, size);
  prizes.forEach((prize, index) => {
    const start = -Math.PI / 2 + index * Math.PI * 2 / prizes.length;
    const end = -Math.PI / 2 + (index + 1) * Math.PI * 2 / prizes.length;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(2,36,57,.18)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((start + end) / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = index % colors.length === 2 || index % colors.length === 3 ? "#052840" : "#fff";
    ctx.font = "700 26px system-ui";
    ctx.fillText(String(prize).slice(0, 18), radius - 38, 8);
    ctx.restore();
  });
}

function targetRotation(prize) {
  const index = Math.max(0, state.prizes.findIndex((item) => String(item) === String(prize)));
  const slice = 360 / Math.max(1, state.prizes.length);
  const center = index * slice + slice / 2;
  return state.rotation + 7 * 360 + (360 - center);
}

async function spin() {
  if (state.spinning) return;
  state.spinning = true;
  $("testSpin").disabled = true;
  $("testSpin").querySelector("span").textContent = "SPINNING";
  try {
    const data = await api("/api/test/spin", {
      method: "POST",
      body: { token, init_data: state.initData },
    });
    const result = data.winner;
    state.rotation = targetRotation(result.prize);
    $("testWheel").style.transition = "transform 5.4s cubic-bezier(.12,.72,.08,1)";
    $("testWheel").style.transform = `rotate(${state.rotation}deg)`;
    await new Promise((resolve) => setTimeout(resolve, 5550));
    $("testPrize").textContent = result.prize || "Premium Prize";
    $("testResult").classList.remove("hidden");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.spinning = false;
    $("testSpin").disabled = false;
    $("testSpin").querySelector("span").textContent = "TEST SPIN";
  }
}

async function boot() {
  if (!token) {
    $("testStatus").textContent = "Test token မပါပါ။ Admin မှပို့ထားသော Test Link ကိုပြန်ဖွင့်ပါ။";
    return;
  }
  const identity = telegramIdentity();
  state.user = identity.user;
  state.initData = identity.initData;
  if (!state.user || !state.initData) {
    $("testStatus").textContent = "ဒီ Test Link ကို Lucky77 Telegram Bot အတွင်းမှ ဖွင့်ပါ။";
    return;
  }
  try {
    const [eventData, statusData] = await Promise.all([
      api(`/api/test/event?token=${encodeURIComponent(token)}`),
      api("/api/test/status", {
        method: "POST",
        body: { token, init_data: state.initData },
      }),
    ]);
    if (!statusData.channel?.joined) {
      $("testStatus").textContent = "Lucky77 Channel ကို Join ပြီးမှ Test Spin စမ်းနိုင်ပါသည်။";
      return;
    }
    state.prizes = eventData.wheel_prizes || [];
    $("testTitle").textContent = `${eventData.event?.title || "Lucky77"} · Test`;
    $("testGate").classList.add("hidden");
    $("testStage").classList.remove("hidden");
    drawWheel();
  } catch (error) {
    $("testStatus").textContent = error.message;
  }
}

$("testSpin").addEventListener("click", spin);
$("testAgain").addEventListener("click", () => $("testResult").classList.add("hidden"));
document.querySelector(".result-backdrop").addEventListener("click", () => $("testResult").classList.add("hidden"));
boot();
