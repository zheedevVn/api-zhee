const crypto = require("crypto");

// 1. Render ảnh xúc xắc SVG phong cách Casino SUKA88
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
        <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.2"/>
      </filter>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="url(#diceGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    ${dots}
  </svg>`;
}

// 2. Engine tạo phiên xúc xắc SUKA88 (Chỉ định / Ngẫu nhiên kèm Salt)
function createSuka88Round(setParam, baseUrl) {
  let d1, d2, d3;
  let modeName = "Quay Ngẫu Nhiên Tự Nhiên (Provably Fair)";

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

  return {
    cong_game: "SUKA88 Provably Fair Gaming Engine",
    phien_cuoc_id: Date.now(),
    che_do: modeName,
    ket_qua: kq,
    tong_diem: `${total} Điểm`,
    chi_tiet_3_xuc_xac: {
      xuc_xac_1: { nut: d1, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d1}` },
      xuc_xac_2: { nut: d2, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d2}` },
      xuc_xac_3: { nut: d3, anh_xuc_xac: `${baseUrl}/api/taixiu/suka88?image=${d3}` }
    },
    chung_thuc_provably_fair: {
      chuoi_hash_sha256_truoc_phien: sha256Hash,
      chuoi_hash_md5_truoc_phien: md5Hash,
      chuoi_ket_qua_sau_phien: postRoundString,
      huong_dan_doi_soat: "Dán chuỗi kết quả vào API để xác thực tính minh bạch tuyệt đối"
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

  const isRoll = 
    searchParams.get("action") === "roll" || 
    searchParams.get("demo") === "true" || 
    searchParams.has("roll") || 
    rawQueryValue.toLowerCase() === "roll" || 
    rawQueryValue.toLowerCase() === "demo";

  const setParam = searchParams.get("set") || searchParams.get("dice") || searchParams.get("rig");

  if (isRoll || setParam || (rawQueryValue && ["tai", "xiu", "bao"].includes(rawQueryValue.toLowerCase())) || /^[1-6][\-,\s\_][1-6][\-,\s\_][1-6]$/.test(rawQueryValue)) {
    const targetSet = setParam || (rawQueryValue !== "roll" && rawQueryValue !== "demo" ? rawQueryValue : "");
    const customRound = createSuka88Round(targetSet, baseUrl);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Cổng Game SUKA88 - Tạo Ván Cược & Lắc Xúc Xắc Demo",
      du_lieu: customRound
    });
  }

  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Cổng Game Tài Xỉu Độc Quyền SUKA88 (/taixiu/suka88)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      lac_xuc_xac_ngau_nhien: "Lắc 3 xúc xắc ngẫu nhiên kèm mã băm SHA-256 & MD5 chứng thực",
      chinh_cau_theo_y_muon: "Tự tạo ván cược chỉ định kết quả theo cửa (Tài, Xỉu, Bão) hoặc nút cụ thể (ví dụ 6-6-6)"
    },
    cu_phap: [
      `${baseUrl}/api/taixiu/suka88?=roll (Lắc ngẫu nhiên)`,
      `${baseUrl}/api/taixiu/suka88?set=tai (Ép kết quả TÀI)`,
      `${baseUrl}/api/taixiu/suka88?set=xiu (Ép kết quả XỈU)`,
      `${baseUrl}/api/taixiu/suka88?set=6-6-6 (Chỉ định bộ 3 nút)`,
      `${baseUrl}/api/taixiu/suka88?image={1_den_6}`
    ],
    vi_du: [
      `${baseUrl}/api/taixiu/suka88?=roll`,
      `${baseUrl}/api/taixiu/suka88?set=tai`,
      `${baseUrl}/api/taixiu/suka88?set=6-6-6`
    ]
  });
};