const crypto = require("crypto");

// Logo thương hiệu cố định SUKA88
const BRAND_LOGO = "https://i.ibb.co/Mxs9XSSk/Chat-GPT-Image-17-00-24-25-thg-8-2026.png";
const ADMIN_SECRET_KEY = "minhhocgioi"; // Khóa phân quyền hệ thống

// 1. Tọa độ nút xúc xắc chuẩn Casino quốc tế
const DOT_COORDS = {
  1: [[60, 60, "#dc2626", 16]],
  2: [[34, 34, "#1e293b", 10.5], [86, 86, "#1e293b", 10.5]],
  3: [[30, 30, "#1e293b", 10], [60, 60, "#1e293b", 10], [90, 90, "#1e293b", 10]],
  4: [[34, 34, "#dc2626", 11], [86, 34, "#dc2626", 11], [34, 86, "#dc2626", 11], [86, 86, "#dc2626", 11]],
  5: [[32, 32, "#1e293b", 10], [88, 32, "#1e293b", 10], [60, 60, "#dc2626", 10], [32, 88, "#1e293b", 10], [88, 88, "#1e293b", 10]],
  6: [[34, 30, "#1e293b", 10], [86, 30, "#1e293b", 10], [34, 60, "#1e293b", 10], [86, 60, "#1e293b", 10], [34, 90, "#1e293b", 10], [86, 90, "#1e293b", 10]]
};

// 2. Render Khung Cảnh Báo Lỗi Khi Chuỗi Bị Chỉnh Sửa
function generateTamperErrorSvg(reason) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" width="100%" height="100%">
    <defs>
      <linearGradient id="errorBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#450a0a"/>
        <stop offset="50%" stop-color="#180505"/>
        <stop offset="100%" stop-color="#020202"/>
      </linearGradient>
      <linearGradient id="errorBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#991b1b"/>
      </linearGradient>
    </defs>
    <rect x="20" y="16" width="720" height="448" rx="36" ry="36" fill="url(#errorBg)" stroke="url(#errorBorder)" stroke-width="3"/>
    <g transform="translate(380, 160)" text-anchor="middle">
      <circle cx="0" cy="0" r="48" fill="#dc2626" fill-opacity="0.2" stroke="#ef4444" stroke-width="2"/>
      <path d="M-16 -16L16 16M16 -16L-16 16" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
      <text x="0" y="90" fill="#fca5a5" font-size="24" font-weight="900" font-family="'Segoe UI', Roboto, sans-serif" letter-spacing="2">CẢNH BÁO: DỮ LIỆU BỊ CAN THIỆP!</text>
      <text x="0" y="125" fill="#94a3b8" font-size="14" font-family="'Consolas', monospace">${reason || "Chữ ký xác thực HMAC không khớp với chuỗi dữ liệu."}</text>
      <text x="0" y="160" fill="#f87171" font-size="13" font-family="'Segoe UI', Roboto, sans-serif">Hệ thống SUKA88 đã khóa phiên hiển thị để đảm bảo tính toàn vẹn minh bạch.</text>
    </g>
  </svg>`;
}

// 3. Render 1 viên xúc xắc đơn lẻ SVG
function generateSingleDiceSvg(number) {
  const n = Math.max(1, Math.min(6, parseInt(number, 10) || 1));
  const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="160" height="160">
    <defs>
      <linearGradient id="singleDiceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="85%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#cbd5e1"/>
      </linearGradient>
      <filter id="singleShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <rect x="8" y="8" width="104" height="104" rx="22" ry="22" fill="url(#singleDiceGrad)" stroke="#cbd5e1" stroke-width="2.5" filter="url(#singleShadow)" />
    ${dots}
  </svg>`;
}

// 4. Render ĐĨA KHAY XÚC XẮC SUKA88 VIP CASINO (TỶ LỆ VÀNG, LOGO BANNER, HIỆU ỨNG ÁNH SÁNG)
function generateTripleDiceSvg(d1, d2, d3, customSalt) {
  const n1 = Math.max(1, Math.min(6, parseInt(d1, 10) || 1));
  const n2 = Math.max(1, Math.min(6, parseInt(d2, 10) || 1));
  const n3 = Math.max(1, Math.min(6, parseInt(d3, 10) || 1));

  function renderDiceItem(n, offsetX, offsetY) {
    const dots = (DOT_COORDS[n] || DOT_COORDS[1]).map(([cx, cy, fill, r]) => 
      `<circle cx="${cx + offsetX}" cy="${cy + offsetY}" r="${r}" fill="${fill}" />`
    ).join("");

    return `
      <g filter="url(#dice3DShadow)">
        <rect x="${offsetX + 3}" y="${offsetY + 3}" width="124" height="124" rx="26" ry="26" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.8"/>
        <rect x="${offsetX + 5}" y="${offsetY + 5}" width="120" height="120" rx="24" ry="24" fill="url(#diceGrad3D)" stroke="#cbd5e1" stroke-width="2"/>
        ${dots}
      </g>
    `;
  }

  const total = n1 + n2 + n3;
  const isBao = (n1 === n2 && n2 === n3);
  const resultText = isBao ? `BÃO: ${total} ĐIỂM` : (total >= 11 ? `TÀI: ${total} ĐIỂM` : `XỈU: ${total} ĐIỂM`);
  const badgeGradient = isBao ? "url(#goldGrad)" : (total >= 11 ? "url(#redGrad)" : "url(#blueGrad)");
  const badgeTextColor = isBao ? "#451a03" : "#ffffff";
  const crownIcon = isBao 
    ? `<path d="M5 16L8 5L12 11L16 5L19 16H5Z" fill="#fbbf24" stroke="#451a03" stroke-width="1.2"/>` 
    : `<path d="M12 3L4 7V13C4 17.5 7.4 21.7 12 23C16.6 21.7 20 17.5 20 13V7L12 3Z" fill="#ffffff" fill-opacity="0.9"/>`;

  const displayResultString = `${n1}-${n2}-${n3}|${customSalt}`;
  const sha256Preview = crypto.createHash("sha256").update(displayResultString).digest("hex");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" width="100%" height="100%">
    <defs>
      <radialGradient id="tableFeltBg" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="45%" stop-color="#0f172a"/>
        <stop offset="85%" stop-color="#090d16"/>
        <stop offset="100%" stop-color="#020408"/>
      </radialGradient>

      <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="25%" stop-color="#f59e0b"/>
        <stop offset="50%" stop-color="#fbbf24"/>
        <stop offset="75%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#78350f"/>
      </linearGradient>

      <linearGradient id="diceGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="80%" stop-color="#f1f5f9"/>
        <stop offset="100%" stop-color="#cbd5e1"/>
      </linearGradient>

      <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff4b72"/>
        <stop offset="50%" stop-color="#e11d48"/>
        <stop offset="100%" stop-color="#9f1239"/>
      </linearGradient>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#075985"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#a16207"/>
      </linearGradient>

      <linearGradient id="glassPlate" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0.95"/>
      </linearGradient>

      <filter id="plateShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.75"/>
      </filter>
      <filter id="dice3DShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000000" flood-opacity="0.55"/>
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
      <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#f59e0b" flood-opacity="0.35"/>
      </filter>
    </defs>

    <rect x="20" y="16" width="720" height="448" rx="36" ry="36" fill="url(#tableFeltBg)" stroke="url(#goldBorder)" stroke-width="3.5" filter="url(#plateShadow)"/>
    <rect x="28" y="24" width="704" height="432" rx="30" ry="30" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"/>

    <g transform="translate(48, 38)">
      <g filter="url(#neonGlow)">
        <rect x="0" y="0" width="138" height="54" rx="14" ry="14" fill="#0b0f19" stroke="url(#goldBorder)" stroke-width="1.8"/>
        <clipPath id="logoClip">
          <rect x="3" y="3" width="132" height="48" rx="11" ry="11"/>
        </clipPath>
        <image href="${BRAND_LOGO}" x="3" y="3" width="132" height="48" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)"/>
      </g>

      <g transform="translate(160, 2)">
        <rect x="0" y="0" width="310" height="50" rx="25" ry="25" fill="${badgeGradient}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.5" filter="url(#dice3DShadow)"/>
        <g transform="translate(20, 13)">
          ${crownIcon}
        </g>
        <text x="165" y="32" fill="${badgeTextColor}" font-size="20" font-weight="900" font-family="'Segoe UI', Roboto, sans-serif" text-anchor="middle" letter-spacing="1.5">${resultText}</text>
      </g>

      <g transform="translate(490, 8)">
        <rect x="0" y="0" width="174" height="38" rx="19" ry="19" fill="#0f172a" stroke="#334155" stroke-width="1.2"/>
        <circle cx="20" cy="19" r="6" fill="#22c55e"/>
        <text x="96" y="24" fill="#e2e8f0" font-size="11" font-weight="bold" font-family="'Segoe UI', Roboto, sans-serif" text-anchor="middle" letter-spacing="0.5">PROVABLY FAIR 100%</text>
      </g>
    </g>

    <g transform="translate(0, 115)">
      ${renderDiceItem(n1, 125, 10)}
      ${renderDiceItem(n2, 315, 10)}
      ${renderDiceItem(n3, 505, 10)}
    </g>

    <g transform="translate(48, 305)">
      <rect x="0" y="0" width="664" height="135" rx="20" ry="20" fill="url(#glassPlate)" stroke="#334155" stroke-width="1.5"/>

      <g transform="translate(24, 22)">
        <rect x="0" y="0" width="28" height="28" rx="8" ry="8" fill="#0284c7" fill-opacity="0.2" stroke="#38bdf8" stroke-width="1"/>
        <path d="M8 9L13 14L8 19M14 19H20" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="38" y="19" fill="#94a3b8" font-size="12" font-weight="bold" font-family="'Segoe UI', Roboto, sans-serif">CHUỖI KẾT QUẢ:</text>
        <rect x="165" y="-2" width="455" height="32" rx="8" ry="8" fill="#030712" stroke="#1e293b" stroke-width="1"/>
        <text x="180" y="19" fill="#38bdf8" font-size="13.5" font-family="'Consolas', monospace" font-weight="bold">${displayResultString}</text>
      </g>

      <line x1="24" y1="72" x2="640" y2="72" stroke="#334155" stroke-opacity="0.6" stroke-width="1" stroke-dasharray="4 4"/>

      <g transform="translate(24, 86)">
        <rect x="0" y="0" width="28" height="28" rx="8" ry="8" fill="#7c3aed" fill-opacity="0.2" stroke="#a78bfa" stroke-width="1"/>
        <path d="M14 6C11.8 6 10 7.8 10 10V12H9C7.9 12 7 12.9 7 14V20C7 21.1 7.9 22 9 22H19C20.1 22 21 21.1 21 20V14C21 12.9 20.1 12 19 12H18V10C18 7.8 16.2 6 14 6ZM12 10C12 8.9 12.9 8 14 8C15.1 8 16 8.9 16 10V12H12V10Z" fill="#a78bfa"/>
        <text x="38" y="19" fill="#94a3b8" font-size="12" font-weight="bold" font-family="'Segoe UI', Roboto, sans-serif">MÃ SHA-256:</text>
        <rect x="165" y="-2" width="455" height="32" rx="8" ry="8" fill="#030712" stroke="#1e293b" stroke-width="1"/>
        <text x="180" y="19" fill="#c084fc" font-size="12" font-family="'Consolas', monospace" font-weight="bold">${sha256Preview.slice(0, 48)}...</text>
      </g>
    </g>
  </svg>`;
}

// 5. Engine khởi tạo phiên game SUKA88
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

  // Sinh Salt ngẫu nhiên chuẩn hex 24 ký tự
  const saltHex = crypto.randomBytes(12).toString("hex");
  const fullSalt = `SUKA88_${saltHex}`;
  const postRoundString = `${d1}-${d2}-${d3}|${fullSalt}`;
  const sha256Hash = crypto.createHash("sha256").update(postRoundString).digest("hex");
  const md5Hash = crypto.createHash("md5").update(postRoundString).digest("hex");

  // Tạo Token chữ ký mật mã HMAC-SHA256 bất biến
  const signatureToken = crypto.createHmac("sha256", ADMIN_SECRET_KEY)
    .update(`${d1}-${d2}-${d3}|${fullSalt}`)
    .digest("hex")
    .slice(0, 16);

  const comboImage = `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}&salt=${fullSalt}&sig=${signatureToken}`;

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
      chu_ky_xac_thuc_sig: signatureToken,
      huong_dan_doi_soat: `Sử dụng endpoint /api/taixiu/suka88?decode=${postRoundString}&key={api_key} để đối chiếu tính toàn vẹn dữ liệu.`
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 6. Giải mã và đối soát chuỗi kết quả SUKA88
function decodeSuka88String(inputStr, baseUrl) {
  const clean = decodeURIComponent(inputStr).trim();

  const matchResult = clean.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])\|(SUKA88_[a-f0-9]+)/i) || clean.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])\|(.+)/);

  if (matchResult) {
    const d1 = parseInt(matchResult[1], 10);
    const d2 = parseInt(matchResult[2], 10);
    const d3 = parseInt(matchResult[3], 10);
    const fullSalt = matchResult[4] || `SUKA88_verified`;
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const kq = isBao ? `BÃO (Bộ 3 nút ${d1})` : (total >= 11 ? "TÀI" : "XỈU");

    const verifiedSha256 = crypto.createHash("sha256").update(clean).digest("hex");
    const verifiedMd5 = crypto.createHash("md5").update(clean).digest("hex");

    const signatureToken = crypto.createHmac("sha256", ADMIN_SECRET_KEY)
      .update(`${d1}-${d2}-${d3}|${fullSalt}`)
      .digest("hex")
      .slice(0, 16);

    return {
      thuong_hieu: {
        ten_cong_game: "SUKA88",
        logo: BRAND_LOGO
      },
      che_do: "Đối Soát Chuỗi Mật Mã Provably Fair",
      tinh_toan_ven: "Khớp 100% (Dữ liệu xác thực toàn vẹn)",
      ket_qua_thuc_te: kq,
      tong_diem_thuc_te: `${total} Điểm (${kq})`,
      anh_gop_3_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}-${d2}-${d3}&salt=${fullSalt}&sig=${signatureToken}`,
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

  return {
    trang_thai: "that_bai",
    thong_bao: "Định dạng chuỗi kết quả SUKA88 không hợp lệ. Chuỗi phải có dạng: 'x-y-z|SUKA88_salt'"
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

  // 1. ROUTE RENDER ẢNH SVG (CÓ XÁC THỰC CHỮ KÝ HMAC CHỐNG SỬA URL)
  const imgParam = searchParams.get("image") || searchParams.get("img") || searchParams.get("combo");
  if (imgParam) {
    const cleanImg = imgParam.trim();
    const saltParam = searchParams.get("salt") || "";
    const sigParam = searchParams.get("sig") || "";

    const tripleMatch = cleanImg.match(/^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])$/);
    if (tripleMatch) {
      const d1 = tripleMatch[1];
      const d2 = tripleMatch[2];
      const d3 = tripleMatch[3];

      // Nếu có truyền salt -> BẮT BUỘC KIỂM TRA CHỮ KÝ SIG
      if (saltParam) {
        // Kiểm tra định dạng salt chuẩn (phải bắt đầu bằng SUKA88_ và ký tự hex chuẩn)
        const isValidSaltFormat = /^SUKA88_[a-f0-9]{10,64}$/i.test(saltParam);
        const expectedSig = crypto.createHmac("sha256", ADMIN_SECRET_KEY)
          .update(`${d1}-${d2}-${d3}|${saltParam}`)
          .digest("hex")
          .slice(0, 16);

        if (!isValidSaltFormat || sigParam !== expectedSig) {
          res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          return res.status(400).send(generateTamperErrorSvg("Chuỗi Salt không hợp lệ hoặc Chữ ký HMAC (sig) không khớp."));
        }
      }

      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const validSalt = saltParam || `SUKA88_${crypto.createHash("md5").update(`${d1}${d2}${d3}`).digest("hex").slice(0, 12)}`;
      return res.status(200).send(generateTripleDiceSvg(d1, d2, d3, validSalt));
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
    if (decodeParam || (rawQueryValue && rawQueryValue.includes("|"))) {
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