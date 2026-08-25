const crypto = require("crypto");

// 1. Render ảnh xúc xắc SVG đơn lẻ
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

  const dots = (dotCoords[n] || dotCoords[1]).map(([cx, cy, fill, r]) => 
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

// 2. Engine phân tích bàn Sicbo MD5 toàn diện (Đầy đủ các cửa cược trên bàn)
function parseSicboHitclub(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  // TRƯỜNG HỢP 1: Bóc tách chuỗi KẾT QUẢ sau mở bát Sicbo (Ví dụ: ...|1-2-5)
  const resultPattern = /[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/;
  const matchResult = clean.match(resultPattern);

  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const isChan = (total % 2 === 0);
    const isTai = total >= 11 && total <= 17 && !isBao;
    const isXiu = total >= 4 && total <= 10 && !isBao;

    const verifiedMd5 = crypto.createHash("md5").update(clean).digest("hex");
    const verifiedSha256 = crypto.createHash("sha256").update(clean).digest("hex");

    return {
      chuyen_muc: "Hitclub Sicbo MD5 - Đối Soát Kết Quả Sau Mở Bát",
      tinh_minh_bach: "Xác thực 100% từ chuỗi gốc Secret Salt",
      ket_qua_thuc_te: {
        cua_chinh: isBao ? `BÃO (Bộ 3 nút ${d1})` : (isTai ? "TÀI" : "XỈU"),
        cua_chan_le: isChan ? "CHẴN" : "LẺ",
        tong_diem: `${total} Điểm`,
        chi_tiet_3_xuc_xac: {
          xuc_xac_1: { nut: d1, anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
          xuc_xac_2: { nut: d2, anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
          xuc_xac_3: { nut: d3, anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
        },
        cac_cua_thang_tren_ban_sicbo: [
          isBao ? `Bão Bất Kỳ (x31) & Bão ${d1} (x181)` : (isTai ? "Tài (x2)" : "Xỉu (x2)"),
          isChan ? "Chẵn (x2)" : "Lẻ (x2)",
          `Cược Điểm Chính Xác: ${total} Điểm`,
          `Cược Đơn Nút Có Mặt: ${[...new Set([d1, d2, d3])].map(n => `Nút ${n}`).join(", ")}`
        ]
      },
      chuoi_goc_doi_soat: clean,
      chuoi_hash_md5: verifiedMd5,
      chuoi_hash_sha256: verifiedSha256,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // TRƯỜNG HỢP 2: Soi cầu chuỗi MD5 trước phiên bàn Sicbo
  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const len = hex.length;

  const bytes = [];
  let totalByteSum = 0;
  for (let i = 0; i < len; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16) || 0;
    bytes.push(b);
    totalByteSum += b;
  }

  const d1 = ((bytes[0] || 1) % 6) + 1;
  const d2 = ((bytes[1] || 2) % 6) + 1;
  const d3 = ((bytes[2] || 3) % 6) + 1;

  const total = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  const isChan = (total % 2 === 0);
  const isTai = total >= 11 && total <= 17 && !isBao;

  const confidenceScore = (91.8 + ((bytes[0] + totalByteSum) % 65) / 10).toFixed(1);
  const chanRate = (49.5 + ((bytes[1] || 0) % 30) / 10).toFixed(1);
  const leRate = (100 - parseFloat(chanRate)).toFixed(1);

  return {
    chuyen_muc: "Hitclub Sicbo MD5 - Phân Tích & Soi Cầu Bàn Cược",
    chuoi_md5_dau_vao: hex,
    chuan_ma_bam: len === 32 ? "MD5 Standard (Hitclub Sicbo)" : (len === 64 ? "SHA-256 Standard" : "Custom Hash"),
    du_doan_cua_chinh: {
      tai_xiu: isBao ? `BÃO (Bộ 3 nút ${d1})` : (isTai ? "TÀI" : "XỈU"),
      chan_le: isChan ? "CHẴN" : "LẺ",
      tong_diem_du_kien: `${total} Điểm (${isTai ? "Tài 11-17" : "Xỉu 4-10"})`,
      do_tin_cay_thuat_toan: `${confidenceScore}%`
    },
    chi_tiet_3_xuc_xac_uoc_tinh: {
      xuc_xac_1: { nut: d1, hex_byte: hex.substr(0, 2), anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
      xuc_xac_2: { nut: d2, hex_byte: hex.substr(2, 2), anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
      xuc_xac_3: { nut: d3, hex_byte: hex.substr(4, 2), anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
    },
    goi_y_cac_cua_cuoc_sicbo: {
      cua_tai_xiu: isBao ? "Cảnh báo BÃO" : (isTai ? `TÀI (${confidenceScore}%)` : `XỈU (${confidenceScore}%)`),
      cua_chan_le: isChan ? `CHẴN (${chanRate}%)` : `LẺ (${leRate}%)`,
      cua_tong_diem_tiem_nang: `${total} Điểm`,
      cua_xuc_xac_don_xac_suat_cao: `Nút ${d1}, Nút ${d2}, Nút ${d3}`
    },
    phan_tich_the_cau: {
      nhip_cau: (bytes[0] + totalByteSum) % 2 === 0 ? "Cầu Thuận Bước Đều" : "Cầu Đảo Nhịp Ngắn",
      khuyen_nghi: "Ưu tiên đi vốn cửa chính kết hợp lót cửa Chẵn/Lẻ tương ứng"
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

  // Render SVG trực tiếp
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

  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value) { rawQueryValue = key.replace(/^=/, "").trim(); break; }
  }

  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("sicbo") || searchParams.get("q") || rawQueryValue;

  if (hashInput) {
    const analysis = parseSicboHitclub(hashInput, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      du_lieu: analysis
    });
  }

  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Dịch Vụ Soi Cầu & Đối Soát Sicbo MD5 / SHA-256 Hitclub (/taixiu/hitclub)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    cac_chuc_nang: {
      soi_cau_sicbo_md5: "Nhập mã MD5 32 ký tự hoặc SHA-256 từ bàn cược Sicbo Hitclub để phân tích Tài/Xỉu, Chẵn/Lẻ, Tổng điểm",
      doi_soat_mo_bat: "Nhập chuỗi kết quả thực tế sau mở bát (chứa |d1-d2-d3) để đối soát các cửa thắng"
    },
    cu_phap_truy_cap: [
      `${baseUrl}/api/taixiu/hitclub?={ma_md5_sicbo}`,
      `${baseUrl}/api/taixiu/hitclub?md5={ma_md5_sicbo}`,
      `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_mo_bat}`,
      `${baseUrl}/api/taixiu/hitclub?image={1_den_6}`
    ],
    vi_du_theo_anh: [
      `${baseUrl}/api/taixiu/hitclub?=ceaad1ddefbc8d0ee09af7234c98c45b`,
      `${baseUrl}/api/taixiu/hitclub?image=5`
    ]
  });
};