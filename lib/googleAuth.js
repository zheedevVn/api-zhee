const crypto = require("crypto");
const { hasRedis, kvGetJson, kvSetJson, kvDel } = require("./licenseStore");

const SESSION_SECONDS = 24 * 60 * 60;
const ACCOUNT_SECONDS = 400 * 24 * 60 * 60;
const COOKIE_NAME = "zhee_session";
const USER_PREFIX = "zhee:google:user:";
const EMAIL_PREFIX = "zhee:google:email:";
const SESSION_PREFIX = "zhee:google:session:";

let googleCerts = { expires: 0, keys: [] };

function json(res, statusCode, payload, cookie) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  return res.status(statusCode).json(payload);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sessionSecret() {
  const explicit = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (explicit) return explicit;
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (token) return crypto.createHmac("sha256", token).update("zhee-google-session-v1").digest("hex");
  const admin = String(process.env.ADMIN_SECRET || "").trim();
  if (admin) return admin;
  return "";
}

function signSessionToken(payload, secret = sessionSecret()) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readSessionToken(token, secret = sessionSecret()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || !payload.jti || !payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return "";
}

function cookieValue(token, maxAge, secure) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function applyIntent(existing, intent) {
  if (intent !== "login" && intent !== "register") {
    return { status: 400, thong_bao: "Chọn đăng nhập hoặc đăng ký." };
  }
  if (intent === "register" && existing) {
    return { status: 409, thong_bao: "Tài khoản Google này đã đăng ký. Hãy đăng nhập." };
  }
  if (intent === "login" && !existing) {
    return { status: 401, thong_bao: "Chưa có tài khoản. Hãy đăng ký bằng Google." };
  }
  return null;
}

function publicAccount(user, exp) {
  return {
    trang_thai: "thanh_cong",
    authenticated: true,
    provider: "google",
    email: user.email,
    name: user.name,
    picture: user.picture || "",
    expires_at: new Date(exp).toISOString()
  };
}

async function googleKeys() {
  if (googleCerts.expires > Date.now() && googleCerts.keys.length) return googleCerts.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw fail("Không tải được khóa Google.", 503);
  const body = await response.json();
  googleCerts = { expires: Date.now() + 60 * 60 * 1000, keys: body.keys || [] };
  return googleCerts.keys;
}

async function verifyGoogleIdToken(credential) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw fail("Thiếu GOOGLE_CLIENT_ID trên máy chủ.", 503);
  const parts = String(credential || "").split(".");
  if (parts.length !== 3) throw fail("Token Google không hợp lệ.", 401);
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (_) {
    throw fail("Token Google không đọc được.", 401);
  }
  const jwk = (await googleKeys()).find((key) => key.kid === header.kid);
  if (!jwk) throw fail("Khóa Google không khớp.", 401);
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key,
    Buffer.from(parts[2], "base64url")
  );
  if (!valid) throw fail("Chữ ký Google không hợp lệ.", 401);
  const issuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!issuers.includes(payload.iss) || payload.aud !== clientId) {
    throw fail("Tài khoản Google không thuộc ứng dụng này.", 401);
  }
  if (String(payload.email_verified) !== "true") throw fail("Email Google chưa được xác minh.", 401);
  if (!payload.sub || !payload.email || Number(payload.exp) * 1000 <= Date.now()) {
    throw fail("Phiên Google đã hết hạn.", 401);
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email),
    picture: String(payload.picture || "")
  };
}

async function readAccount(req) {
  const secret = sessionSecret();
  if (!secret) return null;
  const token = readSessionToken(readCookie(req, COOKIE_NAME), secret);
  if (!token) return null;
  const session = await kvGetJson(`${SESSION_PREFIX}${token.jti}`);
  if (!session || session.exp <= Date.now()) return null;
  return session;
}

async function saveAccount(profile) {
  const now = new Date().toISOString();
  const existing = await kvGetJson(`${USER_PREFIX}${profile.sub}`);
  const user = {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    created_at: existing && existing.created_at ? existing.created_at : now,
    last_login_at: now
  };
  const emailKey = `${EMAIL_PREFIX}${crypto.createHash("sha256").update(profile.email).digest("hex")}`;
  await kvSetJson(`${USER_PREFIX}${profile.sub}`, user, ACCOUNT_SECONDS);
  await kvSetJson(emailKey, profile.sub, ACCOUNT_SECONDS);
  return user;
}

async function openSession(res, req, user) {
  const secret = sessionSecret();
  if (!secret) throw fail("Thiếu AUTH_SESSION_SECRET trên máy chủ.", 503);
  if (process.env.NODE_ENV === "production" && !hasRedis()) {
    throw fail("Máy chủ thiếu Redis nên không lưu được phiên.", 503);
  }
  const exp = Date.now() + SESSION_SECONDS * 1000;
  const jti = crypto.randomBytes(18).toString("base64url");
  const session = {
    jti,
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture || "",
    exp
  };
  await kvSetJson(`${SESSION_PREFIX}${jti}`, session, SESSION_SECONDS);
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https");
  return {
    cookie: cookieValue(signSessionToken({ jti, exp }, secret), SESSION_SECONDS, secure),
    account: publicAccount(session, exp)
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}

async function googleAuthHandler(req, res) {
  const pathname = String(req.url || "/").split("?")[0].toLowerCase();
  if (req.method === "OPTIONS") return json(res, 204, {});

  try {
    if (pathname.endsWith("/config") && req.method === "GET") {
      const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
      return json(res, 200, {
        trang_thai: "thanh_cong",
        enabled: Boolean(clientId),
        client_id: clientId
      });
    }

    if (pathname.endsWith("/session") && req.method === "GET") {
      const session = await readAccount(req);
      if (!session) {
        return json(res, 401, { trang_thai: "that_bai", authenticated: false, thong_bao: "Chưa đăng nhập." });
      }
      return json(res, 200, publicAccount(session, session.exp));
    }

    if (pathname.endsWith("/logout") && req.method === "POST") {
      const secret = sessionSecret();
      const token = secret ? readSessionToken(readCookie(req, COOKIE_NAME), secret) : null;
      if (token) await kvDel(`${SESSION_PREFIX}${token.jti}`);
      const secure = String(req.headers["x-forwarded-proto"] || "").includes("https");
      return json(res, 200, { trang_thai: "thanh_cong", authenticated: false }, cookieValue("", 0, secure));
    }

    if (pathname.endsWith("/google") && req.method === "POST") {
      const body = parseBody(req);
      const intent = String(body.intent || "");
      const profile = await verifyGoogleIdToken(body.credential);
      const existing = await kvGetJson(`${USER_PREFIX}${profile.sub}`);
      const rejected = applyIntent(existing, intent);
      if (rejected) {
        return json(res, rejected.status, { trang_thai: "that_bai", thong_bao: rejected.thong_bao });
      }
      const user = await saveAccount(profile);
      const opened = await openSession(res, req, user);
      return json(res, 200, opened.account, opened.cookie);
    }

    return json(res, 405, { trang_thai: "that_bai", thong_bao: "Phương thức không được hỗ trợ." });
  } catch (error) {
    return json(res, error.status || 500, {
      trang_thai: "that_bai",
      authenticated: false,
      thong_bao: error.message || "Không xác thực được Google."
    });
  }
}

module.exports = googleAuthHandler;
module.exports.signSessionToken = signSessionToken;
module.exports.readSessionToken = readSessionToken;
module.exports.applyIntent = applyIntent;
module.exports.SESSION_SECONDS = SESSION_SECONDS;
