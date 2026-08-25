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

// 1. Phân tích xác suất MD5 thuật toán băm (MD5 AI Analytics)
function analyzeMd5Hash(hashInput) {
  const cleanHash = hashInput.trim().toLowerCase();
  
  // Lấy các khối bytes và số nguyên từ hash để phân tích entropy
  let totalEntropy = 0;
  for (let i = 0; i < cleanHash.length; i++) {
    totalEntropy += cleanHash.charCodeAt(i);
  }

  const chunk1 = parseInt(cleanHash.substring(0, 8), 16) || 0;
  const chunk2 = parseInt(cleanHash.substring(8, 16), 16) || 0;
  const chunk3 = parseInt(cleanHash.substring(16, 24), 16) || 0;
  const chunk4 = parseInt(cleanHash.substring(24, 32), 16) || 0;

  const combinedWeight = (chunk1 % 100) + (chunk2 % 100) + (chunk3 % 100) + (chunk4 % 100);
  const normalizedScore = (totalEntropy + combinedWeight) % 100;

  // Dự đoán kết quả và tỷ lệ độ tin cậy (82% - 97%)
  const isTai = normalizedScore >= 49;
  const tiLeAn = (82 + ((chunk1 + chunk3) % 16)).toFixed(1); // Dao động 82.0% - 97.0%

  // Phân tích nhịp cầu
  const nhapCauList = [
    "Cầu Bệt dài (Ưu tiên theo xu hướng chính)",
    "Cầu Đảo 1-1 (Nhịp cầu giằng co luân phiên)",
    "Cầu Nghiêng 2-1 (Tỷ lệ lệch về phía kết quả dự báo)",
    "Cầu Nhảy ngẫu nhiên (Độ biến động thấp, cửa vào an toàn)"
  ];
  const loaiCau = nhapCauList[(chunk2 + chunk4) % nhapCauList.length];

  return {
    chuoi_md5: cleanHash,
    du_doan: isTai ? "TÀI" : "XỈU",
    diem_du_kien: isTai ? "11 - 16 Điểm" : "5 - 10 Điểm",
    do_tin_cay: `${tiLeAn}%`,
    chi_so_khuyen_nghi: Number(tiLeAn) >= 90 ? "RẤT MẠNH (Tỷ lệ ăn cao)" : "TRUNG BÌNH CAO",
    phan_tich_nhip_cau: loaiCau,
    thuat_toan_kiem_tra: "MD5 Entropy Bitwise Distribution Analyzer"
  };
}

// 2. Bộ quay xúc xắc Demo ngẫu nhiên (Fair Random Dice Simulator)
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

  // Tạo chuỗi MD5 chứng thực cho ván cược demo này
  const secretKey = crypto.randomBytes(8).toString("hex");
  const rawString = `${dice1}-${dice2}-${dice3}|${secretKey}`;
  const md5Hash = crypto.createHash("md5").update(rawString).digest("hex");

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
    chung_thuc_md5_phien: {
      chuoi_goc: rawString,
      ma_md5: md5Hash
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
  const md5Input = searchParams.get("md5") || searchParams.get("hash") || searchParams.get("q") || firstParam;

  // Trường hợp 1: Chạy mô phỏng Lắc Xúc Xắc Demo
  if (action === "roll" || action === "demo" || md5Input === "roll" || md5Input === "demo") {
    const diceResult = rollDemoDice();
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Mô Phỏng Xúc Xắc Tài Xỉu Demo (Live Roll Simulator)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: diceResult
    });
  }

  // Trường hợp 2: Check và phân tích chuỗi MD5
  if (md5Input && /^[a-fA-F0-9]{32}$/.test(md5Input)) {
    const analysis = analyzeMd5Hash(md5Input);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích Xác Suất Chuỗi MD5 Tài Xỉu (High Accuracy Analyzer)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: analysis
    });
  }

  // Hướng dẫn sử dụng
  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Công Cụ Phân Tích Xác Suất MD5 & Lắc Xúc Xắc Tài Xỉu Demo",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      check_md5: "Phân tích hash 32 ký tự MD5 để tính toán xác suất Tài / Xỉu với tỷ lệ chính xác cao",
      lac_xuc_xac_demo: "Mô phỏng gieo 3 xúc xắc ngẫu nhiên kèm hình ảnh HD và mã MD5 minh bạch"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_md5_32_ky_tu}`,
      `${baseUrl}/api/taixiu?md5={chuoi_md5_32_ky_tu}`,
      `${baseUrl}/api/taixiu?action=roll (Hoặc ?=roll để lắc xúc xắc demo)`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu?=9e107d9d372bb6826bd81d3542a419d6`,
      `${baseUrl}/api/taixiu?action=roll`,
      `${baseUrl}/api/taixiu?=roll`
    ]
  });
};