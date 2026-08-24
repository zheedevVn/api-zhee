const crypto = require("crypto");

const KEY_STORE = new Map();
const PUBLIC_CREATION_SECRET = "Zhee_secret@2026";
const MASTER_ADMIN_SECRET = process.env.ADMIN_SECRET || "minhhocgioi"; // Secret xem list key
const ENCRYPTION_KEY = crypto.createHash("sha256").update(MASTER_ADMIN_SECRET).digest();
const IP_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function maskSecretKey(str) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= 6) return str[0] + "..." + str.slice(-1);
  return `${str.slice(0, 1)}...${str.slice(-4)}`; // vd: m...gioi hoặc Z...CCL
}

function generateSignature(payloadString) {
  return crypto.createHmac("sha256", MASTER_ADMIN_SECRET).update(payloadString).digest("hex");
}

function encryptPayload(dataObj) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(dataObj), "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    iv: iv.toString("hex"),
    encrypted_data: encrypted
  };
}

function generateZheeKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const getChunk = (len) => {
    let res = "";
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      res += chars[bytes[i] % chars.length];
    }
    return res;
  };

  return `ZheeTool-${getChunk(5)}-${getChunk(4)}-${getChunk(5)}-${getChunk(4)}-${getChunk(4)}-${getChunk(3)}`;
}

function createKey({ maxUses = 10, expireHours = 24, note = "VIP User" } = {}) {
  const key = generateZheeKey();
  const now = Date.now();
  const expiresAt = now + parseInt(expireHours, 10) * 60 * 60 * 1000;

  const keyData = {
    key,
    so_luot_toi_da: parseInt(maxUses, 10),
    so_luot_da_dung: 0,
    so_luot_con_lai: parseInt(maxUses, 10),
    thoi_gian_tao: new Date(now).toISOString(),
    thoi_gian_het_han: new Date(expiresAt).toISOString(),
    expiresTimestamp: expiresAt,
    ghi_chu: note,
    trang_thai: "hoat_dong",
    active_ips: {}
  };

  KEY_STORE.set(key, keyData);
  return keyData;
}

function verifyAndConsumeKey(key, clientIp = "127.0.0.1", consume = true, encrypt = false) {
  const now = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");

  if (!key || typeof key !== "string") {
    const rawFail = { hop_le: false, ly_do: "Chưa cung cấp mã Key.", timestamp: now, nonce };
    return {
      trang_thai: "that_bai",
      ...rawFail,
      chu_ky_xac_thuc: generateSignature(JSON.stringify(rawFail))
    };
  }

  const keyData = KEY_STORE.get(key.trim());
  if (!keyData) {
    const rawFail = { hop_le: false, ly_do: "Key không tồn tại hoặc đã bị xóa.", timestamp: now, nonce };
    return {
      trang_thai: "that_bai",
      ...rawFail,
      chu_ky_xac_thuc: generateSignature(JSON.stringify(rawFail))
    };
  }

  if (now > keyData.expiresTimestamp) {
    keyData.trang_thai = "het_han";
    const rawFail = { hop_le: false, ly_do: "Key đã hết hạn.", timestamp: now, nonce };
    return {
      trang_thai: "that_bai",
      ...rawFail,
      chu_ky_xac_thuc: generateSignature(JSON.stringify(rawFail))
    };
  }

  if (keyData.so_luot_da_dung >= keyData.so_luot_toi_da) {
    keyData.trang_thai = "het_luot";
    const rawFail = { hop_le: false, ly_do: "Key đã hết số lần sử dụng.", timestamp: now, nonce };
    return {
      trang_thai: "that_bai",
      ...rawFail,
      chu_ky_xac_thuc: generateSignature(JSON.stringify(rawFail))
    };
  }

  if (!keyData.active_ips) keyData.active_ips = {};
  for (const [ip, ts] of Object.entries(keyData.active_ips)) {
    if (now - ts > IP_SESSION_TIMEOUT_MS) delete keyData.active_ips[ip];
  }

  const isExistingSession = keyData.active_ips[clientIp] && (now - keyData.active_ips[clientIp] <= IP_SESSION_TIMEOUT_MS);

  if (consume) {
    if (isExistingSession) {
      keyData.active_ips[clientIp] = now;
    } else {
      keyData.so_luot_da_dung += 1;
      keyData.so_luot_con_lai = keyData.so_luot_toi_da - keyData.so_luot_da_dung;
      keyData.active_ips[clientIp] = now;
      if (keyData.so_luot_con_lai <= 0) keyData.trang_thai = "het_luot";
    }
  }

  const payload = {
    hop_le: true,
    co_che_ip: isExistingSession ? "Phiên IP còn hiệu lực (Không trừ thêm lượt)" : "Ghi nhận 1 lượt mới cho IP",
    ip: clientIp,
    thong_tin: {
      key: keyData.key,
      so_luot_da_dung: keyData.so_luot_da_dung,
      so_luot_con_lai: keyData.so_luot_con_lai,
      tong_luot: keyData.so_luot_toi_da,
      thoi_gian_het_han: keyData.thoi_gian_het_han,
      ghi_chu: keyData.ghi_chu,
      trang_thai: keyData.trang_thai
    },
    timestamp: now,
    nonce
  };

  const signature = generateSignature(JSON.stringify(payload));

  if (encrypt) {
    const encrypted = encryptPayload(payload);
    return {
      trang_thai: "thanh_cong",
      che_do: "Mã hóa chống Dump AES-256",
      ...encrypted,
      chu_ky_xac_thuc: signature
    };
  }

  return {
    trang_thai: "thanh_cong",
    ...payload,
    chu_ky_xac_thuc: signature
  };
}

function deleteKey(key) {
  if (!key) return false;
  return KEY_STORE.delete(key.trim());
}

function listAllKeys(mask = true) {
  const result = [];
  const now = Date.now();
  for (const item of KEY_STORE.values()) {
    let status = item.trang_thai;
    if (now > item.expiresTimestamp) status = "het_han";
    else if (item.so_luot_con_lai <= 0) status = "het_luot";

    result.push({
      key_an_danh: mask ? maskSecretKey(item.key) : item.key,
      so_luot_toi_da: item.so_luot_toi_da,
      so_luot_da_dung: item.so_luot_da_dung,
      so_luot_con_lai: item.so_luot_con_lai,
      thoi_gian_tao: item.thoi_gian_tao,
      thoi_gian_het_han: item.thoi_gian_het_han,
      ghi_chu: item.ghi_chu,
      trang_thai: status,
      so_ip_ket_noi: Object.keys(item.active_ips || {}).length
    });
  }
  return result;
}

module.exports = {
  PUBLIC_CREATION_SECRET,
  MASTER_ADMIN_SECRET,
  maskSecretKey,
  createKey,
  verifyAndConsumeKey,
  deleteKey,
  listAllKeys
};