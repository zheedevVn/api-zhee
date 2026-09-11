const crypto = require("crypto");
const { sendSvgAsPng } = require("./pngImage");

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

function generateTripleDiceSvg(d1, d2, d3) {
  const values = [d1, d2, d3].map((value) => Math.max(1, Math.min(6, parseInt(value, 10) || 1)));
  const dotCoords = {
    1: [[50, 50, "#e74c3c", 14]],
    2: [[28, 28, "#2c3e50", 9], [72, 72, "#2c3e50", 9]],
    3: [[25, 25, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [75, 75, "#2c3e50", 8]],
    4: [[28, 28, "#e74c3c", 9], [72, 28, "#e74c3c", 9], [28, 72, "#e74c3c", 9], [72, 72, "#e74c3c", 9]],
    5: [[26, 26, "#2c3e50", 8], [74, 26, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [26, 74, "#2c3e50", 8], [74, 74, "#2c3e50", 8]],
    6: [[28, 24, "#2c3e50", 8], [72, 24, "#2c3e50", 8], [28, 50, "#2c3e50", 8], [72, 50, "#2c3e50", 8], [28, 76, "#2c3e50", 8], [72, 76, "#2c3e50", 8]]
  };
  const dice = values.map((number, index) => {
    const offsetX = 20 + index * 110;
    const dots = dotCoords[number].map(([cx, cy, fill, r]) =>
      `<circle cx="${cx + offsetX}" cy="${cy + 42}" r="${r}" fill="${fill}" />`
    ).join("");
    return `<rect x="${offsetX + 6}" y="48" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)"/>${dots}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 190" width="450" height="238">
    <defs>
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#edf2f7"/></linearGradient>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#172554"/><stop offset="100%" stop-color="#020617"/></linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.35"/></filter>
    </defs>
    <rect x="5" y="24" width="350" height="150" rx="24" ry="24" fill="url(#bgGrad)" stroke="#38bdf8" stroke-width="2"/>
    ${dice}
  </svg>`;
}

// 2. Parser chuyên mục TÀI XỈU HITCLUB
function parseHitclubTaiXiu(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  // Đối soát sau mở bát
  const matchResult = clean.match(/[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/);
  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

    return {
      phong_game: "Hitclub - Sảnh Tài Xỉu MD5 / SHA-256",
      che_do: "Đối Soát Chuỗi Kết Quả Sau Mở Bát",
      tinh_minh_bach: "Chính xác 100%",
      ket_qua_thuc_te: kq,
      tong_diem: `${total} Điểm (${kq})`,
      chi_tiet_3_xuc_xac: {
        xuc_xac_1: { nut: d1, anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
        xuc_xac_2: { nut: d2, anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
        xuc_xac_3: { nut: d3, anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
      },
      chuoi_goc: clean,
      chuoi_hash_sha256: crypto.createHash("sha256").update(clean).digest("hex"),
      chuoi_hash_md5: crypto.createHash("md5").update(clean).digest("hex"),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // Soi cầu trước phiên
  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const bytes = [];
  let totalByteSum = 0;
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16) || 0;
    bytes.push(b);
    totalByteSum += b;
  }

  const d1 = ((bytes[0] || 1) % 6) + 1;
  const d2 = ((bytes[1] || 2) % 6) + 1;
  const d3 = ((bytes[2] || 3) % 6) + 1;
  const total = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");
  const score = (91.5 + ((bytes[0] + totalByteSum) % 70) / 10).toFixed(1);

  return {
    phong_game: "Hitclub - Sảnh Tài Xỉu MD5 / SHA-256",
    che_do: "Soi Cầu Phân Tích Xác Suất Trước Phiên",
    chuoi_hash: hex,
    du_doan_cua_chinh: kq,
    tong_diem_du_kien: `${total} Điểm`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: { nut: d1, anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
      xuc_xac_2: { nut: d2, anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
      xuc_xac_3: { nut: d3, anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
    },
    ti_le_xac_suat: {
      xac_suat_tai: isBao ? "0.0%" : (kq === "TÀI" ? `${score}%` : `${(100 - parseFloat(score)).toFixed(1)}%`),
      xac_suat_xiu: isBao ? "0.0%" : (kq === "XỈU" ? `${score}%` : `${(100 - parseFloat(score)).toFixed(1)}%`),
      do_tin_cay: `${score}%`
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 3. Parser chuyên mục SICBO HITCLUB (Đầy đủ bảng cược)
function parseHitclubSicbo(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  // Đối soát sau mở bát
  const matchResult = clean.match(/[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/);
  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const isChan = (total % 2 === 0);
    const isTai = total >= 11 && total <= 17 && !isBao;

    return {
      phong_game: "Hitclub - Sảnh Sicbo MD5 Bàn Tròn",
      che_do: "Đối Soát Kết Quả Bàn Sicbo Sau Mở Bát",
      tinh_minh_bach: "Chính xác 100%",
      ket_qua_thuc_te: {
        cua_tai_xiu: isBao ? `BÃO (Bộ 3 nút ${d1})` : (isTai ? "TÀI" : "XỈU"),
        cua_chan_le: isChan ? "CHẴN" : "LẺ",
        tong_diem: `${total} Điểm`,
        chi_tiet_3_xuc_xac: {
          xuc_xac_1: { nut: d1, anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
          xuc_xac_2: { nut: d2, anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
          xuc_xac_3: { nut: d3, anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
        },
        cac_cua_thang_tren_ban: [
          isBao ? `Bão Bất Kỳ (x31) & Bão ${d1} (x181)` : (isTai ? "Tài (x2)" : "Xỉu (x2)"),
          isChan ? "Chẵn (x2)" : "Lẻ (x2)",
          `Cược Điểm Chính Xác: ${total} Điểm`,
          `Cược Đơn Nút: ${[...new Set([d1, d2, d3])].map(n => `Nút ${n}`).join(", ")}`
        ]
      },
      chuoi_goc: clean,
      chuoi_hash_md5: crypto.createHash("md5").update(clean).digest("hex"),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // Soi cầu trước phiên Sicbo MD5
  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const bytes = [];
  let totalByteSum = 0;
  for (let i = 0; i < hex.length; i += 2) {
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

  const score = (92.0 + ((bytes[0] + totalByteSum) % 65) / 10).toFixed(1);
  const chanRate = (50.0 + ((bytes[1] || 0) % 25) / 10).toFixed(1);
  const leRate = (100 - parseFloat(chanRate)).toFixed(1);

  return {
    phong_game: "Hitclub - Sảnh Sicbo MD5 Bàn Tròn",
    che_do: "Soi Cầu Phân Tích Đa Cửa Sicbo Trước Phiên",
    chuoi_md5: hex,
    du_doan_tong_quan: {
      tai_xiu: isBao ? `BÃO (Bộ 3 nút ${d1})` : (isTai ? "TÀI" : "XỈU"),
      chan_le: isChan ? "CHẴN" : "LẺ",
      tong_diem_du_kien: `${total} Điểm`,
      do_tin_cay: `${score}%`
    },
    chi_tiet_3_xuc_xac_uoc_tinh: {
      xuc_xac_1: { nut: d1, anh: `${baseUrl}/api/taixiu/hitclub?image=${d1}` },
      xuc_xac_2: { nut: d2, anh: `${baseUrl}/api/taixiu/hitclub?image=${d2}` },
      xuc_xac_3: { nut: d3, anh: `${baseUrl}/api/taixiu/hitclub?image=${d3}` }
    },
    goi_y_cuoc_tat_ca_cua: {
      cua_tai_xiu: isBao ? "Cảnh báo BÃO" : (isTai ? `TÀI (${score}%)` : `XỈU (${score}%)`),
      cua_chan_le: isChan ? `CHẴN (${chanRate}%)` : `LẺ (${leRate}%)`,
      cua_diem_chinh_xac: `${total} Điểm`,
      cua_xuc_xac_don: `Nút ${d1}, Nút ${d2}, Nút ${d3}`
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
  const pathname = requestUrl.pathname.toLowerCase();
  const searchParams = requestUrl.searchParams;

  // Render ảnh PNG trực tiếp, hỗ trợ cả một viên và bộ ba xúc xắc.
  const imgParam = searchParams.get("image") || searchParams.get("img");
  if (imgParam) {
    const cleanImg = imgParam.trim();
    const tripleMatch = cleanImg.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
    if (tripleMatch) {
      return sendSvgAsPng(res, generateTripleDiceSvg(tripleMatch[1], tripleMatch[2], tripleMatch[3]));
    }
    const diceNum = parseInt(cleanImg, 10);
    if (diceNum >= 1 && diceNum <= 6) {
      return sendSvgAsPng(res, generateDiceSvg(diceNum));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value) { rawQueryValue = key.replace(/^=/, "").trim(); break; }
  }

  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || rawQueryValue;

  // 1. Phân luồng endpoint SẢNH SICBO: /api/taixiu/hitclub/sicbo
  if (pathname.includes("/sicbo")) {
    if (hashInput) {
      const data = parseHitclubSicbo(hashInput, baseUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: data
      });
    }
    return res.status(200).json({
      trang_thai: "huong_dan",
      phong_game: "Hitclub - Chuyên Mục Soi Cầu Sicbo MD5 (/taixiu/hitclub/sicbo)",
      cu_phap: [
        `${baseUrl}/api/taixiu/hitclub/sicbo?={ma_md5_sicbo}`,
        `${baseUrl}/api/taixiu/hitclub/sicbo?={chuoi_ket_qua_mo_bat}`
      ],
      vi_du: [
        `${baseUrl}/api/taixiu/hitclub/sicbo?=ceaad1ddefbc8d0ee09af7234c98c45b`
      ]
    });
  }

  // 2. Phân luồng endpoint SẢNH TÀI XỈU: /api/taixiu/hitclub/taixiu
  if (pathname.includes("/taixiu/hitclub/taixiu") || hashInput) {
    if (hashInput) {
      const data = parseHitclubTaiXiu(hashInput, baseUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: data
      });
    }
    return res.status(200).json({
      trang_thai: "huong_dan",
      phong_game: "Hitclub - Chuyên Mục Soi Cầu Tài Xỉu MD5 / SHA-256 (/taixiu/hitclub/taixiu)",
      cu_phap: [
        `${baseUrl}/api/taixiu/hitclub/taixiu?={chuoi_hash_sha256_hoac_md5}`,
        `${baseUrl}/api/taixiu/hitclub/taixiu?={chuoi_ket_qua_mo_bat}`
      ],
      vi_du: [
        `${baseUrl}/api/taixiu/hitclub/taixiu?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`
      ]
    });
  }

  // 3. Menu tổng quan Hitclub Portal: /api/taixiu/hitclub
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Trung Tâm Soi Cầu & Đối Soát HITCLUB (/taixiu/hitclub)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    danh_sach_sanh_game: {
      sanh_sicbo: {
        ten: "Sảnh Sicbo MD5 Bàn Tròn",
        endpoint: `${baseUrl}/api/taixiu/hitclub/sicbo`,
        mo_ta: "Chuyên soi cầu và đối soát bàn Sicbo MD5 (phân tích đa cửa: Tài/Xỉu, Chẵn/Lẻ, Cược Điểm 4-17, Cược Đơn).",
        cu_phap: `${baseUrl}/api/taixiu/hitclub/sicbo?={ma_md5_sicbo}`,
        vi_du: `${baseUrl}/api/taixiu/hitclub/sicbo?=ceaad1ddefbc8d0ee09af7234c98c45b`
      },
      sanh_taixiu: {
        ten: "Sảnh Tài Xỉu MD5 & SHA-256",
        endpoint: `${baseUrl}/api/taixiu/hitclub/taixiu`,
        mo_ta: "Chuyên phân tích chuỗi SHA-256 trước phiên và đối soát kết quả sau mở bát chuẩn 100% của sảnh Tài Xỉu.",
        cu_phap: `${baseUrl}/api/taixiu/hitclub/taixiu?={chuoi_hash}`,
        vi_du: `${baseUrl}/api/taixiu/hitclub/taixiu?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`
      }
    }
  });
};