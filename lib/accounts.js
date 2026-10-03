const crypto = require("crypto");
const { kvGetJson, kvSetJson } = require("./licenseStore");

const USER_PREFIX = "zhee:google:user:";
const SECRET_PREFIX = "zhee:billing:secret:";
const IP_PREFIX = "zhee:billing:ip:";
const TOPUP_PREFIX = "zhee:billing:topup:";
const TOPUP_INDEX = "zhee:billing:topup:index";
const USER_INDEX = "zhee:billing:users";
const STORE_TTL = 400 * 24 * 60 * 60;
const FREE_MS = 10 * 24 * 60 * 60 * 1000;
const RENEW_PRICE = 10000;
const RENEW_MS = 10 * 24 * 60 * 60 * 1000;
const MAX_PER_IP = 3;
const BANK = { ngan_hang: "MB BANK", stk: "0899256226", chu_tk: "HO DUC MINH" };

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function adminUsername() {
  return String(process.env.ADMIN_USERNAME || "hoducminh");
}

function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "minhhocgioi");
}

function sameSecret(left, right) {
  const a = crypto.createHash("sha256").update(String(left)).digest();
  const b = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function clientIp(req) {
  const forwarded = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim();
  return forwarded || String((req.headers && req.headers["x-real-ip"]) || "0.0.0.0");
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function makeSecret() {
  return `zs_${crypto.randomBytes(24).toString("base64url")}`;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "ZHEE";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  }
  return req.body;
}

function json(res, status, payload, cookie) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  return res.status(status).json(payload);
}

async function loadUser(sub) {
  if (!sub) return null;
  return kvGetJson(`${USER_PREFIX}${sub}`);
}

async function saveUser(user) {
  await kvSetJson(`${USER_PREFIX}${user.sub}`, user, STORE_TTL);
  if (user.secret) await kvSetJson(`${SECRET_PREFIX}${digest(user.secret)}`, user.sub, STORE_TTL);
  const index = (await kvGetJson(USER_INDEX)) || [];
  if (!index.includes(user.sub)) {
    index.push(user.sub);
    await kvSetJson(USER_INDEX, index.slice(-5000), STORE_TTL);
  }
  return user;
}

function withBilling(user, ip) {
  if (!user.secret) user.secret = makeSecret();
  if (user.balance == null || Number.isNaN(Number(user.balance))) user.balance = 0;
  if (!user.key_expires_at) user.key_expires_at = new Date(Date.now() + FREE_MS).toISOString();
  if (!user.status) user.status = "hoat_dong";
  if (ip && !user.register_ip) user.register_ip = ip;
  return user;
}

function keyActive(user) {
  return Boolean(user) && user.status !== "khoa" && Date.parse(user.key_expires_at || 0) > Date.now();
}

async function assertNewIp(ip) {
  const row = (await kvGetJson(`${IP_PREFIX}${digest(ip)}`)) || { count: 0, subs: [] };
  if (Number(row.count || 0) >= MAX_PER_IP) throw fail("Địa chỉ IP này đã tạo đủ 3 tài khoản.", 429);
  return row;
}

async function rememberIp(ip, sub) {
  const key = `${IP_PREFIX}${digest(ip)}`;
  const row = (await kvGetJson(key)) || { count: 0, subs: [] };
  if (!row.subs.includes(sub)) {
    row.subs.push(sub);
    row.count = row.subs.length;
  }
  await kvSetJson(key, row, STORE_TTL);
  return row;
}

async function finishRegister(user, ip) {
  withBilling(user, ip);
  await saveUser(user);
  await rememberIp(ip, user.sub);
  return user;
}

async function ensureExisting(user) {
  withBilling(user);
  await saveUser(user);
  return user;
}

function publicProfile(user) {
  return {
    trang_thai: "thanh_cong",
    authenticated: true,
    role: "user",
    provider: "google",
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture || "",
    balance: Number(user.balance || 0),
    secret: user.secret || "",
    key_expires_at: user.key_expires_at || "",
    key_active: keyActive(user),
    status: user.status || "hoat_dong",
    renew_price: RENEW_PRICE,
    renew_days: 10,
    free_days: 10,
    created_at: user.created_at || ""
  };
}

function bankTicket(amount, code) {
  return {
    ...BANK,
    so_tien: amount,
    noi_dung: code,
    qr: `https://img.vietqr.io/image/MB-0899256226-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(code)}&accountName=${encodeURIComponent(BANK.chu_tk)}`
  };
}

async function createTopup(user, amount) {
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value < 10000 || value > 20000000) {
    throw fail("Số tiền từ 10.000 đến 20.000.000đ.");
  }
  let code = makeCode();
  for (let i = 0; i < 5 && await kvGetJson(`${TOPUP_PREFIX}${code}`); i += 1) code = makeCode();
  const order = {
    code,
    sub: user.sub,
    email: user.email,
    name: user.name,
    amount: value,
    status: "cho",
    created_at: new Date().toISOString()
  };
  await kvSetJson(`${TOPUP_PREFIX}${code}`, order, 14 * 24 * 60 * 60);
  const index = (await kvGetJson(TOPUP_INDEX)) || [];
  index.unshift(code);
  await kvSetJson(TOPUP_INDEX, [...new Set(index)].slice(0, 500), STORE_TTL);
  return { ...order, ...bankTicket(value, code) };
}

async function readTopup(code) {
  return kvGetJson(`${TOPUP_PREFIX}${String(code || "").trim().toUpperCase()}`);
}

async function listTopups() {
  const index = (await kvGetJson(TOPUP_INDEX)) || [];
  const rows = [];
  for (const code of index.slice(0, 200)) {
    const row = await kvGetJson(`${TOPUP_PREFIX}${code}`);
    if (row) rows.push(row);
  }
  return rows;
}

async function confirmTopup(code) {
  const order = await readTopup(code);
  if (!order) throw fail("Không thấy mã nạp.", 404);
  if (order.status === "xong") return order;
  if (order.status === "huy") throw fail("Mã nạp đã bị hủy.");
  const user = await loadUser(order.sub);
  if (!user) throw fail("Không thấy tài khoản của mã nạp.", 404);
  user.balance = Number(user.balance || 0) + Number(order.amount || 0);
  await saveUser(user);
  order.status = "xong";
  order.confirmed_at = new Date().toISOString();
  await kvSetJson(`${TOPUP_PREFIX}${order.code}`, order, STORE_TTL);
  return order;
}

async function rejectTopup(code) {
  const order = await readTopup(code);
  if (!order) throw fail("Không thấy mã nạp.", 404);
  if (order.status === "xong") throw fail("Mã này đã cộng tiền.");
  order.status = "huy";
  await kvSetJson(`${TOPUP_PREFIX}${order.code}`, order, STORE_TTL);
  return order;
}

async function renew(user) {
  if (Number(user.balance || 0) < RENEW_PRICE) throw fail("Số dư chưa đủ 10.000đ để gia hạn 10 ngày.", 402);
  const base = Math.max(Date.now(), Date.parse(user.key_expires_at || 0) || 0);
  user.balance = Number(user.balance) - RENEW_PRICE;
  user.key_expires_at = new Date(base + RENEW_MS).toISOString();
  user.status = user.status === "khoa" ? "khoa" : "hoat_dong";
  await saveUser(user);
  return user;
}

async function findBySecret(secret) {
  const sub = await kvGetJson(`${SECRET_PREFIX}${digest(String(secret || "").trim())}`);
  if (!sub) return null;
  return loadUser(sub);
}

function gateUser(user) {
  if (!user) return { ok: false, status: 401, thong_bao: "Secret key không hợp lệ." };
  if (user.status === "khoa") return { ok: false, status: 403, thong_bao: "Tài khoản đã bị khóa." };
  if (!keyActive(user)) {
    return { ok: false, status: 402, thong_bao: "Key miễn phí đã hết 10 ngày. Hãy nạp tiền để gia hạn." };
  }
  return { ok: true, user };
}

async function accessForRequest(req) {
  const header = String((req.headers && (req.headers["x-zhee-key"] || req.headers["x-api-key"])) || "").trim();
  let queryKey = "";
  try {
    const url = new URL(req.url || "/", "https://api-zhee.vercel.app");
    queryKey = String(url.searchParams.get("key") || url.searchParams.get("secret") || url.searchParams.get("x-zhee-key") || "").trim();
  } catch (_) {}
  const presented = header || queryKey;
  if (presented) return gateUser(await findBySecret(presented));
  const { readAccount } = require("./googleAuth");
  const session = await readAccount(req);
  if (!session) return { ok: false, status: 401, thong_bao: "Đăng nhập để dùng secret key của tài khoản." };
  if (session.role === "admin") return { ok: true, admin: true };
  return gateUser(await loadUser(session.sub));
}

async function requireSession(req) {
  const { readAccount } = require("./googleAuth");
  const session = await readAccount(req);
  if (!session) throw fail("Chưa đăng nhập.", 401);
  return session;
}

async function requireUser(req) {
  const session = await requireSession(req);
  if (session.role === "admin") throw fail("Trang này dành cho tài khoản Google.", 403);
  const user = await loadUser(session.sub);
  if (!user) throw fail("Không thấy tài khoản.", 404);
  return ensureExisting(user);
}

async function requireAdmin(req) {
  const session = await requireSession(req);
  if (session.role !== "admin") throw fail("Chỉ tài khoản quản trị.", 403);
  return session;
}

async function adjustUser(body) {
  const user = await loadUser(body.sub);
  if (!user) throw fail("Không thấy người dùng.", 404);
  if (body.balance_delta != null && body.balance_delta !== "") {
    user.balance = Math.max(0, Number(user.balance || 0) + Number(body.balance_delta || 0));
  }
  if (body.balance != null && body.balance !== "") user.balance = Math.max(0, Number(body.balance));
  const days = Number(body.extend_days || 0);
  if (days) {
    const base = Math.max(Date.now(), Date.parse(user.key_expires_at || 0) || 0);
    user.key_expires_at = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  }
  if (body.status === "khoa" || body.status === "hoat_dong") user.status = body.status;
  await saveUser(user);
  return publicProfile(user);
}

async function overview() {
  const ids = (await kvGetJson(USER_INDEX)) || [];
  const users = [];
  for (const sub of ids) {
    const user = await loadUser(sub);
    if (user) users.push(user);
  }
  const topups = await listTopups();
  return {
    users: users.length,
    active_keys: users.filter(keyActive).length,
    balance: users.reduce((sum, user) => sum + Number(user.balance || 0), 0),
    pending: topups.filter((row) => row.status === "cho").length,
    topups: topups.length
  };
}

async function accountsHandler(req, res) {
  const pathname = String(req.url || "/").split("?")[0].toLowerCase();
  try {
    if (pathname === "/api/auth/admin" && req.method === "POST") {
      const body = parseBody(req);
      if (!sameSecret(body.username, adminUsername()) || !sameSecret(body.password, adminPassword())) {
        return json(res, 401, { trang_thai: "that_bai", thong_bao: "Sai tên đăng nhập hoặc mật khẩu." });
      }
      const { openRoleSession } = require("./googleAuth");
      const opened = await openRoleSession(req, {
        role: "admin",
        sub: "admin",
        email: adminUsername(),
        name: "Quản trị"
      });
      return json(res, 200, { ...opened.account, role: "admin" }, opened.cookie);
    }

    if (pathname === "/api/account" && req.method === "GET") {
      const session = await requireSession(req);
      if (session.role === "admin") {
        return json(res, 200, {
          trang_thai: "thanh_cong",
          authenticated: true,
          role: "admin",
          name: session.name || "Quản trị",
          email: session.email || adminUsername(),
          balance: 0,
          key_active: false
        });
      }
      return json(res, 200, publicProfile(await requireUser(req)));
    }

    if (pathname === "/api/account/renew" && req.method === "POST") {
      const user = await renew(await requireUser(req));
      return json(res, 200, publicProfile(user));
    }

    if (pathname === "/api/account/topup" && req.method === "POST") {
      const user = await requireUser(req);
      const ticket = await createTopup(user, parseBody(req).amount);
      return json(res, 200, { trang_thai: "thanh_cong", ...ticket });
    }

    if (pathname === "/api/account/topups" && req.method === "GET") {
      const user = await requireUser(req);
      const rows = (await listTopups()).filter((row) => row.sub === user.sub);
      return json(res, 200, { trang_thai: "thanh_cong", danh_sach: rows });
    }

    if (pathname === "/api/admin/overview" && req.method === "GET") {
      await requireAdmin(req);
      return json(res, 200, { trang_thai: "thanh_cong", ...(await overview()) });
    }

    if (pathname === "/api/admin/users" && req.method === "GET") {
      await requireAdmin(req);
      const q = new URL(req.url, "https://api-zhee.vercel.app").searchParams.get("q") || "";
      const ids = (await kvGetJson(USER_INDEX)) || [];
      const rows = [];
      for (const sub of ids) {
        const user = await loadUser(sub);
        if (!user) continue;
        const hay = `${user.email} ${user.name} ${user.sub}`.toLowerCase();
        if (q && !hay.includes(String(q).toLowerCase())) continue;
        rows.push(publicProfile(user));
      }
      return json(res, 200, { trang_thai: "thanh_cong", danh_sach: rows });
    }

    if (pathname === "/api/admin/users" && req.method === "POST") {
      await requireAdmin(req);
      return json(res, 200, { trang_thai: "thanh_cong", ...(await adjustUser(parseBody(req))) });
    }

    if (pathname === "/api/admin/topups" && req.method === "GET") {
      await requireAdmin(req);
      return json(res, 200, { trang_thai: "thanh_cong", danh_sach: await listTopups() });
    }

    if (pathname === "/api/admin/topups" && req.method === "POST") {
      await requireAdmin(req);
      const body = parseBody(req);
      const order = body.action === "huy" ? await rejectTopup(body.code) : await confirmTopup(body.code);
      return json(res, 200, { trang_thai: "thanh_cong", ...order });
    }

    return json(res, 405, { trang_thai: "that_bai", thong_bao: "Phương thức không được hỗ trợ." });
  } catch (error) {
    return json(res, error.status || 500, { trang_thai: "that_bai", thong_bao: error.message || "Lỗi tài khoản." });
  }
}

module.exports = accountsHandler;
module.exports.clientIp = clientIp;
module.exports.assertNewIp = assertNewIp;
module.exports.finishRegister = finishRegister;
module.exports.ensureExisting = ensureExisting;
module.exports.accessForRequest = accessForRequest;
module.exports.makeCode = makeCode;
module.exports.createTopup = createTopup;
module.exports.confirmTopup = confirmTopup;
module.exports.renew = renew;
module.exports.RENEW_PRICE = RENEW_PRICE;
module.exports.MAX_PER_IP = MAX_PER_IP;
module.exports.sameSecret = sameSecret;
module.exports.keyActive = keyActive;
