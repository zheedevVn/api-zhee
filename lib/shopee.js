/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const SITES = {
  vn: {
    host: "shopee.vn",
    mall: "mall.shopee.vn",
    img: "https://down-vn.img.susercontent.com/file",
    lang: "vi"
  },
  th: {
    host: "shopee.co.th",
    mall: "mall.shopee.co.th",
    img: "https://down-th.img.susercontent.com/file",
    lang: "th"
  },
  id: {
    host: "shopee.co.id",
    mall: "mall.shopee.co.id",
    img: "https://down-id.img.susercontent.com/file",
    lang: "id"
  },
  sg: {
    host: "shopee.sg",
    mall: "mall.shopee.sg",
    img: "https://down-sg.img.susercontent.com/file",
    lang: "en"
  },
  my: {
    host: "shopee.com.my",
    mall: "mall.shopee.com.my",
    img: "https://down-my.img.susercontent.com/file",
    lang: "en"
  },
  ph: {
    host: "shopee.ph",
    mall: "mall.shopee.ph",
    img: "https://down-ph.img.susercontent.com/file",
    lang: "en"
  },
  tw: {
    host: "shopee.tw",
    mall: "mall.shopee.tw",
    img: "https://down-tw.img.susercontent.com/file",
    lang: "zh-Hant"
  }
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 120;
const cache = new Map();

function firstParam(params) {
  for (const [key, value] of params.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function siteFromInput(input) {
  const raw = String(input || "").toLowerCase();
  if (raw.includes("shopee.co.th")) return "th";
  if (raw.includes("shopee.co.id")) return "id";
  if (raw.includes("shopee.com.my")) return "my";
  if (raw.includes("shopee.ph")) return "ph";
  if (raw.includes("shopee.tw")) return "tw";
  if (raw.includes("shopee.sg")) return "sg";
  return "vn";
}

function parseInput(input) {
  if (!input) return { username: "", shopid: "" };

  let raw = String(input).trim();
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {}

  raw = raw.split("#")[0].trim();

  const shopId = raw.match(/shopee\.[^/]+\/shop\/(\d+)/i);
  if (shopId) return { username: "", shopid: shopId[1] };

  const productPath = raw.match(/shopee\.[^/]+\/product\/(\d+)\/(\d+)/i);
  if (productPath) return { username: "", shopid: productPath[1] };

  const productI = raw.match(/-i\.(\d+)\.(\d+)/i);
  if (productI) return { username: "", shopid: productI[1] };

  const pathOnly = raw.replace(/\?.*$/, "").replace(/\/+$/, "");
  const user = pathOnly.match(/shopee\.[^/]+\/([a-zA-Z0-9._-]+)$/i);
  if (
    user &&
    !["shop", "product", "search", "mall", "cart", "buyer"].includes(
      user[1].toLowerCase()
    )
  ) {
    return { username: user[1], shopid: "" };
  }

  if (/^\d{4,}$/.test(raw)) return { username: "", shopid: raw };

  return {
    username: raw.replace(/^@+/, "").replace(/\/+$/, "").split("?")[0],
    shopid: ""
  };
}

function imageUrl(site, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(String(value))) return String(value);
  return `${(SITES[site] || SITES.vn).img}/${value}`;
}

function unix(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const date = new Date(n > 1e12 ? n : n * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("vi-VN");
}

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }
  return null;
}

function number(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function flag(...values) {
  for (const value of values) {
    if (value === true || value === 1 || value === "1" || value === "true") {
      return true;
    }
    if (value === false || value === 0 || value === "0" || value === "false") {
      return false;
    }
  }
  return false;
}

function yesNo(...values) {
  return flag(...values) ? "CÓ" : "KHÔNG";
}

function formatDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 60) return `${Math.round(n)} giây`;
  if (n < 3600) return `${Math.round(n / 60)} phút`;
  const hours = n / 3600;
  return hours >= 10 ? `${Math.round(hours)} giờ` : `${hours.toFixed(1)} giờ`;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  if (cache.size >= CACHE_MAX_ITEMS) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

function withCookie(headers, cookie) {
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function mallHeaders(cfg, cookie) {
  return withCookie(
    {
      "User-Agent": "okhttp/4.12.0",
      Accept: "application/json",
      "Accept-Language":
        cfg.lang === "vi" ? "vi-VN,vi;q=0.9,en;q=0.8" : "en-US,en;q=0.9",
      "X-API-SOURCE": "android",
      "X-Shopee-Language": cfg.lang,
      Referer: `https://${cfg.mall}/`
    },
    cookie
  );
}

function browserHeaders(host, cookie) {
  return withCookie(
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: `https://${host}/`,
      Origin: `https://${host}`,
      "X-Requested-With": "XMLHttpRequest",
      "X-API-SOURCE": "pc",
      "X-Shopee-Language": "vi"
    },
    cookie
  );
}

async function requestText(url, options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    ...options
  });
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    text,
    url: response.url || url
  };
}

async function requestJson(url, options = {}) {
  const result = await requestText(url, options);
  let json = null;
  try {
    json = JSON.parse(result.text);
  } catch (e) {}
  return { ...result, json };
}

function shopPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (data.data && typeof data.data === "object") {
    const inner = data.data;
    if (
      inner.shopid ||
      inner.shop_id ||
      inner.userid ||
      inner.user_id ||
      inner.name ||
      inner.account
    ) {
      return inner;
    }
  }
  if (
    data.shopid ||
    data.shop_id ||
    data.userid ||
    data.user_id ||
    data.name ||
    data.account
  ) {
    return data;
  }
  return null;
}

function hasShopIdentity(data) {
  return Boolean(
    data &&
      (data.shopid ||
        data.shop_id ||
        data.userid ||
        data.user_id ||
        data.name ||
        data.account?.username)
  );
}

async function shopeeMallApi(site, username, shopid, cookie) {
  const cfg = SITES[site] || SITES.vn;
  const query = new URLSearchParams({
    entry_point: "ShopByPDP",
    need_cancel_rate: "true",
    request_source: "shop_home_page",
    version: "1"
  });

  if (shopid) query.set("shopid", String(shopid));
  else query.set("username", username);

  const url = `https://${cfg.mall}/api/v4/shop/get_shop_base?${query}`;

  try {
    const result = await requestJson(url, {
      method: "GET",
      headers: mallHeaders(cfg, cookie)
    });
    const data = shopPayload(result.json);
    if (result.ok && hasShopIdentity(data)) {
      return {
        success: true,
        data,
        source: "shopee_mall_api",
        status: result.status
      };
    }
    return {
      success: false,
      source: "shopee_mall_api",
      status: result.status,
      error:
        result.json?.error_msg ||
        result.json?.error ||
        "Shopee Mall không trả dữ liệu"
    };
  } catch (error) {
    return {
      success: false,
      source: "shopee_mall_api",
      status: 0,
      error: error.message
    };
  }
}

async function shopeeWebGetApi(site, username, shopid, cookie) {
  const cfg = SITES[site] || SITES.vn;
  const query = new URLSearchParams({
    entry_point: "ShopByPDP",
    need_cancel_rate: "true",
    request_source: "shop_home_page",
    version: "1"
  });
  if (shopid) query.set("shopid", String(shopid));
  else query.set("username", username);

  const url = `https://${cfg.host}/api/v4/shop/get_shop_base?${query}`;

  try {
    const result = await requestJson(url, {
      method: "GET",
      headers: browserHeaders(cfg.host, cookie)
    });
    const data = shopPayload(result.json);
    if (result.ok && hasShopIdentity(data)) {
      return {
        success: true,
        data,
        source: "shopee_web_api",
        status: result.status
      };
    }
    return {
      success: false,
      source: "shopee_web_api",
      status: result.status,
      error:
        result.json?.error_msg ||
        result.json?.error ||
        "Shopee Web không trả dữ liệu"
    };
  } catch (error) {
    return {
      success: false,
      source: "shopee_web_api",
      status: 0,
      error: error.message
    };
  }
}

async function shopeeShopApi(site, username, shopid, cookie) {
  const cfg = SITES[site] || SITES.vn;
  const url = `https://${cfg.host}/api/v4/shop/get_shop_base_v2`;
  const body = {
    request_source: "mobile_shop_home_page",
    livestream_params: {}
  };
  if (shopid) body.shopid = Number(shopid);
  else body.username = username;

  try {
    const result = await requestJson(url, {
      method: "POST",
      headers: {
        ...browserHeaders(cfg.host, cookie),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = shopPayload(result.json);
    if (result.ok && hasShopIdentity(data)) {
      return {
        success: true,
        data,
        source: "shopee_api",
        status: result.status
      };
    }
    return {
      success: false,
      source: "shopee_api",
      status: result.status,
      error:
        result.json?.error_msg ||
        result.json?.error ||
        "Shopee không trả dữ liệu"
    };
  } catch (error) {
    return {
      success: false,
      source: "shopee_api",
      status: 0,
      error: error.message
    };
  }
}

async function shopeePublicPage(site, username, shopid, cookie) {
  const cfg = SITES[site] || SITES.vn;
  const url = shopid
    ? `https://${cfg.host}/shop/${shopid}`
    : `https://${cfg.host}/${encodeURIComponent(username)}`;

  try {
    const result = await requestText(url, {
      headers: {
        ...browserHeaders(cfg.host, cookie),
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!result.ok || !result.text) {
      return {
        success: false,
        status: result.status,
        error: "Không lấy được trang Shopee"
      };
    }
    return {
      success: true,
      html: result.text,
      status: result.status,
      url: result.url
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      error: error.message
    };
  }
}

function extractShopIds(html, fallback = {}) {
  if (!html) return null;

  const wanted = String(fallback.username || "").toLowerCase();
  if (wanted) {
    const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const around = html.match(
      new RegExp(
        `["']shopid["']\\s*:\\s*(\\d+)[\\s\\S]{0,240}["']username["']\\s*:\\s*["']${escaped}["']|["']username["']\\s*:\\s*["']${escaped}["'][\\s\\S]{0,240}["']shopid["']\\s*:\\s*(\\d+)`,
        "i"
      )
    );
    if (around) {
      return {
        shopid: around[1] || around[2] || fallback.shopid || "",
        username: fallback.username
      };
    }
  }

  const ogUrl = html.match(
    /property=["']og:url["'][^>]*content=["']https?:\/\/[^"'/]+\/([a-zA-Z0-9._-]+)/i
  );
  const shopid = html.match(/["']shopid["']\s*:\s*(\d+)/i);
  const username = html.match(/["']username["']\s*:\s*["']([a-zA-Z0-9._-]+)["']/i);

  if (!shopid && !username && !ogUrl) return null;

  return {
    shopid: shopid ? shopid[1] : fallback.shopid || "",
    username: username ? username[1] : ogUrl ? ogUrl[1] : fallback.username || ""
  };
}

function normalizeShop(data, site, fallback, source) {
  const cfg = SITES[site] || SITES.vn;
  const account = data?.account || {};
  const rating = data?.shop_rating || data?.rate_info || {};
  const shop = data?.shop && (data.shop.shopid || data.shop.name) ? data.shop : data;

  const shopid = pick(
    shop?.shopid,
    shop?.shop_id,
    data?.shopid,
    data?.shop_id,
    fallback.shopid
  );
  const userid = pick(shop?.userid, shop?.user_id, data?.userid, data?.user_id);
  const username = pick(
    account?.username,
    shop?.username,
    data?.username,
    fallback.username
  );
  const name = pick(
    shop?.name,
    shop?.shop_name,
    data?.name,
    data?.shop_name,
    username,
    "Không rõ"
  );
  const avatar = pick(
    account?.portrait,
    shop?.portrait,
    shop?.shop_logo,
    data?.portrait,
    data?.shop_logo
  );
  const ratingStar = pick(shop?.rating_star, data?.rating_star, rating?.rating_star);
  const responseRate = number(
    pick(shop?.response_rate, data?.response_rate, rating?.response_rate),
    null
  );

  return {
    ton_tai: true,
    site: site.toUpperCase(),
    userid: number(userid, 0),
    shopid: number(shopid, 0),
    username: username || "Không rõ",
    ten_hien_thi: name,
    ten_shop: name,
    mo_ta: pick(shop?.description, data?.description, "Chưa có mô tả"),
    quoc_gia: site.toUpperCase(),
    dia_diem: pick(
      shop?.shop_location,
      data?.shop_location,
      data?.place,
      "Chưa cập nhật"
    ),
    avatar: imageUrl(site, avatar),
    anh_bia: imageUrl(site, pick(shop?.cover, data?.cover)),
    link_trang: username
      ? `https://${cfg.host}/${encodeURIComponent(username)}`
      : `https://${cfg.host}/shop/${shopid}`,
    so_nguoi_theo_doi: number(
      pick(shop?.follower_count, data?.follower_count),
      0
    ),
    so_dang_theo: number(
      pick(account?.following_count, shop?.following_count, data?.following_count),
      0
    ),
    so_san_pham: number(pick(shop?.item_count, data?.item_count), 0),
    diem_danh_gia:
      ratingStar == null ? "Chưa cập nhật" : Number(Number(ratingStar).toFixed(2)),
    danh_gia: {
      tot: number(pick(data?.rating_good, rating?.rating_good, shop?.rating_good), 0),
      trung_binh: number(
        pick(data?.rating_normal, rating?.rating_normal, shop?.rating_normal),
        0
      ),
      te: number(pick(data?.rating_bad, rating?.rating_bad, shop?.rating_bad), 0)
    },
    ty_le_phan_hoi: responseRate == null ? "Chưa cập nhật" : `${responseRate}%`,
    thoi_gian_phan_hoi:
      formatDuration(pick(shop?.response_time, data?.response_time)) ||
      "Chưa cập nhật",
    nhan: {
      mall_chinh_hang: yesNo(
        data?.show_official_shop_label,
        shop?.show_official_shop_label,
        data?.is_official_shop,
        shop?.is_official_shop
      ),
      shopee_verified: yesNo(
        data?.is_shopee_verified,
        shop?.is_shopee_verified
      ),
      preferred_plus: yesNo(
        data?.is_preferred_plus_seller,
        shop?.is_preferred_plus_seller
      )
    },
    trang_thai: {
      dang_nghi_ban: yesNo(data?.vacation, shop?.vacation),
      la_nguoi_ban: yesNo(
        account?.is_seller,
        data?.is_seller,
        shop?.is_seller,
        true
      )
    },
    hoat_dong_gan_nhat:
      unix(pick(data?.last_active_time, shop?.last_active_time)) || "Không rõ",
    ngay_tao: unix(pick(data?.ctime, shop?.ctime)) || "Không rõ",
    nguon_du_lieu: source || data?.__source || "Shopee Public"
  };
}

async function lookupShopee(site, username, shopid, cookie) {
  const attempts = [];

  const mall = await shopeeMallApi(site, username, shopid, cookie);
  attempts.push(mall);
  if (mall.success) {
    return normalizeShop(mall.data, site, { username, shopid }, mall.source);
  }

  const webGet = await shopeeWebGetApi(site, username, shopid, cookie);
  attempts.push(webGet);
  if (webGet.success) {
    return normalizeShop(webGet.data, site, { username, shopid }, webGet.source);
  }

  const api = await shopeeShopApi(site, username, shopid, cookie);
  attempts.push(api);
  if (api.success) {
    return normalizeShop(api.data, site, { username, shopid }, api.source);
  }

  const page = await shopeePublicPage(site, username, shopid, cookie);
  if (page.success) {
    const extracted = extractShopIds(page.html, { username, shopid });
    if (
      extracted &&
      ((extracted.shopid && extracted.shopid !== String(shopid || "")) ||
        (extracted.username && extracted.username !== username))
    ) {
      const retry = await shopeeMallApi(
        site,
        extracted.username || username,
        extracted.shopid || shopid,
        cookie
      );
      attempts.push(retry);
      if (retry.success) {
        return normalizeShop(
          retry.data,
          site,
          {
            username: extracted.username || username,
            shopid: extracted.shopid || shopid
          },
          retry.source
        );
      }
    }
  }

  return {
    ton_tai: false,
    ma_loi: "SHOPEE_BLOCKED",
    thong_bao:
      "Không lấy được thông tin công khai từ Shopee. Shopee có thể đã giới hạn request hoặc thay đổi dữ liệu trang.",
    chi_tiet: {
      api: attempts.map((item) => ({
        nguon: item.source,
        http: item.status || 0,
        loi: item.error || null
      })),
      page: {
        http: page.status || 0,
        loi: page.error || null
      }
    }
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;
  const url = new URL(req.url || "", baseUrl);
  const params = url.searchParams;
  const body =
    req.body && typeof req.body === "object" ? req.body : {};

  const raw =
    params.get("username") ||
    params.get("user") ||
    params.get("shop") ||
    params.get("shopid") ||
    params.get("id") ||
    params.get("q") ||
    body.username ||
    body.shopid ||
    firstParam(params);

  if (!raw) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Shopee Shop / Account Lookup",
      cu_phap: [
        `${baseUrl}/api/mxh/shopee?=username`,
        `${baseUrl}/api/mxh/shopee?username=username`,
        `${baseUrl}/api/mxh/shopee?shopid=88201679`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/shopee?=apple_flagship_store`,
        `${baseUrl}/api/mxh/shopee?=shopee_supermarket`,
        `${baseUrl}/api/mxh/shopee?shopid=88201679`
      ],
      ghi_chu:
        "Tra cứu thông tin công khai của shop/tài khoản Shopee theo username, shopid hoặc link."
    });
  }

  const parsed = parseInput(raw);
  if (!parsed.username && !parsed.shopid) {
    return res.status(400).json({
      trang_thai: "that_bai",
      ma_loi: 400,
      thong_bao: "Username hoặc Shop ID Shopee không hợp lệ."
    });
  }

  const siteRaw = (
    params.get("site") ||
    params.get("region") ||
    body.site ||
    ""
  ).toLowerCase();
  const site = SITES[siteRaw] ? siteRaw : siteFromInput(raw);
  const cookie = params.get("cookie") || body.cookie || "";
  const cacheKey = `${site}:${parsed.username || ""}:${parsed.shopid || ""}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Shop / Account Lookup",
      du_lieu: { ...cached, cache_hit: true },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  try {
    const data = await lookupShopee(
      site,
      parsed.username,
      parsed.shopid,
      cookie
    );

    if (!data.ton_tai) {
      return res.status(502).json({
        trang_thai: "that_bai",
        ma_loi: data.ma_loi,
        thong_bao: data.thong_bao,
        chi_tiet: data.chi_tiet
      });
    }

    cacheSet(cacheKey, data);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Shop / Account Lookup",
      du_lieu: data,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Đã xảy ra lỗi khi kiểm tra Shopee.",
      chi_tiet: error.message
    });
  }
};
