const { File } = require("megajs");

const MEGA_TIMEOUT_MS = 15000;
const MAX_FOLDER_ITEMS = 100;
const AUTHOR = "Hồ Đức Minh (Zhee Dev)";

function getQueryValue(req, names) {
  for (const name of names) {
    const value = req.query?.[name];
    if (value) return String(value).trim();
  }

  const rawQuery = String(req.url || "").split("?")[1] || "";
  if (rawQuery) {
    const first = rawQuery.split("&")[0];
    const value = first.startsWith("=") ? first.slice(1) : "";
    if (value) return decodeURIComponent(value).trim();
  }

  return "";
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("mega_timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function loadMetadata(file) {
  return withTimeout(new Promise((resolve, reject) => {
    file.loadAttributes((error, loadedFile) => {
      if (error) return reject(error);
      resolve(loadedFile || file);
    });
  }), MEGA_TIMEOUT_MS);
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return null;
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 2)} ${units[unit]}`;
}

function serializeNode(node, index) {
  return {
    stt: index + 1,
    ten: node.name || null,
    loai: node.directory ? "folder" : "file",
    kich_thuoc: node.directory ? null : Number.isFinite(node.size) ? node.size : null,
    kich_thuoc_hien_thi: node.directory ? null : formatBytes(node.size),
    ngay_tao: node.createdAt ? new Date(node.createdAt).toISOString() : null,
    handle: node.nodeId || null
  };
}

function publicAccountLimitation(res) {
  return res.status(400).json({
    trang_thai: "that_bai",
    loai: "mega_user_lookup",
    tac_gia: AUTHOR,
    thong_bao: "MEGA không có API tra cứu user công khai theo username/email. Chỉ có thể đọc metadata của file/folder được chia sẻ công khai; thông tin tài khoản đầy đủ cần phiên đăng nhập của chính chủ.",
    bao_mat: "API này không nhận hoặc lưu mật khẩu, cookie hay session MEGA."
  });
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const action = String(req.query?.action || req.query?.type || "").toLowerCase();
  if (["user", "account", "profile"].includes(action)) {
    return publicAccountLimitation(res);
  }

  const input = getQueryValue(req, ["url", "link", "file", "folder", "q", ""]);
  if (!input) {
    return res.status(400).json({
      trang_thai: "that_bai",
      tac_gia: AUTHOR,
      thong_bao: "Vui lòng nhập link file/folder MEGA công khai.",
      cu_phap: "/api/mxh/mega?url=https://mega.nz/file/{id}#{key}",
      ho_tro: ["file", "folder"],
      gioi_han_user: "MEGA không cho tra cứu full user công khai; không gửi mật khẩu hoặc cookie lên API."
    });
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch (_) {
    return res.status(400).json({ trang_thai: "that_bai", tac_gia: AUTHOR, thong_bao: "Link MEGA không hợp lệ." });
  }

  if (!["mega.nz", "mega.co.nz"].includes(parsed.hostname.toLowerCase())) {
    return res.status(400).json({ trang_thai: "that_bai", tac_gia: AUTHOR, thong_bao: "Chỉ hỗ trợ link mega.nz hoặc mega.co.nz." });
  }

  if (!parsed.hash || !/(^|\/)file\//.test(parsed.pathname) && !/(^|\/)folder\//.test(parsed.pathname) && !parsed.hash.startsWith("#!") && !parsed.hash.startsWith("#F!")) {
    return res.status(400).json({ trang_thai: "that_bai", tac_gia: AUTHOR, thong_bao: "Link phải là public file/folder MEGA và có key sau dấu #." });
  }

  const startedAt = Date.now();
  try {
    const file = File.fromURL(input);
    const metadata = await loadMetadata(file);
    const isFolder = Boolean(metadata.directory);
    const children = isFolder && Array.isArray(metadata.children)
      ? metadata.children.slice(0, MAX_FOLDER_ITEMS).map(serializeNode)
      : [];

    return res.status(200).json({
      trang_thai: "thanh_cong",
      tac_gia: AUTHOR,
      loai: isFolder ? "mega_folder_lookup" : "mega_file_lookup",
      nguon: "MEGA public link",
      thoi_gian_phan_hoi_ms: Date.now() - startedAt,
      tep_tin: {
        ten: metadata.name || null,
        loai: isFolder ? "folder" : "file",
        handle: metadata.nodeId || metadata.downloadId || null,
        kich_thuoc: isFolder ? null : Number.isFinite(metadata.size) ? metadata.size : null,
        kich_thuoc_hien_thi: isFolder ? null : formatBytes(metadata.size),
        ngay_tao: metadata.createdAt ? new Date(metadata.createdAt).toISOString() : null,
        co_khoa_giai_ma: Boolean(metadata.key),
        link_cong_khai: input
      },
      chu_so_huu: null,
      ghi_chu_chu_so_huu: "MEGA không công khai owner của public link; không suy đoán danh tính người dùng.",
      folder: isFolder ? {
        tong_so_muc: metadata.children?.length || 0,
        da_tra_ve: children.length,
        vuot_gioi_han: (metadata.children?.length || 0) > MAX_FOLDER_ITEMS,
        danh_sach: children
      } : null
    });
  } catch (error) {
    const message = error?.message === "mega_timeout"
      ? "MEGA phản hồi quá lâu, vui lòng thử lại."
      : "Không thể đọc public link MEGA. Link có thể đã bị xóa, sai key hoặc bị giới hạn truy cập.";
    return res.status(502).json({
      trang_thai: "that_bai",
      tac_gia: AUTHOR,
      loai: "mega_lookup",
      thong_bao: message,
      chi_tiet: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};
