require("./zheeProtect.js").verifyOrThrow();
const CHECKSCAM_API = "https://cs.mmovn.space/v1/check";
const CHECKSCAM_KEY = (process.env.CHECKSCAM_API_KEY || process.env.GDV_API_KEY || "cs_c0q1vnhzrg0lm43cpy8bdmakok7umoss").trim();

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function extractFirstParam(params) {
  return String(params[""] || "").trim();
}

function formatVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString("vi-VN")} ₫`;
}

function mapStatus(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "danger" || raw === "black" || raw === "scam") {
    return { muc_do: "NGUY HIỂM", da_bi_bao_cao: "CÓ" };
  }
  if (raw === "warning" || raw === "warn") {
    return { muc_do: "CẢNH BÁO", da_bi_bao_cao: "CÓ" };
  }
  if (raw === "safe" || raw === "ok" || raw === "clean") {
    return { muc_do: "CHƯA CÓ BÁO CÁO", da_bi_bao_cao: "KHÔNG" };
  }
  return { muc_do: "KHÔNG RÕ", da_bi_bao_cao: "KHÔNG RÕ" };
}

function mapType(type) {
  const raw = String(type || "").toLowerCase();
  if (raw === "account" || raw === "stk") return "Số tài khoản";
  if (raw === "phone" || raw === "sdt") return "Số điện thoại";
  if (raw === "name" || raw === "person") return "Họ tên";
  if (raw === "bank") return "Ngân hàng";
  return type || null;
}

function cleanData(data) {
  if (!data || typeof data !== "object") return null;
  const mapped = {
    ho_ten: data.name || data.ho_ten || null,
    so_tai_khoan: data.stk || data.account || data.so_tai_khoan || null,
    ngan_hang: data.bank || data.ngan_hang || null,
    loai_thong_tin: mapType(data.type),
    so_bao_cao: Number.isFinite(Number(data.reports)) ? Number(data.reports) : null,
    thiet_hai: formatVnd(data.total_damage || data.thiet_hai),
    thiet_hai_so: Number.isFinite(Number(data.total_damage)) ? Number(data.total_damage) : null,
    link_chi_tiet: data.latest_url || data.url || null
  };
  const out = {};
  for (const [key, value] of Object.entries(mapped)) {
    if (value != null && value !== "") out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Checkscam — Tra cứu thông tin bị báo cáo (/tools/checkscam)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Check STK, SĐT, họ tên đã bị tố cáo/báo cáo lừa đảo (cs.mmovn.space). Không phải check giao dịch viên.",
    cu_phap: [
      `${baseUrl}/api/tools/checkscam?={stk_sdt_hoac_ten}`,
      `${baseUrl}/api/tools/checkscam?q={tu_khoa}`,
      `${baseUrl}/api/tools/checkscam?stk={so_tai_khoan}`,
      `${baseUrl}/api/tools/checkscam?sdt={so_dien_thoai}`
    ],
    vi_du: [
      `${baseUrl}/api/tools/checkscam?=1903456789`
    ]
  };
}

async function lookup(query) {
  const url = `${CHECKSCAM_API}/${encodeURIComponent(query)}?key=${encodeURIComponent(CHECKSCAM_KEY)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-Key": CHECKSCAM_KEY,
      "User-Agent": "ZheeAPI/1.0"
    },
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  if (!res.ok || !json) {
    const err = new Error(json?.message || `Checkscam không trả JSON hợp lệ (HTTP ${res.status}).`);
    err.statusCode = res.status === 401 || res.status === 403 ? 403 : 502;
    throw err;
  }
  return json;
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const query = pick(params, body, "q", "query", "stk", "sdt", "phone", "ten", "name", "bank") || extractFirstParam(params);

  if (!query) return res.status(200).json(buildGuide(baseUrl));

  try {
    const raw = await lookup(query);
    const muc = mapStatus(raw.status);
    const thongTin = cleanData(raw.data);
    const out = {
      trang_thai: "thanh_cong",
      chuyen_muc: "Checkscam — Thông tin bị báo cáo",
      tu_khoa: query,
      muc_do: muc.muc_do,
      da_bi_bao_cao: muc.da_bi_bao_cao,
      thong_bao: raw.message || "Không có mô tả.",
      nguon: "cs.mmovn.space",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
    if (thongTin) out.thong_tin = thongTin;
    return res.status(200).json(out);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      trang_thai: "that_bai",
      ma_loi: error.statusCode || 500,
      thong_bao: error.message || "Không tra cứu được thông tin bị báo cáo.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
