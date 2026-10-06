/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
/**
 * ZheeDevTool — License Guard (server-side)
 * (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 *
 * He thong bao ve ban quyen source code:
 *  - Khi co nguoi deploy source len domain la -> phone-home ve server nay
 *  - Server gui canh bao Telegram cho admin kem nut [Duyet] / [Chan]
 *  - Admin bam Chan -> domain vao blacklist vinh vien (Redis)
 *  - Ban copy tu dong kiem tra license dinh ky -> bi chan thi tat toan bo
 *
 * Bot Telegram chay qua webhook (Vercel serverless) -> KHONG can chay 24/7.
 */

try { require("./zheeProtect.js").verifyOrThrow(); } catch (_) {}

const LICENSE_SERVER = "https://api-zhee.vercel.app";
const DOMAIN_BL_PREFIX = "zhee:license:domain:blocked:";
const DOMAIN_WL_PREFIX = "zhee:license:domain:allowed:";
const DOMAIN_REPORT_PREFIX = "zhee:license:domain:reported:";
const DOMAIN_LIST_KEY = "zhee:license:domain:list";

// ---- Redis helpers (Upstash REST, fallback memory) ----
const _mem = new Map();
function _redisCfg() {
  return {
    url: String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, ""),
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  };
}
function _hasRedis() {
  const c = _redisCfg();
  return Boolean(c.url && c.token);
}
async function _rget(key) {
  try {
    if (_hasRedis()) {
      const { url, token } = _redisCfg();
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["GET", key]),
        signal: AbortSignal.timeout(10000),
      });
      const j = await r.json().catch(() => ({}));
      return j.result ?? null;
    }
    return _mem.has(key) ? _mem.get(key) : null;
  } catch (_) { return _mem.has(key) ? _mem.get(key) : null; }
}
async function _rset(key, val, ttlSec) {
  try {
    const v = typeof val === "string" ? val : JSON.stringify(val);
    if (_hasRedis()) {
      const { url, token } = _redisCfg();
      const cmd = ttlSec ? ["SET", key, v, "EX", Math.max(1, ttlSec)] : ["SET", key, v];
      await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
      return true;
    }
    _mem.set(key, v);
    return true;
  } catch (_) { _mem.set(key, typeof val === "string" ? val : JSON.stringify(val)); return true; }
}
async function _rdel(key) {
  try {
    if (_hasRedis()) {
      const { url, token } = _redisCfg();
      await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["DEL", key]),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }
    _mem.delete(key);
    return true;
  } catch (_) { return false; }
}

function _normDomain(d) {
  return String(d || "").toLowerCase().split(":")[0].trim().replace(/^www\./, "");
}

// ---- Trang thai domain: "allowed" | "blocked" | "pending" ----
async function domainStatus(domain) {
  const d = _normDomain(domain);
  if (!d) return "pending";
  // Domain chinh chu luon allowed
  if (d === "api-zhee.vercel.app" || d === "localhost" || d === "127.0.0.1" || d.endsWith(".vercel.app") && d.startsWith("api-zhee")) return "allowed";
  try {
    const blocked = await _rget(DOMAIN_BL_PREFIX + d);
    if (blocked) return "blocked";
    const allowed = await _rget(DOMAIN_WL_PREFIX + d);
    if (allowed) return "allowed";
  } catch (_) {}
  return "pending";
}

async function blockDomain(domain, reason) {
  const d = _normDomain(domain);
  if (!d) return false;
  await _rset(DOMAIN_BL_PREFIX + d, JSON.stringify({ domain: d, blockedAt: new Date().toISOString(), reason: reason || "admin_reject" }));
  await _rdel(DOMAIN_WL_PREFIX + d);
  await _rdel(DOMAIN_REPORT_PREFIX + d);
  return true;
}

async function allowDomain(domain) {
  const d = _normDomain(domain);
  if (!d) return false;
  await _rset(DOMAIN_WL_PREFIX + d, JSON.stringify({ domain: d, allowedAt: new Date().toISOString() }));
  await _rdel(DOMAIN_REPORT_PREFIX + d);
  return true;
}

// ---- Telegram ----
function _tgCfg() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    admins: String(process.env.TELEGRAM_ADMIN_IDS || "").split(",").map(s => s.trim()).filter(Boolean),
  };
}
async function _tgSend(chatId, text, replyMarkup) {
  const { token } = _tgCfg();
  if (!token || !chatId) return null;
  try {
    const body = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    return await r.json().catch(() => null);
  } catch (_) { return null; }
}
function _esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Gui canh bao cho admin khi phat hien domain la (chong spam: 1 lan / 6h / domain)
async function reportUnknownDomain(domain, meta) {
  const d = _normDomain(domain);
  if (!d) return { status: "pending" };
  const st = await domainStatus(d);
  if (st !== "pending") return { status: st };

  const { admins } = _tgCfg();
  const already = await _rget(DOMAIN_REPORT_PREFIX + d);
  if (!already && admins.length) {
    const now = new Date().toISOString();
    const lines = [
      "🚨 <b>PHÁT HIỆN SOURCE TRÁI PHÉP</b>",
      `🌐 Domain: <code>${_esc(d)}</code>`,
      `🕒 Thời gian: <code>${_esc(now)}</code>`,
      meta?.ip ? `📡 IP: <code>${_esc(meta.ip)}</code>` : "",
      meta?.ua ? `🖥️ UA: <code>${_esc(String(meta.ua).slice(0, 80))}</code>` : "",
      meta?.host ? `🏠 Host header: <code>${_esc(meta.host)}</code>` : "",
      "",
      "Bấm <b>CHẶN</b> để đưa vào blacklist vĩnh viễn — web đó sẽ bị tắt ngay lập tức.",
    ].filter(Boolean).join("\n");
    const kb = {
      inline_keyboard: [[
        { text: "✅ Duyệt", callback_data: `license:allow:${d}` },
        { text: "⛔ Chặn vĩnh viễn", callback_data: `license:block:${d}` },
      ]],
    };
    for (const adminId of admins) {
      try { await _tgSend(adminId, lines, kb); } catch (_) {}
    }
    // Chong spam bao cao: 6 gio
    await _rset(DOMAIN_REPORT_PREFIX + d, now, 6 * 3600);
  }
  return { status: "pending" };
}

// Xu ly callback tu nut Telegram. Tra ve true neu da xu ly.
async function handleLicenseCallback(data, fromId) {
  const { admins } = _tgCfg();
  if (!admins.includes(String(fromId))) return false;
  const m = String(data || "").match(/^license:(allow|block):([a-z0-9.\-]+)$/);
  if (!m) return false;
  const [, action, domain] = m;
  const d = _normDomain(domain);
  if (action === "block") {
    await blockDomain(d, "admin_reject_telegram");
    for (const adminId of admins) {
      try {
        await _tgSend(adminId, `⛔ <b>ĐÃ CHẶN VĨNH VIỄN</b>\n🌐 Domain: <code>${_esc(d)}</code>\n🔒 Web đó đã bị tắt — kể cả có source cũng không dùng được nữa.`);
      } catch (_) {}
    }
  } else {
    await allowDomain(d);
    for (const adminId of admins) {
      try { await _tgSend(adminId, `✅ <b>ĐÃ DUYỆT</b>\n🌐 Domain: <code>${_esc(d)}</code>\nWeb đó được phép hoạt động.`); } catch (_) {}
    }
  }
  return true;
}

// ---- HTTP handlers cho server.js ----

// POST /api/license/beacon  { domain, ip, ua, host }
async function beaconHandler(req, res) {
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (_) {}
  const domain = _normDomain(body.domain || req.headers["x-zhee-domain"] || "");
  const meta = {
    ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim(),
    ua: String(req.headers["user-agent"] || "").slice(0, 200),
    host: String(req.headers.host || ""),
  };
  const result = await reportUnknownDomain(domain, meta);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({ trang_thai: "thanh_cong", domain, license: result.status });
}

// GET /api/license/check?domain=xxx — ban copy goi de tu kiem tra
async function checkHandler(req, res) {
  let domain = "";
  try {
    const u = new URL(req.url || "/", "http://x");
    domain = _normDomain(u.searchParams.get("domain") || req.headers["x-zhee-domain"] || "");
  } catch (_) {}
  const status = await domainStatus(domain);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ domain, license: status, blocked: status === "blocked" });
}

// Client phone-home: goi tu ban copy khi phat hien domain la
async function phoneHome(domain, meta) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    await fetch(`${LICENSE_SERVER}/api/license/beacon`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-zhee-domain": _normDomain(domain) },
      body: JSON.stringify({ domain: _normDomain(domain), ...(meta || {}) }),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch (_) {}
}

// Client tu kiem tra: ban copy goi dinh ky, bi block -> tat web
async function remoteLicenseStatus(domain) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${LICENSE_SERVER}/api/license/check?domain=${encodeURIComponent(_normDomain(domain))}`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    return j.blocked ? "blocked" : (j.license || "pending");
  } catch (_) { return "unknown"; }
}

module.exports = {
  domainStatus,
  blockDomain,
  allowDomain,
  reportUnknownDomain,
  handleLicenseCallback,
  beaconHandler,
  checkHandler,
  phoneHome,
  remoteLicenseStatus,
  LICENSE_SERVER,
};
