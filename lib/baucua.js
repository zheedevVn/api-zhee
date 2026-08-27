const crypto = require("crypto");

const FACES = [
  { ma: "nai", ten: "Nai", ky_hieu: "🦌", mau: "#b45309", nen: "#fef3c7", y_nghia: "Nai — mặt đỏ trên bàn Bầu Cua, tượng trưng sự nhanh nhẹn." },
  { ma: "bau", ten: "Bầu", ky_hieu: "🍐", mau: "#ca8a04", nen: "#fef9c3", y_nghia: "Bầu — trái bầu, mặt vàng, thường nằm giữa hàng trên." },
  { ma: "ga", ten: "Gà", ky_hieu: "🐓", mau: "#ea580c", nen: "#ffedd5", y_nghia: "Gà — mặt cam, tượng trưng tỉnh táo." },
  { ma: "ca", ten: "Cá", ky_hieu: "🐟", mau: "#0284c7", nen: "#e0f2fe", y_nghia: "Cá — mặt xanh, tượng trưng tài lộc." },
  { ma: "cua", ten: "Cua", ky_hieu: "🦀", mau: "#dc2626", nen: "#fee2e2", y_nghia: "Cua — mặt đỏ, hay được cược nhất." },
  { ma: "tom", ten: "Tôm", ky_hieu: "🦐", mau: "#db2777", nen: "#fce7f3", y_nghia: "Tôm — mặt hồng, hàng dưới bên phải." }
];

const FACE_BY_CODE = new Map(FACES.map((face) => [face.ma, face]));

const ALIASES = {
  nai: "nai", deer: "nai", huou: "nai",
  bau: "bau", bauu: "bau", gourd: "bau",
  ga: "ga", rooster: "ga", chicken: "ga",
  ca: "ca", fish: "ca",
  cua: "cua", crab: "cua",
  tom: "tom", shrimp: "tom", prawn: "tom"
};

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function parseOneFace(raw) {
  const key = fold(raw).replace(/\s+/g, "-");
  const ma = ALIASES[key] || (FACE_BY_CODE.has(key) ? key : "");
  return FACE_BY_CODE.get(ma) || null;
}

function parseFaceList(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const chunks = text.split(/[,;|/+\n\-]+/).map((part) => part.trim()).filter(Boolean);
  return chunks.map(parseOneFace).filter(Boolean);
}

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function publicFace(face, baseUrl) {
  return {
    ma: face.ma,
    ten: face.ten,
    ky_hieu: face.ky_hieu,
    mau: face.mau,
    y_nghia: face.y_nghia,
    anh: `${baseUrl}/api/taixiu/baucua?image=${face.ma}`
  };
}

function rollDice(count) {
  return Array.from({ length: count }, () => FACES[crypto.randomInt(0, FACES.length)]);
}

function tally(faces) {
  const counts = { nai: 0, bau: 0, ga: 0, ca: 0, cua: 0, tom: 0 };
  for (const face of faces) counts[face.ma] += 1;
  const trung = FACES.filter((face) => counts[face.ma] > 0).map((face) => ({
    ma: face.ma,
    ten: face.ten,
    so_vien: counts[face.ma],
    ti_le_an: `${counts[face.ma]} ăn ${counts[face.ma]} (cược mặt ${face.ten} được ×${counts[face.ma]})`
  }));
  return { counts, trung };
}

function generateDieSvg(face, x, y, size = 140) {
  const label = face.ten;
  const emoji = face.ky_hieu;
  return `
    <g transform="translate(${x},${y})">
      <rect x="6" y="8" width="${size}" height="${size}" rx="28" fill="#000" opacity="0.18"/>
      <rect x="0" y="0" width="${size}" height="${size}" rx="26" fill="${face.nen}" stroke="${face.mau}" stroke-width="4"/>
      <text x="${size / 2}" y="${size / 2 + 8}" text-anchor="middle" font-size="52">${emoji}</text>
      <text x="${size / 2}" y="${size - 16}" text-anchor="middle" fill="${face.mau}" font-size="18" font-weight="800" font-family="'Segoe UI', Roboto, sans-serif">${label}</text>
    </g>`;
}

function generateRollSvg(faces) {
  const size = 140;
  const gap = 22;
  const pad = 28;
  const width = pad * 2 + faces.length * size + (faces.length - 1) * gap;
  const height = size + pad * 2 + 36;
  const dice = faces.map((face, i) => generateDieSvg(face, pad + i * (size + gap), pad, size)).join("");
  const title = faces.map((face) => face.ten).join(" · ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" rx="28" fill="#14532d"/>
  ${dice}
  <text x="${width / 2}" y="${height - 14}" text-anchor="middle" fill="#bbf7d0" font-size="16" font-weight="700" font-family="'Segoe UI', Roboto, sans-serif">${title}</text>
</svg>`;
}

function sendSvg(res, svg) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  if (typeof res.send === "function") return res.status(200).send(svg);
  res.statusCode = 200;
  return res.end(svg);
}

function respondRoll(res, faces, mode, baseUrl) {
  const { counts, trung } = tally(faces);
  const codes = faces.map((face) => face.ma).join(",");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Bầu Cua Tôm Cá",
    che_do: mode,
    so_vien: faces.length,
    xuc_xac: faces.map((face) => publicFace(face, baseUrl)),
    hien_thi: faces.map((face) => `${face.ky_hieu} ${face.ten}`).join("  ·  "),
    thong_ke: counts,
    mat_trung: trung,
    luat_an: "Cược 1 mặt: ra 1 viên ăn 1, 2 viên ăn 2, 3 viên ăn 3 (không tính vốn).",
    anh: `${baseUrl}/api/taixiu/baucua?image=${codes}`,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Bầu Cua Tôm Cá (/taixiu/baucua)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "3 viên xúc xắc 6 mặt: Nai, Bầu, Gà, Cá, Cua, Tôm. Random 1/2/3 viên, chỉ định mặt, xem thông tin từng mặt.",
    mat: FACES.map((face) => `${face.ky_hieu} ${face.ten} (${face.ma})`),
    cu_phap: {
      random: [
        `${baseUrl}/api/taixiu/baucua`,
        `${baseUrl}/api/taixiu/baucua?so=3`,
        `${baseUrl}/baucua?=1`
      ],
      chi_dinh: [
        `${baseUrl}/api/taixiu/baucua?action=set&mat=cua`,
        `${baseUrl}/api/taixiu/baucua?action=set&mat=cua,bau,tom`,
        `${baseUrl}/api/taixiu/baucua?set=nai-nai-ga`
      ],
      thong_tin: [
        `${baseUrl}/api/taixiu/baucua?action=info&mat=cua`,
        `${baseUrl}/api/taixiu/baucua?action=list`
      ]
    }
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const firstParam = String(params[""] || "").trim();
  const actionRaw = (pick(params, body, "action", "type") || "").toLowerCase();
  const matRaw = pick(params, body, "mat", "set", "faces", "face", "ket_qua", "chi_dinh") || firstParam;

  const imageRaw = pick(params, body, "image", "img");
  if (imageRaw) {
    const parsed = parseFaceList(imageRaw);
    if (!parsed.length || parsed.length > 3) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Ảnh nhận 1–3 mặt. Ví dụ image=cua hoặc image=cua,bau,tom" });
    }
    return sendSvg(res, generateRollSvg(parsed));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const action = ({
    random: "random", lac: "random", roll: "random", rut: "random",
    set: "set", chidinh: "set", chi_dinh: "set", gan: "set",
    info: "info", thongtin: "info",
    list: "list", bo: "list", all: "list"
  }[actionRaw]) || "";

  if (!action && !firstParam && !pick(params, body, "so", "mat", "set", "n", "count")) {
    return res.status(200).json(buildGuide(baseUrl));
  }

  if (action === "list") {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Sáu mặt Bầu Cua",
      tong_so: FACES.length,
      danh_sach: FACES.map((face) => publicFace(face, baseUrl)),
      luat: "Lắc 3 viên. Cược mặt nào ra n viên thì ăn n lần tiền cược.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (action === "info" || (!action && parseOneFace(matRaw) && parseFaceList(matRaw).length === 1 && !/^[123]$/.test(firstParam))) {
    const face = parseOneFace(matRaw);
    if (!face) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Không nhận ra mặt. Dùng: nai, bau, ga, ca, cua, tom."
      });
    }
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Thông tin mặt Bầu Cua",
      du_lieu: publicFace(face, baseUrl),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (action === "set" || (!action && parseFaceList(matRaw).length >= 1 && !/^[123]$/.test(firstParam))) {
    const faces = parseFaceList(matRaw);
    if (!faces.length) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Cần 1, 2 hoặc 3 mặt. Ví dụ: set=cua,bau,tom"
      });
    }
    if (faces.length > 3) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Chỉ được chỉ định tối đa 3 viên."
      });
    }
    return respondRoll(res, faces, "Chỉ định mặt Bầu Cua", baseUrl);
  }

  const countRaw = pick(params, body, "so", "n", "count") || (action === "random" ? "3" : firstParam) || "3";
  const count = Number.parseInt(countRaw, 10);
  if (![1, 2, 3].includes(count)) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Random chỉ nhận 1, 2 hoặc 3 viên. Mặc định 3. Ví dụ ?so=3"
    });
  }
  return respondRoll(res, rollDice(count), `Random ${count} viên Bầu Cua`, baseUrl);
};
