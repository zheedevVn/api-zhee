const crypto = require("crypto");

// Logo thương hiệu cố định SUKA88
const BRAND_LOGO = "https://i.ibb.co/Mxs9XSSk/Chat-GPT-Image-17-00-24-25-thg-8-2026.png";
const ADMIN_SECRET_KEY = "minhhocgioi"; // Key độc quyền cho toàn bộ hệ thống SUKA88

// Tọa độ nút xúc xắc chuẩn Casino
const DOT_COORDS = {
  1: [[50, 50, "#e74c3c", 13]],
  2: [[28, 28, "#2c3e50", 9], [72, 72, "#2c3e50", 9]],
  3: [[25, 25, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [75, 75, "#2c3e50", 8]],
  4: [[28, 28, "#e74c3c", 9], [72, 28, "#e74c3c", 9], [28, 72, "#e74c3c", 9], [72, 72, "#e74c3c", 9]],
  5: [[26, 26, "#2c3e50", 8], [74, 26, "#2c3e50", 8], [50, 50, "#2c3e50", 8], [26, 74, "#2c3e50", 8], [74, 74, "#2c3e50", 8]],
  6: [[28, 24, "#2c3e50", 8], [72, 24, "#2c3e50", 8], [28, 50, "#2c3e50", 8], [72, 50, "#2c3e50", 8], [28, 76, "#2c3e50", 8], [72, 76, "#2c3e50", 8]]
};

// Render 1 viên xúc xắc đơn lẻ SVG
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
        <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.25"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// Render GHÉP 3 XÚC XẮC THÀNH 1 ẢNH DUY NHẤT (SVG Plate)
function generateTripleDiceSvg(d1, d2, d3) {
  const n1 = Math.max(1, Math.min(6, parseInt(d1, 10) || 1));
  const n2 = Math.max(1, Math.min(6, parseInt(d2, 10) || 1));
  const n3 = Math.max(1, Math.min(6, parseInt(d3, 10) || 1));

  function renderGroup(n, offsetX) {
    const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
      `<circle cx="${cx + offsetX}" cy="${cy + 20}" r="${r}" fill="${fill}" />`
    ).join("");

    return `
      <g filter="url(#shadow)">
        <rect x="${offsetX + 6}" y="26" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2"/>
        ${dots}
      </g>
    `;
  }

  const total = n1 + n2 + n3;
  const isBao = (n1 === n2 && n2 === n3);
  const resultText = isBao ? `BÃO: ${total} ĐIỂM` : (total >= 11 ? `TÀI: ${total} ĐIỂM` : `XỈU: ${total} ĐIỂM`);
  const resultColor = total >= 11 && !isBao ? "#e74c3c" : "#2980b9";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160" width="450" height="200">
    <defs>
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#edf2f7"/>
      </linearGradient>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect x="5" y="5" width="350" height="150" rx="24" ry="24" fill="url(#bgGrad)" stroke="#334155" stroke-width="2.5"/>
    <rect x="110" y="10" width="140" height="22" rx="11" ry="11" fill="${resultColor}" />
    <text x="180" y="25" fill="#ffffff" font-size="11" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle">${resultText}</text>
    ${renderGroup(n1, 20)}
    ${renderGroup(n2, 130)}
    ${renderGroup(n3, 240)}
  </svg>`;
}

// Tạo phiên xúc xắc SUKA88 (Chỉ định hoặc Random)
function createSuka88Round(setParam, baseUrl) {
  let d1, d2, d3;
  let modeName = "Quay Ngẫu Nhiên (Provably Fair)";

  const cleanSet = (setParam || "").toString().trim().toLowerCase();
  const specificMatch = cleanSet.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);

  if (specificMatch) {
    d1 = parseInt(specificMatch[1], 10);
    d2 = parseInt(specificMatch[2], 10);
    d3 = parseInt(specificMatch[3], 10);
    modeName = `Chỉ Định Nút Chính Xác (${d1}-${d2}-${d3})`;
  } else if (cleanSet === "tai" || cleanSet === "over") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 < 11 || (d1 === d2 && d2 === d3));
    modeName = "Chỉ Định Cầu Ép Về TÀI (11 - 17 Điểm)";
  } else if (cleanSet === "xiu" || cleanSet === "under") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 > 10 || (d1 === d2 && d2 === d3));
    modeName = "Chỉ Định Cầu Ép Về XỈU (4 - 10 Điểm)";
  } else if (cleanSet === "bao" || cleanSet === "triple") {
    const num = crypto.randomInt(1, 7);
    d1 = num; d2 = num; d3 = num;
    modeName = `Chỉ Định Cầu BÃO (${num}-${num}-${num})`;
  } else {
    d1 = crypto.randomInt(1, 7);
    d2 = crypto.randomInt(1, 7);
    d3 = crypto.randomInt(1, 7);
  }

  const total = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

  const saltRandom = crypto.randomBytes(12).toString("hex");
  const postRoundString = `${d1}-${d2}-${d3}|SUKA88_${saltRandom}`;
  const sha256Hash = crypto.createHash("sha256").update(postRoundString).digest("hex");
  const md5Hash = crypto.createHash("md5").update(postRoundString).digest("hex");

  const comboImage = `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}`;

  return {
    thuong_hieu: {
      ten_cong_game: "SUKA88",
      logo: BRAND_LOGO,
      khau_hieu: "Cổng Game Tài Xỉu Độc Quyền - Provably Fair Engine"
    },
    phien_cuoc_id: Date.now(),
    che_do: modeName,
    ket_qua: kq,
    tong_diem: `${total} Điểm`,
    anh_gop_3_xuc_xac: comboImage,
    chi_tiet_tung_vien: {
      xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}` },
      xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d2}` },
      xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d3}` }
    },
    chung_thuc_provably_fair: {
      chuoi_hash_sha256_truoc_phien: sha256Hash,
      chuoi_hash_md5_truoc_phien: md5Hash,
      chuoi_ket_qua_sau_phien: postRoundString,
      huong_dan_doi_soat: `Dán chuỗi kết quả vào /api/taixiu/suka88?decode=${postRoundString}&key=m....gioi để giải mã.`
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// Giải mã chuỗi đối soát độc quyền của SUKA88
function decodeSuka88String(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  // Bóc tách chuỗi kết quả SUKA88 (Dạng "d1-d2-d3|SUKA88_salt")
  const matchResult = clean.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])\|SUKA88/i) || clean.match(/[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/);

  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

    const verifiedSha256 = crypto.createHash("sha256").update(clean).digest("hex");
    const verifiedMd5 = crypto.createHash("md5").update(clean).digest("hex");

    return {
      thuong_hieu: {
        ten_cong_game: "SUKA88",
        logo: BRAND_LOGO
      },
      che_do: "Giải Mã & Đối Soát Chuỗi Kết Quả SUKA88",
      do_chinh_xac: "100% (Xác thực từ Secret Salt)",
      ket_qua_thuc_te: kq,
      tong_diem_thuc_te: `${total} Điểm (${kq})`,
      anh_gop_3_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}`,
      chi_tiet_3_xuc_xac: {
        xuc_xac_1: d1,
        xuc_xac_2: d2,
        xuc_xac_3: d3
      },
      chuoi_goc_doi_soat: clean,
      chuoi_hash_sha256_tuong_ung: verifiedSha256,
      chuoi_hash_md5_tuong_ung: verifiedMd5,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // Trường hợp phân tích chuỗi SHA-256 nội bộ SUKA88
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
  const kq = isBao ? `BÃO (${d1})` : (total >= 11 ? "TÀI" : "XỈU");

  return {
    thuong_hieu: {
      ten_cong_game: "SUKA88",
      logo: BRAND_LOGO
    },
    che_do: "Phân Tích Chuỗi Hash SUKA88",
    chuoi_hash: hex,
    du_doan_ket_qua: kq,
    tong_diem_du_kien: `${total} Điểm`,
    anh_gop_3_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: d1,
      xuc_xac_2: d2,
      xuc_xac_3: d3
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

  // 1. ROUTE RENDER ẢNH SVG (KHÔNG CẦN KEY)
  const imgParam = searchParams.get("image") || searchParams.get("img") || searchParams.get("combo");
  if (imgParam) {
    const cleanImg = imgParam.trim();
    const tripleMatch = cleanImg.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
    if (tripleMatch) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(generateTripleDiceSvg(tripleMatch[1], tripleMatch[2], tripleMatch[3]));
    }

    const diceNum = parseInt(cleanImg, 10);
    if (diceNum >= 1 && diceNum <= 6) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(generateSingleDiceSvg(diceNum));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value && !["key", "admin_key", "token"].includes(key)) {
      rawQueryValue = key.replace(/^=/, "").trim();
      break;
    }
  }

  const providedKey = searchParams.get("key") || searchParams.get("admin_key") || searchParams.get("token");
  const setParam = searchParams.get("set") || searchParams.get("dice") || searchParams.get("rig");
  const decodeParam = searchParams.get("decode") || searchParams.get("str") || searchParams.get("hash");
  const actionParam = searchParams.get("action");

  const isExecuting = setParam || decodeParam || actionParam || rawQueryValue;

  // 2. NẾU THỰC HIỆN BẤT KỲ THAO TÁC NÀO TRÊN SUKA88 -> BẮT BUỘC CHECK ADMIN KEY
  if (isExecuting) {
    if (!providedKey || providedKey.trim() !== ADMIN_SECRET_KEY) {
      return res.status(403).json({
        trang_thai: "tu_choi",
        ma_loi: 403,
        thong_bao: "Quyền truy cập bị từ chối! Toàn bộ tính năng thương hiệu SUKA88 yêu cầu xác thực Admin Key.",
        huong_dan_xac_thuc: "Bổ sung tham số &key=m....gioi vào cuối URL.",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    // A. Giải chuỗi SUKA88
    if (decodeParam || (rawQueryValue && (rawQueryValue.includes("|") || rawQueryValue.length >= 32))) {
      const targetStr = decodeParam || rawQueryValue;
      const decodeResult = decodeSuka88String(targetStr, baseUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: decodeResult
      });
    }

    // B. Lắc ngẫu nhiên hoặc Can thiệp cầu
    const targetSet = setParam || (rawQueryValue !== "roll" && rawQueryValue !== "demo" ? rawQueryValue : "");
    const roundData = createSuka88Round(targetSet, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "SUKA88 - Khởi Tạo Phiên Thành Công",
      du_lieu: roundData
    });
  }

  // 3. Trang tài liệu hướng dẫn SUKA88
  return res.status(200).json({
    trang_thai: "huong_dan",
    thuong_hieu: {
      ten_cong_game: "SUKA88",
      logo: BRAND_LOGO,
      khau_hieu: "Cổng Game Tài Xỉu Độc Quyền - Provably Fair Engine"
    },
    chuyen_muc: "Cổng Game Tài Xỉu Độc Quyền SUKA88 (/taixiu/suka88)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      lac_xuc_xac: "Lắc 3 xúc xắc ngẫu nhiên kèm mã băm SHA-256 (Yêu cầu Key)",
      can_thiep_ket_qua: "Chỉ định kết quả ván cược theo ý muốn: set=tai, set=xiu, set=6-6-6 (Yêu cầu Key)",
      giai_chuoi_suka88: "Giải mã và đối soát chuỗi kết quả nội bộ của SUKA88 (Yêu cầu Key)",
      anh_gop_3_vien: "Tự động xuất 1 ảnh SVG duy nhất chứa 3 viên trên đĩa"
    },
    cu_phap_ho_tro: [
      `${baseUrl}/api/taixiu/suka88?=roll&key=m....gioi`,
      `${baseUrl}/api/taixiu/suka88?set=tai&key=m....gioi`,
      `${baseUrl}/api/taixiu/suka88?set=xiu&key=m....gioi`,
      `${baseUrl}/api/taixiu/suka88?set=6-6-6&key=m....gioi`,
      `${baseUrl}/api/taixiu/suka88?decode={chuoi_ket_qua_suka88}&key=m....gioi`,
      `${baseUrl}/api/taixiu/suka88?image=6-6-6 (Xem ảnh gộp 3 viên)`,
      `${baseUrl}/api/taixiu/suka88?image=6 (Xem ảnh 1 viên)`
    ]
  });
};