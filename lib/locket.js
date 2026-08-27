const crypto = require("crypto");
const { encryptPayload, decryptPayload } = require("./keyManager");

const LOCKET_API = "https://api.locketcamera.com";
const FIREBASE_KEY = "AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So";
const FIREBASE_PROJECT = "locket-4252a";
const FIREBASE_GMPID = "1:641029076083:ios:cc8eb46290d69b234fa606";
const IOS_BUNDLE_ID = "com.locket.Locket";
const USER_AGENT = "com.locket.Locket/1.121.1 iPhone/18.2 hw/iPhone12_1";
const IDENTITY_URL = "https://www.googleapis.com/identitytoolkit/v3/relyingparty";
const SECURE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const REGISTER_COOLDOWN_MS = 5 * 60 * 1000;
const registerCooldownByIp = new Map();

const ACTION_MAP = {
  check: "check",
  username: "check",
  tra: "check",
  me: "me",
  info: "me",
  account: "me",
  thongtin: "me",
  login: "me",
  friends: "friends",
  banbe: "friends",
  friend: "friends",
  moments: "moments",
  moment: "moments",
  feed: "moments",
  anh: "moments",
  add: "add",
  ketban: "add",
  moi: "add",
  send: "add",
  cancel: "cancel",
  huy: "cancel",
  delete: "cancel",
  unfriend: "cancel",
  decrypt: "decrypt",
  giaima: "decrypt",
  decode: "decrypt",
  register: "register",
  reg: "register",
  tao: "register",
  create: "register",
  dangky: "register",
  signup: "register"
};

const BULK_KEYS = ["threads", "count", "so_luong", "list", "uids", "users", "bulk", "spam", "soluong", "emails", "accounts", "farm", "auto"];

function extractFirstParam(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function pick(searchParams, body, ...keys) {
  for (const key of keys) {
    const fromQuery = searchParams.get(key);
    if (fromQuery) return String(fromQuery).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function wantsEncrypt(searchParams, body, defaultOn = false) {
  const flag = pick(searchParams, body, "encrypt", "mahoa").toLowerCase();
  if (flag === "false" || flag === "0" || flag === "raw") return false;
  if (flag === "true" || flag === "1") return true;
  return Boolean(defaultOn);
}

function wrapEncrypted(payload, searchParams, body, defaultOn = false) {
  if (!wantsEncrypt(searchParams, body, defaultOn)) return payload;
  const encrypted = encryptPayload(payload);
  return {
    trang_thai: "thanh_cong",
    che_do: "Mã hóa AES-256-CBC",
    iv: encrypted.iv,
    encrypted_data: encrypted.encrypted_data,
    huong_dan_giai_ma: {
      cu_phap: "/api/tools/locket?action=decrypt&iv={iv}&data={encrypted_data}",
      vi_du_post: { action: "decrypt", iv: encrypted.iv, data: encrypted.encrypted_data }
    }
  };
}

function handleDecrypt(searchParams, body) {
  const iv = pick(searchParams, body, "iv");
  const data = pick(searchParams, body, "data", "encrypted_data", "payload");
  try {
    return {
      trang_thai: "thanh_cong",
      che_do: "Giải mã AES-256-CBC",
      du_lieu: decryptPayload(iv, data)
    };
  } catch (error) {
    const err = new Error("Không giải mã được. Kiểm tra lại iv và encrypted_data.");
    err.statusCode = 400;
    throw err;
  }
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function formatViDate(input) {
  if (!input) return null;
  let date = null;
  if (typeof input === "number") date = new Date(input > 1e12 ? input : input * 1000);
  else if (typeof input === "string") date = new Date(input);
  else if (input._seconds) date = new Date(input._seconds * 1000);
  else if (input.seconds) date = new Date(Number(input.seconds) * 1000);
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("vi-VN");
}

function parseGold(customAttributes, badge) {
  if (String(badge || "").toLowerCase().includes("gold")) return true;
  try {
    const attrs = typeof customAttributes === "string" ? JSON.parse(customAttributes) : customAttributes;
    const list = attrs?.revenueCatEntitlements || attrs?.entitlements || [];
    return Array.isArray(list) && list.some((item) => String(item).toLowerCase().includes("gold"));
  } catch (_) {
    return false;
  }
}

function normalizeUsername(input) {
  if (!input) return "";
  let raw = String(input).trim();
  try { raw = decodeURIComponent(raw); } catch (_) {}
  const camMatch = raw.match(/locket\.cam\/([a-zA-Z0-9._]+)/i);
  if (camMatch && camMatch[1]) raw = camMatch[1];
  return raw.replace(/^@+/, "").replace(/\/+$/, "").trim().toLowerCase();
}

function extractInviteUid(htmlOrUrl) {
  const decoded = String(htmlOrUrl).replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  const match = decoded.match(/locket\.camera(?:%2F|\/)invites(?:%2F|\/)([A-Za-z0-9]+)/i);
  const fullId = match && match[1] ? match[1] : "";
  if (!fullId) return { uid: "", inviteId: "" };
  return { uid: fullId.slice(0, 28), inviteId: fullId };
}

function extractAvatar(html) {
  const imgMatch = html.match(/class=["']?profile-pic-img["']?[^>]*src=["']?([^"'\s>]+)/i)
    || html.match(/src=["']?([^"'\s>]*locket-img[^"'\s>]*)["']?[^>]*class=["']?profile-pic-img/i);
  if (!imgMatch || !imgMatch[1]) return "";
  return imgMatch[1].replace("firebasestorage.googleapis.com:443", "firebasestorage.googleapis.com").trim();
}

function extractInitials(html) {
  const match = html.match(/class=["']?profile-pic-initials["']?[^>]*>([^<]+)</i);
  return match && match[1] ? match[1].trim() : "";
}

function isCelebrityProfile(html) {
  const body = html.split(/<body[^>]*>/i)[1] || "";
  return /class=["'][^"']*celebrity-container/i.test(body);
}

function looksLikeUid(value) {
  return /^[A-Za-z0-9]{28}$/.test(value);
}

function normalizePhone(input) {
  let cleaned = String(input).trim().replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("0")) cleaned = "+84" + cleaned.slice(1);
  else if (cleaned.startsWith("84") && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  else if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

function firebaseAuthHeaders() {
  return {
    Accept: "*/*",
    "Content-Type": "application/json",
    "User-Agent": `FirebaseAuth.iOS/10.23.1 ${USER_AGENT}`,
    "X-Client-Version": "iOS/FirebaseSDK/10.23.1/FirebaseCore-iOS",
    "X-Firebase-GMPID": FIREBASE_GMPID,
    "X-Ios-Bundle-Identifier": IOS_BUNDLE_ID
  };
}

function locketHeaders(token, appCheck) {
  const headers = {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": USER_AGENT,
    "X-Client-Version": "iOS/FirebaseSDK/10.23.1/FirebaseCore-iOS",
    "X-Firebase-GMPID": FIREBASE_GMPID,
    "X-Ios-Bundle-Identifier": IOS_BUNDLE_ID
  };
  if (appCheck) headers["X-Firebase-AppCheck"] = appCheck;
  return headers;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try { return { json: JSON.parse(text), text, status: res.status, ok: res.ok }; }
  catch (_) { return { json: null, text, status: res.status, ok: res.ok }; }
}

async function identityPost(path, body) {
  const res = await fetch(`${IDENTITY_URL}/${path}?key=${FIREBASE_KEY}`, {
    method: "POST",
    headers: firebaseAuthHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  return parseJsonSafe(res);
}

async function locketPost(path, token, body, appCheck) {
  const headers = token
    ? locketHeaders(token, appCheck)
    : {
        Accept: "*/*",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Ios-Bundle-Identifier": IOS_BUNDLE_ID
      };
  if (!token && appCheck) headers["X-Firebase-AppCheck"] = appCheck;

  const res = await fetch(`${LOCKET_API}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000)
  });
  return parseJsonSafe(res);
}

function mapFirebaseError(message) {
  const code = String(message || "").toUpperCase();
  if (code.includes("EMAIL_NOT_FOUND")) return "Email chưa đăng ký Locket.";
  if (code.includes("EMAIL_EXISTS") || code.includes("EMAIL_ALREADY")) return "Email này đã được dùng trên Locket.";
  if (code.includes("WEAK_PASSWORD")) return "Mật khẩu quá yếu. Tối thiểu 6 ký tự.";
  if (code.includes("INVALID_EMAIL")) return "Email không hợp lệ.";
  if (code.includes("ADMIN_ONLY_OPERATION")) return "Firebase đã tắt đăng ký công khai. Phải tạo qua API Locket kèm AppCheck.";
  if (code.includes("INVALID_PASSWORD") || code.includes("INVALID_LOGIN")) return "Mật khẩu không đúng.";
  if (code.includes("INVALID_ID_TOKEN") || code.includes("TOKEN_EXPIRED")) return "Token hết hạn hoặc không hợp lệ. Hãy đăng nhập lại hoặc dùng refresh_token.";
  if (code.includes("USER_DISABLED")) return "Tài khoản đã bị vô hiệu hóa.";
  if (code.includes("INVALID_REFRESH")) return "Refresh token không hợp lệ.";
  if (code.includes("TOO_MANY_ATTEMPTS")) return "Quá nhiều lần thử. Vui lòng thử lại sau.";
  return message || "Xác thực Locket thất bại.";
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.headers["x-real-ip"] || "").trim() || req.socket?.remoteAddress || "unknown";
}

function remainingRegisterCooldown(ip) {
  const last = registerCooldownByIp.get(ip);
  if (!last) return 0;
  const remain = REGISTER_COOLDOWN_MS - (Date.now() - last);
  if (remain <= 0) {
    registerCooldownByIp.delete(ip);
    return 0;
  }
  return remain;
}

function markRegisterCooldown(ip) {
  registerCooldownByIp.set(ip, Date.now());
  if (registerCooldownByIp.size <= 400) return;
  const now = Date.now();
  for (const [key, ts] of registerCooldownByIp) {
    if (now - ts > REGISTER_COOLDOWN_MS) registerCooldownByIp.delete(key);
  }
}

function formatCooldown(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes > 0) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
}

function randomClientToken() {
  return crypto.randomBytes(20).toString("hex");
}

function stringifyErrorPart(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.message || value.status || JSON.stringify(value);
  return String(value);
}

function locketInnerError(result) {
  const inner = result?.json?.result || result?.json || {};
  return stringifyErrorPart(inner.errors && inner.errors[0])
    || stringifyErrorPart(result?.json?.error?.message)
    || stringifyErrorPart(inner.error)
    || stringifyErrorPart(result?.json?.error)
    || stringifyErrorPart(result?.text);
}

function needsAppCheck(message) {
  return /appcheck|app-check|app_check|unauthenticated/i.test(String(message || ""));
}

function hasBulkAttempt(searchParams, body) {
  for (const key of BULK_KEYS) {
    if (searchParams.has(key) || (body && body[key] != null && String(body[key]).trim() !== "")) return key;
  }
  return "";
}

function assertSingleTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/[,;|\n]/.test(value) || value.split(/\s+/).filter(Boolean).length > 1) {
    const err = new Error("Chỉ được gửi hoặc hủy đúng 1 lời mời mỗi lần gọi API. Không hỗ trợ danh sách / spam.");
    err.statusCode = 400;
    throw err;
  }
  return value;
}

async function lookupLocketUsername(username) {
  const profileUrl = `https://locket.cam/${encodeURIComponent(username)}`;
  const res = await fetch(profileUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });

  const html = await res.text();
  const isNotFound = res.status === 404 || /Page Not Found/i.test(html);
  const { uid, inviteId } = extractInviteUid(html);

  if (isNotFound || !uid) {
    return { ton_tai: false, username, link_profile: profileUrl };
  }

  return {
    ton_tai: true,
    username,
    uid,
    ma_moi: inviteId,
    chu_cai_viet_tat: extractInitials(html) || null,
    anh_dai_dien: extractAvatar(html) || null,
    tai_khoan_noi_tieng: isCelebrityProfile(html),
    link_profile: profileUrl,
    link_moi_ban_be: `https://locket.camera/invites/${inviteId}`
  };
}

async function resolveTargetUid(raw, token, appCheck) {
  const input = String(raw || "").trim();
  if (!input) return "";

  const fromInvite = extractInviteUid(input);
  if (fromInvite.uid) return fromInvite.uid;
  if (looksLikeUid(input)) return input;

  const username = normalizeUsername(input);
  if (!username) return "";

  if (token) {
    const byName = await locketPost("getUserByUsername", token, { data: { username } }, appCheck);
    const uid = byName.json?.result?.data?.uid || byName.json?.result?.data?.user_uid;
    if (uid) return uid;
  }

  const publicLookup = await lookupLocketUsername(username);
  return publicLookup.ton_tai ? publicLookup.uid : "";
}

async function signInWithEmail(email, password) {
  const result = await identityPost("verifyPassword", {
    email,
    password,
    clientType: "CLIENT_TYPE_IOS",
    returnSecureToken: true
  });
  if (!result.ok || !result.json?.idToken) {
    const err = new Error(mapFirebaseError(result.json?.error?.message));
    err.statusCode = 401;
    throw err;
  }
  return {
    idToken: result.json.idToken,
    refreshToken: result.json.refreshToken,
    expiresIn: result.json.expiresIn,
    uid: result.json.localId,
    email: result.json.email,
    displayName: result.json.displayName,
    photoUrl: result.json.profilePicture
  };
}

async function signInWithPhone(phone, password) {
  const phoneRes = await locketPost("signInWithPhonePassword", "", {
    data: { phone: normalizePhone(phone), password }
  });
  const customToken = phoneRes.json?.result?.token;
  if (!customToken) {
    const err = new Error("SĐT hoặc mật khẩu Locket không đúng.");
    err.statusCode = 401;
    throw err;
  }

  const identity = await identityPost("verifyCustomToken", {
    token: customToken,
    returnSecureToken: true
  });
  if (!identity.ok || !identity.json?.idToken) {
    const err = new Error(mapFirebaseError(identity.json?.error?.message));
    err.statusCode = 401;
    throw err;
  }

  const payload = decodeJwtPayload(identity.json.idToken) || {};
  return {
    idToken: identity.json.idToken,
    refreshToken: identity.json.refreshToken,
    expiresIn: identity.json.expiresIn,
    uid: identity.json.localId || payload.user_id || payload.sub
  };
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(`${SECURE_TOKEN_URL}?key=${FIREBASE_KEY}`, {
    method: "POST",
    headers: firebaseAuthHeaders(),
    body: JSON.stringify({ grantType: "refresh_token", refreshToken }),
    signal: AbortSignal.timeout(8000)
  });
  const parsed = await parseJsonSafe(res);
  if (!parsed.ok || !parsed.json?.id_token) {
    const err = new Error(mapFirebaseError(parsed.json?.error?.message || parsed.json?.error));
    err.statusCode = 401;
    throw err;
  }
  return {
    idToken: parsed.json.id_token,
    refreshToken: parsed.json.refresh_token,
    expiresIn: parsed.json.expires_in,
    uid: parsed.json.user_id
  };
}

async function getAccountInfo(idToken) {
  const result = await identityPost("getAccountInfo", { idToken });
  if (!result.ok || !result.json?.users?.[0]) {
    const err = new Error(mapFirebaseError(result.json?.error?.message));
    err.statusCode = 401;
    throw err;
  }
  return result.json.users[0];
}

async function fetchLocketUser(token, uid, appCheck) {
  const result = await locketPost("fetchUserV2", token, { data: { user_uid: uid } }, appCheck);
  return result.json?.result?.data || null;
}

function mapUserProfile(user, fallbackUid) {
  if (!user) return null;
  const first = user.first_name || "";
  const last = user.last_name || "";
  return {
    uid: user.uid || fallbackUid || null,
    username: user.username || null,
    ho: last || null,
    ten: first || null,
    ho_ten: `${first} ${last}`.trim() || null,
    badge: user.badge || null,
    gold: parseGold(null, user.badge) ? "CÓ" : "KHÔNG",
    anh_dai_dien: user.profile_picture_url || null,
    tai_khoan_tam: Boolean(user.temp)
  };
}

async function authenticate(searchParams, body, req) {
  const headerAuth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  let token = pick(searchParams, body, "token", "id_token", "idToken") || headerAuth || req.headers["x-locket-token"] || "";
  const refresh = pick(searchParams, body, "refresh", "refresh_token", "refreshToken");
  const email = pick(searchParams, body, "email");
  const phone = pick(searchParams, body, "phone", "sdt");
  const password = pick(searchParams, body, "password", "pass", "matkhau");
  const appCheck = pick(searchParams, body, "appcheck", "app_check") || req.headers["x-firebase-appcheck"] || "";

  let session = null;

  if (email && password) session = await signInWithEmail(email, password);
  else if (phone && password) session = await signInWithPhone(phone, password);
  else if (refresh && !token) session = await refreshIdToken(refresh);
  else if (token) {
    const payload = decodeJwtPayload(token) || {};
    session = {
      idToken: token,
      refreshToken: refresh || null,
      uid: payload.user_id || payload.sub || null,
      expiresIn: payload.exp ? String(payload.exp - Math.floor(Date.now() / 1000)) : null
    };
  }

  if (!session) return null;

  if (refresh && token) {
    const payload = decodeJwtPayload(token);
    if (payload?.exp && payload.exp * 1000 < Date.now() + 30000) {
      session = await refreshIdToken(refresh);
    }
  }

  return { ...session, appCheck };
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Locket Widget — Tra cứu Username & Quản lý tài khoản",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Check username công khai không cần đăng nhập. Các thao tác tài khoản dùng token hoặc email/SĐT + mật khẩu của chính bạn (giống cookie Zalo). Gửi/hủy kết bạn chỉ 1 người mỗi lần — không hỗ trợ spam.",
    luu_y: [
      "Token (idToken) hết hạn khoảng 1 giờ. Lần sau dùng ?token=... hoặc ?refresh_token=... không cần gửi lại mật khẩu.",
      "Nên gửi mật khẩu bằng POST JSON để không lộ trên URL.",
      "Gửi / hủy lời mời: đúng 1 username hoặc UID mỗi request.",
      "Tạo tài khoản: đúng 1 lượt / 5 phút. Tự nhập email, mật khẩu, username — không farm, không email ngẫu nhiên."
    ],
    cong_khai: {
      check_username: {
        cu_phap: `${baseUrl}/api/tools/locket?={username}`,
        vi_du: `${baseUrl}/api/tools/locket?=minh`
      }
    },
    can_dang_nhap: {
      thong_tin_tai_khoan: {
        cu_phap: [
          `${baseUrl}/api/tools/locket?action=me&email={email}&password={mat_khau}`,
          `${baseUrl}/api/tools/locket?action=me&phone={sdt}&password={mat_khau}`,
          `${baseUrl}/api/tools/locket?action=me&token={id_token}`
        ],
        vi_du: `${baseUrl}/api/tools/locket?action=me&token={id_token}`
      },
      danh_sach_ban_be: {
        cu_phap: `${baseUrl}/api/tools/locket?action=friends&token={id_token}`,
        vi_du: `${baseUrl}/api/tools/locket?action=friends&token={id_token}&encrypt=true`,
        mac_dinh: "Kết quả friends/moments mặc định mã hóa AES-256. Thêm &encrypt=false để xem JSON thô. Giải mã: action=decrypt."
      },
      moment_moi_nhat: {
        cu_phap: `${baseUrl}/api/tools/locket?action=moments&token={id_token}`,
        vi_du: `${baseUrl}/api/tools/locket?action=moments&token={id_token}&limit=8`
      },
      giai_ma: {
        cu_phap: `${baseUrl}/api/tools/locket?action=decrypt&iv={iv}&data={encrypted_data}`,
        vi_du: `${baseUrl}/api/tools/locket?action=decrypt&iv={iv}&data={encrypted_data}`
      },
      gui_loi_moi: {
        cu_phap: `${baseUrl}/api/tools/locket?action=add&token={id_token}&username={username}`,
        vi_du: `${baseUrl}/api/tools/locket?action=add&token={id_token}&username=minh`
      },
      huy_loi_moi: {
        cu_phap: `${baseUrl}/api/tools/locket?action=cancel&token={id_token}&uid={uid}&direction=outgoing`,
        vi_du: `${baseUrl}/api/tools/locket?action=cancel&token={id_token}&username=minh&direction=outgoing`
      },
      tao_tai_khoan: {
        gioi_han: "1 lượt tạo / 5 phút (theo IP). Không tạo liên tục, không spam.",
        cu_phap: `${baseUrl}/api/tools/locket?action=register&email={email}&password={mat_khau}&username={username}&ten={ten}`,
        vi_du_post: {
          action: "register",
          email: "ban@gmail.com",
          password: "matkhau",
          username: "tenban",
          ten: "Minh"
        },
        appcheck: "Locket thường yêu cầu &appcheck={token} lấy từ app chính thức. API không farm / không tự sinh AppCheck."
      }
    }
  };
}

function publicCheckResponse(data) {
  if (!data.ton_tai) {
    return {
      trang_thai: "thanh_cong",
      chuyen_muc: "Locket Username Lookup",
      du_lieu: {
        username: data.username,
        co_ton_tai: false,
        tinh_trang: "CÒN TRỐNG — Username chưa được đăng ký trên Locket.",
        link_profile: data.link_profile,
        may_chu_kiem_tra: "Locket.cam Public Profile Gateway",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }
    };
  }

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Username Lookup",
    du_lieu: {
      username: data.username,
      uid: data.uid,
      ma_moi: data.ma_moi,
      co_ton_tai: true,
      tinh_trang: "ĐÃ ĐĂNG KÝ — Username đang được sử dụng.",
      chu_cai_viet_tat: data.chu_cai_viet_tat,
      anh_dai_dien: data.anh_dai_dien,
      tai_khoan_noi_tieng: data.tai_khoan_noi_tieng ? "CÓ" : "KHÔNG",
      link_profile: data.link_profile,
      link_moi_ban_be: data.link_moi_ban_be,
      may_chu_kiem_tra: "Locket.cam Public Profile Gateway",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    }
  };
}

async function handleMe(session) {
  const uidFromToken = session.uid || (decodeJwtPayload(session.idToken) || {}).user_id || (decodeJwtPayload(session.idToken) || {}).sub;
  const [account, profile] = await Promise.all([
    getAccountInfo(session.idToken),
    uidFromToken ? fetchLocketUser(session.idToken, uidFromToken, session.appCheck) : Promise.resolve(null)
  ]);
  const uid = account.localId || uidFromToken;
  const mapped = mapUserProfile(profile, uid);

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Account Session",
    phuong_thuc_xac_thuc: "Token / Email / SĐT (tài khoản của chính user)",
    thong_tin_tai_khoan: {
      uid,
      email: account.email || null,
      so_dien_thoai: account.phoneNumber || null,
      ten_hien_thi: mapped?.ho_ten || account.displayName || null,
      username: mapped?.username || null,
      gold: parseGold(account.customAttributes, mapped?.badge) ? "CÓ" : "KHÔNG",
      badge: mapped?.badge || null,
      anh_dai_dien: mapped?.anh_dai_dien || account.photoUrl || null,
      email_da_xac_minh: Boolean(account.emailVerified),
      lan_dang_nhap_gan_nhat: formatViDate(account.lastLoginAt ? Number(account.lastLoginAt) : null),
      ngay_tao: formatViDate(account.createdAt ? Number(account.createdAt) : null)
    },
    phien_dang_nhap: {
      id_token: session.idToken,
      refresh_token: session.refreshToken || null,
      het_han_sau_giay: session.expiresIn || "3600",
      huong_dan: "Lần sau dùng ?action=me&token={id_token} giống cookie Zalo, không cần gửi lại mật khẩu."
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function handleFriends(session, searchParams, body) {
  const uid = session.uid || (decodeJwtPayload(session.idToken) || {}).user_id;
  if (!uid) {
    const me = await getAccountInfo(session.idToken);
    session.uid = me.localId;
  }
  const ownerUid = session.uid || uid;
  const wantDetail = pick(searchParams, body, "detail") !== "false";
  const limit = Math.min(Number(pick(searchParams, body, "limit")) || 80, 80);

  const res = await fetch(`${FIRESTORE_URL}/users/${ownerUid}/friends?pageSize=${limit}`, {
    headers: { Authorization: `Bearer ${session.idToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000)
  });
  const parsed = await parseJsonSafe(res);
  if (!parsed.ok) {
    const err = new Error("Không lấy được danh sách bạn bè. Token có thể hết hạn.");
    err.statusCode = parsed.status === 401 ? 401 : 502;
    throw err;
  }

  const docs = parsed.json?.documents || [];
  const friends = docs.map((doc) => {
    const friendUid = doc.fields?.user?.stringValue || String(doc.name || "").split("/").pop();
    return {
      uid: friendUid,
      chia_se_lich_su: Boolean(doc.fields?.shared_history_on),
      ngay_ket_ban: formatViDate(doc.createTime)
    };
  }).filter((item) => item.uid);

  let chi_tiet = [];
  if (wantDetail && friends.length) {
    const slice = friends.slice(0, 6);
    chi_tiet = (await Promise.all(slice.map(async (friend) => {
      const user = await fetchLocketUser(session.idToken, friend.uid, session.appCheck);
      return { ...friend, ...(mapUserProfile(user, friend.uid) || {}) };
    }))).filter(Boolean);
  }

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Friends",
    tong_so: friends.length,
    danh_sach_uid: friends.map((item) => item.uid),
    chi_tiet_toi_da_6_ban: chi_tiet,
    ghi_chu: wantDetail ? "Chi tiết hồ sơ chỉ lấy tối đa 6 bạn để tránh timeout serverless." : "Thêm &detail=true để lấy tên/avatar tối đa 6 bạn.",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

function mapMoment(item) {
  const seconds = item?.date?._seconds || item?.date?.seconds;
  return {
    moment_uid: item.canonical_uid || item.id || null,
    uid_ban_be: item.user || null,
    thoi_gian: formatViDate(seconds ? Number(seconds) : item.date),
    chu_thich: item.caption || null,
    anh: item.image_url || null,
    anh_thumbnail: item.thumbnail_url || null,
    video: item.video_url || null,
    md5: item.md5 || null
  };
}

async function handleMoments(session, searchParams, body) {
  const limit = Math.min(Math.max(Number(pick(searchParams, body, "limit")) || 10, 1), 20);
  const result = await locketPost("getLatestMomentV2", session.idToken, {
    data: {
      excluded_users: [],
      users: [],
      should_count_missed_moments: true
    }
  }, session.appCheck);

  const inner = result.json?.result || {};
  if (inner.status && inner.status !== 200 && inner.status !== 304) {
    const err = new Error((inner.errors && inner.errors[0]) || "Không lấy được moment. Token có thể hết hạn.");
    err.statusCode = inner.status === 401 ? 401 : 502;
    throw err;
  }

  const list = Array.isArray(inner.data) ? inner.data.slice(0, limit).map(mapMoment) : [];
  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Latest Moments",
    tong_so_tra_ve: list.length,
    moment_bo_lo: inner.missed_moments_count || 0,
    danh_sach: list,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function handleAdd(session, searchParams, body, firstParam) {
  const raw = assertSingleTarget(
    pick(searchParams, body, "username", "user", "uid", "target", "id") || firstParam
  );
  if (!raw) {
    const err = new Error("Cần 1 username hoặc UID đích: &username={user} hoặc &uid={uid}.");
    err.statusCode = 400;
    throw err;
  }

  const targetUid = await resolveTargetUid(raw, session.idToken, session.appCheck);
  if (!targetUid) {
    const err = new Error(`Không tìm thấy người dùng Locket: ${raw}`);
    err.statusCode = 404;
    throw err;
  }

  const result = await locketPost("sendFriendRequest", session.idToken, {
    data: {
      user_uid: targetUid,
      source: "username",
      platform: "iOS",
      share_history_eligible: true
    }
  }, session.appCheck);

  const inner = result.json?.result || result.json || {};
  const ok = result.ok && (!inner.status || inner.status === 200);
  if (!ok) {
    const message = (inner.errors && inner.errors[0]) || inner.error || result.text || "Gửi lời mời thất bại.";
    const needAppCheck = /appcheck|app-check|app_check/i.test(String(message));
    const err = new Error(needAppCheck
      ? "Locket yêu cầu X-Firebase-AppCheck cho thao tác này. Thêm &appcheck={token} lấy từ app."
      : String(message));
    err.statusCode = 400;
    throw err;
  }

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Friend Request",
    thong_bao: "Đã gửi 1 lời mời kết bạn.",
    dich: { dau_vao: raw, uid: targetUid },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function handleCancel(session, searchParams, body, firstParam) {
  const raw = assertSingleTarget(
    pick(searchParams, body, "username", "user", "uid", "target", "id") || firstParam
  );
  if (!raw) {
    const err = new Error("Cần 1 username hoặc UID để hủy lời mời.");
    err.statusCode = 400;
    throw err;
  }

  const directionRaw = (pick(searchParams, body, "direction", "huong") || "outgoing").toLowerCase();
  const direction = directionRaw === "incoming" || directionRaw === "nhan" ? "incoming" : "outgoing";
  const targetUid = await resolveTargetUid(raw, session.idToken, session.appCheck);
  if (!targetUid) {
    const err = new Error(`Không tìm thấy người dùng Locket: ${raw}`);
    err.statusCode = 404;
    throw err;
  }

  const result = await locketPost("deleteFriendRequest", session.idToken, {
    data: { direction, user_uid: targetUid }
  }, session.appCheck);

  const inner = result.json?.result || result.json || {};
  const ok = result.ok && (!inner.status || inner.status === 200);
  if (!ok) {
    const message = (inner.errors && inner.errors[0]) || inner.error || result.text || "Hủy lời mời thất bại.";
    const err = new Error(String(message));
    err.statusCode = 400;
    throw err;
  }

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Cancel Friend Request",
    thong_bao: direction === "incoming" ? "Đã từ chối 1 lời mời đến." : "Đã hủy 1 lời mời đã gửi.",
    dich: { dau_vao: raw, uid: targetUid, huong: direction },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function finalizeLocketUser(session, username, firstName, lastName) {
  const result = await locketPost("finalizeTemporaryUser", session.idToken, {
    data: {
      username,
      last_name: lastName || "",
      require_username: true,
      first_name: firstName
    }
  }, session.appCheck);

  const inner = result.json?.result || result.json || {};
  const ok = result.ok && (!inner.status || inner.status === 200);
  if (!ok) {
    const message = locketInnerError(result) || "Không hoàn tất hồ sơ Locket.";
    const err = new Error(needsAppCheck(message)
      ? "Locket yêu cầu X-Firebase-AppCheck khi hoàn tất hồ sơ. Thêm &appcheck={token} lấy từ app."
      : String(message));
    err.statusCode = 400;
    throw err;
  }
  return true;
}

async function handleRegister(searchParams, body, req) {
  const email = pick(searchParams, body, "email");
  const password = pick(searchParams, body, "password", "pass", "matkhau");
  const usernameRaw = pick(searchParams, body, "username", "user");
  const firstName = pick(searchParams, body, "ten", "first_name", "firstname", "name") || usernameRaw;
  const lastName = pick(searchParams, body, "ho", "last_name", "lastname");
  const token = pick(searchParams, body, "token", "id_token", "idToken")
    || String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const appCheck = pick(searchParams, body, "appcheck", "app_check") || req.headers["x-firebase-appcheck"] || "";
  const username = normalizeUsername(usernameRaw);

  if (pick(searchParams, body, "random", "fake", "tempmail").toLowerCase() === "true"
    || pick(searchParams, body, "random", "fake", "tempmail") === "1") {
    const err = new Error("Không hỗ trợ email/username ngẫu nhiên. Tự nhập email và username của bạn.");
    err.statusCode = 400;
    throw err;
  }

  if (email && (/[,;|\n]/.test(email) || email.split(/\s+/).filter(Boolean).length > 1)) {
    const err = new Error("Chỉ được tạo đúng 1 tài khoản mỗi lần. Không gửi danh sách email.");
    err.statusCode = 400;
    throw err;
  }

  if (!username) {
    const err = new Error("Cần username. Ví dụ: action=register&email={email}&password={mat_khau}&username={username}&ten={ten}");
    err.statusCode = 400;
    throw err;
  }
  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    const err = new Error("Username Locket không hợp lệ. Chỉ dùng chữ thường, số, dấu chấm hoặc gạch dưới (tối đa 30 ký tự).");
    err.statusCode = 400;
    throw err;
  }

  const taken = await lookupLocketUsername(username);
  if (taken.ton_tai) {
    const err = new Error(`Username '${username}' đã được dùng trên Locket. Chọn username khác.`);
    err.statusCode = 409;
    throw err;
  }

  if (token && !email) {
    const payload = decodeJwtPayload(token) || {};
    const session = {
      idToken: token,
      uid: payload.user_id || payload.sub || null,
      appCheck
    };
    await finalizeLocketUser(session, username, firstName || username, lastName);
    return {
      trang_thai: "thanh_cong",
      chuyen_muc: "Locket Hoàn tất hồ sơ",
      thong_bao: "Đã gắn username cho tài khoản tạm (không tính lượt tạo mới).",
      username,
      ten: firstName || username,
      ho: lastName || null,
      gioi_han: "Tạo tài khoản mới: 1 lượt / 5 phút.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  if (!email || !password) {
    const err = new Error("Cần email và mật khẩu của chính bạn. Không tự sinh email.");
    err.statusCode = 400;
    throw err;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Email không hợp lệ.");
    err.statusCode = 400;
    throw err;
  }
  if (password.length < 6) {
    const err = new Error("Mật khẩu tối thiểu 6 ký tự.");
    err.statusCode = 400;
    throw err;
  }
  if (!firstName) {
    const err = new Error("Cần tên hiển thị: &ten={ten}.");
    err.statusCode = 400;
    throw err;
  }

  const ip = clientIp(req);
  const remain = remainingRegisterCooldown(ip);
  if (remain > 0) {
    const err = new Error(`Giới hạn 1 lượt tạo / 5 phút. Thử lại sau ${formatCooldown(remain)}.`);
    err.statusCode = 429;
    err.payload = {
      trang_thai: "that_bai",
      ma_loi: 429,
      thong_bao: err.message,
      thu_lai_sau_giay: Math.ceil(remain / 1000),
      gioi_han: "1 tài khoản / 5 phút — không tạo liên tục."
    };
    throw err;
  }

  const created = await locketPost("createAccountWithEmailPassword", "", {
    data: {
      email,
      password,
      client_email_verif: true,
      client_token: randomClientToken(),
      platform: "ios"
    }
  }, appCheck);

  const inner = created.json?.result || created.json || {};
  const createdOk = created.ok && (!inner.status || inner.status === 200);
  if (!createdOk) {
    const message = locketInnerError(created);
    const err = new Error(needsAppCheck(message)
      ? "Locket yêu cầu X-Firebase-AppCheck khi tạo tài khoản. Lấy token AppCheck từ app Locket chính thức rồi gửi &appcheck=... API không farm / không tự sinh AppCheck."
      : mapFirebaseError(message));
    err.statusCode = /already|exists|đã được dùng/i.test(String(message)) ? 409 : 400;
    throw err;
  }

  markRegisterCooldown(ip);

  let session;
  try {
    session = await signInWithEmail(email, password);
  } catch (error) {
    return {
      trang_thai: "thanh_cong_mot_phan",
      chuyen_muc: "Locket Register",
      thong_bao: "Đã tạo tài khoản Firebase/Locket nhưng chưa đăng nhập được để gắn username.",
      email,
      username,
      loi_dang_nhap: error.message,
      gioi_han: "Đã tính 1 lượt / 5 phút. Không gọi tạo lại email này.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }
  session.appCheck = appCheck;

  try {
    await finalizeLocketUser(session, username, firstName, lastName);
  } catch (error) {
    return {
      trang_thai: "thanh_cong_mot_phan",
      chuyen_muc: "Locket Register",
      thong_bao: "Đã tạo tài khoản nhưng chưa gắn được username. Có thể gọi lại action=register&token={id_token}&username={username} (không tính lượt tạo mới).",
      email,
      username,
      loi_ho_so: error.message,
      phien_dang_nhap: {
        uid: session.uid,
        id_token: session.idToken,
        refresh_token: session.refreshToken || null,
        het_han_sau_giay: session.expiresIn || "3600"
      },
      gioi_han: "Đã tính 1 lượt / 5 phút.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Locket Register",
    thong_bao: "Đã tạo 1 tài khoản Locket.",
    email,
    username,
    ten: firstName,
    ho: lastName || null,
    uid: session.uid,
    phien_dang_nhap: {
      id_token: session.idToken,
      refresh_token: session.refreshToken || null,
      het_han_sau_giay: session.expiresIn || "3600",
      huong_dan: "Lần sau dùng ?action=me&token={id_token}, không cần gửi lại mật khẩu."
    },
    gioi_han: "1 lượt tạo / 5 phút. Lượt tiếp theo sau 5 phút.",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Locket-Token, X-Firebase-AppCheck");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const searchParams = requestUrl.searchParams;
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const firstParam = extractFirstParam(searchParams);

  const bulkKey = hasBulkAttempt(searchParams, body);
  if (bulkKey) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: `Không hỗ trợ tham số '${bulkKey}'. API chỉ cho 1 tài khoản / 1 lời mời mỗi lần, không spam.`
    });
  }

  const actionRaw = (pick(searchParams, body, "action", "type") || (ACTION_MAP[String(firstParam || "").toLowerCase()] ? firstParam : "")).toLowerCase();
  const action = ACTION_MAP[actionRaw] || "";

  try {
    if (!action && !pick(searchParams, body, "username", "user", "email", "phone", "sdt", "token", "id_token", "refresh", "refresh_token") && !firstParam && !req.headers.authorization) {
      return res.status(200).json(buildGuide(baseUrl));
    }

    if (!action || action === "check") {
      const username = normalizeUsername(pick(searchParams, body, "username", "user", "q") || (!ACTION_MAP[String(firstParam || "").toLowerCase()] ? firstParam : ""));
      if (username) {
        if (!/^[a-z0-9._]{1,30}$/.test(username)) {
          return res.status(400).json({
            trang_thai: "that_bai",
            thong_bao: "Username Locket không hợp lệ. Chỉ dùng chữ thường, số, dấu chấm hoặc gạch dưới (tối đa 30 ký tự).",
            username
          });
        }
        return res.status(200).json(publicCheckResponse(await lookupLocketUsername(username)));
      }
      if (!action) {
        // token/email without action → account info
      } else {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Thiếu username. Ví dụ: /api/tools/locket?=minh"
        });
      }
    }

    if (action === "decrypt") {
      return res.status(200).json(handleDecrypt(searchParams, body));
    }

    if (action === "register") {
      return res.status(200).json(wrapEncrypted(await handleRegister(searchParams, body, req), searchParams, body, false));
    }

    const session = await authenticate(searchParams, body, req);
    if (!session) {
      return res.status(401).json({
        trang_thai: "that_bai",
        thong_bao: "Cần token, hoặc email/SĐT kèm mật khẩu của chính tài khoản Locket.",
        cu_phap: [
          `${baseUrl}/api/tools/locket?action=me&token={id_token}`,
          `${baseUrl}/api/tools/locket?action=me&email={email}&password={mat_khau}`
        ]
      });
    }

    const resolvedAction = action || "me";
    if (resolvedAction === "me") {
      return res.status(200).json(wrapEncrypted(await handleMe(session), searchParams, body, false));
    }
    if (resolvedAction === "friends") {
      return res.status(200).json(wrapEncrypted(await handleFriends(session, searchParams, body), searchParams, body, true));
    }
    if (resolvedAction === "moments") {
      return res.status(200).json(wrapEncrypted(await handleMoments(session, searchParams, body), searchParams, body, true));
    }
    if (resolvedAction === "add") {
      return res.status(200).json(wrapEncrypted(await handleAdd(session, searchParams, body, firstParam), searchParams, body, false));
    }
    if (resolvedAction === "cancel") {
      return res.status(200).json(wrapEncrypted(await handleCancel(session, searchParams, body, firstParam), searchParams, body, false));
    }

    return res.status(200).json(buildGuide(baseUrl));
  } catch (error) {
    const status = error.statusCode || 500;
    if (error.payload) return res.status(status).json(error.payload);
    return res.status(status).json({
      trang_thai: "that_bai",
      ma_loi: status,
      thong_bao: error.message || "Lỗi xử lý Locket."
    });
  }
};
