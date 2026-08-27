const crypto = require("crypto");

const RANKS = [
  { ma: "A", ten: "Át", ten_en: "Ace", poker: 14, bj: [1, 11] },
  { ma: "2", ten: "Hai", ten_en: "Two", poker: 2, bj: [2] },
  { ma: "3", ten: "Ba", ten_en: "Three", poker: 3, bj: [3] },
  { ma: "4", ten: "Bốn", ten_en: "Four", poker: 4, bj: [4] },
  { ma: "5", ten: "Năm", ten_en: "Five", poker: 5, bj: [5] },
  { ma: "6", ten: "Sáu", ten_en: "Six", poker: 6, bj: [6] },
  { ma: "7", ten: "Bảy", ten_en: "Seven", poker: 7, bj: [7] },
  { ma: "8", ten: "Tám", ten_en: "Eight", poker: 8, bj: [8] },
  { ma: "9", ten: "Chín", ten_en: "Nine", poker: 9, bj: [9] },
  { ma: "10", ten: "Mười", ten_en: "Ten", poker: 10, bj: [10] },
  { ma: "J", ten: "Bồi", ten_en: "Jack", poker: 11, bj: [10] },
  { ma: "Q", ten: "Đầm", ten_en: "Queen", poker: 12, bj: [10] },
  { ma: "K", ten: "Già", ten_en: "King", poker: 13, bj: [10] }
];

const SUITS = [
  { ma: "S", ten: "Bích", ten_en: "Spades", ky_hieu: "♠", mau: "Đen", mua: "Đông", y_nghia: "Trí tuệ, quyền lực, quý tộc." },
  { ma: "H", ten: "Cơ", ten_en: "Hearts", ky_hieu: "♥", mau: "Đỏ", mua: "Xuân", y_nghia: "Tình cảm, trái tim, sự sống." },
  { ma: "D", ten: "Rô", ten_en: "Diamonds", ky_hieu: "♦", mau: "Đỏ", mua: "Thu", y_nghia: "Tài lộc, của cải, thành công." },
  { ma: "C", ten: "Tép", ten_en: "Clubs", ky_hieu: "♣", mau: "Đen", mua: "Hè", y_nghia: "Lao động, may mắn, tăng trưởng." }
];

const RANK_ALIASES = {
  a: "A", at: "A", ach: "A", ace: "A",
  2: "2", hai: "2", two: "2",
  3: "3", ba: "3", three: "3",
  4: "4", bon: "4", four: "4",
  5: "5", nam: "5", five: "5",
  6: "6", sau: "6", six: "6",
  7: "7", bay: "7", seven: "7",
  8: "8", tam: "8", eight: "8",
  9: "9", chin: "9", nine: "9",
  10: "10", muoi: "10", ten: "10", t: "10",
  j: "J", jack: "J", boi: "J", jo: "J",
  q: "Q", queen: "Q", dam: "Q", quy: "Q",
  k: "K", king: "K", gia: "K", ka: "K"
};

const SUIT_ALIASES = {
  s: "S", spade: "S", spades: "S", bich: "S", pich: "S", "♠": "S",
  h: "H", heart: "H", hearts: "H", co: "H", "♥": "H",
  d: "D", diamond: "D", diamonds: "D", ro: "D", "♦": "D",
  c: "C", club: "C", clubs: "C", tep: "C", nhep: "C", chuon: "C", "♣": "C"
};

const UNICODE_OFFSET = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13];
const UNICODE_BASE = { S: 0x1F0A1, H: 0x1F0B1, D: 0x1F0C1, C: 0x1F0D1 };

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function buildDeck() {
  const deck = [];
  let index = 1;
  for (const suit of SUITS) {
    RANKS.forEach((rank, rankIndex) => {
      deck.push(makeCard(rank, suit, rankIndex, index));
      index += 1;
    });
  }
  return deck;
}

function makeCard(rank, suit, rankIndex, thuTu) {
  const ma = `${rank.ma}${suit.ma}`;
  return {
    ma,
    ten: `${rank.ten} ${suit.ten}`,
    ten_en: `${rank.ten_en} of ${suit.ten_en}`,
    hang: rank.ma,
    hang_ten: rank.ten,
    hang_en: rank.ten_en,
    chat: suit.ma,
    chat_ten: suit.ten,
    chat_en: suit.ten_en,
    ky_hieu: suit.ky_hieu,
    hien_thi: `${rank.ma}${suit.ky_hieu}`,
    mau: suit.mau,
    unicode: String.fromCodePoint(UNICODE_BASE[suit.ma] + UNICODE_OFFSET[rankIndex]),
    gia_tri_poker: rank.poker,
    gia_tri_blackjack: rank.bj.length === 1 ? rank.bj[0] : rank.bj,
    thu_tu: thuTu,
    loai: rank.ma === "A" ? "Át" : (["J", "Q", "K"].includes(rank.ma) ? "Mặt" : "Số"),
    mua: suit.mua,
    y_nghia: cardMeaning(rank, suit)
  };
}

function cardMeaning(rank, suit) {
  const rankNote = {
    A: "Lá cao nhất bộ bài. Blackjack đếm 1 hoặc 11.",
    J: "Lá mặt Bồi (Jack).",
    Q: "Lá mặt Đầm (Queen).",
    K: "Lá mặt Già (King)."
  }[rank.ma] || `Lá số ${rank.ma}, điểm ${rank.poker}.`;
  return `${rankNote} Chất ${suit.ten} (${suit.ten_en}): ${suit.y_nghia}`.trim();
}

const DECK = buildDeck();
const CARD_BY_CODE = new Map(DECK.map((card) => [card.ma, card]));

function parseOneCard(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const compact = text.replace(/\s+/g, "");
  const foldedCompact = fold(compact).replace(/of/g, "");

  const codeMatch = foldedCompact.match(/^(10|[ajkq2-9]|t)([shdc])$/i);
  if (codeMatch) {
    const rank = RANK_ALIASES[codeMatch[1].toLowerCase()];
    const suit = SUIT_ALIASES[codeMatch[2].toLowerCase()];
    return CARD_BY_CODE.get(`${rank}${suit}`) || null;
  }

  const symbolMatch = compact.match(/^(10|[AJQKajqk2-9]|T)([♠♥♦♣])$/);
  if (symbolMatch) {
    const rank = RANK_ALIASES[symbolMatch[1].toLowerCase()];
    const suit = SUIT_ALIASES[symbolMatch[2]];
    return CARD_BY_CODE.get(`${rank}${suit}`) || null;
  }

  const unicodeCard = DECK.find((card) => card.unicode === compact);
  if (unicodeCard) return unicodeCard;

  const parts = fold(text).split(/[\s_\-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const rank = RANK_ALIASES[parts[0]] || RANK_ALIASES[parts[parts.length - 2]];
    const suit = SUIT_ALIASES[parts[parts.length - 1]] || SUIT_ALIASES[parts[0]];
    if (rank && suit) return CARD_BY_CODE.get(`${rank}${suit}`) || null;
  }

  return null;
}

function parseCardList(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const chunks = text.split(/[,;|/+\n]+/).map((part) => part.trim()).filter(Boolean);
  const tokens = chunks.length > 1 ? chunks : text.split(/\s+/).filter(Boolean);
  return tokens.map((token) => parseOneCard(token)).filter(Boolean);
}

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function extractFirstParam(params) {
  return String(params[""] || "").trim();
}

function parseCount(value, fallback = 1) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(n)) return fallback;
  return n;
}

function shuffleDraw(count) {
  const pool = DECK.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function publicCard(card, baseUrl) {
  return {
    ma: card.ma,
    ten: card.ten,
    ten_en: card.ten_en,
    hien_thi: card.hien_thi,
    unicode: card.unicode,
    hang: card.hang,
    hang_ten: card.hang_ten,
    chat: card.chat_ten,
    chat_en: card.chat_en,
    ky_hieu: card.ky_hieu,
    mau: card.mau,
    loai: card.loai,
    gia_tri_poker: card.gia_tri_poker,
    gia_tri_blackjack: card.gia_tri_blackjack,
    thu_tu: card.thu_tu,
    anh: `${baseUrl}/api/tools/bai?image=${card.ma}`
  };
}

function publicCardInfo(card, baseUrl) {
  return {
    ...publicCard(card, baseUrl),
    mua: card.mua,
    y_nghia: card.y_nghia,
    bo_bai: "52 lá bài Tây chuẩn (không Joker)"
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateCardSvg(card, x = 0, y = 0, width = 240, height = 336) {
  const color = card.mau === "Đỏ" ? "#dc2626" : "#0f172a";
  const rank = escapeXml(card.hang);
  const suit = escapeXml(card.ky_hieu);
  const name = escapeXml(card.ten);
  const corner = `${rank}${suit}`;
  return `
    <g transform="translate(${x},${y})">
      <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="22" ry="22" fill="#020617" opacity="0.18"/>
      <rect x="0" y="0" width="${width}" height="${height}" rx="22" ry="22" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>
      <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="16" ry="16" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.35"/>
      <text x="22" y="48" fill="${color}" font-size="32" font-weight="800" font-family="'Segoe UI', 'Times New Roman', serif">${corner}</text>
      <text x="${width - 22}" y="${height - 22}" fill="${color}" font-size="32" font-weight="800" font-family="'Segoe UI', 'Times New Roman', serif" text-anchor="end">${corner}</text>
      <text x="${width / 2}" y="${height / 2 + 28}" fill="${color}" font-size="92" text-anchor="middle" font-family="'Segoe UI Symbol', 'Noto Sans Symbols', serif">${suit}</text>
      <text x="${width / 2}" y="${height - 28}" fill="${color}" font-size="16" font-weight="700" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif">${name}</text>
    </g>`;
}

function generateHandSvg(cards) {
  const w = 240;
  const h = 336;
  const gap = 24;
  const pad = 28;
  const width = pad * 2 + cards.length * w + (cards.length - 1) * gap;
  const height = h + pad * 2;
  const body = cards.map((card, i) => generateCardSvg(card, pad + i * (w + gap), pad, w, h)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="table" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#052e16"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="28" fill="url(#table)"/>
  ${body}
</svg>`;
}

function handSummary(cards) {
  const colors = new Set(cards.map((card) => card.mau));
  const suits = new Set(cards.map((card) => card.chat));
  const ranks = cards.map((card) => card.hang);
  const uniqueRanks = new Set(ranks);
  const notes = [];
  if (cards.length > 1 && suits.size === 1) notes.push(`Đồng chất ${cards[0].chat_ten}`);
  if (cards.length > 1 && colors.size === 1) notes.push(`Cùng màu ${cards[0].mau}`);
  if (cards.length > 1 && uniqueRanks.size === 1) notes.push(`Đồng hạng ${cards[0].hang_ten}`);
  else if (cards.length === 3 && uniqueRanks.size === 2) notes.push("Một đôi");
  return notes;
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Bài Tây 52 Lá (/tools/bai)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Bộ bài Tây chuẩn 52 lá (4 chất × 13 hạng, không Joker). Random 1/2/3 lá, chỉ định 1/2/3 lá, xem thông tin từng lá.",
    bo_bai: {
      tong_so: 52,
      chat: ["Bích ♠", "Cơ ♥", "Rô ♦", "Tép ♣"],
      hang: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    },
    cu_phap: {
      random: [
        `${baseUrl}/api/tools/bai?=1`,
        `${baseUrl}/api/tools/bai?action=random&so=2`,
        `${baseUrl}/api/tools/bai?so=3`
      ],
      chi_dinh: [
        `${baseUrl}/api/tools/bai?action=set&la=AS`,
        `${baseUrl}/api/tools/bai?action=set&la=AH,KS`,
        `${baseUrl}/api/tools/bai?action=set&la=A bich,K co,10 tep`
      ],
      thong_tin: [
        `${baseUrl}/api/tools/bai?action=info&la=AS`,
        `${baseUrl}/api/tools/bai?=A♥`,
        `${baseUrl}/api/tools/bai?action=list`
      ]
    },
    vi_du_ma_la: {
      AS: "Át Bích",
      AH: "Át Cơ",
      AD: "Át Rô",
      AC: "Át Tép",
      KH: "Già Cơ",
      "10D": "Mười Rô",
      JC: "Bồi Tép"
    }
  };
}

function respondHand(res, cards, mode, baseUrl) {
  const list = cards.map((card) => publicCard(card, baseUrl));
  const codes = cards.map((card) => card.ma).join(",");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Bài Tây 52 Lá",
    che_do: mode,
    so_la: cards.length,
    la_bai: list,
    hien_thi: cards.map((card) => card.hien_thi).join("  "),
    unicode: cards.map((card) => card.unicode).join(" "),
    ghi_chu: handSummary(cards),
    anh: `${baseUrl}/api/tools/bai?image=${codes}`,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
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
  const firstParam = extractFirstParam(params);
  const actionRaw = (pick(params, body, "action", "type") || "").toLowerCase();
  const laRaw = pick(params, body, "la", "bai", "card", "cards", "set", "chi_dinh", "chidinh") || firstParam;

  const imageRaw = pick(params, body, "image", "img");
  if (imageRaw) {
    const parsed = parseCardList(imageRaw.replace(/-/g, ","));
    if (!parsed.length || parsed.length > 3) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Ảnh chỉ nhận 1, 2 hoặc 3 lá hợp lệ. Ví dụ image=AS hoặc image=AH,KS" });
    }
    const svg = generateHandSvg(parsed);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (typeof res.send === "function") return res.status(200).send(svg);
    res.statusCode = 200;
    return res.end(svg);
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const action = (
    { random: "random", rut: "random", rd: "random", draw: "random",
      set: "set", chidinh: "set", chi_dinh: "set", gan: "set", pick: "set",
      info: "info", thongtin: "info",
      list: "list", bo: "list", deck: "list", all: "list" }[actionRaw]
  ) || "";

  if (!action && !firstParam && !pick(params, body, "so", "la", "bai", "card", "cards", "n", "count")) {
    return res.status(200).json(buildGuide(baseUrl));
  }

  if (action === "list") {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Bộ bài Tây 52 lá",
      tong_so: DECK.length,
      chat: SUITS.map((suit) => ({ ma: suit.ma, ten: suit.ten, ky_hieu: suit.ky_hieu, mau: suit.mau })),
      hang: RANKS.map((rank) => ({ ma: rank.ma, ten: rank.ten, ten_en: rank.ten_en })),
      danh_sach: DECK.map((card) => publicCard(card, baseUrl)),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (action === "info" || (!action && parseOneCard(laRaw) && parseCardList(laRaw).length === 1 && !/^[123]$/.test(firstParam))) {
    const card = parseOneCard(laRaw);
    if (!card) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Không nhận ra lá bài. Ví dụ: AS, A♥, A bich, 10D, K cơ."
      });
    }
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Thông tin lá bài Tây",
      du_lieu: publicCardInfo(card, baseUrl),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (action === "set" || (!action && parseCardList(laRaw).length >= 1 && !/^[123]$/.test(firstParam))) {
    const cards = parseCardList(laRaw);
    if (!cards.length) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Cần chỉ định 1, 2 hoặc 3 lá. Ví dụ: la=AS hoặc la=AH,KS,10D hoặc la=A bich,K co."
      });
    }
    if (cards.length > 3) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Chỉ được chỉ định tối đa 3 lá mỗi lần."
      });
    }
    const codes = cards.map((card) => card.ma);
    if (new Set(codes).size !== codes.length) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Không được chỉ định trùng lá trong cùng một lần rút."
      });
    }
    return respondHand(res, cards, "Chỉ định lá bài", baseUrl);
  }

  const countRaw = pick(params, body, "so", "n", "count") || (action === "random" ? "1" : firstParam) || "1";
  const count = parseCount(countRaw, 0);
  if (![1, 2, 3].includes(count)) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Random chỉ nhận 1, 2 hoặc 3 lá. Ví dụ: ?=1, ?so=2, ?action=random&so=3"
    });
  }

  const drawn = shuffleDraw(count);
  return respondHand(res, drawn, `Random ${count} lá`, baseUrl);
};
