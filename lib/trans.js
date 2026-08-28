const crypto = require("crypto");

const MAX_TEXT = 5000;
const MAX_TTS = 800;
const TTS_CHUNK = 180;

const LANGUAGES = {
  auto: "Tự động nhận diện",
  af: "Afrikaans",
  sq: "Albanian — Tiếng Albania",
  am: "Amharic",
  ar: "Arabic — Tiếng Ả Rập",
  hy: "Armenian",
  as: "Assamese",
  ay: "Aymara",
  az: "Azerbaijani",
  bm: "Bambara",
  eu: "Basque",
  be: "Belarusian",
  bn: "Bengali — Tiếng Bengal",
  bho: "Bhojpuri",
  bs: "Bosnian",
  bg: "Bulgarian — Tiếng Bulgaria",
  ca: "Catalan",
  ceb: "Cebuano",
  ny: "Chichewa",
  "zh-CN": "Chinese (Simplified) — Trung giản thể",
  "zh-TW": "Chinese (Traditional) — Trung phồn thể",
  co: "Corsican",
  hr: "Croatian",
  cs: "Czech — Tiếng Séc",
  da: "Danish — Tiếng Đan Mạch",
  dv: "Dhivehi",
  nl: "Dutch — Tiếng Hà Lan",
  en: "English — Tiếng Anh",
  eo: "Esperanto",
  et: "Estonian",
  ee: "Ewe",
  fil: "Filipino — Tiếng Philippines",
  fi: "Finnish — Tiếng Phần Lan",
  fr: "French — Tiếng Pháp",
  fy: "Frisian",
  gl: "Galician",
  ka: "Georgian",
  de: "German — Tiếng Đức",
  el: "Greek — Tiếng Hy Lạp",
  gn: "Guarani",
  gu: "Gujarati",
  ht: "Haitian Creole",
  ha: "Hausa",
  haw: "Hawaiian",
  he: "Hebrew — Tiếng Do Thái",
  hi: "Hindi — Tiếng Hindi",
  hmn: "Hmong",
  hu: "Hungarian — Tiếng Hungary",
  is: "Icelandic",
  ig: "Igbo",
  id: "Indonesian — Tiếng Indonesia",
  ga: "Irish",
  it: "Italian — Tiếng Ý",
  ja: "Japanese — Tiếng Nhật",
  jv: "Javanese — Tiếng Java",
  kn: "Kannada",
  kk: "Kazakh",
  km: "Khmer — Tiếng Khmer",
  rw: "Kinyarwanda",
  ko: "Korean — Tiếng Hàn",
  ku: "Kurdish",
  ky: "Kyrgyz",
  lo: "Lao — Tiếng Lào",
  la: "Latin",
  lv: "Latvian",
  lt: "Lithuanian",
  lg: "Luganda",
  lb: "Luxembourgish",
  mk: "Macedonian",
  mai: "Maithili",
  mg: "Malagasy",
  ms: "Malay — Tiếng Mã Lai",
  ml: "Malayalam",
  mt: "Maltese",
  mi: "Maori",
  mr: "Marathi",
  "mni-Mtei": "Meiteilon (Manipuri)",
  lus: "Mizo",
  mn: "Mongolian — Tiếng Mông Cổ",
  my: "Myanmar (Burmese) — Tiếng Miến Điện",
  ne: "Nepali",
  no: "Norwegian — Tiếng Na Uy",
  or: "Odia (Oriya)",
  om: "Oromo",
  ps: "Pashto",
  fa: "Persian — Tiếng Ba Tư",
  pl: "Polish — Tiếng Ba Lan",
  pt: "Portuguese — Tiếng Bồ Đào Nha",
  pa: "Punjabi",
  qu: "Quechua",
  ro: "Romanian — Tiếng Romania",
  ru: "Russian — Tiếng Nga",
  sm: "Samoan",
  sa: "Sanskrit",
  gd: "Scots Gaelic",
  nso: "Sepedi",
  sr: "Serbian",
  st: "Sesotho",
  sn: "Shona",
  sd: "Sindhi",
  si: "Sinhala",
  sk: "Slovak",
  sl: "Slovenian",
  so: "Somali",
  es: "Spanish — Tiếng Tây Ban Nha",
  su: "Sundanese",
  sw: "Swahili",
  sv: "Swedish — Tiếng Thụy Điển",
  tl: "Tagalog",
  tg: "Tajik",
  ta: "Tamil",
  tt: "Tatar",
  te: "Telugu",
  th: "Thai — Tiếng Thái",
  ti: "Tigrinya",
  ts: "Tsonga",
  tr: "Turkish — Tiếng Thổ Nhĩ Kỳ",
  tk: "Turkmen",
  ak: "Twi (Akan)",
  uk: "Ukrainian — Tiếng Ukraina",
  ur: "Urdu",
  ug: "Uyghur",
  uz: "Uzbek",
  vi: "Vietnamese — Tiếng Việt",
  cy: "Welsh",
  xh: "Xhosa",
  yi: "Yiddish",
  yo: "Yoruba",
  zu: "Zulu",
  yue: "Cantonese — Quảng Đông"
};

const ALIASES = {
  auto: "auto",
  "tu dong": "auto",
  tudong: "auto",
  detect: "auto",
  vi: "vi",
  vn: "vi",
  viet: "vi",
  vietnam: "vi",
  vietnamese: "vi",
  "tieng viet": "vi",
  tiengviet: "vi",
  en: "en",
  eng: "en",
  anh: "en",
  english: "en",
  "tieng anh": "en",
  ja: "ja",
  jp: "ja",
  nhat: "ja",
  japanese: "ja",
  "tieng nhat": "ja",
  ko: "ko",
  kr: "ko",
  han: "ko",
  korean: "ko",
  "tieng han": "ko",
  "zh-cn": "zh-CN",
  zh: "zh-CN",
  cn: "zh-CN",
  trung: "zh-CN",
  chinese: "zh-CN",
  "trung quoc": "zh-CN",
  "tieng trung": "zh-CN",
  "zh-tw": "zh-TW",
  tw: "zh-TW",
  "trung phon": "zh-TW",
  yue: "yue",
  cantonese: "yue",
  "quang dong": "yue",
  fr: "fr",
  phap: "fr",
  french: "fr",
  "tieng phap": "fr",
  de: "de",
  duc: "de",
  german: "de",
  "tieng duc": "de",
  ru: "ru",
  nga: "ru",
  russian: "ru",
  "tieng nga": "ru",
  es: "es",
  "tay ban nha": "es",
  spanish: "es",
  th: "th",
  thai: "th",
  "tieng thai": "th",
  id: "id",
  indo: "id",
  indonesia: "id",
  lo: "lo",
  lao: "lo",
  "tieng lao": "lo",
  km: "km",
  khmer: "km",
  campuchia: "km",
  "tieng khmer": "km",
  it: "it",
  y: "it",
  italian: "it",
  "tieng y": "it",
  pt: "pt",
  "bo dao nha": "pt",
  portuguese: "pt",
  ar: "ar",
  "a rap": "ar",
  arabic: "ar",
  hi: "hi",
  hindi: "hi",
  "an do": "hi",
  tr: "tr",
  tho: "tr",
  turkish: "tr",
  "tho nhi ky": "tr",
  pl: "pl",
  "ba lan": "pl",
  uk: "uk",
  ukraina: "uk",
  ukrainian: "uk",
  nl: "nl",
  "ha lan": "nl",
  dutch: "nl",
  ms: "ms",
  malay: "ms",
  "ma lai": "ms",
  fil: "fil",
  tl: "tl",
  philippines: "fil",
  he: "he",
  iw: "he",
  hebrew: "he",
  "do thai": "he",
  my: "my",
  burmese: "my",
  "mien dien": "my",
  jv: "jv",
  jw: "jv",
  java: "jv"
};

function safeDecodeComponent(value) {
  if (value == null) return "";
  const normalized = String(value).replace(/\+/g, " ");
  try {
    return decodeURIComponent(normalized);
  } catch (_) {}
  try {
    return decodeURIComponent(normalized.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
  } catch (_) {}
  return normalized;
}

function parseRawQuery(reqUrl) {
  const str = String(reqUrl || "");
  const idx = str.indexOf("?");
  if (idx < 0) return {};
  const out = {};
  for (const part of str.slice(idx + 1).split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? "" : part.slice(eq + 1);
    const key = safeDecodeComponent(rawKey);
    const val = safeDecodeComponent(rawVal);
    if (!key) {
      if (val) out[""] = val;
      continue;
    }
    out[key] = val;
  }
  return out;
}

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function normalizeLang(input, fallback) {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  const folded = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (ALIASES[folded]) return ALIASES[folded];
  if (LANGUAGES[raw]) return raw;
  if (LANGUAGES[folded]) return folded;
  const compact = folded.replace(/\s+/g, "");
  if (ALIASES[compact]) return ALIASES[compact];
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(folded)) {
    if (folded === "zh-cn") return "zh-CN";
    if (folded === "zh-tw") return "zh-TW";
    return folded;
  }
  return "";
}

function languageName(code) {
  if (!code) return null;
  return LANGUAGES[code] || LANGUAGES[String(code).toLowerCase()] || code;
}

function parseGooglePayload(payload) {
  if (payload == null) return null;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (_) { return null; }
  }
  if (Array.isArray(payload)) {
    if (typeof payload[0] === "string") {
      return { text: payload[0], src: payload[1] || "" };
    }
    if (Array.isArray(payload[0]) && typeof payload[0][0] === "string") {
      const looksNestedSentences = Array.isArray(payload[0][0]) === false && payload[0].length <= 4;
      if (looksNestedSentences && !Array.isArray(payload[0][0])) {
        const parts = payload.map((row) => (Array.isArray(row) ? row[0] : "")).filter(Boolean);
        return { text: parts.join(""), src: payload[0][1] || "" };
      }
    }
    if (Array.isArray(payload[0])) {
      const sentences = payload[0]
        .map((row) => (Array.isArray(row) ? row[0] : ""))
        .filter((part) => typeof part === "string");
      const src = typeof payload[2] === "string" ? payload[2] : (payload[0][0] && payload[0][0][1]) || "";
      return { text: sentences.join(""), src };
    }
  }
  if (payload.sentences) {
    return {
      text: payload.sentences.map((item) => item.trans || "").join(""),
      src: payload.src || ""
    };
  }
  if (payload.translatedText) return { text: payload.translatedText, src: payload.detectedSourceLanguage || "" };
  return null;
}

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, text, json };
}

async function translateGoogle(text, from, to) {
  const headers = {
    Accept: "application/json,text/plain,*/*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
  };

  const query = new URLSearchParams({ client: "dict-chrome-ex", sl: from, tl: to, q: text });
  const chrome = await fetchJson(`https://clients5.google.com/translate_a/t?${query}`, { headers });
  const chromeParsed = parseGooglePayload(chrome.json || chrome.text);
  if (chrome.ok && chromeParsed && chromeParsed.text) {
    return { ...chromeParsed, engine: "Google Translate" };
  }

  const gtxParams = new URLSearchParams({
    client: "gtx",
    sl: from,
    tl: to,
    dt: "t",
    dt: "ld",
    dj: "1",
    q: text
  });
  const gtx = await fetchJson(`https://translate.googleapis.com/translate_a/single?${gtxParams}`, { headers });
  const gtxParsed = parseGooglePayload(gtx.json || gtx.text);
  if (gtx.ok && gtxParsed && gtxParsed.text) {
    return { ...gtxParsed, engine: "Google Translate" };
  }

  return null;
}

async function translateMyMemory(text, from, to) {
  const source = from === "auto" ? "autodetect" : from;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${to}`)}`;
  const result = await fetchJson(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  });
  const translated = result.json?.responseData?.translatedText;
  if (result.ok && translated && !/INVALID TARGET LANGUAGE|MYMEMORY WARNING/i.test(translated)) {
    return {
      text: translated,
      src: result.json?.responseData?.detectedLanguage || from,
      engine: "MyMemory"
    };
  }
  return null;
}

async function translateText(text, from, to) {
  if (from !== "auto" && from.toLowerCase() === to.toLowerCase()) {
    return { text, src: from, engine: "Không đổi (cùng ngôn ngữ)" };
  }
  const google = await translateGoogle(text, from, to);
  if (google) return google;
  const memory = await translateMyMemory(text, from, to);
  if (memory) return memory;
  const err = new Error("Không dịch được. Thử lại sau hoặc đổi mã ngôn ngữ (vd to=en, to=ja).");
  err.statusCode = 502;
  throw err;
}

function ttsLang(code) {
  const raw = String(code || "vi");
  if (raw === "auto" || raw === "autodetect") return "vi";
  if (raw === "zh-CN" || raw === "zh") return "zh-CN";
  if (raw === "zh-TW") return "zh-TW";
  if (raw === "yue") return "zh-TW";
  return raw;
}

const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;

const VOICES = [
  { ma: "google", ten: "Google", gioi: "mac_dinh", lang: "*", engine: "google" },
  { ma: "hoaimy", ten: "Hoài My", gioi: "nu", lang: "vi", engine: "edge", id: "vi-VN-HoaiMyNeural", locale: "vi-VN" },
  { ma: "namminh", ten: "Nam Minh", gioi: "nam", lang: "vi", engine: "edge", id: "vi-VN-NamMinhNeural", locale: "vi-VN" },
  { ma: "aria", ten: "Aria", gioi: "nu", lang: "en", engine: "edge", id: "en-US-AriaNeural", locale: "en-US" },
  { ma: "jenny", ten: "Jenny", gioi: "nu", lang: "en", engine: "edge", id: "en-US-JennyNeural", locale: "en-US" },
  { ma: "guy", ten: "Guy", gioi: "nam", lang: "en", engine: "edge", id: "en-US-GuyNeural", locale: "en-US" },
  { ma: "davis", ten: "Davis", gioi: "nam", lang: "en", engine: "edge", id: "en-US-DavisNeural", locale: "en-US" },
  { ma: "sonia", ten: "Sonia", gioi: "nu", lang: "en", engine: "edge", id: "en-GB-SoniaNeural", locale: "en-GB" },
  { ma: "ryan", ten: "Ryan", gioi: "nam", lang: "en", engine: "edge", id: "en-GB-RyanNeural", locale: "en-GB" },
  { ma: "nanami", ten: "Nanami", gioi: "nu", lang: "ja", engine: "edge", id: "ja-JP-NanamiNeural", locale: "ja-JP" },
  { ma: "keita", ten: "Keita", gioi: "nam", lang: "ja", engine: "edge", id: "ja-JP-KeitaNeural", locale: "ja-JP" },
  { ma: "sunhi", ten: "SunHi", gioi: "nu", lang: "ko", engine: "edge", id: "ko-KR-SunHiNeural", locale: "ko-KR" },
  { ma: "injoon", ten: "InJoon", gioi: "nam", lang: "ko", engine: "edge", id: "ko-KR-InJoonNeural", locale: "ko-KR" },
  { ma: "xiaoxiao", ten: "Xiaoxiao", gioi: "nu", lang: "zh-CN", engine: "edge", id: "zh-CN-XiaoxiaoNeural", locale: "zh-CN" },
  { ma: "yunxi", ten: "Yunxi", gioi: "nam", lang: "zh-CN", engine: "edge", id: "zh-CN-YunxiNeural", locale: "zh-CN" },
  { ma: "hsiaochen", ten: "HsiaoChen", gioi: "nu", lang: "zh-TW", engine: "edge", id: "zh-TW-HsiaoChenNeural", locale: "zh-TW" },
  { ma: "premwadee", ten: "Premwadee", gioi: "nu", lang: "th", engine: "edge", id: "th-TH-PremwadeeNeural", locale: "th-TH" },
  { ma: "niwat", ten: "Niwat", gioi: "nam", lang: "th", engine: "edge", id: "th-TH-NiwatNeural", locale: "th-TH" },
  { ma: "denise", ten: "Denise", gioi: "nu", lang: "fr", engine: "edge", id: "fr-FR-DeniseNeural", locale: "fr-FR" },
  { ma: "henri", ten: "Henri", gioi: "nam", lang: "fr", engine: "edge", id: "fr-FR-HenriNeural", locale: "fr-FR" },
  { ma: "katja", ten: "Katja", gioi: "nu", lang: "de", engine: "edge", id: "de-DE-KatjaNeural", locale: "de-DE" },
  { ma: "conrad", ten: "Conrad", gioi: "nam", lang: "de", engine: "edge", id: "de-DE-ConradNeural", locale: "de-DE" },
  { ma: "elvira", ten: "Elvira", gioi: "nu", lang: "es", engine: "edge", id: "es-ES-ElviraNeural", locale: "es-ES" },
  { ma: "alvaro", ten: "Alvaro", gioi: "nam", lang: "es", engine: "edge", id: "es-ES-AlvaroNeural", locale: "es-ES" },
  { ma: "svetlana", ten: "Svetlana", gioi: "nu", lang: "ru", engine: "edge", id: "ru-RU-SvetlanaNeural", locale: "ru-RU" },
  { ma: "dmitry", ten: "Dmitry", gioi: "nam", lang: "ru", engine: "edge", id: "ru-RU-DmitryNeural", locale: "ru-RU" },
  { ma: "gadis", ten: "Gadis", gioi: "nu", lang: "id", engine: "edge", id: "id-ID-GadisNeural", locale: "id-ID" },
  { ma: "ardi", ten: "Ardi", gioi: "nam", lang: "id", engine: "edge", id: "id-ID-ArdiNeural", locale: "id-ID" }
];

const VOICE_ALIAS = {
  nu: "nu",
  female: "nu",
  woman: "nu",
  nuvi: "hoaimy",
  hoaimy: "hoaimy",
  my: "hoaimy",
  nam: "nam",
  male: "nam",
  man: "nam",
  namminh: "namminh",
  minh: "namminh",
  google: "google",
  gtx: "google",
  macdinh: "google"
};

function voicePublic(v) {
  return { ma: v.ma, ten: v.ten, gioi: v.gioi, ngon_ngu: v.lang };
}

function voicesCatalog() {
  return {
    tong_so: VOICES.length,
    mac_dinh: "google",
    param: "giong",
    chon: "giong=hoaimy | giong=namminh | giong=nu | giong=nam | giong=aria | giong=guy",
    danh_sach: VOICES.map(voicePublic)
  };
}

function resolveVoice(raw, lang) {
  const folded = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  const want = VOICE_ALIAS[folded] || folded;
  const langBase = String(lang || "vi").split("-")[0];
  if (want === "nu" || want === "nam") {
    const hit = VOICES.find((v) => v.gioi === want && (v.lang === lang || v.lang === langBase) && v.engine === "edge");
    if (hit) return hit;
  }
  const named = VOICES.find((v) => v.ma === want || v.id === raw);
  if (named) return named;
  return VOICES[0];
}

function splitTtsChunks(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  if (s.length <= max) return [s];
  const parts = [];
  let rest = s;
  while (rest.length) {
    if (rest.length <= max) {
      parts.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(" ", max);
    if (cut < Math.floor(max * 0.4)) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return parts.filter(Boolean);
}

async function fetchTtsChunk(chunk, lang) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "audio/mpeg,audio/*,*/*;q=0.8",
    Referer: "https://translate.google.com/",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
  };
  const urls = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(chunk)}`
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 80) return buf;
    } catch (_) {}
  }
  return null;
}

async function googleSpeak(text, lang) {
  const chunks = splitTtsChunks(text, TTS_CHUNK);
  const buffers = [];
  for (const chunk of chunks) {
    const buf = await fetchTtsChunk(chunk, lang);
    if (!buf) return null;
    buffers.push(buf);
  }
  return buffers.length ? Buffer.concat(buffers) : null;
}

function edgeGec() {
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks * 1e7);
  return crypto.createHash("sha256").update(String(ticks) + EDGE_TOKEN, "ascii").digest("hex").toUpperCase();
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBuf(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return Buffer.from(data);
}

function extractAudio(buf) {
  const needle = Buffer.from("Path:audio\r\n");
  const idx = buf.indexOf(needle);
  if (idx >= 0) return buf.slice(idx + needle.length);
  if (buf.length > 2) {
    const headerLen = buf.readUInt16BE(0);
    if (headerLen > 0 && headerLen < buf.length - 2) return buf.slice(2 + headerLen);
  }
  return Buffer.alloc(0);
}

async function edgeSpeak(text, voice) {
  if (typeof WebSocket === "undefined" || !voice || !voice.id) return null;
  const reqId = crypto.randomUUID().replace(/-/g, "");
  const locale = voice.locale || "vi-VN";
  const url = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=" + EDGE_TOKEN + "&Sec-MS-GEC=" + edgeGec() + "&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=" + reqId;
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new WebSocket(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
          Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
        }
      });
    } catch (_) {
      return resolve(null);
    }
    const chunks = [];
    let chain = Promise.resolve();
    let settled = false;
    const done = (buf) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      resolve(buf && buf.length > 80 ? buf : null);
    };
    const timer = setTimeout(() => done(chunks.length ? Buffer.concat(chunks) : null), 8000);
    ws.addEventListener("open", () => {
      const ts = new Date().toUTCString();
      ws.send(
        "X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
        JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundary: "false", wordBoundary: "false" }, outputFormat: "audio-24khz-48kbitrate-mono-mp3" } } } })
      );
      const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='" + locale + "'><voice name='" + voice.id + "'>" + xmlEscape(text) + "</voice></speak>";
      ws.send("X-RequestId:" + reqId + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + ts + "Z\r\nPath:ssml\r\n\r\n" + ssml);
    });
    ws.addEventListener("message", (ev) => {
      chain = chain.then(async () => {
        let data = ev.data;
        if (data && typeof data !== "string" && typeof data.arrayBuffer === "function") {
          data = Buffer.from(await data.arrayBuffer());
        }
        if (typeof data === "string") {
          if (data.includes("Path:turn.end")) {
            clearTimeout(timer);
            done(chunks.length ? Buffer.concat(chunks) : null);
          }
          return;
        }
        const audio = extractAudio(toBuf(data));
        if (audio.length) chunks.push(audio);
      }).catch(() => {});
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      done(null);
    });
  });
}

async function synthesizeVoice(text, lang, voiceMa) {
  const voice = resolveVoice(voiceMa, lang);
  let buf = null;
  let used = voice;
  if (voice.engine === "edge") buf = await edgeSpeak(text, voice);
  if (!buf) {
    buf = await googleSpeak(text, lang);
    if (voice.engine !== "google") used = VOICES[0];
  }
  if (!buf) {
    const err = new Error("Không tạo được giọng nói. Thử câu ngắn hơn hoặc đổi giong=.");
    err.statusCode = 502;
    throw err;
  }
  return { buf, voice: used, mime: "audio/mpeg" };
}

function voiceListenUrl(baseUrl, text, lang, giong) {
  let url = `${baseUrl}/api/tools/trans?action=voice&text=${encodeURIComponent(text)}&to=${encodeURIComponent(lang)}&format=mp3`;
  if (giong) url += `&giong=${encodeURIComponent(giong)}`;
  return url;
}

function sendAudio(res, buf, mime) {
  const type = mime || "audio/mpeg";
  const ext = type.includes("wav") ? "wav" : "mp3";
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `inline; filename="zhee-voice.${ext}"`);
  res.setHeader("Content-Length", String(buf.length));
  if (typeof res.send === "function") return res.status(200).send(buf);
  res.statusCode = 200;
  return res.end(buf);
}

function wantsAudio(req, params, body, action) {
  if (action === "nghe" || action === "mp3" || action === "audio") return true;
  const format = (pick(params, body, "format", "kieu", "output") || "").toLowerCase();
  if (format === "mp3" || format === "audio" || format === "mpeg") return true;
  const accept = String(req.headers.accept || "");
  return /audio\/mpeg|audio\/\*/i.test(accept) && !/application\/json/i.test(accept);
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Dịch Thuật Đa Ngôn Ngữ (/tools/trans)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Dịch văn bản giữa các ngôn ngữ (tự nhận diện nguồn). Mặc định dịch sang tiếng Việt. Có voice: văn bản sang giọng nói MP3.",
    cu_phap: [
      `${baseUrl}/api/tools/trans?={cau_can_dich}`,
      `${baseUrl}/api/tools/trans?text={cau}&to={ma_ngon_ngu}`,
      `${baseUrl}/api/tools/trans?text={cau}&from={nguon}&to={dich}`,
      `${baseUrl}/api/tools/trans?action=voice&text={cau}&to={ma_ngon_ngu}`,
      `${baseUrl}/api/tools/trans?action=voice&text={cau}&to=vi&giong=nu`,
      `${baseUrl}/api/tools/trans?action=voice&text={cau}&to=en&giong=brian&format=mp3`,
      `${baseUrl}/api/tools/trans?action=voices`,
      `${baseUrl}/api/tools/trans?action=langs`
    ],
    vi_du: [
      `${baseUrl}/api/tools/trans?=Hello, how are you?`,
      `${baseUrl}/api/tools/trans?text=${encodeURIComponent("Xin chào")}&to=en`,
      `${baseUrl}/api/tools/trans?text=${encodeURIComponent("こんにちは")}&to=vi`,
      `${baseUrl}/api/tools/trans?text=I love you&to=ja`,
      `${baseUrl}/api/tools/trans?action=voice&text=${encodeURIComponent("Xin chào, mình là Zhee")}&to=vi&giong=nu`,
      `${baseUrl}/api/tools/trans?action=voice&text=${encodeURIComponent("Xin chào")}&to=vi&giong=nam`,
      `${baseUrl}/api/tools/trans?action=voice&text=Hello how are you&to=en&giong=brian&format=mp3`
    ],
    vi_du_post: {
      text: "Xin chào, bạn khỏe không?",
      from: "auto",
      to: "en"
    },
    alias_thuong_dung: {
      vi: "viet / vn / tieng viet",
      en: "anh / english",
      ja: "nhat / jp",
      ko: "han / kr",
      "zh-CN": "trung / cn",
      fr: "phap",
      de: "duc",
      ru: "nga",
      th: "thai",
      lo: "lao",
      km: "khmer"
    },
    giong_kha_dung: voicesCatalog(),
    voice: {
      mo_ta: "Văn bản sang giọng nói MP3. Chọn giọng bằng giong=. Tiếng Việt: hoaimy (nữ), namminh (nam).",
      gioi_han: `Tối đa ${MAX_TTS} ký tự mỗi lần đọc.`
    },
    gioi_han: `Dịch tối đa ${MAX_TEXT} ký tự. Voice tối đa ${MAX_TTS} ký tự. from mặc định auto, to mặc định vi.`
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const params = parseRawQuery(req.url);
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const action = (pick(params, body, "action", "type") || "").toLowerCase();

  if (action === "langs" || action === "languages" || action === "ngonngu" || params.langs === "1") {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Danh sách ngôn ngữ /tools/trans",
      tong_so: Object.keys(LANGUAGES).length,
      ngon_ngu: LANGUAGES,
      giong_kha_dung: voicesCatalog(),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (action === "voices" || action === "giong" || params.voices === "1") {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Danh sách giọng đọc /tools/trans",
      ...voicesCatalog(),
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  const text = pick(params, body, "text", "q", "content", "cau", "msg", "message") || String(params[""] || "").trim();
  if (!text) {
    return res.status(200).json(buildGuide(baseUrl));
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: `Văn bản tối đa ${MAX_TEXT} ký tự. Hiện ${text.length} ký tự.`
    });
  }

  const from = normalizeLang(pick(params, body, "from", "sl", "nguon", "source"), "auto");
  const to = normalizeLang(pick(params, body, "to", "tl", "dich", "target", "lang"), "vi");
  const kieu = (pick(params, body, "kieu") || "").toLowerCase();
  const isVoice = /^(voice|tts|nghe|doc|mp3|audio)$/.test(action) || kieu === "voice" || kieu === "tts";

  if (!from) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Mã ngôn ngữ nguồn không hợp lệ. Xem danh sách: /api/tools/trans?action=langs"
    });
  }
  if (!to) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Mã ngôn ngữ đích không hợp lệ. Ví dụ to=en, to=ja, to=vi, to=han. Xem /api/tools/trans?action=langs"
    });
  }

  if (isVoice) {
    if (text.length > MAX_TTS) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: `Voice tối đa ${MAX_TTS} ký tự mỗi lần. Hiện ${text.length} ký tự.`
      });
    }
    const speakLang = ttsLang(to === "auto" ? "vi" : to);
    const giongRaw = pick(params, body, "giong", "voice", "speaker", "voice_id");
    try {
      const spoken = await synthesizeVoice(text, speakLang, giongRaw);
      if (wantsAudio(req, params, body, action)) return sendAudio(res, spoken.buf, spoken.mime);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "Văn bản sang giọng nói",
        van_ban: text,
        ngon_ngu: {
          ma: speakLang,
          ten: languageName(speakLang)
        },
        giong_yeu_cau: giongRaw || "google",
        giong: voicePublic(spoken.voice),
        giong_kha_dung: voicesCatalog(),
        dinh_dang: spoken.mime,
        dung_luong_byte: spoken.buf.length,
        link_nghe: voiceListenUrl(baseUrl, text, speakLang, spoken.voice.ma),
        file_base64: spoken.buf.toString("base64"),
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        trang_thai: "that_bai",
        ma_loi: error.statusCode || 502,
        thong_bao: error.message || "Không tạo được giọng nói."
      });
    }
  }

  try {
    const result = await translateText(text, from, to);
    const detected = result.src && result.src !== "auto" ? result.src : from;
    const speakLang = ttsLang(to);
    const spoken = result.text || text;
    const out = {
      trang_thai: "thanh_cong",
      chuyen_muc: "Dịch Thuật Đa Ngôn Ngữ",
      van_ban_goc: text,
      ban_dich: result.text,
      nguon: {
        ma: detected === "autodetect" ? "auto" : detected,
        ten: languageName(detected === "autodetect" ? from : detected)
      },
      dich_sang: {
        ma: to,
        ten: languageName(to)
      },
      may_dich: result.engine,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
    if (spoken.length <= MAX_TTS) {
      out.voice = {
        mo_ta: "Giọng đọc bản dịch",
        ngon_ngu: speakLang,
        giong_mac_dinh: "google",
        link_nghe: voiceListenUrl(baseUrl, spoken, speakLang, "google"),
        link_nu: voiceListenUrl(baseUrl, spoken, speakLang, "nu"),
        link_nam: voiceListenUrl(baseUrl, spoken, speakLang, "nam"),
        giong_kha_dung: voicesCatalog()
      };
    }
    return res.status(200).json(out);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      trang_thai: "that_bai",
      ma_loi: error.statusCode || 500,
      thong_bao: error.message || "Lỗi dịch thuật."
    });
  }
};
