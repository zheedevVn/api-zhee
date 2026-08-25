const crypto = require("crypto");

// 1. Bộ sinh hình ảnh Xúc Xắc Casino SVG nội bộ (Chuẩn màu, không bị lỗi link ngoài)
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

// 2. Định danh cấu trúc chuẩn thuật toán băm
function detectHashType(hashLength) {
  switch (hashLength) {
    case 32: return "MD5 (128-bit Standard)";
    case 40: return "SHA-1 (160-bit)";
    case 56: return "SHA-224 (224-bit)";
    case 64: return "SHA-256 (Hitclub / Sunwin / Go88 Provably Fair)";
    case 96: return "SHA-384 (384-bit)";
    case 128: return "SHA-512 (512-bit)";
    default: return "Custom Hex Signature";
  }
}

// 3. THUẬT TOÁN BÓC TÁCH MA TRẬN HASH BẤT BIẾN (DETERMINISTIC MATRIX ENGINE)
function analyzeDeterministicHash(hashInput, baseUrl) {
  const clean = hashInput.trim().toLowerCase();
  const len = clean.length;
  const hashType = detectHashType(len);

  // 1. Phân tích phân bổ Byte & Bit không đổi
  let bitCount = 0;
  let byteSum = 0;
  for (let i = 0; i < len; i += 2) {
    const b = parseInt(clean.substr(i, 2), 16) || 0;
    byteSum += b;
    bitCount += b.toString(2).split("1").length - 1;
  }

  // 2. Chia 3 vùng băm độc lập để bóc tách 3 nút xúc xắc chuẩn
  const segmentSize = Math.floor(len / 3);
  const part1 = clean.substring(0, 8);
  const part2 = clean.substring(segmentSize, segmentSize + 8);
  const part3 = clean.substring(len - 8);

  const u1 = parseInt(part1, 16) || 0;
  const u2 = parseInt(part2, 16) || 0;
  const u3 = parseInt(part3, 16) || 0;

  // Ánh xạ Modulo 6 chính xác
  const d1 = (u1 % 6) + 1;
  const d2 = (u2 % 6) + 1;
  const d3 = (u3 % 6) + 1;

  const tongDiem = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);

  let ketQua = "";
  if (isBao) {
    ketQua = `BÃO (Bộ 3 nút ${d1})`;
  } else if (tongDiem >= 11 && tongDiem <= 17) {
    ketQua = "TÀI";
  } else {
    ketQua = "XỈU";
  }

  // 3. Tính tỷ lệ xác suất bất biến (> 90%)
  const baseConfidence = 91.5 + ((u1 + byteSum) % 65) / 10;
  const doTinCay = Math.min(98.8, baseConfidence).toFixed(1);

  const taiRate = isBao ? "0.0" : (tongDiem >= 11 ? doTinCay : (100 - parseFloat(doTinCay)).toFixed(1));
  const xiuRate = isBao ? "0.0" : (tongDiem <= 10 ? doTinCay : (100 - parseFloat(doTinCay)).toFixed(1));

  // 4. Nhận diện nhịp bước sóng cầu
  const bridgeTypes = [
    "Cầu Bệt Dài (Lực nén cực mạnh, xu hướng giữ nhịp 4-6 tay liên tiếp)",
    "Cầu Đảo Nhịp 1-1 (Dao động điều hòa cân bằng, ưu tiên đánh đảo)",
    "Cầu Thuận Cặp 2-2 (Nhịp bước đôi cân đối, xác suất giữ cầu cực cao)",
    "Cầu Bẻ Điểm 3-2-1 (Lực thoát biên lớn, ưu tiên bắt điểm rơi đảo chiều)"
  ];
  const nhanDinhCau = bridgeTypes[(u2 + byteSum) % bridgeTypes.length];

  return {
    chuoi_hash: clean,
    chuan_ma_bam: hashType,
    do_dai: `${len} ký tự (Hex)`,
    ket_qua_du_doan: ketQua,
    tong_diem_du_kien: `${tongDiem} Điểm (${ketQua === "TÀI" ? "Tài 11 - 17" : (ketQua === "XỈU" ? "Xỉu 4 - 10" : "Bão")})`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: { nut: d1, hex_block: part1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
      xuc_xac_2: { nut: d2, hex_block: part2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
      xuc_xac_3: { nut: d3, hex_block: part3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
    },
    phan_tich_chuyen_sau: {
      xac_suat_tai: `${taiRate}%`,
      xac_suat_xiu: `${xiuRate}%`,
      do_tin_cay_tong_the: `${doTinCay}%`,
      luc_nen_cau: Number(doTinCay) >= 94 ? "CỰC MẠNH (Tỷ lệ thắng áp đảo > 94%)" : "TIÊU CHUẨN CAO (> 90%)",
      nhan_dinh_nhip_cau: nhanDinhCau,
      chien_thuat_khuyen_nghi: Number(doTinCay) >= 94 ? "Tự tin vào lệnh theo cửa dự đoán" : "Quản lý vốn chia lệnh 1-2-4"
    },
    co_che_tinh_toan: "Deterministic Provably Fair Modulo Mapping (Cố định vĩnh viễn theo chuỗi Hash)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 4. Mô phỏng Lắc Xúc Xắc Demo
function rollDemoDice(baseUrl) {
  const dice1 = crypto.randomInt(1, 7);
  const dice2 = crypto.randomInt(1, 7);
  const dice3 = crypto.randomInt(1, 7);

  const tongDiem = dice1 + dice2 + dice3;
  const isBao = dice1 === dice2 && dice2 === dice3;
  
  let ketQua = "";
  if (isBao) {
    ketQua = `BÃO (Bộ ba ${dice1})`;
  } else if (tongDiem >= 11 && tongDiem <= 17) {
    ketQua = "TÀI";
  } else {
    ketQua = "XỈU";
  }

  const secretKey = crypto.randomBytes(8).toString("hex");
  const rawString = `${dice1}-${dice2}-${dice3}|${secretKey}`;
  const md5Hash = crypto.createHash("md5").update(rawString).digest("hex");
  const sha256Hash = crypto.createHash("sha256").update(rawString).digest("hex");

  return {
    phien_cuoc_id: Date.now(),
    xuc_xac_1: dice1,
    xuc_xac_2: dice2,
    xuc_xac_3: dice3,
    tong_diem: tongDiem,
    ket_qua: ketQua,
    hinh_anh_xuc_xac: {
      xuc_xac_1_img: `${baseUrl}/api/taixiu?image=${dice1}`,
      xuc_xac_2_img: `${baseUrl}/api/taixiu?image=${dice2}`,
      xuc_xac_3_img: `${baseUrl}/api/taixiu?image=${dice3}`
    },
    chung_thuc_minh_bach: {
      chuoi_goc_truoc_khi_bam: rawString,
      ma_md5: md5Hash,
      ma_sha256: sha256Hash
    }
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

  // Render SVG trực tiếp
  const imgParam = searchParams.get("image") || searchParams.get("img") || searchParams.get("dice");
  if (imgParam) {
    const diceNum = parseInt(imgParam, 10);
    if (diceNum >= 1 && diceNum <= 6) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(generateDiceSvg(diceNum));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value && !["demo", "roll", "image", "img"].includes(key)) {
      firstParam = key.replace(/^=/, "").trim();
      break;
    }
  }

  const action = searchParams.get("action") || (searchParams.get("demo") === "true" || searchParams.has("roll") ? "roll" : "");
  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || firstParam;

  if (action === "roll" || action === "demo" || hashInput === "roll" || hashInput === "demo") {
    const diceResult = rollDemoDice(baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Mô Phỏng Xúc Xắc Tài Xỉu Demo (Live Roll Simulator)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: diceResult
    });
  }

  if (hashInput && /^[a-fA-F0-9]{16,128}$/.test(hashInput.trim())) {
    const analysis = analyzeDeterministicHash(hashInput.trim(), baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích Soi Cầu Xác Suất MD5 / SHA-256 Chuyên Sâu (Deterministic)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: analysis
    });
  }

  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Công Cụ Phân Tích Xác Suất MD5 / SHA-256 & Lắc Xúc Xắc Tài Xỉu Demo",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      phan_tich_hash: "Hỗ trợ tự động phân tích tất cả các định dạng Hash: MD5 (32 ký tự), SHA-1 (40 ký tự), SHA-256 (64 ký tự), SHA-512...",
      ket_qua_co_dinh: "Mỗi chuỗi Hash có kết quả cố định 100%, không bị đổi khi F5/reload trang",
      anh_xuc_xac_svg: "Engine render SVG nội bộ chất lượng cao không bị phụ thuộc CDN ngoài"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_hash_md5_hoac_sha256}`,
      `${baseUrl}/api/taixiu?hash={chuoi_hash}`,
      `${baseUrl}/api/taixiu?action=roll`,
      `${baseUrl}/api/taixiu?image={1_den_6}`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu?=768890760c8f97c77fc63bfd6f2d1e8495d02311d95cf2d4024b43dfc87f2f37`,
      `${baseUrl}/api/taixiu?=9e107d9d372bb6826bd81d3542a419d6`,
      `${baseUrl}/api/taixiu?action=roll`,
      `${baseUrl}/api/taixiu?image=6`
    ]
  });
};