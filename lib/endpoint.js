require("./zheeProtect.js").verifyOrThrow();
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/javascript,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
};

const MAX_SCRIPTS = 6;
const MAX_JS_BYTES = 280_000;
const MAX_ENDPOINTS = 40;
const SKIP_EXT = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|mp3|pdf)(?:\?|$)/i;

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

function toPageUrl(raw) {
  let value = String(raw || "").trim();
  if (!value) return "";
  try { value = decodeURIComponent(value); } catch (_) {}
  if (!/^https?:\/\//i.test(value)) value = `https://${value.replace(/^\/+/, "")}`;
  return value;
}

function resolveUrl(href, base) {
  try {
    const url = new URL(href, base);
    if (!/^https?:$/i.test(url.protocol) && !/^wss?:$/i.test(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch (_) {
    return "";
  }
}

function looksStatic(url) {
  return SKIP_EXT.test(url) || /(?:fonts\.google|gstatic|gravatar|facebook\.com\/tr|google-analytics|gtag\/js|googletagmanager)/i.test(url);
}

function classify(url) {
  const lower = url.toLowerCase();
  if (lower.startsWith("ws:") || lower.startsWith("wss:")) return "websocket";
  if (lower.includes("graphql")) return "graphql";
  if (/\/api\/|\/v\d+\/|api\.|\/rest\/|\/endpoint/i.test(lower)) return "api";
  if (/\/(ajax|rpc|service|gateway)\b/i.test(lower)) return "api";
  return "http";
}

function looksEndpoint(url) {
  if (!url || looksStatic(url)) return false;
  if (/[=\/]$/.test(url) && /(?:href|src|url)=$/i.test(url)) return false;
  if (/href=$/i.test(url)) return false;
  const kind = classify(url);
  return kind !== "http";
}

function addHit(map, url, nguon, goi) {
  if (!url || looksStatic(url) || /href=$/i.test(url)) return;
  const kind = classify(url);
  if (kind === "http" && goi !== "form" && goi !== "fetch") return;
  const key = url.split("#")[0];
  if (!map.has(key)) {
    map.set(key, { url: key, loai: kind, nguon: [nguon], cach_goi: goi ? [goi] : [] });
    return;
  }
  const item = map.get(key);
  if (!item.nguon.includes(nguon)) item.nguon.push(nguon);
  if (goi && !item.cach_goi.includes(goi)) item.cach_goi.push(goi);
}

function extractFromHtml(html, pageUrl) {
  const map = new Map();
  const scripts = [];
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const abs = resolveUrl(match[1], pageUrl);
    if (abs) scripts.push(abs);
  }
  for (const match of html.matchAll(/<form[^>]+action=["']([^"']+)["']/gi)) {
    const abs = resolveUrl(match[1], pageUrl);
    if (abs) addHit(map, abs, "html-form", "form");
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]{8,220}/gi)) {
    const abs = resolveUrl(match[0].replace(/[),.;]+$/, ""), pageUrl);
    if (abs && looksEndpoint(abs)) addHit(map, abs, "html", "url");
  }
  extractFromJs(html, pageUrl, map, "html-inline");
  return { map, scripts: [...new Set(scripts)].slice(0, MAX_SCRIPTS) };
}

function extractFromJs(code, pageUrl, map, nguon) {
  const callRe = /(?:fetch|axios\.(?:get|post|put|patch|delete)|\$\.(?:get|post|ajax)|XMLHttpRequest)\s*(?:\(\s*)?["'`]([^"'`]{2,220})["'`]/gi;
  let match;
  while ((match = callRe.exec(code))) {
    const abs = resolveUrl(match[1], pageUrl);
    if (abs) addHit(map, abs, nguon, "fetch");
  }
  const relRe = /["'`](\/(?:api|graphql|v\d+|rest|ajax)\/[^"'`\s]{0,180})["'`]/gi;
  while ((match = relRe.exec(code))) {
    const abs = resolveUrl(match[1], pageUrl);
    if (abs) addHit(map, abs, nguon, "path");
  }
  const absRe = /["'`]((?:https?:|wss?:)\/\/[^"'`\s]{8,220})["'`]/gi;
  while ((match = absRe.exec(code))) {
    const abs = resolveUrl(match[1], pageUrl);
    if (abs && looksEndpoint(abs)) addHit(map, abs, nguon, "url");
  }
}

async function fetchText(url, timeoutMs) {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const sliced = buf.length > MAX_JS_BYTES ? buf.subarray(0, MAX_JS_BYTES) : buf;
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url,
    text: sliced.toString("utf8")
  };
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Check Endpoint / API của Website (/web/endpoint)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Quét HTML + file JS để tìm URL API mà trang khai báo trong mã nguồn. Không bắt request lúc chạy như F12 Network (cần trình duyệt thật, cookie đăng nhập).",
    cu_phap: [
      `${baseUrl}/web/endpoint?={url_website}`,
      `${baseUrl}/api/web/endpoint?url={url_website}`
    ],
    vi_du: [
      `${baseUrl}/web/endpoint?=https://vietqr.io`
    ],
    gioi_han: "Tối đa 6 file JS, không thực thi JavaScript, không lấy header Authorization của user."
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

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const raw = pick(params, body, "url", "site", "web", "q") || extractFirstParam(params);
  if (!raw) return res.status(200).json(buildGuide(baseUrl));

  let pageUrl = "";
  try {
    pageUrl = new URL(toPageUrl(raw)).toString();
  } catch (_) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "URL không hợp lệ. Ví dụ: /web/endpoint?=https://vietqr.io"
    });
  }

  try {
    const page = await fetchText(pageUrl, 8000);
    if (!page.ok && !page.text) {
      return res.status(502).json({
        trang_thai: "that_bai",
        thong_bao: `Không tải được trang (HTTP ${page.status}).`
      });
    }
    const extracted = extractFromHtml(page.text, page.finalUrl || pageUrl);
    const jsScanned = [];
    for (const src of extracted.scripts) {
      try {
        const js = await fetchText(src, 5000);
        if (js.text) extractFromJs(js.text, page.finalUrl || pageUrl, extracted.map, src.replace(/\?.*$/, "").split("/").slice(-1)[0] || "js");
        jsScanned.push({ file: src, ok: js.ok });
      } catch (_) {
        jsScanned.push({ file: src, ok: false });
      }
    }

    const list = [...extracted.map.values()]
      .sort((a, b) => a.loai.localeCompare(b.loai) || a.url.localeCompare(b.url))
      .slice(0, MAX_ENDPOINTS)
      .map((item) => ({
        url: item.url,
        loai: item.loai,
        cach_goi: item.cach_goi.length ? item.cach_goi : undefined,
        nguon: item.nguon.slice(0, 4)
      }));

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Check Endpoint Website",
      trang: page.finalUrl || pageUrl,
      ma_http: page.status,
      so_endpoint: list.length,
      danh_sach: list,
      js_da_quet: jsScanned.length,
      ghi_chu: "Đây là URL tìm thấy trong HTML/JS, không phải log request lúc user thao tác trên trình duyệt.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Không quét được endpoint.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
