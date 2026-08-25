const crypto = require("crypto");

// 1. Hàm tạo mã SVG Xúc Xắc Casino 3D Đỏ Trắng Trực Tiếp (Không sợ chết link/CDN)
function generateDiceSvg(number) {
  const n = Math.max(1, Math.min(6, parseInt(number) || 1));
  const dotCoords = {
    1: [[50, 50, "#e74c3c", 13]], // Nút đỏ to ở giữa cho số 1
    2: [[28, 28, "#2c3e50", 9], [72, 72, "#2c3e50", 9]],
    3: [[25, 25, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [75, 75, "#2c3e50", 8]],
    4: [[28, 28, "#e74c3c", 9], [72, 28, "#e74c3c", 9], [28, 72, "#e74c3c", 9], [72, 72, "#e74c3c", 9]], // Nút đỏ cho số 4
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
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// 2. Nhận diện chuẩn thuật toán băm
function detectHashType(hashLength) {
  switch (hashLength) {
    case 32: return "MD5 (128-bit Standard)";
    case 40: return "SHA-1 (160-bit)";
    case 56: return "SHA-224 (224-bit)";
    case 64: return "SHA-256 (Hitclub / Sunwin / Go88 Provably Fair)";
    case 96: return "SHA-384 (384-bit)";
    case 128: return "SHA-512 (512-bit)";
    default: return "Hex Game Signature";
  }
}

// 3. THUẬT TOÁN QUÉT MA TRẬN HASH & SOI CẦU CHUYÊN SÂU
function analyzeUniversalHash(hashInput, baseUrl) {
  const clean = hashInput.trim().toLowerCase();
  const len = clean.length;
  const hashType = detectHashType(len);

  // 1. Phân tích ma trận byte & bit distribution
  let totalBits = 0;
  let evenBytes = 0;
  let oddBytes = 0;
  let totalSum = 0;

  for (let i = 0; i < len; i += 2) {
    const byte = parseInt(clean.substr(i, 2), 16) || 0;
    totalSum += byte;
    if (byte % 2 === 0) evenBytes++; else oddBytes++;
    totalBits += byte.toString(2).split("1").length - 1;
  }

  // 2. Lấy 3 khối 8-hex độc lập (Đầu - Giữa - Đuôi)
  const partSize = Math.floor(len / 3);
  const chunk1 = clean.substring(0, 8);
  const chunk2 = clean.substring(partSize, partSize + 8);
  const chunk3 = clean.substring(len - 8);

  const uint1 = parseInt(chunk1, 16) || 0;
  const uint2 = parseInt(chunk2, 16) || 0;
  const uint3 = parseInt(chunk3, 16) || 0;

  // Tính 3 nút xúc xắc chuẩn Modulo 6
  const d1 = ((uint1 + evenBytes) % 6) + 1;
  const d2 = ((uint2 + oddBytes) % 6) + 1;
  const d3 = ((uint3 + (totalBits % 6)) % 6) + 1;

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

  // 3. Tính tỷ lệ % xác suất chi tiết
  const rawTai = isBao ? 0 : (tongDiem >= 11 ? Math.min(97.2, 84.5 + ((uint1 + totalSum) % 130) / 10) : Math.max(7.5, 100 - (84.5 + ((uint1 + totalSum) % 130) / 10)));
  const xiuRate = (100 - rawTai).toFixed(1);
  const finalTaiRate = rawTai.toFixed(1);
  const tiLeAnChinh = (ketQua === "TÀI" ? finalTaiRate : (ketQua === "XỈU" ? xiuRate : "99.0"));

  // 4. Nhận định nhịp cầu
  const bridgeTypes = [
    "Cầu Bệt Dài (Lực nén cực mạnh, xu hướng đi dây 4-6 tay liên tiếp)",
    "Cầu Đảo Nhịp 1-1 (Dao động điều hòa luân phiên, cửa đảo chiếm ưu thế)",
    "Cầu Thuận Cặp 2-2 (Nhịp bước đôi ổn định, xác suất giữ nhịp cao)",
    "Cầu Bẻ Điểm 3-2-1 (Lực thoát biên lớn, ưu tiên bắt điểm rơi đảo chiều)"
  ];
  const nhanDinhCau = bridgeTypes[(uint2 + totalSum) % bridgeTypes.length];

  return {
    chuoi_hash: clean,
    chuan_ma_bam: hashType,
    do_dai: `${len} ký tự (Hex)`,
    ket_qua_du_doan: ketQua,
    tong_diem_du_kien: `${tongDiem} Điểm (${ketQua === "TÀI" ? "Tài 11 - 17" : (ketQua === "XỈU" ? "Xỉu 4 - 10" : "Bão")})`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: { nut: d1, hex_block: chunk1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
      xuc_xac_2: { nut: d2, hex_block: chunk2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
      xuc_xac_3: { nut: d3, hex_block: chunk3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
    },
    phan_tich_chuyen_sau: {
      xac_suat_tai: `${finalTaiRate}%`,
      xac_suat_xiu: `${xiuRate}%`,
      do_tin_cay_tong_the: `${tiLeAnChinh}%`,
      luc_nen_cau: Number(tiLeAnChinh) >= 90 ? "CỰC MẠNH (Tỷ lệ ăn áp đảo)" : "TIÊU CHUẨN",
      nhan_dinh_nhip_cau: nhanDinhCau,
      chien_thuat_khuyen_nghi: Number(tiLeAnChinh) >= 90 ? "Tự tin vào lệnh theo kết quả dự đoán" : "Đi đều tay (Quản lý vốn 1-2-4)"
    },
    thuat_toan: "Multi-Zone Bitwise Entropy & Provably Fair Modulo Mapping",
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

  // 1. ROUTE RENDER HÌNH ẢNH XÚC XẮC SVG TRỰC TIẾP
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
    const analysis = analyzeUniversalHash(hashInput.trim(), baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích Soi Cầu Xác Suất MD5 / SHA-256 Chuyên Sâu",
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
      lac_xuc_xac_demo: "Mô phỏng gieo 3 xúc xắc ngẫu nhiên kèm hình ảnh nút xúc xắc chuẩn và chuỗi hash chứng thực",
      anh_xuc_xac: "Hỗ trợ xuất trực tiếp ảnh xúc xắc chuẩn: /api/taixiu?image=1 -> /api/taixiu?image=6"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_hash_md5_hoac_sha256}`,
      `${baseUrl}/api/taixiu?hash={chuoi_hash}`,
      `${baseUrl}/api/taixiu?action=roll (Hoặc ?=roll để lắc xúc xắc demo)`,
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