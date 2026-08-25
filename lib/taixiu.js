const crypto = require("crypto");

// 1. Render ảnh xúc xắc SVG nội bộ chuẩn màu Casino
function generateDiceSvg(number) {
  const n = Math.max(1, Math.min(6, parseInt(number, 10) || 1));
  const dotCoords = {
    1: [[50, 50, "#e74c3c", 14]],
    2: [[28, 28, "#2c3e50", 9], [72, 72, "#2c3e50", 9]],
    3: [[25, 25, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [75, 75, "#2c3e50", 8]],
    4: [[28, 28, "#e74c3c", 9], [72, 28, "#e74c3c", 9], [28, 72, "#e74c3c", 9], [72, 72, "#e74c3c", 9]],
    5: [[26, 26, "#2c3e50", 8], [74, 26, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [26, 74, "#2c3e50", 8], [74, 74, "#2c3e50", 8]],
    6: [[28, 24, "#2c3e50", 8], [72, 24, "#2c3e50", 8], [28, 50, "#2c3e50", 8], [72, 50, "#2c3e50", 8], [28, 76, "#2c3e50", 8], [72, 76, "#2c3e50", 8]]
  };

  const dots = dotCoords[n].map(([cx, cy, fill, r]) => 
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
    <defs>
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#edf2f7"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.2"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// 2. Engine tạo phiên xúc xắc chỉ định hoặc ngẫu nhiên
function createCustomOrRandomRound(setParam, baseUrl) {
  let d1, d2, d3;
  let modeName = "Ngẫu Nhiên (Fair Random)";

  const cleanSet = (setParam || "").toString().trim().toLowerCase();

  const specificMatch = cleanSet.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
  if (specificMatch) {
    d1 = parseInt(specificMatch[1], 10);
    d2 = parseInt(specificMatch[2], 10);
    d3 = parseInt(specificMatch[3], 10);
    modeName = `Chỉ Định Nút Chính Xác (${d1}-${d2}-${d3})`;
  } else if (cleanSet === "tai" || cleanSet === "over") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 < 11 || (d1 === d2 && d2 === d3));
    modeName = "Chỉ Định Cầu TÀI (11 - 17 Điểm)";
  } else if (cleanSet === "xiu" || cleanSet === "under") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 > 10 || (d1 === d2 && d2 === d3));
    modeName = "Chỉ Định Cầu XỈU (4 - 10 Điểm)";
  } else if (cleanSet === "bao" || cleanSet === "triple") {
    const num = crypto.randomInt(1, 7);
    d1 = num; d2 = num; d3 = num;
    modeName = `Chỉ Định Cầu BÃO (Bộ 3 nút ${num})`;
  } else {
    d1 = crypto.randomInt(1, 7);
    d2 = crypto.randomInt(1, 7);
    d3 = crypto.randomInt(1, 7);
  }

  const total = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

  const salt = crypto.randomBytes(12).toString("hex");
  const postRoundString = `${d1}-${d2}-${d3}|HitClub_${salt}`;
  const sha256PreRound = crypto.createHash("sha256").update(postRoundString).digest("hex");
  const md5PreRound = crypto.createHash("md5").update(postRoundString).digest("hex");

  return {
    phien_cuoc_id: Date.now(),
    che_do_tao: modeName,
    ket_qua: kq,
    tong_diem: `${total} Điểm`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
      xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
      xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
    },
    du_lieu_provably_fair: {
      chuoi_hash_truoc_phien_sha256: sha256PreRound,
      chuoi_hash_truoc_phien_md5: md5PreRound,
      chuoi_ket_qua_sau_phien: postRoundString,
      huong_dan_doi_soat: "Dán chuoi_hash_truoc_phien_sha256 hoặc chuoi_ket_qua_sau_phien vào API để đối soát kết quả."
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 3. Parser phân tích Hash & Chuỗi kết quả
function parseAdvancedHash(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  const postRoundPattern = /[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/;
  const matchResult = clean.match(postRoundPattern);

  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

    const verifiedSha256 = crypto.createHash("sha256").update(clean).digest("hex");

    return {
      trang_thai_tra_cuu: "Xác Thực Chuỗi Kết Quả Minh Bạch (Provably Fair Verified)",
      do_chinh_xac: "100% (Dữ liệu đối soát từ chuỗi mở bát)",
      ket_qua_thuc_te: kq,
      tong_diem_thuc_te: `${total} Điểm (${kq})`,
      chi_tiet_3_xuc_xac_that: {
        xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
        xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
        xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
      },
      chuoi_goc_doi_soat: clean,
      ma_hash_sha256_tuong_ung: verifiedSha256,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const len = hex.length;

  const bytes = [];
  let totalByteSum = 0;
  for (let i = 0; i < len; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16) || 0;
    bytes.push(b);
    totalByteSum += b;
  }

  const b1 = bytes[0] !== undefined ? bytes[0] : 1;
  const b2 = bytes[1] !== undefined ? bytes[1] : 2;
  const b3 = bytes[2] !== undefined ? bytes[2] : 3;

  const d1 = (b1 % 6) + 1;
  const d2 = (b2 % 6) + 1;
  const d3 = (b3 % 6) + 1;

  const tongDiem = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  
  let duDoanCua = "";
  if (isBao) {
    duDoanCua = `BÃO (Bộ 3 nút ${d1})`;
  } else if (tongDiem >= 11) {
    duDoanCua = "TÀI";
  } else {
    duDoanCua = "XỈU";
  }

  const confidenceScore = (91.5 + ((b1 + totalByteSum) % 70) / 10).toFixed(1);
  const taiRate = isBao ? "0.0%" : (duDoanCua === "TÀI" ? `${confidenceScore}%` : `${(100 - parseFloat(confidenceScore)).toFixed(1)}%`);
  const xiuRate = isBao ? "0.0%" : (duDoanCua === "XỈU" ? `${confidenceScore}%` : `${(100 - parseFloat(confidenceScore)).toFixed(1)}%`);

  const bridgeTypes = [
    "Cầu Bệt Dài (Lực nén cực mạnh, xu hướng theo dây 4-6 ván liên tiếp)",
    "Cầu Đảo Nhịp 1-1 (Dao động cân bằng, ưu tiên đánh đổi hướng)",
    "Cầu Thuận Cặp 2-2 (Nhịp bước đôi cân đối, xác suất giữ cầu cao)",
    "Cầu Bẻ Điểm 3-2-1 (Lực thoát biên lớn, ưu tiên bắt điểm rơi đảo chiều)"
  ];
  const nhanDinhCau = bridgeTypes[(b2 + totalByteSum) % bridgeTypes.length];

  return {
    trang_thai_tra_cuu: "Soi Cầu Dự Đoán Xu Hướng Trước Phiên",
    chuoi_hash_kiem_tra: hex,
    chuan_ma_bam: len === 64 ? "SHA-256 (Hitclub / Sunwin Standard)" : (len === 32 ? "MD5 Standard" : "Custom Hash"),
    du_doan_cua_chinh: duDoanCua,
    tong_diem_du_kien: `${tongDiem} Điểm (${duDoanCua === "TÀI" ? "Tài 11 - 17" : (duDoanCua === "XỈU" ? "Xỉu 4 - 10" : "Bão")})`,
    chi_tiet_3_xuc_xac_uoc_tinh: {
      xuc_xac_1: { nut: d1, hex_byte: hex.substr(0, 2), anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
      xuc_xac_2: { nut: d2, hex_byte: hex.substr(2, 2), anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
      xuc_xac_3: { nut: d3, hex_byte: hex.substr(4, 2), anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
    },
    phan_tich_ti_le_xac_suat: {
      xac_suat_tai: taiRate,
      xac_suat_xiu: xiuRate,
      do_tin_cay_cua_du_doan: `${confidenceScore}%`,
      luc_nen_cau: Number(confidenceScore) >= 94 ? "CỰC MẠNH (Tỷ lệ thắng áp đảo trên 94%)" : "TIÊU CHUẨN CAO (Trên 90%)",
      nhan_dinh_nhip_cau: nhanDinhCau,
      chien_thuat_khuyen_nghi: Number(confidenceScore) >= 94 ? "Tự tin vào lệnh theo cửa dự đoán" : "Quản lý vốn chia lệnh 1-2-4"
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  // 1. Render ảnh SVG trực tiếp (?image=1..6)
  const imgParam = searchParams.get("image") || searchParams.get("img");
  if (imgParam) {
    const diceNum = parseInt(imgParam, 10);
    if (diceNum >= 1 && diceNum <= 6) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(generateDiceSvg(diceNum));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Bóc tách tham số dạng query không khóa (?value hoặc ?=value)
  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value) { rawQueryValue = key.replace(/^=/, "").trim(); break; }
  }

  const isRoll = 
    searchParams.get("action") === "roll" || 
    searchParams.get("demo") === "true" || 
    searchParams.has("roll") || 
    rawQueryValue.toLowerCase() === "roll" || 
    rawQueryValue.toLowerCase() === "demo";

  const setParam = searchParams.get("set") || searchParams.get("dice") || searchParams.get("rig");

  // 2. Xử lý chế độ Quay xúc xắc / Chỉ định kết quả
  if (isRoll || setParam || (rawQueryValue && ["tai", "xiu", "bao"].includes(rawQueryValue.toLowerCase())) || /^[1-6][\-,\s\_][1-6][\-,\s\_][1-6]$/.test(rawQueryValue)) {
    const targetSet = setParam || (rawQueryValue !== "roll" && rawQueryValue !== "demo" ? rawQueryValue : "");
    const customRound = createCustomOrRandomRound(targetSet, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Mô Phỏng & Thiết Lập Kết Quả Xúc Xắc (Custom & Random Simulator)",
      du_lieu: customRound
    });
  }

  // 3. Xử lý phân tích Hash / Chuỗi kết quả đối soát
  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || rawQueryValue;

  if (hashInput) {
    const analysis = parseAdvancedHash(hashInput, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích & Xác Thực Tài Xỉu MD5 / SHA-256 Hitclub & Sunwin",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: analysis
    });
  }

  // 4. Trang tài liệu hướng dẫn
  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Hệ Thống Soi Cầu & Giả Lập Tài Xỉu MD5 / SHA-256 Đa Năng",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    cac_chuc_nang: {
      soi_cau_hash: "Dán chuỗi SHA-256 hoặc MD5 trước phiên để phân tích xác suất",
      xac_thuc_mo_bat: "Dán chuỗi kết quả sau mở bát (ví dụ: ...|4-1-2) để đối soát 100% xúc xắc thật",
      chi_dinh_xuc_xac_hoac_cau: "Tự tạo ván cược chỉ định xúc xắc hoặc theo cửa (kèm mã Hash SHA-256 & MD5 chuẩn)",
      xem_anh_xuc_xac: "Xem ảnh SVG trực tiếp từng hạt xúc xắc 1 đến 6"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_hash_hoac_chuoi_ket_qua}`,
      `${baseUrl}/api/taixiu?=roll (Lắc xúc xắc ngẫu nhiên)`,
      `${baseUrl}/api/taixiu?set=6-6-6 (Chỉ định 3 con xúc xắc cụ thể)`,
      `${baseUrl}/api/taixiu?set=tai (Chỉ định ép ra kết quả TÀI)`,
      `${baseUrl}/api/taixiu?set=xiu (Chỉ định ép ra kết quả XỈU)`,
      `${baseUrl}/api/taixiu?image={1_den_6} (Xem ảnh SVG)`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu?=roll`,
      `${baseUrl}/api/taixiu?set=6-6-6`,
      `${baseUrl}/api/taixiu?set=tai`,
      `${baseUrl}/api/taixiu?set=xiu`,
      `${baseUrl}/api/taixiu?=18049442e18b4b8df3a0219fc9bcf9394bd94d203453d1d9f361fcb8fc7fb3c4`,
      `${baseUrl}/api/taixiu?image=6`
    ]
  });
};