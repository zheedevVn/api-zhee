const cheerio = require("cheerio");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const TIMEOUT_MS = 10000;
const cache = new Map();

function inputFromRequest(req) {
  const requestUrl = new URL(req.url || "", "https://api-zhee.local");
  const query = req.query || {};
  let value = query.url || query.username || query.user || query.profile || query[""] || "";
  if (!value) {
    for (const [key, item] of requestUrl.searchParams.entries()) {
      value = item || key;
      if (value) break;
    }
  }
  return String(value || "").trim();
}

function parseProfile(input) {
  const value = input.replace(/^@+/, "").trim();
  let profileUrl;
  try {
    profileUrl = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(`https://www.linkedin.com/in/${value.replace(/^\/|\/$/g, "")}/`);
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/i.test(profileUrl.hostname)) return null;
  const match = profileUrl.pathname.match(/^\/in\/([^/]+)/i);
  if (!match || !/^[A-Za-z0-9%._-]{1,120}$/.test(match[1])) return null;
  profileUrl.protocol = "https:";
  profileUrl.hostname = "www.linkedin.com";
  profileUrl.search = "";
  profileUrl.hash = "";
  return { slug: decodeURIComponent(match[1]), url: profileUrl.toString() };
}

function cached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...item.value, cache_hit: true };
}

function saveCache(key, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cache_hit: false };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || null;
}

function parseJsonLd($) {
  const records = [];
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const value = JSON.parse($(element).text());
      records.push(...(Array.isArray(value) ? value : [value]));
    } catch {}
  });
  return records.find((item) => item && (item["@type"] === "Person" || item["@type"] === "ProfilePage")) || {};
}

function meta($, property) {
  return $(`meta[property='${property}'], meta[name='${property}']`).first().attr("content") || null;
}

async function lookup(profile) {
  const key = `profile:${profile.slug.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;

  const response = await fetch(profile.url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; ZheeAPI/1.0; public profile lookup)"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (response.status === 404) {
    const error = new Error(`Không tìm thấy hồ sơ LinkedIn: ${profile.slug}`);
    error.status = 404;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`LinkedIn trả HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($);
  const title = meta($, "og:title") || $("title").text().trim() || jsonLd.name || null;
  const description = meta($, "og:description") || meta($, "description") || jsonLd.description || null;
  const image = meta($, "og:image") || (typeof jsonLd.image === "string" ? jsonLd.image : jsonLd.image?.url) || null;
  const canonical = $("link[rel='canonical']").attr("href") || meta($, "og:url") || profile.url;
  const person = jsonLd["@type"] === "ProfilePage" ? jsonLd.mainEntity || {} : jsonLd;
  const organization = person.worksFor?.name || person.affiliation?.name || null;

  if (!title && !description && !person.name) {
    const error = new Error("LinkedIn không cung cấp dữ liệu hồ sơ công khai cho username này.");
    error.status = 403;
    throw error;
  }

  const data = {
    trang_thai: "thanh_cong",
    loai: "linkedin_public_profile_lookup",
    thong_tin_ca_nhan: {
      username: profile.slug,
      ho_ten: firstDefined(person.name, title?.split(" - ")[0], profile.slug),
      tieu_de: firstDefined(person.jobTitle, description),
      mo_ta: description,
      cong_ty: organization,
      anh_dai_dien: image,
      dia_chi: person.address?.addressLocality || null,
      trang_web: typeof person.url === "string" && !person.url.includes("linkedin.com") ? person.url : null,
      lien_ket_khac: Array.isArray(person.sameAs) ? person.sameAs : [],
      link_trang_ca_nhan: canonical
    },
    nguon: "LinkedIn public profile metadata / JSON-LD",
    cache_hit: false,
    ghi_chu: "Chỉ trả dữ liệu công khai mà LinkedIn cung cấp trên trang hồ sơ; không truy cập email, số điện thoại, kết nối hoặc dữ liệu riêng tư."
  };
  return saveCache(key, data);
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const input = inputFromRequest(req);
  const profile = parseProfile(input);
  if (!input || !profile) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username LinkedIn hoặc link linkedin.com/in/username.",
      cu_phap: "/api/mxh/linkedln?=username_hoac_link_linkedin",
      tac_gia: AUTHOR
    });
  }

  try {
    const result = await lookup(profile);
    return res.status(200).json({ ...result, tac_gia: AUTHOR });
  } catch (error) {
    const status = error.status === 404 ? 404 : error.status === 403 ? 502 : 502;
    return res.status(status).json({
      trang_thai: "that_bai",
      thong_bao: error.status === 404
        ? error.message
        : "LinkedIn đang giới hạn hoặc ẩn dữ liệu hồ sơ công khai từ máy chủ này.",
      chi_tiet: "Tool không dùng cookie, mật khẩu hoặc dữ liệu riêng tư; chỉ đọc metadata công khai.",
      upstream_status: error.status || null,
      tac_gia: AUTHOR
    });
  }
};
