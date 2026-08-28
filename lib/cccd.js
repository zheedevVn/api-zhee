const PROVINCES = {
  "001": "Hà Nội",
  "002": "Hà Giang",
  "004": "Cao Bằng",
  "006": "Bắc Kạn",
  "008": "Tuyên Quang",
  "010": "Lào Cai",
  "011": "Điện Biên",
  "012": "Lai Châu",
  "014": "Sơn La",
  "015": "Yên Bái",
  "017": "Hòa Bình",
  "019": "Thái Nguyên",
  "020": "Lạng Sơn",
  "022": "Quảng Ninh",
  "024": "Bắc Giang",
  "025": "Phú Thọ",
  "026": "Vĩnh Phúc",
  "027": "Bắc Ninh",
  "030": "Hải Dương",
  "031": "Hải Phòng",
  "033": "Hưng Yên",
  "034": "Thái Bình",
  "035": "Hà Nam",
  "036": "Nam Định",
  "037": "Ninh Bình",
  "038": "Thanh Hóa",
  "040": "Nghệ An",
  "042": "Hà Tĩnh",
  "044": "Quảng Bình",
  "045": "Quảng Trị",
  "046": "Thừa Thiên Huế",
  "048": "Đà Nẵng",
  "049": "Quảng Nam",
  "051": "Quảng Ngãi",
  "052": "Bình Định",
  "054": "Phú Yên",
  "056": "Khánh Hòa",
  "058": "Ninh Thuận",
  "060": "Bình Thuận",
  "062": "Kon Tum",
  "064": "Gia Lai",
  "066": "Đắk Lắk",
  "067": "Đắk Nông",
  "068": "Lâm Đồng",
  "070": "Bình Phước",
  "072": "Tây Ninh",
  "074": "Bình Dương",
  "075": "Đồng Nai",
  "077": "Bà Rịa - Vũng Tàu",
  "079": "Hồ Chí Minh",
  "080": "Long An",
  "082": "Tiền Giang",
  "083": "Bến Tre",
  "084": "Trà Vinh",
  "086": "Vĩnh Long",
  "087": "Đồng Tháp",
  "089": "An Giang",
  "091": "Kiên Giang",
  "092": "Cần Thơ",
  "093": "Hậu Giang",
  "094": "Sóc Trăng",
  "095": "Bạc Liêu",
  "096": "Cà Mau"
};

const GENDER_CENTURY = {
  0: { gioi_tinh: "Nam", the_ky: 20, nam_tu: 1900, nam_den: 1999 },
  1: { gioi_tinh: "Nữ", the_ky: 20, nam_tu: 1900, nam_den: 1999 },
  2: { gioi_tinh: "Nam", the_ky: 21, nam_tu: 2000, nam_den: 2099 },
  3: { gioi_tinh: "Nữ", the_ky: 21, nam_tu: 2000, nam_den: 2099 },
  4: { gioi_tinh: "Nam", the_ky: 22, nam_tu: 2100, nam_den: 2199 },
  5: { gioi_tinh: "Nữ", the_ky: 22, nam_tu: 2100, nam_den: 2199 },
  6: { gioi_tinh: "Nam", the_ky: 23, nam_tu: 2200, nam_den: 2299 },
  7: { gioi_tinh: "Nữ", the_ky: 23, nam_tu: 2200, nam_den: 2299 }
};

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

function normalizeId(raw) {
  return String(raw || "").replace(/[\s.\-_/]/g, "");
}

function parseCccd(raw) {
  const id = normalizeId(raw);
  if (!/^\d+$/.test(id)) {
    return { hop_le: false, ly_do: "Chỉ nhận chữ số. Bỏ khoảng trắng, dấu chấm, gạch." };
  }
  if (id.length === 9) {
    return {
      hop_le: false,
      loai: "CMND 9 số (cũ)",
      ly_do: "Đây là CMND 9 số, không phải CCCD 12 số. Tool chỉ giải mã CCCD/định danh 12 số theo NĐ 137/2015."
    };
  }
  if (id.length !== 12) {
    return { hop_le: false, ly_do: "CCCD phải đúng 12 chữ số." };
  }

  const maTinh = id.slice(0, 3);
  const maGt = Number(id[3]);
  const yy = id.slice(4, 6);
  const serial = id.slice(6);
  const tinh = PROVINCES[maTinh];
  const gt = GENDER_CENTURY[maGt];
  const loi = [];

  if (!tinh) loi.push(`Mã tỉnh ${maTinh} không có trong Phụ lục 1 Thông tư 07/2016/TT-BCA.`);
  if (!gt) loi.push(`Mã giới tính/thế kỷ '${id[3]}' không hợp lệ (phải 0–7).`);

  let namSinh = null;
  let tuoi = null;
  if (gt) {
    namSinh = gt.nam_tu + Number(yy);
    const now = new Date();
    tuoi = now.getFullYear() - namSinh;
    if (tuoi < 0 || tuoi > 130) loi.push("Năm sinh suy ra không hợp lý.");
  }

  const hopLe = loi.length === 0;
  const out = {
    hop_le: hopLe,
    hop_le_chu: hopLe ? "CÓ" : "KHÔNG",
    loai: "CCCD / Số định danh cá nhân 12 số",
    so_cccd: id,
    noi_dang_ky_khai_sinh: tinh || null,
    ma_tinh: maTinh,
    gioi_tinh: gt ? gt.gioi_tinh : null,
    the_ky_sinh: gt ? `Thế kỷ ${gt.the_ky} (${gt.nam_tu}–${gt.nam_den})` : null,
    nam_sinh: namSinh,
    tuoi_du_kien: tuoi,
    so_thu_tu: serial,
    cau_truc: {
      "3_so_dau": `${maTinh} — mã tỉnh/thành nơi đăng ký khai sinh`,
      "so_thu_4": `${id[3]} — mã giới tính theo thế kỷ sinh`,
      "so_5_6": `${yy} — năm sinh (2 số cuối)`,
      "6_so_cuoi": `${serial} — khoảng số ngẫu nhiên (không tra được ý nghĩa khác)`
    },
    nguon_quy_tac: "Nghị định 137/2015/NĐ-CP Điều 13; Thông tư 07/2016/TT-BCA Phụ lục 1",
    ghi_chu: "Không tra cứu CSDLQG / VNeID. Không trả họ tên, địa chỉ, ảnh. Các trường trên được giải mã từ chính dãy 12 số, không lấy từ danh sách người có sẵn."
  };
  if (!hopLe) out.ly_do = loi;
  if (!tinh) delete out.noi_dang_ky_khai_sinh;
  return out;
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Check CCCD 12 số (/tools/cccd)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Giải mã số CCCD theo quy tắc pháp lý: tỉnh khai sinh, giới tính, năm sinh. Không lộ họ tên. Không kết nối hệ thống định danh quốc gia.",
    cu_phap: [
      `${baseUrl}/api/tools/cccd?={12_so}`,
      `${baseUrl}/api/tools/cccd?so={12_so}`
    ],
    vi_du: [
      `${baseUrl}/api/tools/cccd?=001201000001`
    ]
  };
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
  const raw = pick(params, body, "so", "cccd", "id", "q") || extractFirstParam(params);
  if (!raw) return res.status(200).json(buildGuide(baseUrl));

  const parsed = parseCccd(raw);
  return res.status(parsed.hop_le ? 200 : 400).json({
    trang_thai: parsed.hop_le ? "thanh_cong" : "that_bai",
    chuyen_muc: "Check CCCD",
    ...parsed,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
};
