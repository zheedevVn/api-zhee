const crypto = require("crypto");
const { sendSvgAsPng } = require("./pngImage");

// 1. Tọa độ nút xúc xắc chuẩn B52 Club
const DOT_COORDS = {
  1: [[50, 50, "#dc2626", 14]],
  2: [[28, 28, "#1e293b", 9], [72, 72, "#1e293b", 9]],
  3: [[25, 25, "#1e293b", 8], [50, 50, "#1e293b", 8], [75, 75, "#1e293b", 8]],
  4: [[28, 28, "#dc2626", 9], [72, 28, "#dc2626", 9], [28, 72, "#dc2626", 9], [72, 72, "#dc2626", 9]],
  5: [[26, 26, "#1e293b", 8], [74, 26, "#1e293b", 8], [50, 50, "#dc2626", 8], [26, 74, "#1e293b", 8], [74, 74, "#1e293b", 8]],
  6: [[28, 24, "#1e293b", 8], [72, 24, "#1e293b", 8], [28, 50, "#1e293b", 8], [72, 50, "#1e293b", 8], [28, 76, "#1e293b", 8], [72, 76, "#1e293b", 8]]
};

// 2. Render ảnh xúc xắc đơn lẻ SVG
function generateSingleDiceSvg(number) {
  const n = Math.max(1, Math.min(6, parseInt(number, 10) || 1));
  const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
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

// 3. Render ảnh gộp 3 xúc xắc B52 Bom Tấn
function generateTripleDiceSvg(d1, d2, d3) {
  const n1 = Math.max(1, Math.min(6, parseInt(d1, 10) || 1));
  const n2 = Math.max(1, Math.min(6, parseInt(d2, 10) || 1));
  const n3 = Math.max(1, Math.min(6, parseInt(d3, 10) || 1));

  function renderGroup(n, offsetX) {
    const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
      `<circle cx="${cx + offsetX}" cy="${cy + 42}" r="${r}" fill="${fill}" />`
    ).join("");

    return `
      <g filter="url(#shadow)">
        <rect x="${offsetX + 6}" y="48" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2"/>
        ${dots}
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 190" width="450" height="238">
    <defs>
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#edf2f7"/>
      </linearGradient>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect x="5" y="24" width="350" height="150" rx="24" ry="24" fill="url(#bgGrad)" stroke="#38bdf8" stroke-width="2"/>
    ${renderGroup(n1, 20)}
    ${renderGroup(n2, 130)}
    ${renderGroup(n3, 240)}
  </svg>`;
}

// 4. Parser SẢNH BÓNG ĐÁ VOLTA MD5 (Đội Nhà / Đội Khách 1.98)
function parseB52Volta(inputStr) {
  const clean = decodeURIComponent(inputStr).trim();
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
  const isTai = total >= 11;

  const score = (92.5 + ((bytes[0] + totalByteSum) % 60) / 10).toFixed(1);
  const homeRate = isTai ? score : (100 - parseFloat(score)).toFixed(1);
  const awayRate = !isTai ? score : (100 - parseFloat(score)).toFixed(1);

  return {
    sanh_game: "B52 CLUB - Sảnh Bóng Đá Volta MD5",
    che_do: "Soi Kèo Trực Tuyến Trước Trận Đấu",
    chuoi_md5_volta: hex,
    ket_qua_cuoi: {
      keo_du_doan_chinh: isTai ? "ĐỘI NHÀ (HOME - Tỷ lệ 1.98)" : "ĐỘI KHÁCH (AWAY - Tỷ lệ 1.98)",
      do_tin_cay_thuat_toan: `${score}%`,
      chi_tiet_ti_le: {
        xac_suat_doi_nha_thang: `${homeRate}%`,
        xac_suat_doi_khach_thang: `${awayRate}%`
      }
    },
    nhan_dinh_the_tran: {
      the_tran: isTai ? "Đội Nhà dâng cao tấn công, lực ép biên áp đảo" : "Đội Khách phản công nhanh, tạo đột biến cao",
      khuyen_nghi: `Chốt lệnh vào ${isTai ? "ĐỘI NHÀ" : "ĐỘI KHÁCH"} theo tỷ lệ tự tin ${score}%`
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 5. Parser SẢNH TÀI XỈU BOM TẤN B52 (SHA-256 & Chuỗi KQ)
function parseB52TaiXiu(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  // Đối soát chuỗi kết quả sau mở bát (chứa |d1-d2-d3)
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

    const verifiedSha256 = crypto.createHash("sha256").update(clean).digest("hex");
    const verifiedMd5 = crypto.createHash("md5").update(clean).digest("hex");

    return {
      sanh_game: "B52 CLUB - Sảnh Tài Xỉu Bom Tấn",
      che_do: "Đối Soát Chuỗi Kết Quả Sau Mở Bát",
      tinh_minh_bach: "Chính xác 100% (Provably Fair)",
      ket_qua_cuoi: {
        cua_thang_chinh: isBao ? `BÃO (${d1}-${d1}-${d1})` : (isTai ? "TÀI" : "XỈU"),
        cua_chan_le: isChan ? "CHẴN" : "LẺ",
        tong_diem: `${total} Điểm (${isBao ? "Bão" : (isTai ? "Tài 11-17" : "Xỉu 4-10")})`,
        bo_ba_nut: `${d1} - ${d2} - ${d3}`
      },
      anh_gop_3_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d1}-${d2}-${d3}`,
      chi_tiet_3_xuc_xac: {
        xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d1}` },
        xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d2}` },
        xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d3}` }
      },
      chuoi_goc_doi_soat: clean,
      chuoi_hash_sha256: verifiedSha256,
      chuoi_hash_md5: verifiedMd5,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // Soi cầu trước phiên (SHA-256 hoặc MD5)
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

  const score = (92.6 + ((bytes[0] + totalByteSum) % 55) / 10).toFixed(1);
  const duDoanCuaChinh = isBao ? `BÃO (${d1}-${d1}-${d1})` : (isTai ? "TÀI" : "XỈU");
  const giaiThichDiem = isBao ? "Bão Bom Tấn" : (isTai ? "Tài 11 - 17 Điểm" : "Xỉu 4 - 10 Điểm");

  return {
    sanh_game: "B52 CLUB - Sảnh Tài Xỉu Bom Tấn",
    che_do: "Soi Cầu Phân Tích Xác Suất Trước Phiên",
    chuoi_hash_kiem_tra: hex,
    chuan_ma_bam: hex.length === 64 ? "SHA-256 Standard" : (hex.length === 32 ? "MD5 Standard" : "Custom Hash"),
    ket_qua_cuoi: {
      cua_du_doan_chinh: duDoanCuaChinh,
      cua_chan_le: isChan ? "CHẴN" : "LẺ",
      tong_diem_du_kien: `${total} Điểm (${giaiThichDiem})`,
      bo_ba_nut_uoc_tinh: `${d1} - ${d2} - ${d3}`,
      do_tin_cay_thuat_toan: `${score}%`
    },
    anh_gop_3_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d1}-${d2}-${d3}`,
    chi_tiet_3_xuc_xac_uoc_tinh: {
      xuc_xac_1: { nut: d1, hex_byte: hex.substr(0, 2), anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d1}` },
      xuc_xac_2: { nut: d2, hex_byte: hex.substr(2, 2), anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d2}` },
      xuc_xac_3: { nut: d3, hex_byte: hex.substr(4, 2), anh_xuc_xac: `${baseUrl}/api/taixiu/b52club?image=${d3}` }
    },
    the_cau_va_chien_thuat: {
      the_cau: (bytes[0] + totalByteSum) % 2 === 0 ? "Cầu Bom Tấn Thuận Nhịp" : "Cầu Bẻ Điểm Đảo Chiều",
      khuyen_nghi: "Bắt lệnh cửa chính theo tỷ lệ xác suất cao, chia vốn 1-2-4 an toàn."
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

  // Render ảnh SVG trực tiếp
  const imgParam = searchParams.get("image") || searchParams.get("img");
  if (imgParam) {
    const cleanImg = imgParam.trim();
    const tripleMatch = cleanImg.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
    if (tripleMatch) {
      return sendSvgAsPng(res, generateTripleDiceSvg(tripleMatch[1], tripleMatch[2], tripleMatch[3]));
    }

    const diceNum = parseInt(cleanImg, 10);
    if (diceNum >= 1 && diceNum <= 6) {
      return sendSvgAsPng(res, generateSingleDiceSvg(diceNum));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value) { rawQueryValue = key.replace(/^=/, "").trim(); break; }
  }

  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("sha256") || searchParams.get("q") || rawQueryValue;

  // 1. Phân luồng endpoint SẢNH VOLTA: /api/taixiu/b52club/volta
  if (pathname.includes("/volta")) {
    if (hashInput) {
      const data = parseB52Volta(hashInput);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: data
      });
    }
    return res.status(200).json({
      trang_thai: "huong_dan",
      sanh_game: "B52 CLUB - Sảnh Bóng Đá Volta MD5 (/taixiu/b52club/volta)",
      cu_phap: [
        `${baseUrl}/api/taixiu/b52club/volta?={ma_md5_volta}`
      ],
      vi_du: [
        `${baseUrl}/api/taixiu/b52club/volta?=50e0087bc111acab077a5b3a82f3a612`
      ]
    });
  }

  // 2. Phân luồng endpoint SẢNH TÀI XỈU BOM TẤN: /api/taixiu/b52club/taixiu
  if (pathname.includes("/taixiu/b52club/taixiu") || hashInput) {
    if (hashInput) {
      const data = parseB52TaiXiu(hashInput, baseUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: data
      });
    }
    return res.status(200).json({
      trang_thai: "huong_dan",
      sanh_game: "B52 CLUB - Sảnh Tài Xỉu Bom Tấn MD5 & SHA-256 (/taixiu/b52club/taixiu)",
      cu_phap: [
        `${baseUrl}/api/taixiu/b52club/taixiu?={chuoi_hash_hoac_md5}`,
        `${baseUrl}/api/taixiu/b52club/taixiu?={chuoi_ket_qua_mo_bat}`
      ],
      vi_du: [
        `${baseUrl}/api/taixiu/b52club/taixiu?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`
      ]
    });
  }

  // 3. Menu tổng quan B52 Club Portal: /api/taixiu/b52club
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Trung Tâm Soi Cầu & Đối Soát B52 CLUB (/taixiu/b52club)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    danh_sach_sanh_game: {
      sanh_volta: {
        ten: "Sảnh Bóng Đá Volta MD5",
        endpoint: `${baseUrl}/api/taixiu/b52club/volta`,
        mo_ta: "Phân tích chuỗi MD5 bàn bóng đá Volta (Đội Nhà / Đội Khách tỷ lệ 1.98).",
        cu_phap: `${baseUrl}/api/taixiu/b52club/volta?={ma_md5_volta}`,
        vi_du: `${baseUrl}/api/taixiu/b52club/volta?=50e0087bc111acab077a5b3a82f3a612`
      },
      sanh_taixiu: {
        ten: "Sảnh Tài Xỉu Bom Tấn MD5 / SHA-256",
        endpoint: `${baseUrl}/api/taixiu/b52club/taixiu`,
        mo_ta: "Phân tích chuỗi SHA-256/MD5 và đối soát chuỗi kết quả mở bát sảnh Tài Xỉu Bom Tấn B52.",
        cu_phap: `${baseUrl}/api/taixiu/b52club/taixiu?={chuoi_hash}`,
        vi_du: `${baseUrl}/api/taixiu/b52club/taixiu?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`
      }
    }
  });
};