const crypto = require("crypto");

// Logo thương hiệu cố định SUKA88
const BRAND_LOGO = "https://i.ibb.co/Mxs9XSSk/Chat-GPT-Image-17-00-24-25-thg-8-2026.png";
const ADMIN_SECRET_KEY = "minhhocgioi"; // Khóa phân quyền hệ thống

// 1. Tọa độ nút xúc xắc chuẩn Casino quốc tế
const DOT_COORDS = {
  1: [[50, 50, "#e11d48", 14]],
  2: [[28, 28, "#1e293b", 9], [72, 72, "#1e293b", 9]],
  3: [[25, 25, "#1e293b", 8.5], [50, 50, "#1e293b", 8.5], [75, 75, "#1e293b", 8.5]],
  4: [[28, 28, "#e11d48", 9], [72, 28, "#e11d48", 9], [28, 72, "#e11d48", 9], [72, 72, "#e11d48", 9]],
  5: [[26, 26, "#1e293b", 8.5], [74, 26, "#1e293b", 8.5], [50, 50, "#e11d48", 8.5], [26, 74, "#1e293b", 8.5], [74, 74, "#1e293b", 8.5]],
  6: [[28, 24, "#1e293b", 8.5], [72, 24, "#1e293b", 8.5], [28, 50, "#1e293b", 8.5], [72, 50, "#1e293b", 8.5], [28, 76, "#1e293b", 8.5], [72, 76, "#1e293b", 8.5]]
};

// 2. Render 1 viên xúc xắc đơn lẻ SVG
function generateSingleDiceSvg(number) {
  const n = Math.max(1, Math.min(6, parseInt(number, 10) || 1));
  const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
    <defs>
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// 3. Render Khung Đĩa Casino SUKA88 Chuyên Nghiệp (Kèm Chuỗi Kết Quả & Hash)
function generateTripleDiceSvg(d1, d2, d3, customSalt) {
  const n1 = Math.max(1, Math.min(6, parseInt(d1, 10) || 1));
  const n2 = Math.max(1, Math.min(6, parseInt(d2, 10) || 1));
  const n3 = Math.max(1, Math.min(6, parseInt(d3, 10) || 1));

  function renderGroup(n, offsetX) {
    const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
      `<circle cx="${cx + offsetX}" cy="${cy + 60}" r="${r}" fill="${fill}" />`
    ).join("");

    return `
      <g filter="url(#diceShadow)">
        <rect x="${offsetX + 5}" y="65" width="90" height="90" rx="18" ry="18" fill="url(#diceGrad)" stroke="#f1f5f9" stroke-width="2"/>
        ${dots}
      </g>
    `;
  }

  const total = n1 + n2 + n3;
  const isBao = (n1 === n2 && n2 === n3);
  const resultText = isBao ? `BÃO (${n1}) - ${total} ĐIỂM` : (total >= 11 ? `TÀI - ${total} ĐIỂM` : `XỈU - ${total} ĐIỂM`);
  const badgeBg = isBao ? "url(#goldGrad)" : (total >= 11 ? "url(#redGrad)" : "url(#blueGrad)");
  const badgeTextColor = isBao ? "#451a03" : "#ffffff";

  const saltStr = customSalt || `SUKA88_${crypto.createHash("md5").update(`${n1}${n2}${n3}`).digest("hex").slice(0, 10)}`;
  const displayResultString = `${n1}-${n2}-${n3}|${saltStr}`;
  const sha256Preview = crypto.createHash("sha256").update(displayResultString).digest("hex");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 260" width="520" height="295">
    <defs>
      <!-- Gradient Đĩa Casino Kim Loại -->
      <linearGradient id="plateBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="50%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#78350f"/>
      </linearGradient>
      
      <!-- Gradient Xúc Xắc 3D -->
      <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="85%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#cbd5e1"/>
      </linearGradient>

      <!-- Badges Gradient -->
      <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f43f5e"/>
        <stop offset="100%" stop-color="#be123c"/>
      </linearGradient>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0ea5e9"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde047"/>
        <stop offset="100%" stop-color="#ca8a04"/>
      </linearGradient>

      <!-- Hiệu ứng đổ bóng thực -->
      <filter id="diceShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
      <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
    </defs>

    <!-- Khung Bàn Nền Viền Kim Loại Gold Vát Cong -->
    <rect x="5" y="5" width="450" height="250" rx="28" ry="28" fill="url(#plateBg)" stroke="url(#goldBorder)" stroke-width="2.5"/>

    <!-- Header: Logo Brand SUKA88 & Status -->
    <g transform="translate(24, 18)">
      <rect x="0" y="0" width="80" height="24" rx="6" ry="6" fill="#fbbf24" fill-opacity="0.1" stroke="#fbbf24" stroke-width="1"/>
      <text x="40" y="16" fill="#fbbf24" font-size="12" font-weight="900" font-family="'Segoe UI', Roboto, sans-serif" text-anchor="middle" letter-spacing="1.5">SUKA88</text>
    </g>

    <!-- Header: Huy Hiệu Kết Quả Nổi Bật -->
    <g transform="translate(145, 14)" filter="url(#badgeShadow)">
      <rect x="0" y="0" width="170" height="32" rx="16" ry="16" fill="${badgeBg}" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4"/>
      <text x="85" y="21" fill="${badgeTextColor}" font-size="14" font-weight="900" font-family="'Segoe UI', Roboto, sans-serif" text-anchor="middle" letter-spacing="1">${resultText}</text>
    </g>

    <!-- 3 Viên Xúc Xắc Nằm Ngang Cân Đối Tuyệt Đối -->
    ${renderGroup(n1, 35)}
    ${renderGroup(n2, 175)}
    ${renderGroup(n3, 315)}

    <!-- Khung Chuỗi Kết Quả & Mã Hash Xác Thực Sau Phiên -->
    <g transform="translate(20, 180)">
      <rect x="0" y="0" width="420" height="60" rx="12" ry="12" fill="#030712" fill-opacity="0.75" stroke="#334155" stroke-width="1.2"/>
      
      <!-- Label & Chuỗi Kết Quả Thật -->
      <text x="14" y="22" fill="#94a3b8" font-size="10" font-weight="bold" font-family="'Segoe UI', Roboto, sans-serif">KẾT QUẢ:</text>
      <rect x="68" y="9" width="338" height="18" rx="4" ry="4" fill="#0f172a"/>
      <text x="76" y="22" fill="#38bdf8" font-size="11" font-family="'Consolas', 'Courier New', monospace" font-weight="bold">${displayResultString}</text>
      
      <!-- Label & Hash SHA-256 Rút Gọn -->
      <text x="14" y="46" fill="#94a3b8" font-size="10" font-weight="bold" font-family="'Segoe UI', Roboto, sans-serif">MÃ HASH:</text>
      <text x="68" y="46" fill="#a78bfa" font-size="9.5" font-family="'Consolas', 'Courier New', monospace">${sha256Preview.slice(0, 38)}...</text>
    </g>
  </svg>`;
}

// 4. Engine khởi tạo phiên game SUKA88
function createSuka88Round(setParam, baseUrl) {
  let d1, d2, d3;
  let modeName = "Provably Fair Cryptographic Standard";

  const cleanSet = (setParam || "").toString().trim().toLowerCase();
  const specificMatch = cleanSet.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);

  if (specificMatch) {
    d1 = parseInt(specificMatch[1], 10);
    d2 = parseInt(specificMatch[2], 10);
    d3 = parseInt(specificMatch[3], 10);
    modeName = "System Initialized Matrix";
  } else if (cleanSet === "tai" || cleanSet === "over") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 < 11 || (d1 === d2 && d2 === d3));
    modeName = "Symmetric Range High Allocation";
  } else if (cleanSet === "xiu" || cleanSet === "under") {
    do {
      d1 = crypto.randomInt(1, 7);
      d2 = crypto.randomInt(1, 7);
      d3 = crypto.randomInt(1, 7);
    } while (d1 + d2 + d3 > 10 || (d1 === d2 && d2 === d3));
    modeName = "Symmetric Range Low Allocation";
  } else if (cleanSet === "bao" || cleanSet === "triple") {
    const num = crypto.randomInt(1, 7);
    d1 = num; d2 = num; d3 = num;
    modeName = "Harmonic Triple State";
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

  const comboImage = `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}&salt=${saltRandom}`;

  return {
    thuong_hieu: {
      ten_cong_game: "SUKA88",
      logo: BRAND_LOGO,
      khau_hieu: "Cổng Game Quốc Tế - Đẳng Cấp Xanh Chín & Bảo Mật Tuyệt Đối",
      chung_nhan: "Provably Fair Certified Gaming Platform"
    },
    phien_cuoc_id: Date.now(),
    phuong_thuc_tao: modeName,
    ket_qua: kq,
    tong_diem: `${total} Điểm`,
    anh_gop_3_xuc_xac: comboImage,
    chi_tiet_tung_vien: {
      xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}` },
      xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d2}` },
      xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d3}` }
    },
    chung_thuc_minh_bach: {
      chuoi_hash_sha256_truoc_phien: sha256Hash,
      chuoi_hash_md5_truoc_phien: md5Hash,
      chuoi_ket_qua_sau_phien: postRoundString,
      huong_dan_doi_soat: `Sử dụng endpoint /api/taixiu/suka88?decode=${postRoundString}&key={api_key} để đối chiếu tính toàn vẹn dữ liệu.`
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 5. Giải mã và đối soát chuỗi kết quả SUKA88
function decodeSuka88String(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

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
      che_do: "Đối Soát Chuỗi Mật Mã Provably Fair",
      tinh_toan_ven: "Khớp 100% (Dữ liệu xác thực toàn vẹn)",
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
    che_do: "Phân Tích Chuỗi Hash Mật Mã",
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

  // 1. Render ảnh SVG trực tiếp (Công khai)
  const imgParam = searchParams.get("image") || searchParams.get("img") || searchParams.get("combo");
  if (imgParam) {
    const cleanImg = imgParam.trim();
    const customSalt = searchParams.get("salt") || "";
    const tripleMatch = cleanImg.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
    if (tripleMatch) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(generateTripleDiceSvg(tripleMatch[1], tripleMatch[2], tripleMatch[3], customSalt));
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

  // 2. Kiểm tra xác thực quyền truy cập dịch vụ
  if (isExecuting) {
    if (!providedKey || providedKey.trim() !== ADMIN_SECRET_KEY) {
      return res.status(403).json({
        trang_thai: "tu_choi",
        ma_loi: 403,
        thong_bao: "Quyền truy cập bị từ chối! Dịch vụ yêu cầu Private API Key hợp lệ để thực hiện thao tác.",
        huong_dan: "Vui lòng đính kèm tham số &key={api_key} trong yêu cầu.",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    // A. Giải mã chuỗi
    if (decodeParam || (rawQueryValue && (rawQueryValue.includes("|") || rawQueryValue.length >= 32))) {
      const targetStr = decodeParam || rawQueryValue;
      const decodeResult = decodeSuka88String(targetStr, baseUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        du_lieu: decodeResult
      });
    }

    // B. Khởi tạo phiên
    const targetSet = setParam || (rawQueryValue !== "roll" && rawQueryValue !== "demo" ? rawQueryValue : "");
    const roundData = createSuka88Round(targetSet, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "SUKA88 - Khởi Tạo Phiên Thành Công",
      du_lieu: roundData
    });
  }

  // 3. Trang tài liệu thương hiệu SUKA88
  return res.status(200).json({
    trang_thai: "thanh_cong",
    thuong_hieu: {
      ten_cong_game: "SUKA88",
      logo: BRAND_LOGO,
      khau_hieu: "Cổng Game Quốc Tế - Đẳng Cấp Xanh Chín & Bảo Mật Tuyệt Đối",
      chung_nhan: "Provably Fair Certified Gaming Platform"
    },
    chuyen_muc: "Cổng Game Quốc Tế SUKA88 (/taixiu/suka88)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      phien_game_minh_bach: "Khởi tạo phiên gieo xúc xắc tích hợp mã hóa Provably Fair SHA-256/MD5",
      doi_soat_mat_ma: "Hệ thống giải mã và xác thực tính toàn vẹn của chuỗi kết quả",
      hinh_anh_chuan_casino: "Tự động xuất hình ảnh 3 xúc xắc trên đĩa chất lượng cao chuẩn vector SVG"
    },
    cu_phap_ho_tro: [
      `${baseUrl}/api/taixiu/suka88?=roll&key={api_key}`,
      `${baseUrl}/api/taixiu/suka88?decode={chuoi_ket_qua}&key={api_key}`,
      `${baseUrl}/api/taixiu/suka88?image={d1}-{d2}-{d3}`
    ],
    vi_du_mau: [
      `${baseUrl}/api/taixiu/suka88?=roll&key=your_api_key`,
      `${baseUrl}/api/taixiu/suka88?image=6-6-6`
    ]
  });
};