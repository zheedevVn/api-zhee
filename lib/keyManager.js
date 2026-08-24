const crypto = require("crypto");

const KEY_STORE = new Map();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ZheeAdmin_Secret_2026@Secure";

// Hàm sinh mã định dạng: ZheeTool-xxxxx-xxxx-xxxxx-xxxx-xxxx-xxx
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

// 1. Tạo Key mới
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
    trang_thai: "hoat_dong"
  };

  KEY_STORE.set(key, keyData);
  return keyData;
}

// 2. Kiểm tra và Trừ lượt nhập
function verifyAndConsumeKey(key, consume = true) {
  if (!key || typeof key !== "string") {
    return { hop_le: false, ly_do: "Chưa cung cấp mã Key hợp lệ." };
  }

  const keyData = KEY_STORE.get(key.trim());
  if (!keyData) {
    return { hop_le: false, ly_do: "Key không tồn tại trên hệ thống hoặc đã bị xóa." };
  }

  const now = Date.now();
  if (now > keyData.expiresTimestamp) {
    keyData.trang_thai = "het_han";
    return { hop_le: false, ly_do: "Key đã hết hạn sử dụng theo thời gian.", thong_tin: keyData };
  }

  if (keyData.so_luot_da_dung >= keyData.so_luot_toi_da) {
    keyData.trang_thai = "het_luot";
    return { hop_le: false, ly_do: "Key đã hết số lần sử dụng tối đa.", thong_tin: keyData };
  }

  if (consume) {
    keyData.so_luot_da_dung += 1;
    keyData.so_luot_con_lai = keyData.so_luot_toi_da - keyData.so_luot_da_dung;
    if (keyData.so_luot_con_lai <= 0) {
      keyData.trang_thai = "het_luot";
    }
  }

  return {
    hop_le: true,
    thong_bao: consume ? "Xác thực và trừ lượt dùng thành công." : "Key hợp lệ và sẵn sàng sử dụng.",
    thong_tin: {
      key: keyData.key,
      so_luot_da_dung: keyData.so_luot_da_dung,
      so_luot_con_lai: keyData.so_luot_con_lai,
      tong_luot: keyData.so_luot_toi_da,
      thoi_gian_het_han: keyData.thoi_gian_het_han,
      ghi_chu: keyData.ghi_chu,
      trang_thai: keyData.trang_thai
    }
  };
}

// 3. Xóa Key
function deleteKey(key) {
  if (!key) return false;
  return KEY_STORE.delete(key.trim());
}

// 4. Lấy danh sách Key
function listAllKeys() {
  const result = [];
  const now = Date.now();
  for (const item of KEY_STORE.values()) {
    let status = item.trang_thai;
    if (now > item.expiresTimestamp) status = "het_han";
    else if (item.so_luot_con_lai <= 0) status = "het_luot";
    result.push({ ...item, trang_thai: status });
  }
  return result;
}

module.exports = {
  ADMIN_SECRET,
  createKey,
  verifyAndConsumeKey,
  deleteKey,
  listAllKeys
};