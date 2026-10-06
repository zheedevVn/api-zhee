/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const crypto = require("crypto");
const { sendSvgAsPng } = require("./pngImage");
const bai = require("./bai");

const SUKA88_LOGO = "https://i.ibb.co/Mxs9XSSk/Chat-GPT-Image-17-00-24-25-thg-8-2026.png";
const SUKA88_KEY = "minhhocgioi";
const SUKA88_PATH = "/api/taixiu/suka88/bcr";

function suka88Brand() {
  return {
    ten_cong_game: "SUKA88",
    logo: SUKA88_LOGO,
    sanh: "Baccarat (BCR)",
    khau_hieu: "Cổng Game Quốc Tế - Đẳng Cấp Xanh Chín & Bảo Mật Tuyệt Đối"
  };
}

function denySukaKey() {
  return {
    trang_thai: "tu_choi",
    ma_loi: 403,
    thong_bao: "Sảnh SUKA88 Baccarat cần API key. Thêm &key={api_key}.",
    huong_dan: "Ví dụ: /api/taixiu/suka88/bcr?action=random&key={api_key}",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

function baccaratValue(card) {
  if (!card) return 0;
  if (card.hang === "A") return 1;
  if (["10", "J", "Q", "K"].includes(card.hang)) return 0;
  return Number(card.hang);
}

function handTotal(cards) {
  return cards.reduce((sum, card) => sum + baccaratValue(card), 0) % 10;
}

function shouldPlayerDraw(total) {
  return total <= 5;
}

function shouldBankerDraw(bankerTotal, playerThird) {
  if (playerThird == null) return bankerTotal <= 5;
  const p = baccaratValue(playerThird);
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p !== 8;
  if (bankerTotal === 4) return p >= 2 && p <= 7;
  if (bankerTotal === 5) return p >= 4 && p <= 7;
  if (bankerTotal === 6) return p === 6 || p === 7;
  return false;
}

function shuffleDeck() {
  const pool = bai.DECK.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function parseSide(raw) {
  const cards = bai.parseCardList(String(raw || ""));
  if (cards.length > 3) return null;
  return cards;
}

function publicSide(cards, baseUrl) {
  const total = handTotal(cards);
  return {
    la_bai: cards.map((card) => ({
      ...bai.publicCard(card, baseUrl),
      diem_baccarat: baccaratValue(card)
    })),
    hien_thi: cards.map((card) => card.hien_thi).join(" "),
    diem: total,
    natural: cards.length === 2 && total >= 8
  };
}

function outcome(player, banker) {
  const p = handTotal(player);
  const b = handTotal(banker);
  if (p > b) return { thang: "PLAYER", ten: "Con (Player)" };
  if (b > p) return { thang: "BANKER", ten: "Cái (Banker)" };
  return { thang: "TIE", ten: "Hòa (Tie)" };
}

function dealRandom() {
  const deck = shuffleDeck();
  const player = [deck.pop(), deck.pop()];
  const banker = [deck.pop(), deck.pop()];
  const pTotal = handTotal(player);
  const bTotal = handTotal(banker);
  if (pTotal >= 8 || bTotal >= 8) {
    return { player, banker, ghi_chu: ["Natural — không rút lá thứ 3"] };
  }
  const notes = [];
  let playerThird = null;
  if (shouldPlayerDraw(pTotal)) {
    playerThird = deck.pop();
    player.push(playerThird);
    notes.push("Con rút lá thứ 3");
  } else {
    notes.push("Con dừng");
  }
  if (shouldBankerDraw(handTotal(banker.slice(0, 2)), playerThird)) {
    banker.push(deck.pop());
    notes.push("Cái rút lá thứ 3");
  } else {
    notes.push("Cái dừng");
  }
  return { player, banker, ghi_chu: notes };
}

function generateTableSvg(player, banker, result) {
  const cardW = 150;
  const cardH = 210;
  const gap = 12;
  function row(cards, y) {
    return cards.map((card, i) => bai.generateCardSvg(card, 36 + i * (cardW + gap), y, cardW, cardH)).join("");
  }
  const pTotal = handTotal(player);
  const bTotal = handTotal(banker);
  const width = 36 * 2 + 3 * cardW + 2 * gap;
  const height = 520;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" rx="28" fill="#14532d"/>
  <text x="36" y="36" fill="#bbf7d0" font-size="20" font-weight="800" font-family="'Segoe UI', Roboto, sans-serif">PLAYER (Con) — ${pTotal}</text>
  ${row(player, 48)}
  <text x="36" y="292" fill="#fde68a" font-size="20" font-weight="800" font-family="'Segoe UI', Roboto, sans-serif">BANKER (Cái) — ${bTotal}</text>
  ${row(banker, 304)}
  <text x="${width / 2}" y="500" text-anchor="middle" fill="#f8fafc" font-size="22" font-weight="800" font-family="'Segoe UI', Roboto, sans-serif">${result.ten}</text>
</svg>`;
}

function sendSvg(res, svg) {
  return sendSvgAsPng(res, svg);
}

function cardImageUrl(card, baseUrl) {
  return `${baseUrl}/api/taixiu/suka88/bai?image=${card.ma}`;
}

function respondDeal(res, player, banker, mode, notes, baseUrl) {
  const ketQua = outcome(player, banker);
  const playerCodes = player.map((card) => card.ma).join(",");
  const bankerCodes = banker.map((card) => card.ma).join(",");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    thuong_hieu: suka88Brand(),
    chuyen_muc: "SUKA88 — Baccarat (BCR)",
    che_do: mode,
    player: {
      ...publicSide(player, baseUrl),
      anh_tung_la: player.map((card) => cardImageUrl(card, baseUrl))
    },
    banker: {
      ...publicSide(banker, baseUrl),
      anh_tung_la: banker.map((card) => cardImageUrl(card, baseUrl))
    },
    ket_qua: ketQua,
    ghi_chu: notes || [],
    luat_diem: "Át = 1, 2–9 = mặt, 10/J/Q/K = 0. Tổng chia 10 lấy dư (mod 10). 8 hoặc 9 hai lá là Natural.",
    anh: `${baseUrl}${SUKA88_PATH}?image=1&player=${playerCodes}&banker=${bankerCodes}`,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    thuong_hieu: suka88Brand(),
    chuyen_muc: "SUKA88 — Baccarat / BCR (/taixiu/suka88/bcr)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Sảnh Baccarat cổng SUKA88. Con (Player) vs Cái (Banker). Chơi cần &key=.",
    cu_phap: {
      random: [
        `${baseUrl}${SUKA88_PATH}?action=random&key={api_key}`,
        `${baseUrl}/suka88/bcr?action=random&key={api_key}`
      ],
      chi_dinh: [
        `${baseUrl}${SUKA88_PATH}?action=set&player=AS,9H&banker=KD,5C&key={api_key}`
      ],
      thong_tin: [
        `${baseUrl}${SUKA88_PATH}?action=info`,
        `${baseUrl}${SUKA88_PATH}?action=info&la=AS`
      ]
    }
  };
}

function rulesPayload() {
  return {
    trang_thai: "thanh_cong",
    chuyen_muc: "Luật Baccarat",
    diem_la: {
      A: 1,
      "2-9": "Theo mặt",
      "10_J_Q_K": 0,
      tong: "Cộng điểm rồi mod 10"
    },
    rut_la_thu_3: {
      player: "Con 0–5 rút, 6–7 dừng, 8–9 natural.",
      banker_khi_con_khong_rut: "Cái 0–5 rút, 6–7 dừng.",
      banker_khi_con_rut: "0–2 luôn rút; 3 trừ khi lá 3 của Con là 8; 4 rút nếu lá 3 Con là 2–7; 5 rút nếu 4–7; 6 rút nếu 6–7; 7 dừng."
    },
    ket_qua: ["PLAYER (Con)", "BANKER (Cái)", "TIE (Hòa)"],
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
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
  const playerRaw = pick(params, body, "player", "con", "punto");
  const bankerRaw = pick(params, body, "banker", "cai", "banco");
  const laRaw = pick(params, body, "la", "card") || firstParam;

  if (pick(params, body, "image", "img")) {
    const player = parseSide(playerRaw);
    const banker = parseSide(bankerRaw);
    if (!player || !banker || !player.length || !banker.length) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Ảnh cần player=...&banker=... Ví dụ player=AS,9H&banker=KD,5C&image=1" });
    }
    return sendSvg(res, generateTableSvg(player, banker, outcome(player, banker)));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const action = ({
    random: "random", deal: "random", chia: "random", rut: "random",
    set: "set", chidinh: "set", chi_dinh: "set",
    info: "info", thongtin: "info", luat: "info",
    list: "info"
  }[actionRaw]) || "";

  if (!action && !firstParam && !playerRaw && !bankerRaw) {
    return res.status(200).json(buildGuide(baseUrl));
  }

  if (action === "info") {
    const card = bai.parseOneCard(laRaw);
    if (card) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "Điểm lá Baccarat",
        du_lieu: {
          ...bai.publicCard(card, baseUrl),
          diem_baccarat: baccaratValue(card)
        },
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
    return res.status(200).json(rulesPayload());
  }

  if (action === "set" || playerRaw || bankerRaw) {
    if (pick(params, body, "key", "admin_key", "token") !== SUKA88_KEY) {
      return res.status(403).json(denySukaKey());
    }
    const player = parseSide(playerRaw);
    const banker = parseSide(bankerRaw);
    if (!player || !banker || player.length < 2 || banker.length < 2) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Cần chỉ định ít nhất 2 lá Con và 2 lá Cái. Ví dụ: player=AS,9H&banker=KD,5C"
      });
    }
    const used = [...player, ...banker].map((card) => card.ma);
    if (new Set(used).size !== used.length) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Không được trùng lá giữa Con và Cái."
      });
    }
    return respondDeal(res, player, banker, "Chỉ định bài Baccarat", ["Dùng đúng các lá đã chỉ định, không tự rút thêm."], baseUrl);
  }

  if (pick(params, body, "key", "admin_key", "token") !== SUKA88_KEY) {
    return res.status(403).json(denySukaKey());
  }
  const dealt = dealRandom();
  return respondDeal(res, dealt.player, dealt.banker, "Random ván Baccarat", dealt.ghi_chu, baseUrl);
};
