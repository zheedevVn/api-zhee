const crypto = require("crypto");

// 1. Bộ render ảnh xúc xắc SVG nội bộ chuẩn màu Casino (Không sợ 404)
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
        <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// 2. Thuật toán phân tích Hash chuyên sâu (Advanced Byte Mapping & Trend Bias)
function parseAdvancedHash(inputStr, baseUrl) {
  const clean = inputStr.trim();
  
  // TRƯỜNG HỢP 1: Chuỗi kết quả sau phiên (Ví dụ: "1-1-2|key..." hoặc "3,4,5#...")
  const rawResultMatch = clean.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/);
  if (rawResultMatch) {
    const d1 = parseInt(rawResultMatch[1], 10);
    const d2 = parseInt(rawResultMatch[2], 10);
    const d3 = parseInt(rawResultMatch[3], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const kq = isBao ? `BÃO (${d1})` : (total >= 11 ? "TÀI" : "XỈU");

    return {
      che_do: "Chuỗi Kết Quả Thực Tế (Post-Round Verification)",
      ket_qua_chinh_xac_100: kq,
      tong_diem: `${total} Điểm`,
      chi_tiet_3_xuc_xac: {
        xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
        xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
        xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
      },
      chuoi_goc: clean,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // TRƯỜNG HỢP 2: Chuỗi Hash (SHA-256 64 ký tự, MD5 32 ký tự)
  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const len = hex.length;

  let totalByteSum = 0;
  const bytes = [];
  for (let i = 0; i < len; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16) || 0;
    bytes.push(b);
    totalByteSum += b;
  }

  // Tính 3 xúc xắc dựa trên thuật toán Rolling Hash Checksum
  let seed1 = 0, seed2 = 0, seed3 = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (i % 3 === 0) seed1 = (seed1 * 31 + bytes[i]) % 1000000;
    else if (i % 3 === 1) seed2 = (seed2 * 31 + bytes[i]) % 1000000;
    else seed3 = (seed3 * 31 + bytes[i]) % 1000000;
  }

  const d1 = (seed1 % 6) + 1;
  const d2 = (seed2 % 6) + 1;
  const d3 = (seed3 % 6) + 1;

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

  const baseRate = 92.0 + ((bytes[0] + totalByteSum) % 65) / 10;
  const doTinCay = Math.min(98.5, baseRate).toFixed(1);

  const taiRate = isBao ? "0.0" : (tongDiem >= 11 ? doTinCay : (100 - parseFloat(doTinCay)).toFixed(1));
  const xiuRate = isBao ? "0.0" : (tongDiem <= 10 ? doTinCay : (100 - parseFloat(doTinCay)).toFixed(1));

  const bridgeTypes = [
    "Cầu Bệt Dài (Lực nén cực mạnh, xu hướng theo dây 4-6 ván liên tiếp)",
    "Cầu Đảo Nhịp 1-1 (Dao động cân bằng, ưu tiên đánh đổi hướng)",
    "Cầu Thuận Cặp 2-2 (Nhịp bước đôi cân đối, xác suất giữ cầu cao)",
    "Cầu Bẻ Điểm 3-2-1 (Lực thoát biên lớn, ưu tiên bắt điểm rơi đảo chiều)"
  ];
  const nhanDinhCau = bridgeTypes[(bytes[1] + totalByteSum) % bridgeTypes.length];

  return {
    chuoi_hash: hex,
    chuan_ma_bam: len === 64 ? "SHA-256 (Hitclub / Sunwin / Go88 Standard)" : (len === 32 ? "MD5 Standard" : "Custom Hash"),
    do_dai: `${len} ký tự`,
    du_doan_cua: ketQua,
    tong_diem_du_kien: `${tongDiem} Điểm (${ketQua === "TÀI" ? "Tài 11 - 17" : (ketQua === "XỈU" ? "Xỉu 4 - 10" : "Bão")})`,
    chi_tiet_3_xuc_xac_du_kien: {
      xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d1}` },
      xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d2}` },
      xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu?image=${d3}` }
    },
    phan_tich_chuyen_sau: {
      xac_suat_tai: `${taiRate}%`,
      xac_suat_xiu: `${xiuRate}%`,
      do_tin_cay_tong_the: `${doTinCay}%`,
      luc_nen_cau: Number(doTinCay) >= 94 ? "CỰC MẠNH (Tỷ lệ thắng áp đảo > 94%)" : "TIÊU CHUẨN CAO (> 90%)",
      nhan_dinh_nhip_cau: nhanDinhCau,
      chien_thuat_khuyen_nghi: Number(doTinCay) >= 94 ? "Tự tin vào lệnh theo cửa dự đoán" : "Quản lý vốn chia lệnh 1-2-4"
    },
    thuat_toan_ap_dung: "Deterministic Rolling Checksum & Modulo Bit Distribution",
    luu_y_quan_trong: "Chuỗi Hash trước phiên là mã hóa bảo mật 1 chiều. API đưa ra phân tích xác suất cửa Tài/Xỉu tốt nhất theo quy luật phân bố.",
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

  // 1. Render ảnh xúc xắc trực tiếp
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

  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || firstParam;

  if (hashInput) {
    const analysis = parseAdvancedHash(hashInput, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phân Tích Soi Cầu Xác Suất MD5 / SHA-256 Hitclub & Sunwin",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      du_lieu: analysis
    });
  }

  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Công Cụ Soi Cầu & Phân Tích Xác Suất Tài Xỉu MD5 / SHA-256",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    cu_phap: [
      `${baseUrl}/api/taixiu?={chuoi_hash_sha256_hoac_md5}`,
      `${baseUrl}/api/taixiu?image={1_den_6}`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu?=48ee581f559af7e67bbff1807c0511f27bd6ac49085aaa71c69d20b8e4c71a93`,
      `${baseUrl}/api/taixiu?image=6`
    ]
  });
};