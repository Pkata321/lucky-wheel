"use strict";

const $ = (id) => document.getElementById(id);
let backupJson = null;
let previewOk = false;

function show(node) { node?.classList.remove("hidden"); }
function pretty(data) { return JSON.stringify(data, null, 2); }

async function postJson(path, data) {
  const res = await fetch(`/backend${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.message || body.detail || body.error || `HTTP ${res.status}`);
  }
  return body;
}

function renderStats(result) {
  const backup = result.backup || {};
  const current = result.current_redis || {};
  const items = [
    ["Backup Members", backup.members],
    ["Backup Winners", backup.winners],
    ["Backup History", backup.history],
    ["Backup CS Messages", backup.cs_messages],
    ["Current Redis Winners", current.winners],
    ["Current Redis History", current.history],
  ];
  $("stats").innerHTML = items.map(([label, value]) => `<div class="restore-stat"><span>${label}</span><strong>${Number(value || 0).toLocaleString("en-US")}</strong></div>`).join("");
}

$("backupFile").addEventListener("change", async () => {
  const file = $("backupFile").files?.[0];
  backupJson = null;
  previewOk = false;
  $("previewBtn").disabled = true;
  $("restoreBtn").disabled = true;
  if (!file) return;
  try {
    backupJson = JSON.parse(await file.text());
    $("previewBtn").disabled = false;
  } catch (error) {
    alert(`Backup JSON ဖတ်မရပါ: ${error.message}`);
  }
});

$("previewBtn").addEventListener("click", async () => {
  if (!backupJson) return;
  $("previewBtn").disabled = true;
  try {
    const result = await postJson("/backup/merge/preview", backupJson);
    previewOk = true;
    renderStats(result);
    $("previewOutput").textContent = pretty(result);
    show($("previewCard"));
    $("restoreBtn").disabled = $("confirmText").value.trim() !== "MERGE ONLY";
  } catch (error) {
    alert(error.message);
  } finally {
    $("previewBtn").disabled = false;
  }
});

$("confirmText").addEventListener("input", () => {
  $("restoreBtn").disabled = !(previewOk && backupJson && $("confirmText").value.trim() === "MERGE ONLY");
});

$("restoreBtn").addEventListener("click", async () => {
  if (!backupJson || $("confirmText").value.trim() !== "MERGE ONLY") return;
  if (!confirm("Safe Merge Restore စတင်မည်။ Existing data မဖျက်ပါ။ ဆက်လုပ်မလား?")) return;
  $("restoreBtn").disabled = true;
  try {
    const result = await postJson("/backup/merge/restore", backupJson);
    $("restoreOutput").textContent = pretty(result);
    show($("restoreCard"));
  } catch (error) {
    $("restoreOutput").textContent = error.message;
    show($("restoreCard"));
    alert(error.message);
  } finally {
    $("restoreBtn").disabled = false;
  }
});
