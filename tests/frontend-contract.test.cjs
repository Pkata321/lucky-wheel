"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const project = path.resolve(root, "..");
const backend = fs.readFileSync(path.join(project, "backend", "index.js"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const pairs = [
  ["script.js", "index.html"],
  ["admin.js", "admin.html"],
  ["winners.js", "winners.html"],
];

for (const [jsName, htmlName] of pairs) {
  const js = fs.readFileSync(path.join(root, jsName), "utf8");
  const html = fs.readFileSync(path.join(root, htmlName), "utf8");
  const htmlIds = new Set(
    [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])
  );
  const jsIds = new Set(
    [...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1])
  );
  const missing = [...jsIds].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], `${jsName} references missing DOM IDs: ${missing.join(", ")}`);
  assert.ok(js.includes('"/backend"'), `${jsName} must use the same-origin backend proxy`);
  assert.ok(!js.includes("onrender.com"), `${jsName} must not call Render cross-origin`);
  assert.ok(!/x-api-key|api_key=|lucky77_admin_api_key/i.test(js), `${jsName} exposes legacy API-key auth`);
}

const player = fs.readFileSync(path.join(root, "script.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const inbox = fs.readFileSync(path.join(root, "winners.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");

assert.ok(player.includes('"X-Idempotency-Key"'), "Player spin must send an idempotency key");
assert.ok(player.includes("access_token"), "Player must pass opaque member access");
assert.ok(player.includes("Unlimited Test Spin"), "Unlimited local Test Event flow is missing");
assert.ok(!player.includes('api("/api/test/spin"'), "Test flow must not write spin data");
assert.ok(!player.includes('api("/api/test/status"'), "Test flow must not read or write member status");
assert.ok(admin.includes("/admin/promos/generate"), "Promo admin action is missing");
assert.ok(admin.includes("copyTestLink"), "Test Link copy action is missing");
assert.ok(admin.includes("/admin/branding/publish"), "Branding publish action is missing");
assert.ok(inbox.includes('credentials: "include"'), "Inbox session requests must include cookies");

for (const id of [
  "promoGenerate",
  "promoSend",
  "testCopyLink",
  "brandingUpload",
  "brandingSaveDraft",
  "brandingPublish",
  "auditTable",
  "claimsTable",
]) {
  assert.ok(adminHtml.includes(`id="${id}"`), `Admin HTML missing ${id}`);
  assert.ok(admin.includes(`"${id}"`), `Admin JS does not wire ${id}`);
}

const rewrites = new Map((config.rewrites || []).map((item) => [item.source, item.destination]));
assert.equal(
  rewrites.get("/backend/:path*"),
  "https://lucky77-wheel-bot-548i.onrender.com/:path*"
);
assert.equal(rewrites.get("/event/:path*"), "/index.html");
assert.equal(rewrites.get("/test/:path*"), "/index.html");
assert.equal(rewrites.get("/admin"), "/admin.html");
assert.equal(rewrites.get("/player"), "/index.html");

for (const route of [
  "/auth/login",
  "/auth/check",
  "/admin/overview",
  "/admin/event",
  "/admin/promos",
  "/admin/branding",
  "/admin/audit",
  "/admin/claims",
  "/api/player/event",
  "/api/player/status",
  "/api/player/register",
  "/api/player/account",
  "/api/player/spin",
  "/api/test/event",
  "/api/test/status",
  "/api/test/spin",
]) {
  assert.ok(backend.includes(`"${route}"`), `Backend route missing: ${route}`);
}

assert.ok(fs.statSync(path.join(root, "assets", "lucky77-logo.png")).size > 1000);

console.log("Lucky77 v6.4.5 frontend contracts: PASS");
