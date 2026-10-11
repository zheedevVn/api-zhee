/**  * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.  * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.  * ZheeDevTool-Signed-2026  */
require("./zheeProtect.js").verifyOrThrow();
const crypto = require("crypto");
const { kvGetJson, kvSetJson, kvDel } = require("./licenseStore");
const googleAuth = require("./googleAuth");

const CLIENT_PREFIX = "zhee:oauth:client:";
const OWNER_INDEX = "zhee:oauth:owner:";
const CODE_PREFIX = "zhee:oauth:code:";
const CODE_TTL = 600;
const TOKEN_TTL = 3600;
const ISSUER = "https://api-zhee.vercel.app";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function oauthSecret() {
  const explicit = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (explicit) return explicit;
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (token) return crypto.createHmac("sha256", token).update("zhee-oauth-v1").digest("hex");
  const admin = String(process.env.ADMIN_SECRET || "").trim();
  if (admin) return admin;
  return "";
}
function b64url(buf) { return Buffer.from(buf).toString("base64url"); }
function signToken(payload) {
  const secret = oauthSecret();
  if (!secret) throw fail("Thieu AUTH_SESSION_SECRET tren may chu.", 503);
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}
function verifyToken(token) {
  const secret = oauthSecret();
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!p || p.typ !== "zhee_at" || !p.exp || p.exp <= Date.now()) return null;
    return p;
  } catch (_) { return null; }
}
function sha(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function sameSecret(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function validRedirectUri(u) {
  try {
    const url = new URL(String(u || "").trim());
    if (url.protocol === "https:") return url.toString().replace(/\/$/, "") === String(u).trim().replace(/\/$/, "") ? String(u).trim() : url.toString();
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return String(u).trim();
    return null;
  } catch (_) { return null; }
}
async function readSession(req) {
  const s = await googleAuth.readAccount(req);
  return s || null;
}
async function loadUser(sub) {
  return kvGetJson("zhee:google:user:" + sub);
}

async function createClient(ownerSub, name, redirectUris) {
  const cleanName = String(name || "").trim().slice(0, 60);
  if (cleanName.length < 3) throw fail("Ten ung dung phai tu 3 ky tu.", 400);
  const uris = Array.isArray(redirectUris) ? redirectUris : [redirectUris];
  const clean = [];
  for (const u of uris.slice(0, 5)) {
    const v = validRedirectUri(u);
    if (!v) throw fail("Redirect URI khong hop le (chi chap nhan https, hoac http://localhost de test): " + String(u).slice(0, 80), 400);
    if (!clean.includes(v)) clean.push(v);
  }
  if (!clean.length) throw fail("Can it nhat 1 redirect URI hop le.", 400);
  const clientId = "zhc_" + crypto.randomBytes(12).toString("hex");
  const secret = "zhs_" + crypto.randomBytes(32).toString("hex");
  const client = {
    client_id: clientId,
    secret_hash: sha(secret),
    name: cleanName,
    redirect_uris: clean,
    owner_sub: ownerSub,
    created_at: new Date().toISOString()
  };
  await kvSetJson(CLIENT_PREFIX + clientId, client, 400 * 24 * 3600);
  const idx = (await kvGetJson(OWNER_INDEX + ownerSub)) || [];
  if (!idx.includes(clientId)) {
    idx.push(clientId);
    await kvSetJson(OWNER_INDEX + ownerSub, idx.slice(-100), 400 * 24 * 3600);
  }
  return { client_id: clientId, client_secret: secret, name: cleanName, redirect_uris: clean, created_at: client.created_at };
}
async function listClients(ownerSub) {
  const idx = (await kvGetJson(OWNER_INDEX + ownerSub)) || [];
  const out = [];
  for (const id of idx) {
    const c = await kvGetJson(CLIENT_PREFIX + id);
    if (c) out.push({ client_id: c.client_id, name: c.name, redirect_uris: c.redirect_uris, created_at: c.created_at });
  }
  return out;
}
async function deleteClient(ownerSub, clientId) {
  const c = await kvGetJson(CLIENT_PREFIX + String(clientId));
  if (!c || c.owner_sub !== ownerSub) throw fail("Khong tim thay ung dung.", 404);
  await kvDel(CLIENT_PREFIX + c.client_id);
  const idx = ((await kvGetJson(OWNER_INDEX + ownerSub)) || []).filter((x) => x !== c.client_id);
  await kvSetJson(OWNER_INDEX + ownerSub, idx, 400 * 24 * 3600);
  return true;
}
async function regenerateSecret(ownerSub, clientId) {
  const c = await kvGetJson(CLIENT_PREFIX + String(clientId));
  if (!c || c.owner_sub !== ownerSub) throw fail("Khong tim thay ung dung.", 404);
  const secret = "zhs_" + crypto.randomBytes(32).toString("hex");
  c.secret_hash = sha(secret);
  await kvSetJson(CLIENT_PREFIX + c.client_id, c, 400 * 24 * 3600);
  return { client_id: c.client_id, client_secret: secret };
}
async function getClient(clientId) {
  return kvGetJson(CLIENT_PREFIX + String(clientId || ""));
}
function parseScopes(raw) {
  const set = new Set(String(raw || "").split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean));
  set.delete("openid");
  const allowed = ["profile", "email"];
  return [...set].filter((s) => allowed.includes(s));
}
function scopeLabel(s) {
  if (s === "email") return "Dia chi email cua ban";
  return "Ten hien thi va anh dai dien";
}

function consentHtml(client, params, user) {
  const scopes = parseScopes(params.scope);
  const scopeItems = scopes.length
    ? scopes.map((s) => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${esc(scopeLabel(s))}</span></li>`).join("")
    : `<li><span>Thong tin co ban cua tai khoan</span></li>`;
  const hidden = ["client_id", "redirect_uri", "scope", "state"].map((k) =>
    `<input type="hidden" name="${k}" value="${esc(params[k] || "")}">`).join("");
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cho phep dang nhap — Zhee API</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#eef0f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px 12px}.card{width:100%;max-width:430px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(20,20,60,.14)}.head{background:linear-gradient(120deg,#141432 0%,#2b2b6b 55%,#3b2a7a 100%);padding:34px 28px 28px;text-align:center}.shield{width:60px;height:60px;margin:0 auto 14px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center}.head h1{color:#fff;font-size:19px;font-weight:800;margin-bottom:8px}.head p{color:rgba(255,255,255,.75);font-size:13px;line-height:1.6}.body{padding:26px 28px 28px}.app{display:flex;align-items:center;gap:12px;background:#f6f7fb;border:1px solid #e6e8f0;border-radius:14px;padding:14px 16px;margin-bottom:18px}.app-ic{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;flex:none}.app b{display:block;font-size:14.5px;color:#1b1b3a}.app span{font-size:12px;color:#8a8fa3}.scopes{list-style:none;margin:0 0 22px}.scopes li{display:flex;align-items:center;gap:10px;padding:9px 2px;font-size:13.5px;color:#3c3f52;border-bottom:1px solid #f0f1f5}.btns{display:flex;gap:10px}.btn{flex:1;padding:13px;border-radius:12px;font-size:14.5px;font-weight:700;cursor:pointer;border:none}.allow{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}.deny{background:#f1f2f6;color:#5b5f73}.user{display:flex;align-items:center;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid #f0f1f5;font-size:12.5px;color:#8a8fa3}.user img{width:28px;height:28px;border-radius:50%}.foot{text-align:center;margin-top:14px;font-size:11px;color:#b0b4c6;letter-spacing:1.5px;font-weight:800}</style>
</head><body><div class="card">
<div class="head"><div class="shield"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
<h1>Dang nhap bang Zhee</h1><p>Ung dung ben thu ba muon truy cap tai khoan Zhee cua ban</p></div>
<div class="body">
<div class="app"><div class="app-ic">${esc((client.name || "A").trim().charAt(0).toUpperCase())}</div><div><b>${esc(client.name)}</b><span>yeu cau quyen truy cap</span></div></div>
<ul class="scopes">${scopeItems}</ul>
<form method="POST" action="/oauth/authorize">${hidden}
<div class="btns"><button class="btn deny" type="submit" name="decision" value="deny">Tu choi</button><button class="btn allow" type="submit" name="decision" value="allow">Cho phep</button></div></form>
<div class="user">${user.picture ? `<img src="${esc(user.picture)}" alt="">` : ""}<span>Dang nhap voi tu cach <b style="color:#3c3f52">${esc(user.name || user.email || "")}</b></span></div>
<div class="foot">ZHEE API</div>
</div></div></body></html>`;
}
function errorHtml(message) {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loi — Zhee API</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#eef0f4;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.c{background:#fff;border-radius:16px;padding:32px 28px;max-width:400px;text-align:center;box-shadow:0 8px 30px rgba(20,20,60,.1)}h1{font-size:17px;color:#1b1b3a;margin-bottom:10px}p{font-size:13.5px;color:#8a8fa3;line-height:1.6}</style>
</head><body><div class="c"><h1>Khong the dang nhap</h1><p>${esc(message)}</p></div></body></html>`;
}
function readFormBody(req) {
  let raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  const out = {};
  for (const pair of String(raw).split("&")) {
    const i = pair.indexOf("=");
    if (i < 0) continue;
    try { out[decodeURIComponent(pair.slice(0, i).replace(/\+/g, " "))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " ")); } catch (_) {}
  }
  return out;
}
function redirectWith(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
}
function sendHtml(res, html, status = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).send(html);
}
function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

async function handleAuthorizePage(req, res) {
  const q = req.query || {};
  const clientId = String(q.client_id || "").trim();
  const redirectUri = String(q.redirect_uri || "").trim();
  const responseType = String(q.response_type || "").trim();
  const scope = String(q.scope || "");
  const state = String(q.state || "");
  const client = await getClient(clientId);
  if (!client) return sendHtml(res, errorHtml("Ung dung khong ton tai (client_id sai)."), 400);
  const matched = client.redirect_uris.find((u) => u === redirectUri.replace(/\/$/, "") || u.replace(/\/$/, "") === redirectUri.replace(/\/$/, ""));
  if (!matched) return sendHtml(res, errorHtml("redirect_uri khong khop voi ung dung da dang ky."), 400);
  if (responseType !== "code") return sendHtml(res, errorHtml("Chi ho tro response_type=code."), 400);
  const user = await readSession(req);
  if (!user) {
    const next = "/oauth/authorize?" + new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope, state }).toString();
    res.setHeader("Location", "/dang-nhap?next=" + encodeURIComponent(next));
    return res.status(302).send("");
  }
  return sendHtml(res, consentHtml(client, { client_id: clientId, redirect_uri: redirectUri, scope, state }, user));
}

async function handleAuthorizeSubmit(req, res) {
  const body = readFormBody(req);
  const clientId = String(body.client_id || "").trim();
  const redirectUri = String(body.redirect_uri || "").trim();
  const scope = String(body.scope || "");
  const state = String(body.state || "");
  const decision = String(body.decision || "");
  const client = await getClient(clientId);
  if (!client) return sendHtml(res, errorHtml("Ung dung khong ton tai."), 400);
  const matched = client.redirect_uris.find((u) => u.replace(/\/$/, "") === redirectUri.replace(/\/$/, ""));
  if (!matched) return sendHtml(res, errorHtml("redirect_uri khong hop le."), 400);
  const user = await readSession(req);
  if (!user) {
    res.setHeader("Location", "/dang-nhap");
    return res.status(302).send("");
  }
  if (decision !== "allow") {
    res.setHeader("Location", redirectWith(matched, { error: "access_denied", state }));
    return res.status(302).send("");
  }
  const code = crypto.randomBytes(24).toString("hex");
  await kvSetJson(CODE_PREFIX + code, {
    client_id: client.client_id, sub: user.sub, redirect_uri: matched, scope, created_at: Date.now()
  }, CODE_TTL);
  res.setHeader("Location", redirectWith(matched, { code, state }));
  return res.status(302).send("");
}

function clientCredentials(req, body) {
  const h = String(req.headers.authorization || "");
  if (/^basic /i.test(h)) {
    try {
      const dec = Buffer.from(h.slice(6).trim(), "base64").toString("utf8");
      const i = dec.indexOf(":");
      if (i > 0) return { id: dec.slice(0, i), secret: dec.slice(i + 1) };
    } catch (_) {}
  }
  return { id: String(body.client_id || "").trim(), secret: String(body.client_secret || "") };
}

async function handleToken(req, res) {
  const body = readFormBody(req);
  if (String(body.grant_type || "") !== "authorization_code") {
    return json(res, 400, { error: "unsupported_grant_type" });
  }
  const creds = clientCredentials(req, body);
  const client = await getClient(creds.id);
  if (!client || !sameSecret(sha(creds.secret), client.secret_hash)) {
    return json(res, 401, { error: "invalid_client" });
  }
  const code = String(body.code || "").trim();
  const redirectUri = String(body.redirect_uri || "").trim();
  const stored = await kvGetJson(CODE_PREFIX + code);
  await kvDel(CODE_PREFIX + code);
  if (!stored || stored.client_id !== client.client_id) {
    return json(res, 400, { error: "invalid_grant", error_description: "Ma code khong hop le hoac da su dung." });
  }
  if (stored.redirect_uri.replace(/\/$/, "") !== redirectUri.replace(/\/$/, "")) {
    return json(res, 400, { error: "invalid_grant", error_description: "redirect_uri khong khop." });
  }
  const now = Date.now();
  const accessToken = signToken({
    typ: "zhee_at", sub: stored.sub, cid: client.client_id,
    scope: parseScopes(stored.scope), iat: now, exp: now + TOKEN_TTL * 1000,
    jti: crypto.randomBytes(12).toString("hex")
  });
  return json(res, 200, {
    access_token: accessToken, token_type: "Bearer", expires_in: TOKEN_TTL, scope: parseScopes(stored.scope).join(" ")
  });
}

async function handleUserInfo(req, res) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^bearer\s+(.+)$/i);
  const payload = m ? verifyToken(m[1].trim()) : null;
  if (!payload) {
    res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token"');
    return json(res, 401, { error: "invalid_token" });
  }
  const user = await loadUser(payload.sub);
  if (!user) return json(res, 404, { error: "user_not_found" });
  const scopes = payload.scope || [];
  const out = { sub: user.sub };
  if (scopes.includes("profile")) {
    out.name = user.name || "";
    out.picture = user.picture || "";
  }
  if (scopes.includes("email")) {
    out.email = user.email || "";
    out.email_verified = true;
  }
  return json(res, 200, out);
}

function handleDiscovery(req, res) {
  return json(res, 200, {
    issuer: ISSUER,
    authorization_endpoint: ISSUER + "/oauth/authorize",
    token_endpoint: ISSUER + "/oauth/token",
    userinfo_endpoint: ISSUER + "/oauth/userinfo",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"]
  });
}

async function handleClientsApi(req, res) {
  const user = await readSession(req);
  if (!user) return json(res, 401, { trang_thai: "that_bai", thong_bao: "Can dang nhap." });
  const url = new URL(req.url || "/api/oauth/clients", "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts.length > 3 ? decodeURIComponent(parts[3]) : null;
  const isRegen = id && parts[4] === "secret";
  const cleanId = isRegen ? id : id;
  try {
    if (req.method === "GET" && !id) {
      return json(res, 200, { trang_thai: "thanh_cong", ung_dung: await listClients(user.sub) });
    }
    if (req.method === "POST" && !id) {
      const body = readFormBody(req);
      const created = await createClient(user.sub, body.name, body.redirect_uris);
      return json(res, 200, { trang_thai: "thanh_cong", ung_dung: created, luu_y: "Luu client_secret ngay — chi hien 1 lan duy nhat." });
    }
    if (req.method === "DELETE" && cleanId && !isRegen) {
      await deleteClient(user.sub, cleanId);
      return json(res, 200, { trang_thai: "thanh_cong" });
    }
    if (req.method === "POST" && isRegen) {
      const r = await regenerateSecret(user.sub, cleanId);
      return json(res, 200, { trang_thai: "thanh_cong", ung_dung: r, luu_y: "Secret cu da bi huy. Luu secret moi ngay." });
    }
    return json(res, 405, { trang_thai: "that_bai", thong_bao: "Phuong thuc khong ho tro." });
  } catch (e) {
    return json(res, e.status || 500, { trang_thai: "that_bai", thong_bao: e.message || "Loi may chu." });
  }
}

module.exports = {
  handleAuthorizePage,
  handleAuthorizeSubmit,
  handleToken,
  handleUserInfo,
  handleDiscovery,
  handleClientsApi
};
