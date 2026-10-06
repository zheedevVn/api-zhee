require("./zheeProtect.js").verifyOrThrow();
const crypto = require("crypto");

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

function json(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(statusCode).json(payload);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "hex");
  const b = Buffer.from(String(right || ""), "hex");
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(String(initData || ""));
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!receivedHash || !authDate) throw new Error("Thiếu dữ liệu xác thực Telegram.");

  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > MAX_AUTH_AGE_SECONDS) {
    throw new Error("Phiên Telegram đã hết hạn.");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!safeEqual(receivedHash, expectedHash)) {
    throw new Error("Dữ liệu Telegram không hợp lệ.");
  }

  let user;
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch (_) {
    throw new Error("Không đọc được tài khoản Telegram.");
  }
  if (!user || !user.id) throw new Error("Không tìm thấy tài khoản Telegram.");
  return { user, authDate };
}

module.exports = async function telegramAuthHandler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") {
    return json(res, 405, {
      trang_thai: "that_bai",
      thong_bao: "Telegram Mini App auth chỉ nhận POST."
    });
  }

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) {
    return json(res, 503, {
      trang_thai: "that_bai",
      thong_bao: "Thiếu TELEGRAM_BOT_TOKEN trên Vercel."
    });
  }

  try {
    const body = parseBody(req);
    const verified = verifyInitData(body.initData || body.init_data, botToken);
    const user = verified.user;
    const admins = String(process.env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const role = admins.includes(String(user.id)) ? "admin" : "user";

    return json(res, 200, {
      trang_thai: "thanh_cong",
      authenticated: true,
      telegram_id: String(user.id),
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Telegram user",
      username: user.username || "",
      avatar_url: user.photo_url || "",
      language_code: user.language_code || "",
      role,
      role_label: role === "admin" ? "ADMIN" : "USER",
      auth_date: verified.authDate
    });
  } catch (error) {
    return json(res, 401, {
      trang_thai: "that_bai",
      authenticated: false,
      thong_bao: error.message
    });
  }
};

module.exports.verifyInitData = verifyInitData;
