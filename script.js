"use strict";

/* ===========================
 PART 1 — CORE BASE
=========================== */

/* ===== DEFAULT API ===== */

const DEFAULT_API_BASE = "https://lucky77-wheel-bot.onrender.com";
const DEFAULT_API_KEY = "Lucky77_luckywheel_77";

/* ===== STORAGE ===== */

const LS_SETTINGS = "lucky77_ui_settings_v1";
const LS_CACHE_MEMBERS = "lucky77_cache_members_v1";
const LS_CACHE_MEMBERS_AT = "lucky77_cache_members_at_v1";
const LS_TODAY_WINNERS = "lucky77_today_winners_v1";


/* ===== DOM HELPER ===== */

function $(id){
  const el = document.getElementById(id);
  if(!el) throw new Error("Missing DOM #"+id);
  return el;
}

/* ===== UTILS ===== */

function esc(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function clamp(n,a,b){
  n = Number(n);
  if(!Number.isFinite(n)) n = a;
  return Math.max(a,Math.min(b,n));
}

/* ===== SETTINGS MODEL ===== */

const defaultSettings = {

  apiBase: DEFAULT_API_BASE,
  apiKey: DEFAULT_API_KEY,

  uiColor:"#ffffff",
  wheelAccent:"#d6b25e",

  wheelColorsText:
`#ffffff
#f1f5ff
#fff4d6
#e9eefc`,

  prizes:[
    {name:"10000Ks",times:4},
    {name:"5000Ks",times:2},
    {name:"3000Ks",times:3}
  ],

  pageBgDataUrl:"",
  topBannerDataUrl:"",
  bottomBannerDataUrl:"",
  wheelBannerDataUrl:""

};

/* ===== SETTINGS LOAD ===== */

function loadSettings(){

  try{

    const raw = localStorage.getItem(LS_SETTINGS);

    if(!raw) return structuredClone(defaultSettings);

    const data = JSON.parse(raw);

    return {...structuredClone(defaultSettings),...data};

  }catch{

    return structuredClone(defaultSettings);

  }

}

function saveSettings(s){

  localStorage.setItem(LS_SETTINGS,JSON.stringify(s));

}

/* ===== API ===== */

function getApiBase(){

  const s = loadSettings();

  return String(s.apiBase || DEFAULT_API_BASE).replace(/\/+$/,"");

}

function getApiKey(){

  const s = loadSettings();

  return String(s.apiKey || DEFAULT_API_KEY);

}

function buildUrl(path){

  const base = getApiBase();
  const key = getApiKey();

  return `${base}${path}?key=${encodeURIComponent(key)}`;

}

async function fetchJson(url,opt={},timeout=12000){

  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(),timeout);

  try{

    const res = await fetch(url,{...opt,signal:ctrl.signal});
    const txt = await res.text();

    let json;

    try{
      json = JSON.parse(txt);
    }catch{
      json = {ok:false,error:"Invalid JSON"};
    }

    if(!res.ok && !json.ok){
      return {ok:false,error:json.error || "HTTP_"+res.status};
    }

    return json;

  }catch(e){

    return {ok:false,error:e.message};

  }finally{

    clearTimeout(t);

  }

}

async function apiGet(path,timeout){

  return fetchJson(buildUrl(path),{method:"GET"},timeout);

}

async function apiPost(path,body,timeout){

  return fetchJson(

    buildUrl(path),

    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key":getApiKey()
      },
      body:JSON.stringify(body || {})
    },

    timeout

  );

}

/* ===== BUTTON BUSY ===== */

function setBusy(btn,busy,text){

  if(!btn) return;

  if(busy){

    btn.dataset.old = btn.textContent;
    btn.disabled = true;

    if(text) btn.textContent = text;

  }else{

    btn.disabled = false;

    if(btn.dataset.old){
      btn.textContent = btn.dataset.old;
      delete btn.dataset.old;
    }

  }

}

const LS_TEST_MODE = "lucky77_test_mode_v1";

function isTestMode(){
  return localStorage.getItem(LS_TEST_MODE) === "1";
}

/* ===== MEMBERS CACHE ===== */

function cacheMembers(list){

  try{

    localStorage.setItem(LS_CACHE_MEMBERS,JSON.stringify(list||[]));
    localStorage.setItem(LS_CACHE_MEMBERS_AT,String(Date.now()));

  }catch{}

}

function readMembersCache(){

  try{

    const raw = localStorage.getItem(LS_CACHE_MEMBERS);

    if(!raw) return null;

    const arr = JSON.parse(raw);

    if(!Array.isArray(arr)) return null;

    return arr;

  }catch{

    return null;

  }

}

/* ===========================
 PART 2 — UI BOOT
=========================== */

let settings = loadSettings();

/* ===== DOM ===== */

const spinBtn = $("spinBtn");
const restartSpinBtn = $("restartSpinBtn");
const membersBtn = $("membersBtn");
const winnerListBtn = $("winnerListBtn");

const poolText = $("poolText");

const settingsBtn = $("settingsBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const drawer = $("drawer");

const musicBtn = $("musicBtn");

const apiBaseInput = $("apiBaseInput");
const apiKeyInput = $("apiKeyInput");

const uiColorInput = $("uiColorInput");
const wheelAccentInput = $("wheelAccentInput");

const topBannerImg = $("topBannerImg");
const bottomBannerImg = $("bottomBannerImg");
const wheelBannerImg = $("wheelBannerImg");

const bgLayer = $("bgLayer");

/* ===== APPLY SETTINGS ===== */

function applySettingsUI(){

  apiBaseInput.value = settings.apiBase;
  apiKeyInput.value = settings.apiKey;

  uiColorInput.value = settings.uiColor;
  wheelAccentInput.value = settings.wheelAccent;

  document.documentElement.style.setProperty("--ui",settings.uiColor);
  document.documentElement.style.setProperty("--gold",settings.wheelAccent);

  if(settings.pageBgDataUrl){
    bgLayer.style.backgroundImage=`url(${settings.pageBgDataUrl})`;
    bgLayer.classList.add("has-img");
  }

  if(settings.topBannerDataUrl){
    topBannerImg.src=settings.topBannerDataUrl;
    topBannerImg.style.display="block";
  }

  if(settings.bottomBannerDataUrl){
    bottomBannerImg.src=settings.bottomBannerDataUrl;
    bottomBannerImg.style.display="block";
  }

  if(settings.wheelBannerDataUrl){
    wheelBannerImg.src=settings.wheelBannerDataUrl;
    wheelBannerImg.style.display="block";
  }

}

applySettingsUI();

/* ===== SETTINGS DRAWER ===== */

settingsBtn.onclick = ()=>{

  drawer.classList.add("open");

};

closeSettingsBtn.onclick = ()=>{

  drawer.classList.remove("open");

};

/* ===== SAVE SETTINGS ===== */

function saveSettingsFromUI(){

  settings.apiBase = apiBaseInput.value.trim();
  settings.apiKey = apiKeyInput.value.trim();

  settings.uiColor = uiColorInput.value;
  settings.wheelAccent = wheelAccentInput.value;

  saveSettings(settings);

  applySettingsUI();

}

/* ===== POOL ===== */

async function refreshPool(){

  const res = await apiGet("/pool",7000);

  if(!res.ok){

    poolText.textContent="Error";

    return;

  }

  poolText.textContent = res.pool;

}

/* ===== INIT ===== */

refreshPool();
/* ===========================
 PART 3 — WHEEL + PRIZE BUILDER (FIX)
=========================== */

let wheelAngle = 0;
let wheelPrizes = [];

const wheelCanvas = $("wheel");
const wheelCtx = wheelCanvas.getContext("2d");

function parseWheelColors(){

  const txt=settings.wheelColorsText||"";

  const arr=txt.split("\n")
  .map(v=>v.trim())
  .filter(v=>v);

  if(!arr.length){
    return ["#ffffff","#f1f5ff","#fff4d6","#e9eefc"];
  }

  return arr;

}

/* ===== BUILD UNIQUE PRIZES ===== */

function buildWheelPrizes(){

  wheelPrizes=[];

  const seen=new Set();

  settings.prizes.forEach(p=>{

    const name=String(p.name||"").trim();

    if(!name)return;

    const key=name.toLowerCase();

    if(seen.has(key))return;

    seen.add(key);

    wheelPrizes.push(name);

  });

  if(!wheelPrizes.length){
    wheelPrizes=["EMPTY"];
  }

}

/* ===== DRAW WHEEL ===== */

function drawWheel(){

  const total=wheelPrizes.length;

  const TAU=Math.PI*2;

  const w=wheelCanvas.width;
  const h=wheelCanvas.height;

  const cx=w/2;
  const cy=h/2;

  const r=Math.min(cx,cy)-10;

  wheelCtx.clearRect(0,0,w,h);

  const colors=parseWheelColors();

  const slice=TAU/total;

  for(let i=0;i<total;i++){

    const start=wheelAngle+i*slice;
    const end=start+slice;

    wheelCtx.beginPath();
    wheelCtx.moveTo(cx,cy);
    wheelCtx.arc(cx,cy,r,start,end);
    wheelCtx.closePath();

    wheelCtx.fillStyle=colors[i%colors.length];
    wheelCtx.fill();

    wheelCtx.strokeStyle="rgba(0,0,0,0.12)";
    wheelCtx.stroke();

    wheelCtx.save();

    wheelCtx.translate(cx,cy);
    wheelCtx.rotate(start+slice/2);

    wheelCtx.fillStyle="#101318";
    wheelCtx.font="bold 16px system-ui";
    wheelCtx.textAlign="right";

    wheelCtx.fillText(
      wheelPrizes[i],
      r-20,
      6
    );

    wheelCtx.restore();

  }

}

/* ===========================
 PRIZE BUILDER
=========================== */

const prizeBuilder=$("prizeBuilder");

function renderPrizeBuilder(){

  prizeBuilder.innerHTML="";

  settings.prizes.forEach((p,idx)=>{

    const row=document.createElement("div");
    row.className="prize-row";

    const name=document.createElement("input");
    name.value=p.name;

    const step=document.createElement("div");
    step.className="stepper";

    const minus=document.createElement("button");
    minus.textContent="-";

    const input=document.createElement("input");
    input.type="number";
    input.value=p.times;

    const plus=document.createElement("button");
    plus.textContent="+";

    const remove=document.createElement("button");
    remove.textContent="✖";

    minus.onclick=()=>{

      p.times=Math.max(1,p.times-1);

      saveSettings(settings);
      renderPrizeBuilder();

    };

    plus.onclick=()=>{

      p.times=p.times+1;

      saveSettings(settings);
      renderPrizeBuilder();

    };

    input.onchange=()=>{

  p.times=clamp(input.value,1,9999);

  saveSettings(settings);

  renderPrizeBuilder();

  buildWheelPrizes();
  drawWheel();

};

    name.onchange=()=>{

      p.name=name.value;

      saveSettings(settings);

      buildWheelPrizes();
      drawWheel();

    };

    remove.onclick=()=>{

      settings.prizes.splice(idx,1);

      if(settings.prizes.length===0){

        settings.prizes.push({
          name:"",
          times:1
        });

      }

      saveSettings(settings);

      renderPrizeBuilder();

      buildWheelPrizes();
      drawWheel();

    };

    step.append(minus,input,plus,remove);

    row.append(name,step);

    prizeBuilder.append(row);

  });

  /* ===== ADD BUTTON ===== */

  const addBtn=document.createElement("button");

  addBtn.className="btn";

  addBtn.textContent="+ Add Prize";

  addBtn.onclick=()=>{

    settings.prizes.push({
      name:"",
      times:1
    });

    saveSettings(settings);

    renderPrizeBuilder();

  };

  prizeBuilder.append(addBtn);

}

/* ===== INIT ===== */

buildWheelPrizes();
drawWheel();
renderPrizeBuilder();
/* ===========================
 PART 4 — SPIN ENGINE
=========================== */

let spinning = false;

/* ===== FIND PRIZE INDEX ===== */

function findPrizeIndex(prize){

  const p = String(prize||"").trim();

  let idx = wheelPrizes.findIndex(v=>String(v).trim()===p);

  if(idx>=0) return idx;

  const lower = p.toLowerCase();

  idx = wheelPrizes.findIndex(v=>String(v).toLowerCase()===lower);

  return idx;

}

/* ===== CALCULATE TARGET ANGLE ===== */

function calcTargetAngle(idx){

  const TAU = Math.PI*2;

  const total = wheelPrizes.length;

  const slice = TAU/total;

  const pointer = -Math.PI/2;

  let target = pointer - (idx+0.5)*slice;

  target = ((target%TAU)+TAU)%TAU;

  return target;

}

/* ===== ANIMATE SPIN ===== */

function animateSpin(target,duration=3200){

  const TAU = Math.PI*2;

  const start = wheelAngle;

  const startNorm = ((start%TAU)+TAU)%TAU;

  const delta = ((target-startNorm)+TAU)%TAU;

  const extra = 6 + Math.random()*4;

  const final = start + extra*TAU + delta;

  const t0 = performance.now();

  function ease(t){
    return 1 - Math.pow(1-t,3);
  }

  return new Promise(resolve=>{

    function frame(now){

      const p = Math.min((now-t0)/duration,1);

      const e = ease(p);

      wheelAngle = start + (final-start)*e;

      drawWheel();

      if(p<1) requestAnimationFrame(frame);
      else resolve();

    }

    requestAnimationFrame(frame);

  });

}

/* ===== SPIN CLICK ===== */

async function doSpin(){

  if(spinning) return;

  if(!wheelPrizes.length){
    alert("Prize မရှိသေးပါ");
    return;
  }

  spinning = true;
  setBusy(spinBtn,true,"SPIN...");

  let res;

  try{

    // ✅ correct endpoint
    res = await apiPost("/spin",{},12000);

    if(!res?.ok){
      throw new Error(res?.error || "spin error");
    }

  }catch(e){

    spinning=false;
    setBusy(spinBtn,false);

    alert("Spin error: " + (e?.message || e));
    return;
  }

  const prize = String(res.prize || "");
  const winner = res.winner || {};

  let idx = findPrizeIndex(prize);

  if(idx < 0){
    buildWheelPrizes();
    drawWheel();
    idx = findPrizeIndex(prize);
  }

  if(idx < 0){
    idx = Math.floor(Math.random()*wheelPrizes.length);
  }

  const target = calcTargetAngle(idx);

  await animateSpin(target,3200);

  showWinnerModal(prize,winner,res.turn);

  recordTodayWinner({ prize, winner, turn: res.turn });

  refreshPool();

  spinning=false;
  setBusy(spinBtn,false);
}

  const prize = String(res.prize||"");

  const winner = res.winner || {};

  let idx = findPrizeIndex(prize);

  if(idx<0){

    buildWheelPrizes();
    drawWheel();

    idx = findPrizeIndex(prize);

  }

  if(idx<0){

    idx = Math.floor(Math.random()*wheelPrizes.length);

  }

  const target = calcTargetAngle(idx);

  await animateSpin(target,3200);

 showWinnerModal(prize,winner,res.turn);

recordTodayWinner({ prize, winner, turn: res.turn });



  refreshPool();

  spinning=false;

  setBusy(spinBtn,false);

}

spinBtn.onclick = doSpin;
restartSpinBtn.onclick = async ()=>{
  setBusy(restartSpinBtn,true,"Restarting...");
  try{
    const r = await apiPost("/event/reset",{},12000);
    if(!r?.ok) alert("Reset error: " + (r?.error || "unknown"));
    refreshPool();
  }catch(e){
    alert("Reset error: " + (e?.message || e));
  }finally{
    setBusy(restartSpinBtn,false);
  }
};

/* ===========================
 PART 5/7 — WINNER MODAL + TODAY WINNER LIST (TEST AWARE)
 - Winner Modal show/hide
 - Today Winner List panel (Wheel အောက်)
 - Save winners only when Test OFF
 - Prize Done toggle (local + backend /winner/done when Test OFF)
=========================== */

/* ===== DOM (modal + winner list panel) ===== */
const winnerModal = $("winnerModal");
const winnerBackdrop = $("winnerBackdrop");
const winnerCloseBtn = $("winnerCloseBtn");

const winnerPrizeTitle = $("winnerPrizeTitle");
const winnerTitleText = $("winnerTitleText");
const winnerNameText = $("winnerNameText");
const winnerHint = $("winnerHint");

const contactBtn = $("contactBtn");
const noticeBtn = $("noticeBtn");

const winnerListPanel = $("winnerListPanel");
const winnerListCloseBtn = $("winnerListCloseBtn");
const winnerListBody = $("winnerListBody");
const winnerListTotalText = $("winnerListTotalText");

/* ===== Today Winners Storage (per day) ===== */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${LS_TODAY_WINNERS}_${y}-${m}-${day}`;
}

function readTodayWinners() {
  try {
    const raw = localStorage.getItem(todayKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeTodayWinners(arr) {
  try { localStorage.setItem(todayKey(), JSON.stringify(arr || [])); } catch {}
}

/* ===== state ===== */
let lastWinner = null; // { prize, winner, turn }

/* ===== helpers ===== */
function winnerDisplay(w) {
  const username = String(w?.username || "").replace("@", "").trim();
  const name = String(w?.name || "").trim();
  const display = String(w?.display || "").trim();
  return display || name || (username ? `@${username}` : String(w?.id || "-"));
}

function hasUsername(w) {
  const u = String(w?.username || "").replace("@", "").trim();
  return !!u;
}

/* ===== Winner Modal ===== */
function showWinnerModal(prize, winnerObj, turn) {
  lastWinner = { prize: String(prize || "-"), winner: winnerObj || {}, turn: turn || null };

  winnerPrizeTitle.textContent = "WINNER";
  winnerTitleText.textContent = String(prize || "—");
  winnerNameText.textContent = winnerDisplay(winnerObj);

  if (hasUsername(winnerObj)) {
    contactBtn.style.display = "inline-flex";
    noticeBtn.style.display = "none";
    winnerHint.textContent = "✅ Username ရှိလို့ Telegram ကိုတန်းဖွင့်နိုင်ပါတယ်";
  } else {
    contactBtn.style.display = "none";
    noticeBtn.style.display = "inline-flex";
    winnerHint.textContent = "✅ Username မရှိလို့ Notice(DM) နှိပ်ရင် Bot က DM ပို့မယ်";
  }

  winnerModal.classList.remove("hidden");
  winnerModal.setAttribute("aria-hidden", "false");
}

function hideWinnerModal() {
  winnerModal.classList.add("hidden");
  winnerModal.setAttribute("aria-hidden", "true");
  lastWinner = null;
}

winnerCloseBtn.addEventListener("click", hideWinnerModal);
winnerBackdrop.addEventListener("click", hideWinnerModal);

contactBtn.addEventListener("click", () => {
  if (!lastWinner) return;
  const u = String(lastWinner.winner?.username || "").replace("@", "").trim();
  if (!u) return;
  window.open(`https://t.me/${u}`, "_blank");
});

noticeBtn.addEventListener("click", async () => {
  if (!lastWinner) return;
  const uid = lastWinner.winner?.id;
  if (!uid) return;

  setBusy(noticeBtn, true, "Sending...");
  try {
    const r = await apiPost("/notice", { user_id: String(uid), prize: String(lastWinner.prize || "") }, 12000);
    if (!r?.ok) throw new Error(r?.error || "notice_failed");
    alert("✅ Notice (DM) ပို့ပြီးပါပြီ");
  } catch (e) {
    alert("Notice error: " + (e?.message || e));
  } finally {
    setBusy(noticeBtn, false);
  }
});

/* ===== Today Winner List UI ===== */
function openWinnerListPanel() {
  winnerListPanel.classList.remove("hidden");
  renderWinnerList();
}
function closeWinnerListPanel() {
  winnerListPanel.classList.add("hidden");
}

winnerListBtn.addEventListener("click", openWinnerListPanel);
winnerListCloseBtn.addEventListener("click", closeWinnerListPanel);

function renderWinnerList() {
  const list = readTodayWinners();
  winnerListTotalText.textContent = list.length ? ` • Total: ${list.length}` : "";

  if (!list.length) {
    winnerListBody.innerHTML = `<div class="small">No winners yet (Today)</div>`;
    return;
  }

  const rows = list.map((r, i) => {
    const doneTxt = r.done ? "Done ✅" : "Prize Done";
    const doneClass = r.done ? "success" : "";
    return `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(16,19,24,0.08);padding:10px 0;">
        <div style="min-width:0;">
          <div style="font-weight:1000;">#${esc(String(r.turn || (i+1)))} • ${esc(String(r.prize||"-"))}</div>
          <div class="small" style="margin-top:4px;">
            ${esc(String(r.name || "-"))} • ID: ${esc(String(r.user_id || "-"))}
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button class="btn mini ${doneClass}" data-act="done" data-uid="${esc(String(r.user_id))}">
            ${doneTxt}
          </button>
          ${
            r.username
              ? `<button class="btn mini" data-act="tg" data-user="${esc(String(r.username).replace("@",""))}">Telegram</button>`
              : `<button class="btn mini" data-act="notice" data-uid="${esc(String(r.user_id))}" data-prize="${esc(String(r.prize||""))}">Notice</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  winnerListBody.innerHTML = rows;
}

/* ===== Winner List actions (delegation) ===== */
winnerListBody.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;

  const act = b.dataset.act;

  if (act === "tg") {
    const user = String(b.dataset.user || "").replace("@","").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  if (act === "notice") {
    const uid = String(b.dataset.uid || "");
    const prize = String(b.dataset.prize || "");
    if (!uid) return;

    setBusy(b, true, "Sending...");
    try {
      const r = await apiPost("/notice", { user_id: uid, prize }, 12000);
      if (!r?.ok) throw new Error(r?.error || "notice_failed");
      alert("✅ Notice (DM) ပို့ပြီးပါပြီ");
    } catch (err) {
      alert("Notice error: " + (err?.message || err));
    } finally {
      setBusy(b, false);
    }
    return;
  }

  if (act === "done") {
    const uid = String(b.dataset.uid || "");
    if (!uid) return;

    // toggle local
    const list = readTodayWinners();
    const idx = list.findIndex(x => String(x.user_id) === uid);
    if (idx < 0) return;

    const next = !list[idx].done;
    list[idx].done = next;
    writeTodayWinners(list);

    // backend only when Test OFF
    if (!isTestMode()) {
      try {
        await apiPost("/winner/done", { user_id: uid }, 12000);
      } catch {}
    }

    renderWinnerList();
    return;
  }
});

/* ===== Save winner result (called by Part 4) ===== */
function recordTodayWinner({ prize, winner, turn }) {
  if (isTestMode()) return; // Test ON => do not save

  const uid = String(winner?.id || winner?.user_id || "");
  if (!uid) return;

  const list = readTodayWinners();

  // prevent duplicate same user in same day (optional)
  // (If you want allow multiple wins, remove this block)
  const exists = list.some(x => String(x.user_id) === uid);
  if (exists) return;

  list.push({
    user_id: uid,
    name: winnerDisplay(winner),
    username: String(winner?.username || "").replace("@","").trim(),
    prize: String(prize || "-"),
    turn: Number(turn || (list.length + 1)),
    done: false,
    at: Date.now(),
  });

  writeTodayWinners(list);

  // if panel open, refresh instantly
  if (!winnerListPanel.classList.contains("hidden")) {
    renderWinnerList();
  }
}
/* ===========================
 PART 6 — MEMBERS PANEL (FAST + CACHE)
 - Members button -> /members
 - Render table with active/inactive
 - Telegram / Notice actions
 - Local cache for instant open
=========================== */

const membersPanel = $("membersPanel");
const membersCloseBtn = $("membersCloseBtn");
const membersTable = $("membersTable");
const membersTotalText = $("membersTotalText");

function openMembersPanel() {
  membersPanel.classList.remove("hidden");

  // ✅ instant render from cache first
  const cache = readMembersCache();
  if (cache && cache.length) {
    renderMembers(cache, true);
  } else {
    membersTable.innerHTML = `<div class="small">Loading members...</div>`;
  }

  // then fetch fresh
  refreshMembers();
}

function closeMembersPanel() {
  membersPanel.classList.add("hidden");
}

membersBtn.addEventListener("click", openMembersPanel);
membersCloseBtn.addEventListener("click", closeMembersPanel);

function statusBadge(active) {
  return active
    ? `<span style="font-weight:1000;color:#16a34a;">ACTIVE</span>`
    : `<span style="font-weight:1000;color:#ef4444;">INACTIVE</span>`;
}

function renderMembers(list, fromCache = false) {
  const arr = Array.isArray(list) ? list : [];
  membersTotalText.textContent = arr.length ? ` • Total: ${arr.length}${fromCache ? " (cache)" : ""}` : "";

  if (!arr.length) {
    membersTable.innerHTML = `<div class="small">No members</div>`;
    return;
  }

  // sort active first
  arr.sort((a, b) => (b.active === true) - (a.active === true));

  const rows = arr.map(m => {
    const username = String(m.username || "").replace("@", "").trim();
    const display = String(m.display || m.name || (username ? "@"+username : m.id) || "-");
    const uid = String(m.id || "");

    return `
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(16,19,24,0.08);padding:10px 0;">
        <div style="min-width:0;">
          <div style="font-weight:1000;word-break:break-word;">${esc(display)}</div>
          <div class="small" style="margin-top:4px;">
            ID: ${esc(uid)} • ${statusBadge(!!m.active)}
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          ${
            username
              ? `<button class="btn mini" data-act="tg" data-user="${esc(username)}">Telegram</button>`
              : `<button class="btn mini" data-act="notice" data-uid="${esc(uid)}">Notice</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  membersTable.innerHTML = rows;
}

async function refreshMembers() {
  setBusy(membersBtn, true, "Members...");

  try {
    const res = await apiGet("/members", 15000); // ✅ 12–15s
    if (!res?.ok) throw new Error(res?.error || "members_error");

    const list = Array.isArray(res.members) ? res.members : [];
    cacheMembers(list);
    renderMembers(list, false);

  } catch (e) {
    const cache = readMembersCache();
    if (cache && cache.length) {
      renderMembers(cache, true);
      membersTable.insertAdjacentHTML("afterbegin",
        `<div class="small" style="margin-bottom:8px;">⚠️ Live fetch error, showing cache</div>`
      );
    } else {
      membersTable.innerHTML = `<div class="small">Members error: ${esc(e?.message || e)}</div>`;
    }
  } finally {
    setBusy(membersBtn, false);
  }
}

/* ===== Members action buttons ===== */
membersTable.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;

  const act = b.dataset.act;

  if (act === "tg") {
    const user = String(b.dataset.user || "").replace("@", "").trim();
    if (!user) return;
    window.open(`https://t.me/${user}`, "_blank");
    return;
  }

  if (act === "notice") {
    const uid = String(b.dataset.uid || "").trim();
    if (!uid) return;

    setBusy(b, true, "Sending...");
    try {
      const r = await apiPost("/notice", { user_id: uid, prize: "" }, 12000);
      if (!r?.ok) throw new Error(r?.error || "notice_failed");
      alert("✅ Notice (DM) ပို့ပြီးပါပြီ");
    } catch (err) {
      alert("Notice error: " + (err?.message || err));
    } finally {
      setBusy(b, false);
    }
    return;
  }
});