const cheerio = require("cheerio");

const LAZADA_HOST = "www.lazada.vn";
const LAZADA_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const cache = new Map();

function firstParam(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function text(value, fallback = null) {
  if (value == null || value === "") return fallback;
  return String(value).replace(/\\u002F/g, "/").trim() || fallback;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function absoluteUrl(value, base = `https://${LAZADA_HOST}`) {
  if (!value) return null;
  try { return new URL(String(value), base).toString(); } catch (_) { return null; }
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString("vi-VN");
}

function parseInput(raw) {
  let input = text(raw, "");
  try { input = decodeURIComponent(input); } catch (_) {}
  input = input.trim();
  if (!input) return { type: "unknown", value: "" };

  const product = input.match(/lazada\.[^/]+\/products\/[^/]*-i(\d+)-s(\d+)\.html/i);
  if (product) return { type: "product", productId: product[1], sellerId: product[2], value: input };
  const productShort = input.match(/lazada\.[^/]+\/products\/[^/]*-i(\d+)\.html/i);
  if (productShort) return { type: "product", productId: productShort[1], value: input };
  if (/^\d{4,}$/.test(input)) return { type: "seller", sellerId: input, value: input };

  const shop = input.match(/lazada\.[^/]+\/shop\/([^/?#]+)/i);
  if (shop) return { type: "shop", slug: shop[1], value: input };
  if (/^https?:\/\//i.test(input)) return { type: "url", value: input };
  return { type: "shop", slug: input.replace(/^@+/, "").replace(/^\/+|\/+$/g, ""), value: input };
}

function allObjects(value, output = []) {
  if (!value || typeof value !== "object" || output.length > 2000) return output;
  output.push(value);
  if (Array.isArray(value)) value.forEach((item) => allObjects(item, output));
  else Object.values(value).forEach((item) => allObjects(item, output));
  return output;
}

function pick(objects, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      if (wanted.has(key.toLowerCase()) && value != null && value !== "") return value;
    }
  }
  return null;
}

function parseEmbeddedJson($) {
  const objects = [];
  $("script").each((_, element) => {
    const type = String($(element).attr("type") || "").toLowerCase();
    const source = $(element).html() || "";
    if (type.includes("ld+json")) {
      try { allObjects(JSON.parse(source), objects); } catch (_) {}
    }
    const matches = source.match(/\{(?:[^{}]|\{[^{}]*\}){20,}\}/g) || [];
    for (const match of matches.slice(0, 30)) {
      try { allObjects(JSON.parse(match), objects); } catch (_) {}
    }
  });
  return objects;
}

function isChallengePage(html) {
  const sample = String(html || "").slice(0, 12000).toLowerCase();
  return sample.includes("x5referer") || sample.includes("_____tmd_____");
}

function translatedUrl(url) {
  const source = new URL(url);
  const host = source.hostname.replace(/\./g, "-");
  const translated = new URL(`https://${host}.translate.goog${source.pathname}`);
  source.searchParams.forEach((value, key) => translated.searchParams.set(key, value));
  translated.searchParams.set("_x_tr_sl", "auto");
  translated.searchParams.set("_x_tr_tl", "en");
  translated.searchParams.set("_x_tr_hl", "en");
  return translated.toString();
}

async function requestHtml(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      ...headers
    },
    signal: AbortSignal.timeout(LAZADA_TIMEOUT_MS)
  });
  return { response, html: await response.text() };
}

async function fetchPage(url) {
  const direct = await requestHtml(url);
  if (direct.response.ok && !isChallengePage(direct.html)) return { ...direct, source: "Lazada public page" };

  // Lazada may return an anti-bot interstitial to serverless IPs. Google Translate
  // fetches the same public page and does not require a Lazada credential/session.
  try {
    const translated = await requestHtml(translatedUrl(url), { Referer: url });
    if (translated.response.ok && !isChallengePage(translated.html)) {
      return { ...translated, source: "Lazada public page via read-only translation proxy" };
    }
  } catch (_) {}
  return { ...direct, source: "Lazada public page" };
}

function buildResult(input, pageUrl, html, source = "Lazada public page") {
  const $ = cheerio.load(html);
  const objects = parseEmbeddedJson($);
  const productObject = objects.find((item) => String(item["@type"] || "").toLowerCase().includes("product")) || {};
  const offer = productObject.offers && !Array.isArray(productObject.offers) ? productObject.offers : (productObject.offers || [])[0] || {};
  const sellerObject = productObject.seller || {};
  const images = Array.isArray(productObject.image) ? productObject.image : (productObject.image ? [productObject.image] : []);
  const title = text(pick(objects, ["name", "title"])) || text($("meta[property='og:title']").attr("content")) || text($("title").text());
  const description = text(pick(objects, ["description"])) || text($("meta[name='description']").attr("content"));
  const image = absoluteUrl(images[0] || $("meta[property='og:image']").attr("content"), pageUrl);
  const sellerName = text(pick(objects, ["sellerName", "shopName", "storeName", "seller_name"])) || text(sellerObject.name);
  const sellerId = text(pick(objects, ["sellerId", "seller_id", "shopId", "shop_id"]));
  const productId = text(pick(objects, ["productId", "itemId", "item_id"])) || input.productId;
  const price = pick(objects, ["price", "salePrice", "priceValue", "currentPrice"]) ?? offer.price;
  const currency = text(pick(objects, ["priceCurrency"])) || text(offer.priceCurrency, "VND");
  const rating = pick(objects, ["ratingValue", "ratingScore", "rating"]);
  const reviewCount = pick(objects, ["reviewCount", "review_count", "ratingCount"]);
  const availability = text(pick(objects, ["availability"])) || text(offer.availability);
  const canonical = absoluteUrl($("link[rel='canonical']").attr("href"), pageUrl) || pageUrl;
  const pageTitle = text($("title").text(), "");
  const isProduct = input.type === "product" || /\/products\//i.test(pageUrl);
  const isErrorPage = /^(enter fail page|page not found|không tìm thấy|not found)\b/i.test(pageTitle);
  const hasProductData = Boolean(productObject.name || productObject.description || offer.price || images.length || title);
  const hasShopData = Boolean(sellerName || (title && !/^shop(?:\s|$)/i.test(title)));

  return {
    ton_tai: !isErrorPage && (isProduct ? hasProductData : hasShopData),
    loai_tra_cuu: isProduct ? "san_pham" : "shop_cong_khai",
    nen_tang: "Lazada Việt Nam",
    username_hoac_slug: input.slug || null,
    seller_id: sellerId || input.sellerId || null,
    product_id: productId || null,
    ten_hien_thi: title || sellerName || input.slug || null,
    ten_shop_nguoi_ban: sellerName || null,
    mo_ta: description || null,
    gia: price == null ? null : { gia: number(price) ?? text(price), tien_te: currency },
    danh_gia: rating == null && reviewCount == null ? null : {
      diem: number(rating) ?? text(rating),
      so_luot: number(reviewCount) ?? text(reviewCount)
    },
    tinh_trang: availability || null,
    anh_dai_dien_san_pham: image,
    danh_sach_anh: images.map((item) => absoluteUrl(item, pageUrl)).filter(Boolean),
    link_cong_khai: canonical,
    du_lieu_trang: {
      ma_http: 200,
      tieu_de: text($("title").text()),
      canonical,
      html_co_du_lieu_nhung: Boolean(html.length)
    },
    truong_khong_cong_khai: [
      "Followers, doanh thu, tỷ lệ phản hồi, thời gian phản hồi, Mall/Official Store và toàn bộ sản phẩm không được Lazada công khai ổn định trên HTML hiện tại.",
      "API không nhận hoặc lưu mật khẩu, cookie, session hay token Lazada."
    ],
    nguon: `${source} / JSON-LD`,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function lookup(input) {
  const cacheKey = input.value.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.data, cache_hit: true };
  if (cached) cache.delete(cacheKey);

  const pageUrl = /^https?:\/\//i.test(input.value)
    ? input.value
    : input.type === "product"
      ? `https://${LAZADA_HOST}/products/item-i${input.productId}.html`
      : `https://${LAZADA_HOST}/shop/${encodeURIComponent(input.slug || input.sellerId)}/`;
  const { response, html, source } = await fetchPage(pageUrl);
  if (!response.ok) throw new Error(`lazada_http_${response.status}`);
  const data = buildResult(input, pageUrl, html, source);
  if (!data.ton_tai) throw new Error("lazada_public_data_not_found");
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...data, cache_hit: false };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const url = new URL(req.url || "/", baseUrl);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const raw = url.searchParams.get("url") || url.searchParams.get("link") || url.searchParams.get("shop") || url.searchParams.get("seller") || url.searchParams.get("product") || url.searchParams.get("q") || body.url || body.link || body.shop || body.seller || body.product || body.q || firstParam(url.searchParams);
  if (!raw) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Lazada Shop & Product Lookup",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      mo_ta: "Tra cứu dữ liệu Lazada công khai từ link shop, slug/seller ID hoặc link sản phẩm. Không yêu cầu mật khẩu, cookie hay session.",
      cu_phap: [
        `${baseUrl}/api/mxh/lazada?={shop_slug_hoac_seller_id}`,
        `${baseUrl}/api/mxh/lazada?url={link_shop_lazada}`,
        `${baseUrl}/api/mxh/lazada?url={link_san_pham_lazada}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/lazada?=https://www.lazada.vn/shop/{slug}/`,
        `${baseUrl}/api/mxh/lazada?=https://www.lazada.vn/products/{slug}-i{product_id}.html`
      ],
      gioi_han: "Lazada không công khai ổn định toàn bộ chỉ số shop như followers, doanh thu và tỷ lệ phản hồi; API chỉ trả field đọc được từ trang public, không bịa dữ liệu."
    });
  }

  const input = parseInput(raw);
  if (input.type === "unknown" || !input.value) {
    return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Link, slug, seller ID hoặc product URL Lazada không hợp lệ." });
  }
  try {
    const data = await lookup(input);
    return res.status(200).json({ trang_thai: "thanh_cong", ...data });
  } catch (error) {
    const status = error.message.includes("http_404") ? 404 : 502;
    return res.status(status).json({
      trang_thai: "that_bai",
      thong_bao: "Không đọc được dữ liệu Lazada công khai cho đầu vào này.",
      chi_tiet: error.message,
      input: input.value,
      ghi_chu: "Chỉ hỗ trợ dữ liệu public; không sử dụng cookie, session hoặc thông tin đăng nhập."
    });
  }
};
