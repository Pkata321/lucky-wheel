"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const player = fs.readFileSync(path.join(root, "script.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const winners = fs.readFileSync(path.join(root, "winners.js"), "utf8");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

for (const copy of [
  "ကိုယ်တိုင်အကောင့်ဖောက်ရန်",
  "CS သို့ဆက်သွယ်ရန်",
  "Verified Game Account",
  "Promo Code",
]) {
  assert.ok(html.includes(copy), `Player copy missing: ${copy}`);
}

assert.ok(player.includes("test-player"));
assert.ok(player.includes("Unlimited Test Spin"));
assert.ok(player.includes("persisted: false"));
assert.ok(!player.includes('api("/api/test/spin"'));
assert.ok(!player.includes('api("/api/test/status"'));
assert.ok(adminHtml.includes('data-section="inbox"'));
assert.ok(adminHtml.includes('data-src="./winners.html?embedded=1"'));
assert.ok(winners.includes("EMBEDDED"));

const routes = new Map(config.rewrites.map((item) => [item.source, item.destination]));
assert.equal(routes.get("/admin"), "/admin.html");
assert.equal(routes.get("/player"), "/index.html");
assert.equal(routes.get("/test"), "/index.html");
assert.equal(routes.get("/test/:path*"), "/index.html");

console.log("Lucky77 confirmed frontend flow: PASS");