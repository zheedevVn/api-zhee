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
    const s = String(u || "").trim();
    const url = new URL(s);
    if (url.protocol === "https:") return url.toString().replace(/\/$/, "") === s.replace(/\/$/, "") ? s : url.toString();
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return s;
    if (!["https:", "http:"].includes(url.protocol) && /^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) return s;
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
  if (cleanName.length < 3) throw fail("Tên ứng dụng phải từ 3 ký tự.", 400);
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
async function updateClientRedirectUris(ownerSub, clientId, redirectUris) {
  const c = await kvGetJson(CLIENT_PREFIX + String(clientId));
  if (!c || c.owner_sub !== ownerSub) throw fail("Khong tim thay ung dung.", 404);
  const uris = Array.isArray(redirectUris) ? redirectUris : String(redirectUris || "").split(/[\n,]+/);
  const clean = [];
  for (const u of uris) {
    const v = validRedirectUri(u);
    if (v && !clean.includes(v)) clean.push(v);
  }
  if (!clean.length) throw fail("Can it nhat 1 redirect URI hop le.", 400);
  c.redirect_uris = clean;
  await kvSetJson(CLIENT_PREFIX + c.client_id, c, 400 * 24 * 3600);
  return { client_id: c.client_id, name: c.name, redirect_uris: c.redirect_uris };
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
  if (s === "email") return "Địa chỉ email của bạn";
  return "Tên hiển thị và ảnh đại diện";
}

function loginHtml(client, params) {
  const q = new URLSearchParams({ client_id: params.client_id || "", redirect_uri: params.redirect_uri || "", response_type: "code", scope: params.scope || "", state: params.state || "" }).toString();
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Đăng nhập để tiếp tục — Zhee</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#07070f;color:#e8e8f2;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 14px;position:relative;overflow:hidden}
.bg{position:fixed;inset:0;pointer-events:none;background:radial-gradient(500px 350px at 50% 0%,rgba(99,102,241,.16),transparent 60%),radial-gradient(400px 400px at 50% 110%,rgba(168,85,247,.1),transparent 60%)}
.card{position:relative;width:100%;max-width:420px;background:rgba(21,28,40,.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.5);padding:38px 30px 30px;text-align:center}
.card::before{content:"";position:absolute;top:0;left:12%;right:12%;height:1px;background:linear-gradient(90deg,transparent,rgba(129,140,248,.7),transparent)}
.logo{width:64px;height:64px;margin:0 auto 18px;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(124,58,237,.5)}
h1{font-size:20px;font-weight:900;margin-bottom:8px;background:linear-gradient(90deg,#a5b4fc,#c084fc,#f0abfc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.sub{color:#9aa0b8;font-size:13px;line-height:1.7;margin-bottom:24px}.sub b{color:#fff}
#gbtn{display:flex;justify-content:center;margin:0 auto;min-height:44px}
.tabs{display:flex;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:4px;margin-bottom:20px}
.tabs button{flex:1;padding:11px;border:none;border-radius:10px;background:transparent;color:#9aa0b8;font-size:13.5px;font-weight:700;cursor:pointer;transition:all .15s}
.tabs button.on{background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;box-shadow:0 4px 14px rgba(124,58,237,.4)}
.note{margin-top:18px;font-size:12px;color:#5b6478;line-height:1.6}
.err{display:none;margin-top:14px;font-size:12.5px;color:#f87171;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px 12px;line-height:1.5}
.foot{text-align:center;margin-top:20px;font-size:10.5px;color:#5b6478;letter-spacing:3px;font-weight:800}</style>
</head><body><div class="bg"></div><div class="card">
<div class="logo"><svg width="64" height="64" viewBox="0 0 64 64">${zheeLogoInner("zll")}</svg></div>
<h1>Đăng nhập để tiếp tục</h1>
<p class="sub"><b>${esc(client.name)}</b> muốn bạn dùng tài khoản Zhee<br>để tiếp tục tới ứng dụng</p>
<div class="tabs"><button type="button" id="tabLogin" class="on" onclick="setIntent('login')">Đăng nhập</button><button type="button" id="tabReg" onclick="setIntent('register')">Đăng ký</button></div>
<div id="gbtn"></div>
<div class="err" id="err"></div>
<p class="note">Đăng nhập bằng Google — tài khoản Zhee của bạn<br>chính là tài khoản Google đã liên kết.</p>
<div class="foot">ZHEE API</div>
</div>
<script>
const NEXT_URL = "/oauth/authorize?${q}";
let INTENT = "login";
function setIntent(v){INTENT=v;document.getElementById("tabLogin").className=v==="login"?"on":"";document.getElementById("tabReg").className=v==="register"?"on":"";renderGbtn();updNote();document.getElementById("err").style.display="none"}
let GSI_READY=false,GSI_CID="";
function renderGbtn(){if(!GSI_READY)return;document.getElementById("gbtn").innerHTML="";google.accounts.id.renderButton(document.getElementById("gbtn"),{theme:"filled_black",size:"large",width:320,text:INTENT==="register"?"signup_with":"signin_with",shape:"pill"})}
function updNote(){const n=document.querySelector(".note");if(n)n.innerHTML=INTENT==="register"?"Tạo tài khoản Zhee mới bằng Google —<br>miễn phí, chỉ mất vài giây.":"Đăng nhập bằng Google — tài khoản Zhee của bạn<br>chính là tài khoản Google đã liên kết."}
function showErr(m){const e=document.getElementById("err");e.style.display="block";e.textContent=m}
function loadGsi(){return new Promise((res,rej)=>{if(window.google&&google.accounts&&google.accounts.id)return res();const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.onload=res;s.onerror=()=>rej(new Error("Không tải được Google."));document.head.appendChild(s)})}
async function onGoogleCredential(r){
  try{
    const resp=await fetch("/api/auth/google",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:r&&r.credential,intent:INTENT})});
    const j=await resp.json();
    if(resp.ok&&j.authenticated===true){location.href=NEXT_URL;return}
    showErr((j&&j.thong_bao)||"Đăng nhập thất bại.");
  }catch(e){showErr("Lỗi kết nối, thử lại.")}
}
(async()=>{
  try{
    const cfg=await fetch("/api/auth/config",{credentials:"same-origin"}).then(r=>r.json());
    if(!cfg.client_id)throw new Error("Máy chủ chưa cấu hình Google.");
    await loadGsi();
    google.accounts.id.initialize({client_id:cfg.client_id,callback:onGoogleCredential});
    GSI_CID=cfg.client_id;GSI_READY=true;renderGbtn();
  }catch(e){showErr(e.message||"Không tải được đăng nhập Google.")}
})();
</script></body></html>`;
}
function consentHtml(client, params, user) {
  const scopes = parseScopes(params.scope);
  const scopeItems = scopes.length
    ? scopes.map((s) => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${esc(scopeLabel(s))}</span></li>`).join("")
    : `<li><span>Thông tin cơ bản của tài khoản</span></li>`;
  const hidden = ["client_id", "redirect_uri", "scope", "state"].map((k) =>
    `<input type="hidden" name="${k}" value="${esc(params[k] || "")}">`).join("");
  const appInitial = esc((client.name || "A").trim().charAt(0).toUpperCase());
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cho phép đăng nhập — Zhee</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#07070f;color:#e8e8f2;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 14px;position:relative;overflow:hidden}
.bg{position:fixed;inset:0;pointer-events:none;background:radial-gradient(500px 350px at 50% 0%,rgba(99,102,241,.16),transparent 60%),radial-gradient(400px 400px at 50% 110%,rgba(168,85,247,.1),transparent 60%)}
.card{position:relative;width:100%;max-width:440px;background:rgba(21,28,40,.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.5)}
.card::before{content:"";position:absolute;top:0;left:12%;right:12%;height:1px;background:linear-gradient(90deg,transparent,rgba(129,140,248,.7),transparent)}
.head{padding:36px 30px 26px;text-align:center;background:radial-gradient(300px 160px at 50% 0%,rgba(99,102,241,.18),transparent 70%)}
.logo{width:64px;height:64px;margin:0 auto 16px;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(124,58,237,.5)}
.head h1{font-size:21px;font-weight:900;margin-bottom:8px;background:linear-gradient(90deg,#a5b4fc,#c084fc,#f0abfc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.head p{color:#9aa0b8;font-size:13px;line-height:1.65}
.body{padding:6px 26px 28px}
.app{display:flex;align-items:center;gap:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:15px 16px;margin-bottom:18px}
.app-ic{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:19px;flex:none;box-shadow:0 4px 14px rgba(124,58,237,.4)}
.app b{display:block;font-size:14.5px;color:#fff}.app span{font-size:12px;color:#9aa0b8}
.scopes{list-style:none;margin:0 0 22px}.scopes li{display:flex;align-items:center;gap:11px;padding:10px 2px;font-size:13.5px;color:#c6cbde;border-bottom:1px solid rgba(255,255,255,.06)}
.btns{display:flex;gap:10px}.btn{flex:1;padding:14px;border-radius:13px;font-size:14.5px;font-weight:700;cursor:pointer;border:none;transition:transform .12s,box-shadow .12s}
.btn:hover{transform:translateY(-1px)}.allow{background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;box-shadow:0 8px 24px rgba(124,58,237,.45)}.deny{background:rgba(255,255,255,.07);color:#c6cbde;border:1px solid rgba(255,255,255,.1)}
.user{display:flex;align-items:center;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07);font-size:12.5px;color:#9aa0b8}.user img{width:30px;height:30px;border-radius:50%;border:1.5px solid rgba(129,140,248,.5)}.user b{color:#fff}
.foot{text-align:center;margin-top:16px;font-size:10.5px;color:#5b6478;letter-spacing:3px;font-weight:800}</style>
</head><body><div class="bg"></div><div class="card">
<div class="head"><div class="logo"><svg width="64" height="64" viewBox="0 0 64 64">${zheeLogoInner("zlc")}</svg></div>
<h1>Đăng nhập bằng Zhee</h1><p>Ứng dụng bên thứ ba muốn truy cập<br>tài khoản Zhee của bạn</p></div>
<div class="body">
<div class="app"><div class="app-ic">${appInitial}</div><div><b>${esc(client.name)}</b><span>yêu cầu quyền truy cập</span></div></div>
<ul class="scopes">${scopeItems}</ul>
<form method="POST" action="/oauth/authorize">${hidden}
<div class="btns"><button class="btn deny" type="submit" name="decision" value="deny">Từ chối</button><button class="btn allow" type="submit" name="decision" value="allow">Cho phép</button></div></form>
<div class="user">${user.picture ? `<img src="${esc(user.picture)}" alt="">` : ""}<span>Đăng nhập với tư cách <b>${esc(user.name || user.email || "")}</b></span></div>
<div class="foot">ZHEE API</div>
</div></div></body></html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lỗi — Zhee API</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#07070f;color:#e8e8f2;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.c{background:rgba(21,28,40,.9);border:1px solid rgba(239,68,68,.3);border-radius:20px;padding:36px 30px;max-width:400px;text-align:center;box-shadow:0 16px 50px rgba(0,0,0,.45)}.ic{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.4);display:flex;align-items:center;justify-content:center}h1{font-size:17px;color:#fff;margin-bottom:10px}p{font-size:13.5px;color:#9aa0b8;line-height:1.65}</style>
</head><body><div class="c"><div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h1>Không thể đăng nhập</h1><p>${esc(message)}</p></div></body></html>`;
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
  if (typeof res.send === "function") return res.status(status).send(html);
  res.statusCode = status;
  return res.end(html);
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
  if (!client) return sendHtml(res, errorHtml("Ứng dụng không tồn tại (client_id sai)."), 400);
  const matched = client.redirect_uris.find((u) => u === redirectUri.replace(/\/$/, "") || u.replace(/\/$/, "") === redirectUri.replace(/\/$/, ""));
  if (!matched) return sendHtml(res, errorHtml("redirect_uri không khớp với ứng dụng đã đăng ký."), 400);
  if (responseType !== "code") return sendHtml(res, errorHtml("Chỉ hỗ trợ response_type=code."), 400);
  const user = await readSession(req);
  if (!user) {
    return sendHtml(res, loginHtml(client, { client_id: clientId, redirect_uri: redirectUri, scope, state }));
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
  if (!client) return sendHtml(res, errorHtml("Ứng dụng không tồn tại."), 400);
  const matched = client.redirect_uris.find((u) => u.replace(/\/$/, "") === redirectUri.replace(/\/$/, ""));
  if (!matched) return sendHtml(res, errorHtml("redirect_uri không hợp lệ."), 400);
  const user = await readSession(req);
  if (!user) {
    const back = "/oauth/authorize?" + new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope, state }).toString();
    res.setHeader("Location", back);
    res.statusCode = 302;
    return res.end("");
  }
  if (decision !== "allow") {
    res.setHeader("Location", redirectWith(matched, { error: "access_denied", state }));
    res.statusCode = 302;
    return res.end("");
  }
  const code = crypto.randomBytes(24).toString("hex");
  await kvSetJson(CODE_PREFIX + code, {
    client_id: client.client_id, sub: user.sub, redirect_uri: matched, scope, created_at: Date.now()
  }, CODE_TTL);
  res.setHeader("Location", redirectWith(matched, { code, state }));
  res.statusCode = 302;
  return res.end("");
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
  // Tra ve secret key de app mobile tu dong lay
  try {
    const km = require("./keyManager");
    if (typeof km.getKeyByUser === "function") {
      const k = await km.getKeyByUser(user.sub);
      if (k && k.key) {
        out.secret_key = k.key;
        if (k.expiresTimestamp) out.secret_expires_at = Math.floor(k.expiresTimestamp / 1000);
        else if (k.thoi_gian_het_han) out.secret_expires_at = Math.floor(new Date(k.thoi_gian_het_han).getTime() / 1000);
      }
    }
  } catch (e) {}
  // Fallback: key trong user object
  if (!out.secret_key) {
    if (user.secret_key) out.secret_key = user.secret_key;
    else if (user.secretKey) out.secret_key = user.secretKey;
    else if (user.api_key) out.secret_key = user.api_key;
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
    if ((req.method === "PUT" || req.method === "PATCH") && cleanId && !isRegen) {
      const body = readFormBody(req);
      const r = await updateClientRedirectUris(user.sub, cleanId, body.redirect_uris);
      return json(res, 200, { trang_thai: "thanh_cong", ung_dung: r });
    }
    return json(res, 405, { trang_thai: "that_bai", thong_bao: "Phuong thuc khong ho tro." });
  } catch (e) {
    return json(res, e.status || 500, { trang_thai: "that_bai", thong_bao: e.message || "Loi may chu." });
  }
}


function zheeLogoInner(id) {
  return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"><animate attributeName="stop-color" values="#22d3ee;#a855f7;#ec4899;#22d3ee" dur="4s" repeatCount="indefinite"/></stop><stop offset="0.55" stop-color="#a855f7"><animate attributeName="stop-color" values="#a855f7;#ec4899;#22d3ee;#a855f7" dur="4s" repeatCount="indefinite"/></stop><stop offset="1" stop-color="#ec4899"><animate attributeName="stop-color" values="#ec4899;#22d3ee;#a855f7;#ec4899" dur="4s" repeatCount="indefinite"/></stop></linearGradient><filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="64" height="64" rx="16" fill="#0a0a14"/><rect width="64" height="64" rx="16" fill="none" stroke="url(#${id}g)" stroke-width="1.6" opacity="0.7"/><path d="M18 21 H46 L18 43 H46" fill="none" stroke="url(#${id}g)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}f)"/>`;
}
function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Zhee">${zheeLogoInner("zlg")}</svg>`;
}
function buttonSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="248" height="48" viewBox="0 0 248 48" role="img" aria-label="Đăng nhập bằng Zhee">
<rect x="0.75" y="0.75" width="246.5" height="46.5" rx="23.25" fill="#ffffff" stroke="#dadce0" stroke-width="1.5"/>
<svg x="14" y="14" width="20" height="20" viewBox="0 0 64 64">${zheeLogoInner("zlb")}</svg>
<text x="44" y="30.5" font-family="-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="15" font-weight="500" fill="#1f1f1f" letter-spacing="0.2">Đăng nhập bằng Zhee</text>
</svg>`;
}
function buttonDarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="248" height="48" viewBox="0 0 248 48" role="img" aria-label="Đăng nhập bằng Zhee">
<defs><linearGradient id="zbd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
<rect x="0.75" y="0.75" width="246.5" height="46.5" rx="23.25" fill="url(#zbd)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
<svg x="14" y="14" width="20" height="20" viewBox="0 0 64 64">${zheeLogoInner("zld")}</svg>
<text x="44" y="30.5" font-family="-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="15" font-weight="600" fill="#ffffff" letter-spacing="0.2">Đăng nhập bằng Zhee</text>
</svg>`;
}


function docsHtml() {
  const origin = ISSUER;
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Đăng nhập bằng Zhee — Tài liệu tích hợp</title>
<meta name="description" content="Gắn nút Đăng nhập bằng Zhee vào website của bạn: OAuth 2.0, 3 bước tích hợp, endpoint đầy đủ.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#07070f;color:#e8e8f2;min-height:100vh;overflow-x:hidden}
.bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(600px 400px at 15% 0%,rgba(99,102,241,.14),transparent 60%),radial-gradient(700px 450px at 85% 20%,rgba(168,85,247,.12),transparent 60%),radial-gradient(500px 500px at 50% 100%,rgba(59,42,122,.18),transparent 60%)}
.orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;animation:drift 14s ease-in-out infinite alternate;pointer-events:none}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(50px,-40px) scale(1.25)}}
.ring{position:absolute;inset:-9px;border-radius:50%;background:conic-gradient(from 0deg,#6366f1,#a855f7,#ec4899,#6366f1);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));animation:spin 5s linear infinite;opacity:.85}
@keyframes spin{to{transform:rotate(360deg)}}
.shield-wrap{position:relative;width:96px;height:96px;margin:0 auto 24px}
.timeline{position:relative;margin:8px 0 4px;padding-left:8px}
.timeline::before{content:"";position:absolute;left:24px;top:12px;bottom:12px;width:2px;background:linear-gradient(180deg,#6366f1,#a855f7,#ec4899);opacity:.5;border-radius:2px}
.tstep{position:relative;display:flex;gap:18px;padding:16px 0}
.tstep .n{z-index:1}
.tstep .body{flex:1;min-width:0}
.tstep h3{color:#fff;font-size:15.5px;margin-bottom:6px}
.tstep p{color:#9aa0b8;font-size:13.5px;line-height:1.7}
.card:hover{border-color:rgba(129,140,248,.25);box-shadow:0 16px 50px rgba(0,0,0,.45),0 0 30px rgba(99,102,241,.08)}
.card{transition:border-color .25s,box-shadow .25s}
.chip{display:inline-block;font-size:11px;font-weight:700;color:#a5b4fc;background:rgba(99,102,241,.14);border:1px solid rgba(129,140,248,.3);padding:4px 12px;border-radius:20px;margin:0 4px 8px 0}
.hero{position:relative;z-index:1;text-align:center;padding:72px 20px 60px}
.shield{width:76px;height:76px;margin:0 auto 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.22);box-shadow:0 0 40px rgba(99,102,241,.45),inset 0 0 20px rgba(99,102,241,.15)}
.hero h1{font-size:clamp(30px,5vw,46px);font-weight:900;letter-spacing:.5px;margin-bottom:14px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#818cf8);background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:flow 6s linear infinite}
@keyframes flow{to{background-position:300% center}}
.hero p{color:rgba(255,255,255,.65);font-size:15.5px;max-width:600px;margin:0 auto 30px;line-height:1.7}
.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.btn{display:inline-block;padding:14px 30px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer;border:none;transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-2px)}
.btn-primary{background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;box-shadow:0 8px 28px rgba(124,58,237,.45)}
.btn-ghost{background:rgba(255,255,255,.07);color:#fff;border:1.5px solid rgba(255,255,255,.2)}
.wrap{position:relative;z-index:1;max-width:880px;margin:0 auto;padding:10px 20px 80px}
.card{position:relative;background:rgba(21,28,40,.75);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:30px;margin-bottom:22px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden}
.card::before{content:"";position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(129,140,248,.6),transparent)}
.card h2{font-size:19px;margin-bottom:8px;display:flex;align-items:center;gap:12px;color:#fff}
.n{width:34px;height:34px;flex:none;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(124,58,237,.6)}
.sub{color:#9aa0b8;font-size:13.5px;margin-bottom:16px;line-height:1.7}
.sub a,.p a{color:#a5b4fc}
pre{background:#0a0a16;border:1px solid rgba(255,255,255,.08);color:#d6d6f5;border-radius:14px;padding:18px 20px;font-size:13px;line-height:1.7;overflow-x:auto;margin:14px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre .c{color:#5b6478}pre .k{color:#a5b4fc}pre .s{color:#86efac}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px}
th,td{text-align:left;padding:12px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top}
th{color:#7c8598;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:1.2px}
td code{font-family:ui-monospace,monospace;font-size:12px;color:#a5b4fc;background:rgba(99,102,241,.14);padding:3px 9px;border-radius:7px;word-break:break-all}
.p code{font-family:ui-monospace,monospace;font-size:12.5px;color:#a5b4fc;background:rgba(99,102,241,.14);padding:2px 8px;border-radius:6px}
.tag{display:inline-block;font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px;margin-right:4px;letter-spacing:.5px}
.tag.get{background:rgba(34,197,94,.15);color:#4ade80}.tag.post{background:rgba(59,130,246,.15);color:#60a5fa}
.btn-preview{background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.18);border-radius:14px;padding:20px;margin:14px 0;display:grid;gap:16px;justify-items:center}.btn-preview pre.wrap{white-space:pre-wrap;word-break:break-all;overflow-x:hidden}
.btn-preview img{filter:drop-shadow(0 6px 18px rgba(99,102,241,.4))}
.copy-row{display:flex;gap:10px;align-items:flex-start;margin-top:10px}
.copy-row pre{flex:1;margin:0}
.cp{flex:none;padding:11px 18px;border-radius:10px;border:1.5px solid rgba(129,140,248,.4);background:rgba(99,102,241,.12);font-weight:700;font-size:12.5px;cursor:pointer;color:#a5b4fc;transition:all .15s}
.cp:hover{background:rgba(99,102,241,.25);border-color:#818cf8}
.note{background:rgba(232,169,61,.08);border:1px solid rgba(232,169,61,.3);border-radius:12px;padding:14px 16px;font-size:13px;color:#e8c07a;margin-top:14px;line-height:1.6}
.note b{color:#f0d090}
.step-flow{display:grid;gap:0;margin:6px 0 4px}
.fstep{display:flex;gap:14px;align-items:flex-start;padding:13px 4px;border-bottom:1px solid rgba(255,255,255,.06)}
.fstep:last-child{border:none}
.fstep .dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);margin-top:7px;flex:none;box-shadow:0 0 10px rgba(124,58,237,.8)}
.fstep div{font-size:13.5px;color:#c6cbdE;line-height:1.65}
.fstep b{color:#fff}
footer{text-align:center;padding:36px 20px;color:#5b6478;font-size:12.5px;position:relative;z-index:1}
footer b{color:#a5b4fc;letter-spacing:2.5px}
a{color:#a5b4fc}
@media(max-width:600px){.card{padding:22px 18px}.copy-row{flex-direction:column}.cp{align-self:flex-end}}
</style></head><body>
<div class="bg-glow"></div>
<div class="hero">
<div class="orb" style="width:280px;height:280px;left:8%;top:40px;background:#4f46e5"></div>
<div class="orb" style="width:220px;height:220px;right:10%;top:120px;background:#a855f7;animation-delay:-6s"></div>
<div class="shield-wrap"><div class="ring"></div><div style="margin:0;width:96px;height:96px;border-radius:26px;overflow:hidden;box-shadow:0 0 40px rgba(99,102,241,.45)"><svg width="96" height="96" viewBox="0 0 64 64">${zheeLogoInner("zlh")}</svg></div></div>
<h1>Đăng nhập bằng Zhee</h1>
<p>Cho website của bạn dùng tài khoản Zhee để đăng nhập — chuẩn OAuth 2.0, tích hợp trong vài phút, không cần viết hệ tài khoản riêng.</p>
<div class="cta"><a class="btn btn-primary" href="/ho-so">Tạo ứng dụng ngay</a><a class="btn btn-ghost" href="#tich-hop">Xem hướng dẫn</a></div>
</div>
<div class="wrap">

<div class="card" id="tich-hop">
<h2 style="margin-bottom:14px">Tích hợp trong 4 bước</h2>
<div class="timeline">
<div class="tstep"><span class="n">1</span><div class="body"><h3>Tạo ứng dụng</h3><p>Đăng nhập <a href="/ho-so">Hồ sơ</a> → mục <b style="color:#fff">Ứng dụng OAuth</b> → nhập tên app + redirect URI → nhận <span class="p"><code>client_id</code></span> và <span class="p"><code>client_secret</code></span> (secret chỉ hiện 1 lần).</p></div></div>
<div class="tstep"><span class="n">2</span><div class="body"><h3>Gắn nút đăng nhập</h3><p>Dùng ảnh nút có sẵn bên dưới (hotlink trực tiếp) hoặc tự tạo nút rồi trỏ tới URL authorize.</p></div></div>
<div class="tstep"><span class="n">3</span><div class="body"><h3>Đổi code lấy token</h3><p>User đồng ý → Zhee redirect về app của bạn kèm <span class="p"><code>code</code></span> → server đổi code lấy <span class="p"><code>access_token</code></span> (xem mẫu code bên dưới).</p></div></div>
<div class="tstep"><span class="n">4</span><div class="body"><h3>Lấy thông tin user</h3><p>Gọi <span class="p"><code>/oauth/userinfo</code></span> kèm Bearer token → nhận tên, email, avatar. Dùng <span class="p"><code>sub</code></span> làm ID duy nhất.</p></div></div>
</div>
<div style="margin-top:6px"><span class="chip">OAuth 2.0</span><span class="chip">Authorization Code</span><span class="chip">OpenID Discovery</span></div>
</div>

<div class="card">
<h2>Mã nhúng nút đăng nhập</h2>
<p class="sub">Copy đoạn HTML này dán vào website của bạn (thay YOUR_CLIENT_ID và redirect URI):</p>
<div class="btn-preview">
<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center">
<img src="${origin}/oauth/button.svg" alt="Đăng nhập bằng Zhee" width="248" height="48">
<img src="${origin}/oauth/button-dark.svg" alt="Đăng nhập bằng Zhee (dark)" width="248" height="48">
<img src="${origin}/oauth/logo.svg" alt="Zhee logo" width="48" height="48" style="border-radius:12px">
</div>
<p class="sub" style="margin:4px 0 0;text-align:center">Sáng · Tối · Logo riêng (<span class="p"><code>/oauth/logo.svg</code></span> · <span class="p"><code>/oauth/button-dark.svg</code></span>)</p>
<div style="width:100%"><div class="copy-row"><pre class="wrap">&lt;a href="${origin}/oauth/authorize?client_id=YOUR_CLIENT_ID&amp;redirect_uri=https://webban.com/callback&amp;response_type=code&amp;scope=openid%20profile%20email&amp;state=NGAU_NHIEN"&gt;
  &lt;img src="${origin}/oauth/button.svg" alt="Đăng nhập bằng Zhee"&gt;
&lt;/a&gt;</pre><button class="cp" onclick="cp(this)">Copy</button></div></div>
</div>
<p class="sub" style="margin:0">Tham số: <span class="p"><code>client_id</code></span> (bắt buộc) · <span class="p"><code>redirect_uri</code></span> (phải khớp đã đăng ký) · <span class="p"><code>response_type=code</code></span> · <span class="p"><code>scope</code></span> (openid profile email) · <span class="p"><code>state</code></span> (chuỗi ngẫu nhiên chống CSRF — kiểm tra khi nhận callback).</p>
</div>

<div class="card">
<h2>Code mẫu: đổi code lấy token</h2>
<p class="sub">Chạy ở <b style="color:#fff">server</b> — code dùng 1 lần, hết hạn 10 phút:</p>
<pre><span class="c">// Node.js — chạy ở server, KHÔNG để lộ client_secret ở frontend</span>
<span class="k">const</span> r = <span class="k">await</span> fetch(<span class="s">"${origin}/oauth/token"</span>, {
  method: <span class="s">"POST"</span>,
  headers: { <span class="s">"Content-Type"</span>: <span class="s">"application/json"</span> },
  body: JSON.stringify({
    grant_type: <span class="s">"authorization_code"</span>,
    code, <span class="c">// code từ callback</span>
    redirect_uri: <span class="s">"https://webban.com/callback"</span>,
    client_id: <span class="s">"zhc_..."</span>,
    client_secret: <span class="s">"zhs_..."</span>
  })
});
<span class="k">const</span> { access_token } = <span class="k">await</span> r.json(); <span class="c">// sống 1 giờ</span></pre>
</div>

<div class="card">
<h2>Code mẫu: lấy thông tin user</h2>
<pre><span class="k">const</span> me = <span class="k">await</span> fetch(<span class="s">"${origin}/oauth/userinfo"</span>, {
  headers: { Authorization: <span class="s">"Bearer "</span> + access_token }
}).then(r => r.json());
<span class="c">// → { sub, name, picture, email }  (email chỉ có khi scope gồm email)</span></pre>
<div class="note"><b>Lưu ý:</b> <code>sub</code> là ID duy nhất và không đổi của user — dùng nó làm khóa chính trong DB của bạn, đừng dùng email.</div>
</div>

<div class="card">
<h2>Endpoint</h2>
<table>
<tr><th>Phương thức</th><th>Endpoint</th><th>Mô tả</th></tr>
<tr><td><span class="tag get">GET</span></td><td><code>${origin}/oauth/authorize</code></td><td>Màn hình xin phép của user</td></tr>
<tr><td><span class="tag post">POST</span></td><td><code>${origin}/oauth/token</code></td><td>Đổi code lấy access_token</td></tr>
<tr><td><span class="tag get">GET</span></td><td><code>${origin}/oauth/userinfo</code></td><td>Lấy tên, email, avatar (Bearer token)</td></tr>
<tr><td><span class="tag get">GET</span></td><td><code>${origin}/.well-known/openid-configuration</code></td><td>Discovery JSON cho thư viện OAuth</td></tr>
</table>
<p class="sub" style="margin:14px 0 0">Chuẩn OAuth 2.0 Authorization Code — dùng được với mọi thư viện OAuth/OIDC (Passport, Authlib, NextAuth...).</p>
</div>

<div class="card">
<h2>Nhờ AI khác gắn giúp</h2>
<p class="sub">Copy đoạn dưới dán vào ChatGPT / Claude / AI bất kỳ — nó sẽ tự đọc tài liệu và gắn nút đăng nhập cho bạn:</p>
<div class="copy-row"><pre id="aiPrompt">Hãy gắn nút "Đăng nhập bằng Zhee" vào website của tôi. Đây là OAuth 2.0 provider (tương tự Google login). Đọc kỹ tài liệu tích hợp tại https://api-zhee.vercel.app/llms.txt rồi làm theo từng bước. Hỏi tôi client_id và client_secret khi cần — đừng tự bịa.</pre><button class="cp" onclick="cp(this)">Copy</button></div>
<p class="sub" style="margin:10px 0 0">File <span class="p"><code>/llms.txt</code></span> là chuẩn để AI đọc hiểu website — AI nào cũng fetch được.</p>
</div>

<div class="card">
<h2>Bảo mật</h2>
<div class="step-flow">
<div class="fstep"><span class="dot"></span><div><b>client_secret</b> chỉ ở server, không bao giờ nhúng vào frontend</div></div>
<div class="fstep"><span class="dot"></span><div><b>redirect_uri</b> phải khớp chính xác đã đăng ký (chống đánh cắp code)</div></div>
<div class="fstep"><span class="dot"></span><div>Luôn kiểm tra <b>state</b> khi nhận callback (chống CSRF)</div></div>
<div class="fstep"><span class="dot"></span><div>Code dùng 1 lần, token hết hạn sau <b>1 giờ</b></div></div>
</div>
</div>

</div>
<footer><b>ZHEE API</b><br>© 2026 Hồ Đức Minh (Zhee Dev)</footer>
<script>
function cp(btn){
  const pre = btn.parentElement.querySelector("pre");
  try { navigator.clipboard.writeText(pre.innerText); } catch(e) {
    const t = document.createElement("textarea");
    t.value = pre.innerText; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch(_){}
    t.remove();
  }
  btn.textContent = "Đã copy!"; setTimeout(()=>btn.textContent="Copy",1500);
}
</script>
</body></html>`;
}


function llmsTxt() {
  return `# Zhee API

> API gateway công cộng của Hồ Đức Minh (Zhee Dev). Site: https://api-zhee.vercel.app

## Đăng nhập bằng Zhee (OAuth 2.0)

Cho website của bạn dùng tài khoản Zhee để đăng nhập — tương tự "Sign in with Google".
Chuẩn OAuth 2.0 Authorization Code. Không cần API key riêng cho flow này.

### Bước 1 — Lấy client_id / client_secret
- Đăng nhập https://api-zhee.vercel.app/ho-so → mục "Ứng dụng OAuth" → Tạo ứng dụng
- Nhập tên app + redirect URI (https). Nhận \`client_id\` (zhc_...) và \`client_secret\` (zhs_..., chỉ hiện 1 lần).

### Bước 2 — Đưa user tới trang xin phép
\`\`\`
https://api-zhee.vercel.app/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https://your-site.com/callback&response_type=code&scope=openid%20profile%20email&state=RANDOM_STRING
\`\`\`
- \`redirect_uri\` phải khớp chính xác đã đăng ký.
- \`state\`: chuỗi ngẫu nhiên, kiểm tra khi nhận callback (chống CSRF).
- User đồng ý → redirect về \`redirect_uri?code=...&state=...\`. Từ chối → \`?error=access_denied\`.

### Bước 3 — Đổi code lấy access_token (server-side)
\`POST https://api-zhee.vercel.app/oauth/token\` (JSON):
\`\`\`json
{ "grant_type": "authorization_code", "code": "CODE", "redirect_uri": "https://your-site.com/callback", "client_id": "zhc_...", "client_secret": "zhs_..." }
\`\`\`
- Hoặc dùng header \`Authorization: Basic base64(client_id:client_secret)\`.
- Trả về: \`{ "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }\`
- Code dùng 1 lần, hết hạn 10 phút. KHÔNG để lộ client_secret ở frontend.

### Bước 4 — Lấy thông tin user
\`GET https://api-zhee.vercel.app/oauth/userinfo\` với header \`Authorization: Bearer ACCESS_TOKEN\`
- Trả về: \`{ "sub": "...", "name": "...", "picture": "...", "email": "..." }\` (email chỉ có khi scope gồm email).
- Dùng \`sub\` làm khóa chính trong DB (không đổi), đừng dùng email.

### Endpoint đầy đủ
- Authorize: \`GET https://api-zhee.vercel.app/oauth/authorize\`
- Token: \`POST https://api-zhee.vercel.app/oauth/token\`
- Userinfo: \`GET https://api-zhee.vercel.app/oauth/userinfo\`
- Discovery (OpenID): \`GET https://api-zhee.vercel.app/.well-known/openid-configuration\`
- Nút bấm SVG (hotlink): \`GET https://api-zhee.vercel.app/oauth/button.svg\`
- Tài liệu đầy đủ: https://api-zhee.vercel.app/oauth

### Bảo mật
- client_secret chỉ ở server. redirect_uri khớp chính xác. Luôn kiểm tra state. Token hết hạn 1 giờ.
`;
}


module.exports = {
  handleAuthorizePage,
  handleAuthorizeSubmit,
  handleToken,
  handleUserInfo,
  handleDiscovery,
  handleClientsApi,
  docsHtml,
  buttonSvg,
  buttonDarkSvg,
  logoSvg,
  llmsTxt
};
