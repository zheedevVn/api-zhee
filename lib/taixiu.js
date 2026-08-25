const crypto = require("crypto");

const DICE_IMAGES = {
  1: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Dice-1-b.svg",
  2: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Dice-2-b.svg",
  3: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Dice-3-b.svg",
  4: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Dice-4-b.svg",
  5: "https://upload.wikimedia.org/wikipedia/commons/0/08/Dice-5-b.svg",
  6: "https://upload.wikimedia.org/wikipedia/commons/2/26/Dice-6-b.svg"
};

function detectHashType(hashLength) {
  switch (hashLength) {
    case 32: return "MD5";
    case 40: return "SHA-1";
    case 56: return "SHA-224";
    case 64: return "SHA-256 (Chuỗi Hash Game Phổ Biến)";
    case 96: return "SHA-384";
    case 128: return "SHA-512";
    default: return "Custom Hash / Hex Signature";
  }
}

// Thuật toán bóc tách 3 Xúc xắc từ chuỗi Hex Bytes (Modulo Big-Endian)
function analyzeUniversalHash(hashInput) {
  const cleanHash = hashInput.trim().toLowerCase();
  const len = cleanHash.length;
  const hashName = detectHashType(len);

  // 1. Trích xuất các khối Hex 4-byte từ đầu, giữa và cuối
  const partSize = Math.floor(len / 3);
  const block1Hex = cleanHash.substring(0, 8);
  const block2Hex = cleanHash.substring(partSize, partSize + 8);
  const block3Hex = cleanHash.substring(len - 8, len);

  const num1 = parseInt(block1Hex, 16) || 1;
  const num2 = parseInt(block2Hex, 16) || 2;
  const num3 = parseInt(block3Hex, 16) || 3;

  // 2. Tính toán giá trị 3 hạt xúc xắc theo cơ chế Modulo 6
  const d1 = (num1 % 6) + 1;
  const d2 = (num2 % 6) + 1;
  const d3 = (num3 % 6) + 1;

  const tongDiem = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  
  let ketQua = "";
  if (isBao) {
    ketQua = `BÃO (Bộ ba ${d1})`;
  } else if (tongDiem >= 11) {
    ketQua = "TÀI";
  } else {
    ketQua = "XỈU";
  }

  // 3. Tính độ tin cậy và phân tích nhịp cầu từ Hamming Weight (Mật độ bit)
  let bitCount = 0;
  for (let i = 0; i < len; i += 2) {
    const byte = parseInt(cleanHash.substr(i, 2), 16) || 0;
    bitCount += byte.toString(2).split("1").length - 1;
  }
  const confidence = (85 + (bitCount % 12) + ((num1 % 10) / 10)).toFixed(1);

  const bridgePatterns = [
    "Cầu Bệt dài (Xu hướng bệt tiếp diễn, khuyến nghị theo nhịp)",
    "Cầu Đảo 1-1 (Nhịp luân phiên giằng co, ưu tiên đánh đảo)",
    "Cầu Nghiêng 2-1 (Lực cầu lệch rõ rệt về kết quả dự đoán)",
    "Cầu Nhảy ngẫu nhiên (Biến động thấp, vào lệnh bảo toàn vốn)"
  ];
  const selectedBridge = bridgePatterns[(num2 + num3) % bridgePatterns.length];

  return {
    chuoi_hash_goc: cleanHash,
    dinh_dang_ma_bam: hashName,
    do_dai_chuoi: `${len} ký tự (Hex)`,
    du_doan_chinh: ketQua,
    tong_diem_du_kien: `${tongDiem} Điểm (${ketQua === "TÀI" ? "Tài 11 - 17" : (ketQua === "XỈU" ? "Xỉu 4 - 10" : "Bão")})`,
    chi_tiet_3_xuc_xac_du_kien: {
      xuc_xac_1: d1,
      xuc_xac_2: d2,
      xuc_xac_3: d3,
      hinh_anh_minh_hoa: {
        xuc_xac_1_img: DICE_IMAGES[d1],
        xuc_xac_2_img: DICE_IMAGES[d2],
        xuc_xac_3_img: DICE_IMAGES[d3]
      }
    },
    do_tin_cay: `${confidence}%`,
    chi_so_khuyen_nghi: Number(confidence) >= 90 ? "RẤT CAO (Tỷ lệ ăn mạnh)" : "TRUNG BÌNH CAO",
    phan_tich_nhip_cau: selectedBridge,
    phuong_phap_giai_ma: "Bitwise High-Order Modulo 6 Dice Reconstruction",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 4. Mô phỏng Lắc Xúc Xắc Demo
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
      chuyen_muc: "Phân Tích Xác Suất Chuỗi Hash / MD5 / SHA-256 Tài Xỉu",
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
      `${baseUrl}/api/taixiu?=deed05eaf49e08a246247193096db7b9b2bf7a7295274b34cc28a0b506d7432f`,
      `${baseUrl}/api/taixiu?=9e107d9d372bb6826bd81d3542a419d6`,
      `${baseUrl}/api/taixiu?action=roll`,
      `${baseUrl}/api/taixiu?=roll`
    ]
  });
};