/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const TIMEOUT_MS = 8000;
const MAX_MODELS_GROUP = 80;
const AUTHOR = "Hồ Đức Minh (Zhee Dev)";

const NHA_ALIAS = {
  openai: "openai", chatgpt: "openai", gpt: "openai",
  gemini: "gemini", google: "gemini", studio: "gemini",
  xai: "xai", grok: "xai", spacexai: "xai",
  anthropic: "anthropic", claude: "anthropic",
  groq: "groq",
  openrouter: "openrouter", or: "openrouter",
  deepseek: "deepseek",
  mistral: "mistral",
  together: "together",
  perplexity: "perplexity", pplx: "perplexity",
  cohere: "cohere",
  fireworks: "fireworks",
  siliconflow: "siliconflow", sf: "siliconflow",
  moonshot: "moonshot", kimi: "moonshot",
  huggingface: "huggingface", hf: "huggingface",
  nvidia: "nvidia", nim: "nvidia",
  replicate: "replicate"
};

const NHA_TEN = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  xai: "xAI (Grok)",
  anthropic: "Anthropic (Claude)",
  groq: "Groq",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  together: "Together AI",
  perplexity: "Perplexity",
  cohere: "Cohere",
  fireworks: "Fireworks",
  siliconflow: "SiliconFlow",
  moonshot: "Moonshot (Kimi)",
  huggingface: "Hugging Face",
  nvidia: "NVIDIA NIM",
  replicate: "Replicate"
};

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

function compact(value) {
  if (Array.isArray(value)) {
    const list = value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
    return list.length ? list : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "" || item === false) continue;
      const next = compact(item);
      if (next === undefined || next === null || next === "") continue;
      if (typeof next === "object" && !Array.isArray(next) && !Object.keys(next).length) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
}

function maskKey(key) {
  const s = String(key || "");
  if (s.length <= 12) return `${s.slice(0, 4)}••••`;
  return `${s.slice(0, 8)}••••${s.slice(-4)}`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function fmtNum(value) {
  const n = num(value);
  if (n === undefined) return undefined;
  return n.toLocaleString("vi-VN");
}

function headerGet(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

function parseRateHeaders(headers) {
  const map = {
    request_con: headerGet(headers, "x-ratelimit-remaining-requests") || headerGet(headers, "x-ratelimit-remaining"),
    request_gioi_han: headerGet(headers, "x-ratelimit-limit-requests") || headerGet(headers, "x-ratelimit-limit"),
    token_con: headerGet(headers, "x-ratelimit-remaining-tokens"),
    token_gioi_han: headerGet(headers, "x-ratelimit-limit-tokens"),
    reset_request: headerGet(headers, "x-ratelimit-reset-requests"),
    reset_token: headerGet(headers, "x-ratelimit-reset-tokens"),
    anthropic_request_con: headerGet(headers, "anthropic-ratelimit-requests-remaining"),
    anthropic_request_gioi_han: headerGet(headers, "anthropic-ratelimit-requests-limit"),
    anthropic_token_con: headerGet(headers, "anthropic-ratelimit-tokens-remaining") || headerGet(headers, "anthropic-ratelimit-input-tokens-remaining"),
    anthropic_token_gioi_han: headerGet(headers, "anthropic-ratelimit-tokens-limit") || headerGet(headers, "anthropic-ratelimit-input-tokens-limit")
  };
  const han = {};
  const reqCon = num(map.request_con || map.anthropic_request_con);
  const reqMax = num(map.request_gioi_han || map.anthropic_request_gioi_han);
  const tokCon = num(map.token_con || map.anthropic_token_con);
  const tokMax = num(map.token_gioi_han || map.anthropic_token_gioi_han);
  if (reqCon !== undefined) han.request_con = reqCon;
  if (reqMax !== undefined) han.request_gioi_han = reqMax;
  if (tokCon !== undefined) han.token_con = tokCon;
  if (tokMax !== undefined) han.token_gioi_han = tokMax;
  if (tokCon !== undefined) han.token_con_chu = `${fmtNum(tokCon)} token (rate limit cửa sổ hiện tại)`;
  if (reqCon !== undefined) han.request_con_chu = `${fmtNum(reqCon)} request (rate limit cửa sổ hiện tại)`;
  const reset = map.reset_token || map.reset_request;
  if (reset) han.reset = reset;
  if (!Object.keys(han).length) return undefined;
  if ((han.request_gioi_han === 0 || han.request_gioi_han === undefined) && (han.token_gioi_han === 0 || han.token_gioi_han === undefined)) {
    return undefined;
  }
  han.ghi_chu = "Đây là hạn mức tốc độ (RPM/TPM) của cửa sổ hiện tại, không phải tổng token tài khoản.";
  return han;
}

function errText(json, fallback) {
  if (!json) return fallback;
  const e = json.error;
  if (typeof e === "string" && e.trim()) return e.trim();
  if (e && typeof e === "object") {
    const msg = e.message || e.msg || e.status || e.code;
    if (msg) return String(msg);
  }
  if (json.message) return String(json.message);
  if (json.msg) return String(json.msg);
  if (json.detail) return String(json.detail);
  return fallback;
}

function classifyId(id, extra = "") {
  const s = `${id} ${extra}`.toLowerCase();
  if (/embed|embedding/.test(s)) return "embedding";
  if (/moderation|safety/.test(s)) return "moderation";
  if (/whisper|tts|speech|audio|realtime/.test(s)) return "audio";
  if (/video|veo/.test(s)) return "video";
  if (/dall-e|imagen|image|imagine|flux|stable-diffusion|sdxl|picture/.test(s)) return "image";
  return "chat";
}

function groupModels(ids) {
  const groups = { chat: [], image: [], embedding: [], audio: [], video: [], khac: [] };
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || "").replace(/^models\//, "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const bucket = classifyId(id);
    if (groups[bucket]) groups[bucket].push(id);
    else groups.khac.push(id);
  }
  const out = {};
  let total = 0;
  for (const [key, list] of Object.entries(groups)) {
    if (!list.length) continue;
    total += list.length;
    out[key] = list.length > MAX_MODELS_GROUP ? list.slice(0, MAX_MODELS_GROUP) : list;
    if (list.length > MAX_MODELS_GROUP) out[`${key}_con`] = list.length - MAX_MODELS_GROUP;
  }
  return { so_module: total, module_co_the_dung: out };
}

function collectIds(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.data)) {
    return payload.data.map((item) => (typeof item === "string" ? item : item.id || item.name || item.model)).filter(Boolean);
  }
  if (Array.isArray(payload.models)) {
    return payload.models.map((item) => (typeof item === "string" ? item : item.name || item.id || item.model)).filter(Boolean);
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => (typeof item === "string" ? item : item.id || item.name)).filter(Boolean);
  }
  return [];
}

async function httpJson(url, headers) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "ZheeAPI/1.0", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, json, headers: res.headers, text: text.slice(0, 400) };
}

function bearer(key) {
  return { Authorization: `Bearer ${key}` };
}

function detectProvider(key, override) {
  const forced = NHA_ALIAS[String(override || "").trim().toLowerCase()];
  if (forced) return forced;
  const k = String(key || "").trim();
  if (/^sk-ant-/i.test(k)) return "anthropic";
  if (/^sk-or-/i.test(k)) return "openrouter";
  if (/^sk-proj-/i.test(k) || /^sk-svcacct-/i.test(k) || /^sk-admin-/i.test(k)) return "openai";
  if (/^gsk_/i.test(k)) return "groq";
  if (/^xai-/i.test(k)) return "xai";
  if (/^AIza/i.test(k)) return "gemini";
  if (/^pplx-/i.test(k)) return "perplexity";
  if (/^r8_/i.test(k)) return "replicate";
  if (/^hf_/i.test(k)) return "huggingface";
  if (/^nvapi-/i.test(k)) return "nvidia";
  if (/^sk-[a-f0-9]{32}$/i.test(k)) return "deepseek";
  if (/^sk-/i.test(k)) return "openai";
  return "";
}

function statusFromHttp(http, json) {
  const msg = errText(json, "").toLowerCase();
  const code = String(json?.error?.code || json?.error?.type || "").toLowerCase();
  const expired = /expir|hết hạn|revoked|disabled|deactivated|invalid.*key|incorrect api key|api key not valid|authentication/.test(msg) && (http.status === 401 || http.status === 403);
  const noQuota = http.status === 402
    || /insufficient_quota|credit_balance_exhausted|quota|billing|no credits|out of credits|balance is too low|payment required/.test(`${msg} ${code}`);
  const rate = http.status === 429 && !noQuota;
  const invalid = http.status === 401 || /invalid_api_key|incorrect api key|api key not valid|unauthorized|invalid x-api-key|authentication_error/.test(`${msg} ${code}`);
  return { expired, noQuota, rate, invalid, msg: errText(json, `HTTP ${http.status}`) };
}

function buildResult({ nha, key, hopLe, conHan, hetQuota, hetHan, hetHanLuc, soDu, hanMuc, models, quyen, ghiChu, goiY, lyDo }) {
  const grouped = groupModels(models || []);
  const tom = [];
  if (hopLe === "CÓ" && conHan === "CÓ") tom.push(`Key ${NHA_TEN[nha] || nha} còn hạn.`);
  else if (hopLe === "KHÔNG") tom.push(`Key ${NHA_TEN[nha] || nha} không hợp lệ hoặc đã bị thu hồi.`);
  else tom.push(`Key ${NHA_TEN[nha] || nha} không dùng được.`);
  if (hetQuota === "CÓ") tom.push("Hết quota/số dư.");
  if (grouped.so_module) tom.push(`${grouped.so_module} module/model dùng được.`);
  if (soDu?.con_lai_chu) tom.push(`Còn ${soDu.con_lai_chu}.`);
  else if (soDu?.tong_chu) tom.push(`Số dư ${soDu.tong_chu}.`);
  if (hanMuc?.token_con_chu) tom.push(`Rate limit: ${hanMuc.token_con_chu}.`);
  if (ghiChu) tom.push(ghiChu);

  return compact({
    nha_cung_cap: NHA_TEN[nha] || nha,
    nha_id: nha,
    key_an: maskKey(key),
    hop_le: hopLe,
    con_han: conHan,
    het_quota: (hopLe === "CÓ" || hetQuota === "CÓ") ? hetQuota : undefined,
    het_han: (hopLe === "CÓ" || hetHan === "CÓ") ? hetHan : undefined,
    het_han_luc: hetHanLuc,
    so_du: soDu,
    han_muc_toc_do: hanMuc,
    so_module: grouped.so_module || undefined,
    module_co_the_dung: grouped.so_module ? grouped.module_co_the_dung : undefined,
    quyen,
    tom_tat: tom.join(" "),
    ghi_chu: ghiChu,
    goi_y: goiY,
    ly_do: lyDo
  });
}

async function checkOpenAiCompat(nha, key, modelsUrl, extraUrls = []) {
  const jobs = [httpJson(modelsUrl, bearer(key)), ...extraUrls.map((u) => httpJson(u.url, u.headers || bearer(key)))];
  const [modelsRes, ...rest] = await Promise.all(jobs);
  const st = statusFromHttp(modelsRes, modelsRes.json);
  const hanMuc = parseRateHeaders(modelsRes.headers);
  if (!modelsRes.ok) {
    const goiY = nha === "openai" && /^sk-(?!proj-|svcacct-|admin-)/i.test(key)
      ? "Prefix sk- cũng dùng cho DeepSeek/Mistral/Moonshot/SiliconFlow. Thêm nha=deepseek (hoặc nha=mistral) nếu đây không phải OpenAI."
      : undefined;
    return buildResult({
      nha,
      key,
      hopLe: st.invalid ? "KHÔNG" : (st.rate || st.noQuota ? "CÓ" : "KHÔNG"),
      conHan: st.rate || st.noQuota ? "CÓ" : "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: st.invalid && /expir/.test(st.msg.toLowerCase()) ? "CÓ" : "KHÔNG",
      hanMuc,
      goiY,
      lyDo: st.msg,
      ghiChu: st.noQuota ? "Key còn hạn nhưng hết credit/quota." : undefined
    });
  }
  const extra = {};
  for (const item of rest) {
    if (item?.ok && item.json) Object.assign(extra, flattenExtra(nha, item.json));
  }
  return buildResult({
    nha,
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: "KHÔNG",
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    hanMuc,
    models: collectIds(modelsRes.json),
    quyen: extra.quyen,
    hetHanLuc: extra.het_han_luc,
    ghiChu: extra.ghi_chu || quotaNote(nha)
  });
}

function quotaNote(nha) {
  if (nha === "openrouter" || nha === "deepseek" || nha === "siliconflow" || nha === "moonshot") return undefined;
  if (nha === "gemini") return "Google AI Studio không công khai tổng token/số dư còn lại qua API key. Hết hạn mức thì trả 429 RESOURCE_EXHAUSTED.";
  if (nha === "openai") return "Inference key OpenAI không đọc được số dư tài khoản. Muốn xem billing phải dùng Admin key trên platform.openai.com. Token_con ở trên là rate limit/phút, không phải tổng token gói.";
  if (nha === "xai") return "xAI không trả số credit còn lại qua inference key. Xem số dư tại console.x.ai.";
  if (nha === "anthropic") return "Anthropic không công khai số dư credit qua inference key. Token_con là rate limit cửa sổ hiện tại.";
  return "Nhà cung cấp này không công khai tổng token tài khoản. Chỉ có model list + rate limit (nếu header có).";
}

function flattenExtra(nha, json) {
  if (nha === "openrouter") {
    const d = json.data || json;
    const limit = d.limit_remaining;
    const usage = d.usage;
    const so_du = compact({
      nhan: d.label,
      goi_free: d.is_free_tier ? "CÓ" : "KHÔNG",
      da_dung: num(usage),
      da_dung_chu: usage != null ? `${fmtNum(usage)} credit` : undefined,
      han_key: d.limit == null ? "Không gắn trần trên key" : num(d.limit),
      con_lai: limit == null ? undefined : num(limit),
      con_lai_chu: limit == null ? "Không gắn trần trên key (không có nghĩa là vô hạn credit tài khoản)" : `${fmtNum(limit)} credit`,
      reset_tran: d.limit_reset,
      dung_hom_nay: num(d.usage_daily),
      dung_tuan: num(d.usage_weekly),
      dung_thang: num(d.usage_monthly)
    });
    return { so_du, ghi_chu: "limit_remaining là trần credit gắn trên key. Số dư cả tài khoản khác — xem /credits nếu dùng management key." };
  }
  if (nha === "deepseek") {
    const info = Array.isArray(json.balance_infos) ? json.balance_infos[0] : null;
    const so_du = compact({
      con_goi_api: json.is_available ? "CÓ" : "KHÔNG",
      tien_te: info?.currency,
      tong: info?.total_balance,
      tong_chu: info ? `${info.total_balance} ${info.currency}` : undefined,
      con_lai_chu: info ? `${info.total_balance} ${info.currency}` : undefined,
      tang: info?.granted_balance,
      nap: info?.topped_up_balance
    });
    return { so_du };
  }
  if (nha === "xai") {
    const acls = Array.isArray(json.acls) ? json.acls : (Array.isArray(json.aclStrings) ? json.aclStrings : undefined);
    return compact({
      quyen: acls,
      het_han_luc: json.expire_time || json.expireTime,
      ghi_chu: json.blocked || json.team_blocked ? "Key hoặc team đang bị khóa." : quotaNote("xai")
    });
  }
  if (nha === "siliconflow") {
    const d = json.data || json;
    const so_du = compact({
      tong: d.totalBalance || d.total_balance,
      con_lai_chu: d.totalBalance || d.total_balance,
      nap: d.chargeBalance || d.charge_balance,
      balance: d.balance
    });
    return { so_du };
  }
  if (nha === "moonshot") {
    const d = json.data || json;
    const so_du = compact({
      con_lai: num(d.available_balance),
      con_lai_chu: d.available_balance != null ? String(d.available_balance) : undefined,
      voucher: d.voucher_balance,
      tien_mat: d.cash_balance
    });
    return { so_du };
  }
  if (nha === "huggingface") {
    return { ghi_chu: json.name ? `Tài khoản HF: ${json.name}` : undefined };
  }
  if (nha === "replicate") {
    const so_du = compact({
      loai: json.type,
      username: json.username
    });
    return { so_du };
  }
  return {};
}

async function checkAccountOnly(nha, key, url) {
  const res = await httpJson(url, bearer(key));
  const st = statusFromHttp(res, res.json);
  if (!res.ok) {
    return buildResult({
      nha,
      key,
      hopLe: "KHÔNG",
      conHan: "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: "KHÔNG",
      lyDo: st.msg
    });
  }
  const extra = flattenExtra(nha, res.json);
  const ten = res.json?.name || res.json?.username || res.json?.email;
  return buildResult({
    nha,
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: "KHÔNG",
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    ghiChu: ten
      ? `Tài khoản: ${ten}. Key không gắn danh sách model cố định — gọi từng model khi dùng.`
      : "Key còn hạn. Nhà này không trả danh sách module gắn trên key."
  });
}

async function checkGemini(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`;
  const res = await httpJson(url, {});
  const st = statusFromHttp(res, res.json);
  const models = (res.json?.models || []).filter((m) => {
    const methods = m.supportedGenerationMethods || [];
    return methods.includes("generateContent") || methods.includes("embedContent") || methods.includes("predict");
  }).map((m) => m.name || m.displayName);
  if (!res.ok) {
    return buildResult({
      nha: "gemini",
      key,
      hopLe: st.invalid ? "KHÔNG" : (st.rate || st.noQuota ? "CÓ" : "KHÔNG"),
      conHan: st.rate || st.noQuota ? "CÓ" : "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: "KHÔNG",
      lyDo: st.msg,
      ghiChu: st.noQuota ? "Key còn hạn nhưng hết hạn mức Google." : undefined
    });
  }
  return buildResult({
    nha: "gemini",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: "KHÔNG",
    hetHan: "KHÔNG",
    models,
    ghiChu: quotaNote("gemini")
  });
}

async function checkAnthropic(key) {
  const res = await httpJson("https://api.anthropic.com/v1/models?limit=100", {
    "x-api-key": key,
    "anthropic-version": "2023-06-01"
  });
  const st = statusFromHttp(res, res.json);
  const hanMuc = parseRateHeaders(res.headers);
  if (!res.ok) {
    return buildResult({
      nha: "anthropic",
      key,
      hopLe: st.invalid ? "KHÔNG" : (st.rate || st.noQuota ? "CÓ" : "KHÔNG"),
      conHan: st.rate || st.noQuota ? "CÓ" : "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: "KHÔNG",
      hanMuc,
      lyDo: st.msg
    });
  }
  return buildResult({
    nha: "anthropic",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: "KHÔNG",
    hetHan: "KHÔNG",
    hanMuc,
    models: collectIds(res.json),
    ghiChu: quotaNote("anthropic")
  });
}

async function checkOpenRouter(key) {
  const [keyRes, modelsRes] = await Promise.all([
    httpJson("https://openrouter.ai/api/v1/key", bearer(key)),
    httpJson("https://openrouter.ai/api/v1/models", bearer(key))
  ]);
  const primary = keyRes.ok ? keyRes : modelsRes;
  const st = statusFromHttp(primary, primary.json);
  if (!keyRes.ok && !modelsRes.ok) {
    return buildResult({
      nha: "openrouter",
      key,
      hopLe: st.invalid ? "KHÔNG" : "KHÔNG",
      conHan: "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: "KHÔNG",
      lyDo: st.msg
    });
  }
  const extra = keyRes.ok ? flattenExtra("openrouter", keyRes.json) : {};
  const hetQuota = extra.so_du && extra.so_du.con_lai === 0 ? "CÓ" : "KHÔNG";
  return buildResult({
    nha: "openrouter",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota,
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    models: modelsRes.ok ? collectIds(modelsRes.json) : [],
    ghiChu: extra.ghi_chu
  });
}

async function checkDeepSeek(key) {
  const [bal, models] = await Promise.all([
    httpJson("https://api.deepseek.com/user/balance", bearer(key)),
    httpJson("https://api.deepseek.com/models", bearer(key))
  ]);
  const primary = bal.ok || models.ok ? (bal.ok ? bal : models) : bal;
  const st = statusFromHttp(primary, primary.json);
  if (!bal.ok && !models.ok) {
    return buildResult({
      nha: "deepseek",
      key,
      hopLe: "KHÔNG",
      conHan: "KHÔNG",
      hetQuota: "KHÔNG",
      hetHan: "KHÔNG",
      lyDo: st.msg
    });
  }
  const extra = bal.ok ? flattenExtra("deepseek", bal.json) : {};
  const hetQuota = extra.so_du && extra.so_du.con_goi_api === "KHÔNG" ? "CÓ" : "KHÔNG";
  return buildResult({
    nha: "deepseek",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota,
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    models: models.ok ? collectIds(models.json) : [],
    hanMuc: parseRateHeaders((models.ok ? models : bal).headers)
  });
}

async function checkXai(key) {
  const [models, info] = await Promise.all([
    httpJson("https://api.x.ai/v1/models", bearer(key)),
    httpJson("https://api.x.ai/v1/api-key", bearer(key))
  ]);
  const st = statusFromHttp(models, models.json);
  if (!models.ok) {
    return buildResult({
      nha: "xai",
      key,
      hopLe: st.invalid ? "KHÔNG" : (st.rate || st.noQuota ? "CÓ" : "KHÔNG"),
      conHan: st.rate || st.noQuota ? "CÓ" : "KHÔNG",
      hetQuota: st.noQuota ? "CÓ" : "KHÔNG",
      hetHan: "KHÔNG",
      hanMuc: parseRateHeaders(models.headers),
      lyDo: st.msg
    });
  }
  const extra = info.ok ? flattenExtra("xai", info.json) : {};
  let hetHan = "KHÔNG";
  if (extra.het_han_luc) {
    const t = Date.parse(extra.het_han_luc);
    if (Number.isFinite(t) && t < Date.now()) hetHan = "CÓ";
  }
  return buildResult({
    nha: "xai",
    key,
    hopLe: "CÓ",
    conHan: hetHan === "CÓ" ? "KHÔNG" : "CÓ",
    hetQuota: "KHÔNG",
    hetHan,
    hetHanLuc: extra.het_han_luc,
    models: collectIds(models.json),
    quyen: extra.quyen,
    hanMuc: parseRateHeaders(models.headers),
    ghiChu: extra.ghi_chu || quotaNote("xai")
  });
}

async function checkSiliconFlow(key) {
  const [info, models] = await Promise.all([
    httpJson("https://api.siliconflow.cn/v1/user/info", bearer(key)),
    httpJson("https://api.siliconflow.cn/v1/models", bearer(key))
  ]);
  if (!info.ok && !models.ok) {
    const st = statusFromHttp(info, info.json);
    return buildResult({ nha: "siliconflow", key, hopLe: "KHÔNG", conHan: "KHÔNG", hetQuota: "KHÔNG", hetHan: "KHÔNG", lyDo: st.msg });
  }
  const extra = info.ok ? flattenExtra("siliconflow", info.json) : {};
  return buildResult({
    nha: "siliconflow",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: "KHÔNG",
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    models: models.ok ? collectIds(models.json) : []
  });
}

async function checkMoonshot(key) {
  const bases = ["https://api.moonshot.cn/v1", "https://api.moonshot.ai/v1"];
  let bal = { ok: false, json: null, headers: null, status: 0 };
  let models = { ok: false, json: null, headers: null, status: 0 };
  for (const base of bases) {
    const [b, m] = await Promise.all([
      httpJson(`${base}/users/me/balance`, bearer(key)),
      httpJson(`${base}/models`, bearer(key))
    ]);
    if (b.ok || m.ok) { bal = b; models = m; break; }
    bal = b; models = m;
  }
  if (!bal.ok && !models.ok) {
    const st = statusFromHttp(bal, bal.json);
    return buildResult({ nha: "moonshot", key, hopLe: "KHÔNG", conHan: "KHÔNG", hetQuota: "KHÔNG", hetHan: "KHÔNG", lyDo: st.msg });
  }
  const extra = bal.ok ? flattenExtra("moonshot", bal.json) : {};
  return buildResult({
    nha: "moonshot",
    key,
    hopLe: "CÓ",
    conHan: "CÓ",
    hetQuota: extra.so_du && extra.so_du.con_lai === 0 ? "CÓ" : "KHÔNG",
    hetHan: "KHÔNG",
    soDu: extra.so_du,
    models: models.ok ? collectIds(models.json) : []
  });
}

async function runCheck(nha, key) {
  switch (nha) {
    case "openai":
      return checkOpenAiCompat("openai", key, "https://api.openai.com/v1/models");
    case "gemini":
      return checkGemini(key);
    case "xai":
      return checkXai(key);
    case "anthropic":
      return checkAnthropic(key);
    case "groq":
      return checkOpenAiCompat("groq", key, "https://api.groq.com/openai/v1/models");
    case "openrouter":
      return checkOpenRouter(key);
    case "deepseek":
      return checkDeepSeek(key);
    case "mistral":
      return checkOpenAiCompat("mistral", key, "https://api.mistral.ai/v1/models");
    case "together":
      return checkOpenAiCompat("together", key, "https://api.together.xyz/v1/models");
    case "perplexity":
      return checkOpenAiCompat("perplexity", key, "https://api.perplexity.ai/models");
    case "cohere":
      return checkOpenAiCompat("cohere", key, "https://api.cohere.com/v1/models");
    case "fireworks":
      return checkOpenAiCompat("fireworks", key, "https://api.fireworks.ai/inference/v1/models");
    case "siliconflow":
      return checkSiliconFlow(key);
    case "moonshot":
      return checkMoonshot(key);
    case "huggingface":
      return checkAccountOnly("huggingface", key, "https://huggingface.co/api/whoami-v2");
    case "nvidia":
      return checkOpenAiCompat("nvidia", key, "https://integrate.api.nvidia.com/v1/models");
    case "replicate":
      return checkAccountOnly("replicate", key, "https://api.replicate.com/v1/account");
    default:
      return null;
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return {};
  if (!req.readable || req.readableEnded) return {};
  const chunks = [];
  try {
    await Promise.race([
      (async () => { for await (const chunk of req) chunks.push(chunk); })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("body-timeout")), 2000))
    ]);
  } catch (_) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function pickKey(req, params, body) {
  const auth = String(req.headers.authorization || req.headers["x-api-key"] || "").trim();
  if (/^Bearer\s+\S+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  if (auth && !/^Bearer\s+/i.test(auth) && auth.length > 8) return auth;
  return pick(params, body, "key", "apikey", "api_key", "token") || extractFirstParam(params);
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Check API Key AI (/tools/checkkeyai)",
    tac_gia: AUTHOR,
    mo_ta: "Check key AI còn hạn không, module/model dùng được, và quota/token/credit còn lại (nếu nhà cung cấp công khai). Không lưu key. Không rải key sang nhà khác.",
    nha_ho_tro: Object.values(NHA_TEN),
    cu_phap: [
      `${baseUrl}/api/tools/checkkeyai?key={api_key}`,
      `${baseUrl}/api/tools/checkkeyai?key={api_key}&nha=openai`,
      "POST /api/tools/checkkeyai  { \"key\": \"...\", \"nha\": \"gemini\" }"
    ],
    vi_du: [
      `${baseUrl}/api/tools/checkkeyai?key=sk-proj-...`,
      `${baseUrl}/api/tools/checkkeyai?key=AIza...&nha=gemini`,
      `${baseUrl}/api/tools/checkkeyai?key=xai-...`,
      `${baseUrl}/api/tools/checkkeyai?key=sk-or-v1-...`,
      `${baseUrl}/api/tools/checkkeyai?key=sk-...&nha=deepseek`
    ],
    nha: "openai | gemini | xai | anthropic | groq | openrouter | deepseek | mistral | together | moonshot | siliconflow",
    luu_y: [
      "Nên POST — GET gắn key trên URL, log proxy/Vercel có thể nhìn thấy.",
      "Tự nhận prefix: sk-proj- (OpenAI), AIza (Gemini), xai- (Grok), sk-ant- (Claude), gsk_ (Groq), sk-or- (OpenRouter), sk- + 32 hex (DeepSeek).",
      "Nhiều hãng không công khai tổng token tài khoản; khi đó tool trả model list + rate limit/phút + số dư credit nếu API có.",
      "Không gửi key người khác. Tool gọi thẳng API nhà cung cấp, không lưu."
    ]
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = await readBody(req);
  const key = pickKey(req, params, body);
  if (!key) return res.status(200).json(buildGuide(baseUrl));

  const nha = detectProvider(key, pick(params, body, "nha", "provider", "hang"));
  if (!nha) {
    return res.status(400).json({
      trang_thai: "that_bai",
      chuyen_muc: "Check API Key AI",
      thong_bao: "Không nhận ra nhà cung cấp từ prefix key. Thêm nha=openai|gemini|xai|anthropic|groq|openrouter|deepseek|mistral|together|moonshot|siliconflow",
      key_an: maskKey(key),
      tac_gia: AUTHOR
    });
  }

  try {
    const ketQua = await runCheck(nha, key);
    const hopLe = ketQua?.hop_le === "CÓ";
    return res.status(hopLe ? 200 : 400).json(compact({
      trang_thai: hopLe ? "thanh_cong" : "that_bai",
      chuyen_muc: "Check API Key AI",
      ...ketQua,
      tac_gia: AUTHOR
    }));
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || /abort|timeout/i.test(String(error?.message || ""));
    return res.status(timeout ? 504 : 502).json({
      trang_thai: "that_bai",
      ma_loi: timeout ? 504 : 502,
      chuyen_muc: "Check API Key AI",
      nha_cung_cap: NHA_TEN[nha] || nha,
      key_an: maskKey(key),
      thong_bao: timeout ? "Nhà cung cấp không trả lời kịp (8s)." : (error.message || "Không check được key."),
      tac_gia: AUTHOR
    });
  }
};
