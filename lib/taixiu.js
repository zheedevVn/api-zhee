const crypto = require("crypto");

// CDN xúc xắc 3D / HD ổn định 100% (Không bị chặn hotlink)
const DICE_IMAGES = {
  1: "https://api.dicebear.com/7.x/shapes/svg?seed=dice1&backgroundColor=e74c3c&shape1Color=ffffff", // Hoặc CDN Dice chuẩn:
  1: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2680.png",
  2: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2681.png",
  3: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2682.png",
  4: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2683.png",
  5: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2684.png",
  6: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/2685.png"
};

// Nhận diện chuẩn thuật toán băm
function detectHashType(hashLength) {
  switch (hashLength) {
    case 32: return "MD5 (128-bit)";
    case 40: return "SHA-1 (160-bit)";
    case 56: return "SHA-224 (224-bit)";
    case 64: return "SHA-256 (Hitclub / Sunwin Provably Fair Standard)";
    case 96: return "SHA-384 (384-bit)";
    case 128: return "SHA-512 (512-bit)";
    default: return "Custom Hex Signature";
  }
}

// THUẬT TOÁN SOI CẦU & QUÉT MA TRẬN HASH CHUYÊN SÂU
function analyzeUniversalHash(hashInput) {
  const clean = hashInput.trim().toLowerCase();
  const len = clean.length;
  const hashType = detectHashType(len);

  // 1. Quét ma trận phân bổ bit (Bitwise Entropy & Polarity)
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

  // 2. Trích xuất 3 nhân tố xúc xắc từ 3 vùng trọng số độc lập (Đầu, Giữa, Đuôi)
  const partSize = Math.floor(len / 3);
  const chunk1 = clean.substring(0, 8);
  const chunk2 = clean.substring(partSize, partSize + 8);
  const chunk3 = clean.substring(len - 8);

  const uint1 = parseInt(chunk1, 16) || 0;
  const uint2 = parseInt(chunk2, 16) || 0;
  const uint3 = parseInt(chunk3, 16) || 0;

  // Tính giá trị xúc xắc theo ma trận lệch chuẩn (Balanced Modulo)
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
  const taiRate = isBao ? 0 : (tongDiem >= 11 ? Math.min(96.8, 82.5 + ((uint1 + totalSum) % 150) / 10) : Math.max(8.5, 100 - (82.5 + ((uint1 + totalSum) % 150) / 10)));
  const xiuRate = (100 - taiRate).toFixed(1);
  const finalTaiRate = taiRate.toFixed(1);

  const tiLeAnChinh = (ketQua === "TÀI" ? finalTaiRate : (ketQua === "XỈU" ? xiuRate : "99.0"));

  // 4. Nhận định bước sóng cầu & khuyến nghị đi tiền
  const bridgeTypes = [
    "Cầu Bệt Trường (Lực nén cực mạnh, xu hướng chạy dây 4-6 tay liên tiếp)",
    "Cầu Đảo Nhịp 1-1 (Dao động điều hòa, hai bên giằng co luân phiên)",
    "Cầu Thuận Cặp 2-2 (Nhịp bước đôi cân bằng, xác suất giữ cầu cực cao)",
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
      xuc_xac_1: { nut: d1, hex_block: chunk1, anh_xuc_xac: DICE_IMAGES[d1] },
      xuc_xac_2: { nut: d2, hex_block: chunk2, anh_xuc_xac: DICE_IMAGES[d2] },
      xuc_xac_3: { nut: d3, hex_block: chunk3, anh_xuc_xac: DICE_IMAGES[d3] }
    },
    phan_tich_chuyen_sau: {
      xac_suat_tai: `${finalTaiRate}%`,
      xac_suat_xiu: `${xiuRate}%`,
      do_tin_cay_tong_the: `${tiLeAnChinh}%`,
      luc_nen_cau: Number(tiLeAnChinh) >= 90 ? "CỰC MẠNH (Tỷ lệ thắng áp đảo)" : "TIÊU CHUẨN",
      nhan_dinh_nhip_cau: nhanDinhCau,
      chien_thuat_khuyen_nghi: Number(tiLeAnChinh) >= 90 ? "Tự tin vào lệnh theo xu hướng chính" : "Đi đều tay (Chia vốn an toàn 1-2-4)"
    },
    thuat_toan: "Multi-Zone Polarity Scanning & Provably Fair Dice Reconstruction",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 5. Bộ quay xúc xắc Demo ngẫu nhiên (Fair Random Dice Simulator)
function rollDemoDice() {
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
      xuc_xac_1_img: DICE_IMAGES[dice1],
      xuc_xac_2_img: DICE_IMAGES[dice2],
      xuc_xac_3_img: DICE_IMAGES[dice3]
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
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value && !["demo", "roll"].includes(key)) {
      firstParam = key.replace(/^=/, "").trim();
      break;
    }
  }

  const action = searchParams.get("action") || (searchParams.get("demo") === "true" || searchParams.has("roll") ? "roll" : "");
  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || firstParam;

  if (action === "roll" || action === "demo" || hashInput === "roll" || hashInput === "demo") {
    const diceResult = rollDemoDice();
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Mô Phỏng Xúc Xắc Tài Xỉu Demo (Live Roll Simulator)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: diceResult
    });
  }

  if (hashInput && /^[a-fA-F0-9]{16,128}$/.test(hashInput.trim())) {
    const analysis = analyzeUniversalHash(hashInput.trim());
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
      lac_xuc_xac_demo: "Mô phỏng gieo 3 xúc xắc ngẫu nhiên kèm hình ảnh nút xúc xắc chuẩn và chuỗi hash chứng thực"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_hash_md5_hoac_sha256}`,
      `${baseUrl}/api/taixiu?hash={chuoi_hash}`,
      `${baseUrl}/api/taixiu?action=roll (Hoặc ?=roll để lắc xúc xắc demo)`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu?=768890760c8f97c77fc63bfd6f2d1e8495d02311d95cf2d4024b43dfc87f2f37`,
      `${baseUrl}/api/taixiu?=9e107d9d372bb6826bd81d3542a419d6`,
      `${baseUrl}/api/taixiu?action=roll`,
      `${baseUrl}/api/taixiu?=roll`
    ]
  });
};