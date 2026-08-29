const cheerio = require("cheerio");

const TIKI_HOST = "tiki.vn";
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const cache = new Map();

function firstParam(params) {
  for (const [key, value] of params.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function text(value, fallback = null) {
  if (value == null || value === "") return fallback;
  return String(value).trim() || fallback;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function absoluteUrl(value, base = `https://${TIKI_HOST}`) {
  if (!value) return null;
  try { return new URL(String(value), base).toString(); } catch (_) { return null; }
}

function parseInput(value) {
  let raw = text(value, "");
  try { raw = decodeURIComponent(raw); } catch (_) {}
  raw = raw.trim();
  if (!raw) return { type: "unknown", value: "" };

  const product = raw.match(/tiki\.vn\/[^/?#]+-p(\d+)\.html/i);
  if (product) return { type: "product", productId: product[1], value: raw };
  const productId = raw.match(/(?:product|item|id)[=:/_-]?(\d{5,})/i);
  if (productId) return { type: "product", productId: productId[1], value: raw };
  if (/^\d{5,}$/.test(raw)) return { type: "seller_or_product", id: raw, value: raw };

  const shop = raw.match(/tiki\.vn\/(?:cua-hang|shop|seller)\/([^/?#]+)/i);
  if (shop) return { type: "shop", slug: shop[1], value: raw };
  if (/^https?:\/\//i.test(raw)) return { type: "url", value: raw };
  return { type: "shop", slug: raw.replace(/^@+/, "").replace(/^\/+|\/+$/g, ""), value: raw };
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("tiki_timeout")), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", "Accept-Language": "vi-VN,vi;q=0.9" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch (_) {}
  return { response, json, body };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/xhtml+xml", "Accept-Language": "vi-VN,vi;q=0.9" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  return { response, html: await response.text() };
}

function collectJsonLd($) {
  const result = [];
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const value = JSON.parse($(el).html() || "{}");
      result.push(...(Array.isArray(value) ? value : [value]));
    } catch (_) {}
  });
  return result;
}

function productResult(input, data, pageUrl) {
  const seller = data.current_seller || data.seller || {};
  const images = (data.images || []).map((item) => item.large_url || item.base_url || item.thumbnail_url).filter(Boolean);
  return {
    ton_tai: Boolean(data.id && data.name),
    loai_tra_cuu: "san_pham",
    nen_tang: "Tiki Việt Nam",
    product_id: data.id || input.productId || null,
    sku: data.sku || null,
    ten_san_pham: data.name || null,
    ten_hien_thi: data.name || null,
    mo_ta_ngan: data.short_description || data.meta_description || null,
    gia: data.price == null ? null : { gia: data.price, gia_niem_yet: data.list_price ?? data.original_price ?? null, giam_gia: data.discount ?? null, tien_te: "VND" },
    danh_gia: { diem: data.rating_average ?? null, so_luot: data.review_count ?? 0, nhan_xet: data.review_text ?? null },
    tinh_trang: data.inventory_status || null,
    thuong_hieu: data.brand ? { id: data.brand.id || null, ten: data.brand.name || null, slug: data.brand.slug || null } : null,
    nguoi_ban: seller && Object.keys(seller).length ? seller : null,
    anh_dai_dien: absoluteUrl(data.thumbnail_url || images[0], pageUrl),
    danh_sach_anh: images.map((item) => absoluteUrl(item, pageUrl)).filter(Boolean),
    link_cong_khai: absoluteUrl(data.short_url || data.url_path, pageUrl) || pageUrl,
    bao_hanh: data.warranty_info || data.warranty_policy || null,
    danh_muc: Array.isArray(data.breadcrumbs) ? data.breadcrumbs : null,
    nguon: "Tiki public API /api/v2/products",
    tac_gia: AUTHOR,
    truong_khong_cong_khai: "Tiki không có public user lookup theo username/email. Các chỉ số shop chỉ trả khi Tiki đưa chúng trong phản hồi công khai."
  };
}

function pageResult(input, pageUrl, html) {
  const $ = cheerio.load(html);
  const jsonLd = collectJsonLd($);
  const product = jsonLd.find((item) => String(item["@type"] || "").toLowerCase() === "product") || {};
  const offer = product.offers || {};
  const title = text(product.name) || text($("meta[property='og:title']").attr("content")) || text($("title").text());
  return {
    ton_tai: Boolean(title),
    loai_tra_cuu: input.type === "product" ? "san_pham_public_page" : "shop_cong_khai",
    nen_tang: "Tiki Việt Nam",
    username_hoac_slug: input.slug || null,
    product_id: input.productId || null,
    ten_hien_thi: title,
    mo_ta: text(product.description) || text($("meta[name='description']").attr("content")),
    gia: offer.price == null ? null : { gia: number(offer.price) ?? offer.price, tien_te: offer.priceCurrency || "VND" },
    danh_gia: product.aggregateRating ? { diem: product.aggregateRating.ratingValue ?? null, so_luot: product.aggregateRating.reviewCount ?? 0 } : null,
    anh_dai_dien: absoluteUrl((Array.isArray(product.image) ? product.image[0] : product.image) || $("meta[property='og:image']").attr("content"), pageUrl),
    link_cong_khai: absoluteUrl($("link[rel='canonical']").attr("href"), pageUrl) || pageUrl,
    nguon: "Tiki public page / JSON-LD",
    tac_gia: AUTHOR,
    truong_khong_cong_khai: "Tiki không công khai ổn định toàn bộ thông tin tài khoản/shop như followers, doanh thu và tỷ lệ phản hồi."
  };
}

async function lookup(input) {
  const key = input.value.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.data, cache_hit: true };
  if (cached) cache.delete(key);

  let data;
  if (input.type === "product") {
    const api = await withTimeout(fetchJson(`https://${TIKI_HOST}/api/v2/products/${encodeURIComponent(input.productId)}`));
    if (api.response.ok && api.json && api.json.id) {
      const publicUrl = absoluteUrl(api.json.short_url || api.json.url_path || `/item-p${input.productId}.html`);
      data = productResult(input, api.json, publicUrl || `https://${TIKI_HOST}/item-p${input.productId}.html`);
    }
  }
  if (!data) {
    const pageUrl = /^https?:\/\//i.test(input.value) ? input.value : `https://${TIKI_HOST}/cua-hang/${encodeURIComponent(input.slug || input.id)}`;
    const page = await withTimeout(fetchHtml(pageUrl));
    if (page.response.ok) data = pageResult(input, pageUrl, page.html);
  }
  if (!data || !data.ton_tai) throw new Error("tiki_public_data_not_found");
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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
  const raw = url.searchParams.get("url") || url.searchParams.get("link") || url.searchParams.get("product") || url.searchParams.get("username") || url.searchParams.get("user") || url.searchParams.get("shop") || url.searchParams.get("sellerid") || url.searchParams.get("id") || url.searchParams.get("q") || body.url || body.link || body.product || body.username || body.user || body.shop || body.sellerid || body.id || body.q || firstParam(url.searchParams);

  if (!raw) return res.status(200).json({
    trang_thai: "huong_dan",
    tac_gia: AUTHOR,
    chuyen_muc: "Tiki Account, Shop & Product Lookup",
    tac_gia: AUTHOR,
    mo_ta: "Tra cứu thông tin public Tiki theo link sản phẩm, product ID, link shop hoặc slug. Không nhận mật khẩu, cookie hay session.",
    cu_phap: [`${baseUrl}/api/mxh/tiki?={product_url}`, `${baseUrl}/api/mxh/tiki?product={product_id}`, `${baseUrl}/api/mxh/tiki?url={shop_url_or_slug}`, `${baseUrl}/api/mxh/tiki?username={shop_slug}`],
    vi_du: [`${baseUrl}/api/mxh/tiki?=https://tiki.vn/noi-com-dien-tu-tefal-rk818a68-1-8l-thuong-hieu-phap-hang-chinh-hang-p198944761.html`, `${baseUrl}/api/mxh/tiki?product=198944761`],
    gioi_han: "Tiki có API public cho sản phẩm; không có API public tra cứu user theo username/email. API không suy đoán hoặc thu thập tài khoản riêng tư."
  });

  const input = parseInput(raw);
  if (input.type === "unknown") return res.status(400).json({ trang_thai: "that_bai", tac_gia: AUTHOR, thong_bao: "Link, slug hoặc ID Tiki không hợp lệ." });
  if (input.type === "seller_or_product") input.type = "product", input.productId = input.id;
  try {
    return res.status(200).json({ trang_thai: "thanh_cong", tac_gia: AUTHOR, ...(await lookup(input)) });
  } catch (error) {
    return res.status(error.message.includes("not_found") ? 404 : 502).json({ trang_thai: "that_bai", tac_gia: AUTHOR, thong_bao: "Không đọc được dữ liệu public Tiki cho đầu vào này. Tiki không có public API tra cứu tài khoản cá nhân theo username/email; hãy dùng product ID, link sản phẩm hoặc link shop công khai.", chi_tiet: error.message, input: input.value, ghi_chu: "Không sử dụng cookie, session hoặc thông tin đăng nhập Tiki." });
  }
};
