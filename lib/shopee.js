const SITES = {
  vn: { host: "shopee.vn", img: "https://down-vn.img.susercontent.com/file" },
  th: { host: "shopee.co.th", img: "https://down-th.img.susercontent.com/file" },
  id: { host: "shopee.co.id", img: "https://down-id.img.susercontent.com/file" },
  sg: { host: "shopee.sg", img: "https://down-sg.img.susercontent.com/file" },
  my: { host: "shopee.com.my", img: "https://down-my.img.susercontent.com/file" },
  ph: { host: "shopee.ph", img: "https://down-ph.img.susercontent.com/file" },
  tw: { host: "shopee.tw", img: "https://down-tw.img.susercontent.com/file" }
};

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
  try { raw = decodeURIComponent(raw); } catch (_) {}

  const shopId = raw.match(/shopee\.[^/]+\/shop\/(\d+)/i);
  if (shopId) return { username: "", shopid: shopId[1] };

  const product = raw.match(/shopee\.[^/]+\/product\/(\d+)\/(\d+)/i);
  if (product) return { username: "", shopid: product[1] };

  const user = raw.match(/shopee\.[^/]+\/([a-zA-Z0-9._-]+)\/?$/i);
  if (user && !["shop", "product", "search", "mall", "cart", "buyer"].includes(user[1].toLowerCase())) {
    return { username: user[1], shopid: "" };
  }

  if (/^\d{4,}$/.test(raw)) return { username: "", shopid: raw };
  return { username: raw.replace(/^@+/, "").replace(/\/+$/, ""), shopid: "" };
}

function imageUrl(site, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(String(value))) return String(value);
  return `${(SITES[site] || SITES.vn).img}/${value}`;
}

function unix(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date((n > 1e12 ? n : n * 1000));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString("vi-VN");
}

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return null;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    ...options
  });

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch (_) {}

  return {
    status: response.status,
    ok: response.ok,
    json,
    text,
    url: response.url || url
  };
}

function headers(host, referer) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: referer,
    Origin: `https://${host}`,
    "X-API-SOURCE": "pc",
    "X-Requested-With": "XMLHttpRequest"
  };
}

async function shopeeShopV2(site, username, shopid) {
  const cfg = SITES[site] || SITES.vn;

  const url = `https://${cfg.host}/api/v4/shop/get_shop_base_v2`;

  const body = {
    request_source: "mobile_shop_home_page",
    livestream_params: {}
  };

  if (shopid) {
    body.shopid = Number(shopid);
  } else {
    body.username = username;
  }

  try {
    const res = await requestJson(url, {
      method: "POST",
      headers: {
        ...headers(cfg.host, `https://${cfg.host}/`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = res.json?.data;

    if (
      res.ok &&
      data &&
      (
        data.shopid ||
        data.shop_id ||
        data.account?.username ||
        data.name
      )
    ) {
      return {
        data,
        source: "shopee_v2",
        status: res.status
      };
    }

    return {
      data: null,
      source: "shopee_v2",
      status: res.status,
      error:
        res.json?.error_msg ||
        res.json?.error ||
        "Shopee từ chối request"
    };
  } catch (error) {
    return {
      data: null,
      source: "shopee_v2",
      status: 0,
      error: error.message
    };
  }
}

async function tmapiLookup(site, username, shopid) {
  const key = process.env.TMAPI_KEY;

  if (!key) {
    return {
      data: null,
      configured: false
    };
  }

  const cfg = SITES[site] || SITES.vn;

  const params = new URLSearchParams({
    site
  });

  if (shopid) {
    params.set("shop_id", shopid);
  } else {
    params.set("username", username);
  }

  try {
    const res = await requestJson(
      `https://api.tmapi.top/shopee/shop/shop_info?${params.toString()}`,
      {
        headers: {
          apikey: key,
          Accept: "application/json"
        }
      }
    );

    if (
      res.ok &&
      res.json?.code === 200 &&
      res.json?.data
    ) {
      return {
        data: res.json.data,
        configured: true,
        source: "tmapi",
        status: res.status
      };
    }

    return {
      data: null,
      configured: true,
      source: "tmapi",
      status: res.status,
      error: res.json?.msg || "TMAPI không trả dữ liệu"
    };
  } catch (error) {
    return {
      data: null,
      configured: true,
      source: "tmapi",
      status: 0,
      error: error.message
    };
  }
}
function normalize(data, site, fallback) {
  const account = data?.account || {};
  const rating = data?.shop_rating || data?.rate_info || {};
  const shopid = pick(data?.shopid, data?.shop_id, fallback.shopid, 0);
  const userid = pick(data?.userid, data?.user_id, 0);
  const username = pick(account.username, data?.username, fallback.username, "Không rõ");
  const name = pick(data?.name, data?.shop_name, data?.shopname, username, "Không rõ");
  const portrait = pick(account.portrait, data?.portrait, data?.shop_logo, data?.cover);
  const followers = pick(data?.follower_count, 0);
  const items = pick(data?.item_count, 0);
  const ratingStar = pick(data?.rating_star, rating?.rating_star, null);
  const responseRate = pick(data?.response_rate, rating?.response_rate, null);

  return {
    ton_tai: true,
    loai_tai_khoan: data?.is_official_shop || data?.show_official_shop_label
      ? "Shop Mall chính hãng"
      : "Shop / Người bán",
    site: site.toUpperCase(),
    userid,
    shopid,
    username,
    ten_hien_thi: name,
    ten_shop: name,
    mo_ta: pick(data?.description, "Chưa có mô tả"),
    quoc_gia: site.toUpperCase(),
    dia_diem: pick(data?.shop_location, data?.place, "Chưa cập nhật"),
    avatar: imageUrl(site, portrait),
    anh_bia: imageUrl(site, data?.cover),
    link_trang: username && username !== "Không rõ"
      ? `https://${(SITES[site] || SITES.vn).host}/${encodeURIComponent(username)}`
      : `https://${(SITES[site] || SITES.vn).host}/shop/${shopid}`,
    so_nguoi_theo_doi: followers,
    so_san_pham: items,
    diem_danh_gia: ratingStar == null
      ? "Chưa cập nhật"
      : Number(Number(ratingStar).toFixed(2)),
    danh_gia: {
      tot: pick(data?.rating_good, rating?.rating_good, 0),
      trung_binh: pick(data?.rating_normal, rating?.rating_normal, 0),
      te: pick(data?.rating_bad, rating?.rating_bad, 0)
    },
    ty_le_phan_hoi: responseRate == null
      ? "Chưa cập nhật"
      : `${responseRate}%`,
    nhan: {
      mall_chinh_hang:
        data?.is_official_shop || data?.show_official_shop_label
          ? "CÓ"
          : "KHÔNG",
      shopee_verified: data?.is_shopee_verified ? "CÓ" : "KHÔNG"
    },
    trang_thai: {
      dang_nghi_ban: data?.vacation ? "CÓ" : "KHÔNG",
      la_nguoi_ban: "CÓ"
    },
    hoat_dong_gan_nhat:
      unix(data?.last_active_time) || "Không rõ",
    ngay_tao:
      unix(data?.ctime) || "Không rõ",
    nguon_du_lieu:
      data?.__source || "Shopee"
  };
}

async function lookup({ username, shopid, site }) {
  const v2 = await shopeeShopV2(site, username, shopid);

  if (v2.data) {
    return normalize(
      v2.data,
      site,
      { username, shopid }
    );
  }

  const external = await tmapiLookup(
    site,
    username,
    shopid
  );

  if (external.data) {
    external.data.__source = "TMAPI";

    return normalize(
      external.data,
      site,
      { username, shopid }
    );
  }

  return {
    ton_tai: false,
    ma_loi: "SHOPEE_BLOCKED",
    thong_bao:
      "Shopee đã chặn request trực tiếp. Cần dùng get_shop_base_v2 nếu còn được phép hoặc một API trung gian có API key.",
    chi_tiet: {
      shopee_v2: {
        http: v2.status,
        loi: v2.error || null
      },
      tmapi: external.configured
        ? {
            http: external.status || 0,
            loi: external.error || null
          }
        : {
            cau_hinh: "Thiếu biến môi trường TMAPI_KEY"
          }
    }
  };
}

module.exports = async (req, res) => {
  const protocol =
    req.headers["x-forwarded-proto"] || "https";

  const host =
    req.headers.host || "api-zhee.vercel.app";

  const baseUrl =
    `${protocol}://${host}`;

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const url =
    new URL(req.url || "", baseUrl);

  const params =
    url.searchParams;

  const body =
    req.body && typeof req.body === "object"
      ? req.body
      : {};

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
      chuyen_muc:
        "Shopee Shop / Account Lookup",
      cu_phap: [
        `${baseUrl}/api/mxh/shopee?=username`,
        `${baseUrl}/api/mxh/shopee?username=username`,
        `${baseUrl}/api/mxh/shopee?shopid=88201679`
      ],
      ghi_chu:
        "API chỉ trả thông tin công khai của shop/tài khoản. Không đọc mật khẩu, OTP, cookie hay dữ liệu riêng tư."
    });
  }

  const parsed =
    parseInput(raw);

  if (
    !parsed.username &&
    !parsed.shopid
  ) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao:
        "Username hoặc Shop ID Shopee không hợp lệ."
    });
  }

  const siteRaw =
    (
      params.get("site") ||
      params.get("region") ||
      body.site ||
      ""
    ).toLowerCase();

  const site =
    SITES[siteRaw]
      ? siteRaw
      : siteFromInput(raw);

  try {
    const data =
      await lookup({
        ...parsed,
        site
      });

    if (!data.ton_tai) {
      return res.status(502).json({
        trang_thai: "that_bai",
        ma_loi: data.ma_loi,
        thong_bao: data.thong_bao,
        chi_tiet: data.chi_tiet,
        huong_dan:
          "Nếu muốn fallback ổn định, thêm TMAPI_KEY vào Vercel Environment Variables rồi redeploy."
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc:
        "Shopee Shop Lookup",
      du_lieu: data,
      tac_gia:
        "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao:
        "Không thể lấy thông tin Shopee.",
      chi_tiet: error.message
    });
  }
};
