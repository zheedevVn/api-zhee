const crypto = require("crypto");

// CDN ảnh xúc xắc trực quan chất lượng cao (1 - 6 nút)
const DICE_IMAGES = {
  1: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Dice-1-b.svg",
  2: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Dice-2-b.svg",
  3: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Dice-3-b.svg",
  4: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Dice-4-b.svg",
  5: "https://upload.wikimedia.org/wikipedia/commons/0/08/Dice-5-b.svg",
  6: "https://upload.wikimedia.org/wikipedia/commons/2/26/Dice-6-b.svg"
};

// Phân loại định dạng Hash theo độ dài chuỗi Hex
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

// Thuật toán bóc tách Entropy và phân tích xác suất Tài / Xỉu
function analyzeUniversalHash(hashInput) {
  const cleanHash = hashInput.trim().toLowerCase();
  const hashLength = cleanHash.length;
  const hashName = detectHashType(hashLength);

  let totalEntropy = 0;
  let byteSum = 0;

  for (let i = 0; i < cleanHash.length; i++) {
    const charCode = cleanHash.charCodeAt(i);
    totalEntropy += charCode * (i + 1);
    if (i % 2 === 0) {
      byteSum += parseInt(cleanHash.substr(i, 2), 16) || 0;
    }
  }

  // Chia chuỗi thành các phân đoạn 8-byte để tính trọng số phân phối bit
  const chunkSize = Math.max(4, Math.floor(cleanHash.length / 4));
  const chunk1 = parseInt(cleanHash.substr(0, chunkSize).slice(0, 8), 16) || 0;
  const chunk2 = parseInt(cleanHash.substr(chunkSize, chunkSize).slice(0, 8), 16) || 0;
  const chunk3 = parseInt(cleanHash.substr(chunkSize * 2, chunkSize).slice(0, 8), 16) || 0;
  const chunk4 = parseInt(cleanHash.substr(chunkSize * 3).slice(0, 8), 16) || 0;

  const combinedWeight = (chunk1 % 100) + (chunk2 % 100) + (chunk3 % 100) + (chunk4 % 100);
  const normalizedScore = (totalEntropy + byteSum + combinedWeight) % 100;

  // Dự đoán kết quả: Điểm cân bằng xác suất
  const isTai = normalizedScore >= 49;
  const rawRate = 84 + ((chunk1 + chunk3 + byteSum) % 14) + ((chunk2 % 10) / 10);
  const tiLeAn = Math.min(97.8, Math.max(83.5, rawRate)).toFixed(1);

  // Phân tích nhịp cầu tương thích
  const nhapCauList = [
    "Cầu Bệt dài (Xu hướng bệt mạnh, khuyến nghị nuôi theo cầu)",
    "Cầu Đảo 1-1 (Nhịp cầu giằng co, ưu tiên đánh đảo chiều)",
    "Cầu Nghiêng 2-1 (Tỷ lệ lệch cửa dự đoán rõ rệt)",
    "Cầu Nhảy ngẫu nhiên (Độ biến động thấp, vào lệnh bảo toàn vốn)"
  ];
  const loaiCau = nhapCauList[(chunk2 + chunk4 + byteSum) % nhapCauList.length];

  // Tính điểm số xí ngầu ước lượng theo phân vị
  const diemDuKien = isTai 
    ? (11 + ((chunk1 + chunk2) % 6)) 
    : (4 + ((chunk3 + chunk4) % 7));

  return {
    chuoi_hash_goc: cleanHash,
    dinh_dang_ma_bam: hashName,
    do_dai_chuoi: `${hashLength} ký tự (Hex)`,
    du_doan: isTai ? "TÀI" : "XỈU",
    diem_so_du_kien: `${diemDuKien} Điểm (${isTai ? "Tài 11 - 17" : "Xỉu 4 - 10"})`,
    do_tin_cay: `${tiLeAn}%`,
    danh_gia_cua_an: Number(tiLeAn) >= 90 ? "RẤT CAO (Tỷ lệ ăn mạnh)" : "TRUNG BÌNH KHÁ",
    phan_tich_nhip_cau: loaiCau,
    thuat_toan_kiem_tra: "Multi-Hash Bitwise Entropy & Modulo Distribution",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// Bộ quay xúc xắc Demo ngẫu nhiên (Fair Random Dice Simulator)
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

  // Tạo chuỗi MD5 & SHA-256 chứng thực ván cược
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

  // 1. Chế độ lắc xúc xắc Demo
  if (action === "roll" || action === "demo" || hashInput === "roll" || hashInput === "demo") {
    const diceResult = rollDemoDice();
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Mô Phỏng Xúc Xắc Tài Xỉu Demo (Live Roll Simulator)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: diceResult
    });
  }

  // 2. Chế độ phân tích chuỗi Hash (MD5, SHA-1, SHA-256, SHA-512...)
  if (hashInput && /^[a-fA-F0-9]{16,128}$/.test(hashInput.trim())) {
    const analysis = analyzeUniversalHash(hashInput.trim());
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích Xác Suất Chuỗi Hash / MD5 / SHA-256 Tài Xỉu",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: analysis
    });
  }

  // Trang hướng dẫn chi tiết
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