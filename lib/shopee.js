const SITES = {
  vn: {
    host: "shopee.vn",
    img: "https://down-vn.img.susercontent.com/file"
  },
  th: {
    host: "shopee.co.th",
    img: "https://down-th.img.susercontent.com/file"
  },
  id: {
    host: "shopee.co.id",
    img: "https://down-id.img.susercontent.com/file"
  },
  sg: {
    host: "shopee.sg",
    img: "https://down-sg.img.susercontent.com/file"
  },
  my: {
    host: "shopee.com.my",
    img: "https://down-my.img.susercontent.com/file"
  },
  ph: {
    host: "shopee.ph",
    img: "https://down-ph.img.susercontent.com/file"
  },
  tw: {
    host: "shopee.tw",
    img: "https://down-tw.img.susercontent.com/file"
  }
};

function firstParam(params) {
  for (const [key, value] of params.entries()) {
    if (!key && value) {
      return value.trim();
    }
    if (key && !value) {
      return key.replace(/^=/, "").trim();
    }
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
  if (!input) {
    return {
      username: "",
      shopid: ""
    };
  }

  let raw = String(input).trim();

  try {
    raw = decodeURIComponent(raw);
  } catch (e) {}

  const shopId = raw.match(
    /shopee\.[^/]+\/shop\/(\d+)/i
  );

  if (shopId) {
    return {
      username: "",
      shopid: shopId[1]
    };
  }

  const product = raw.match(
    /shopee\.[^/]+\/product\/(\d+)\/(\d+)/i
  );

  if (product) {
    return {
      username: "",
      shopid: product[1]
    };
  }

  const user = raw.match(
    /shopee\.[^/]+\/([a-zA-Z0-9._-]+)\/?$/i
  );

  if (
    user &&
    ![
      "shop",
      "product",
      "search",
      "mall",
      "cart",
      "buyer"
    ].includes(user[1].toLowerCase())
  ) {
    return {
      username: user[1],
      shopid: ""
    };
  }

  if (/^\d{4,}$/.test(raw)) {
    return {
      username: "",
      shopid: raw
    };
  }

  return {
    username: raw
      .replace(/^@+/, "")
      .replace(/\/+$/, ""),
    shopid: ""
  };
}

function imageUrl(site, value) {
  if (!value) return "";

  if (/^https?:\/\//i.test(String(value))) {
    return String(value);
  }

  return `${(SITES[site] || SITES.vn).img}/${value}`;
}

function unix(ts) {
  const n = Number(ts);

  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  const date = new Date(
    n > 1e12 ? n : n * 1000
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("vi-VN");
}

function pick(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value;
    }
  }

  return null;
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
  const result = await requestText(
    url,
    options
  );

  let json = null;

  try {
    json = JSON.parse(result.text);
  } catch (e) {}

  return {
    ...result,
    json
  };
}

function browserHeaders(host) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Accept":
      "application/json, text/plain, */*",
    "Accept-Language":
      "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer":
      `https://${host}/`,
    "Origin":
      `https://${host}`,
    "X-Requested-With":
      "XMLHttpRequest"
  };
}

async function shopeeShopApi(
  site,
  username,
  shopid
) {
  const cfg =
    SITES[site] || SITES.vn;

  const url =
    `https://${cfg.host}/api/v4/shop/get_shop_base_v2`;

  const body = {
    request_source:
      "mobile_shop_home_page",
    livestream_params: {}
  };

  if (shopid) {
    body.shopid = Number(shopid);
  } else {
    body.username = username;
  }

  try {
    const result =
      await requestJson(url, {
        method: "POST",
        headers: {
          ...browserHeaders(cfg.host),
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(body)
      });

    const data =
      result.json?.data;

    if (
      result.ok &&
      data &&
      (
        data.shopid ||
        data.shop_id ||
        data.userid ||
        data.user_id ||
        data.name
      )
    ) {
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

async function shopeePublicPage(
  site,
  username,
  shopid
) {
  const cfg =
    SITES[site] || SITES.vn;

  let url;

  if (shopid) {
    url =
      `https://${cfg.host}/shop/${shopid}`;
  } else {
    url =
      `https://${cfg.host}/${encodeURIComponent(username)}`;
  }

  try {
    const result =
      await requestText(url, {
        headers: browserHeaders(cfg.host)
      });

    if (
      !result.ok ||
      !result.text
    ) {
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

function extractJsonFromHtml(html) {
  if (!html) return null;

  const patterns = [
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  ];

  for (const pattern of patterns) {
    const match =
      html.match(pattern);

    if (!match) continue;

    try {
      return JSON.parse(match[1]);
    } catch (e) {}
  }

  return null;
}

function extractShopData(html) {
  if (!html) return null;

  const data =
    extractJsonFromHtml(html);

  if (data) {
    const text =
      JSON.stringify(data);

    if (
      text.includes("shopid") ||
      text.includes("shop_id") ||
      text.includes("shop_name")
    ) {
      return data;
    }
  }

  const shopid =
    html.match(
      /["']shopid["']\s*:\s*(\d+)/i
    );

  const userid =
    html.match(
      /["']userid["']\s*:\s*(\d+)/i
    );

  const username =
    html.match(
      /["']username["']\s*:\s*["']([^"']+)/i
    );

  const shopName =
    html.match(
      /["']shop_name["']\s*:\s*["']([^"']+)/i
    );

  if (
    !shopid &&
    !userid &&
    !username &&
    !shopName
  ) {
    return null;
  }

  return {
    shopid:
      shopid ? Number(shopid[1]) : null,
    userid:
      userid ? Number(userid[1]) : null,
    username:
      username ? username[1] : null,
    shop_name:
      shopName ? shopName[1] : null
  };
}
function normalizeShop(data, site, fallback) {
  const cfg = SITES[site] || SITES.vn;
  const account = data?.account || {};
  const rating = data?.shop_rating || data?.rate_info || {};
  const shop = data?.shop || data;

  const shopid = pick(
    shop?.shopid,
    shop?.shop_id,
    data?.shopid,
    data?.shop_id,
    fallback.shopid
  );

  const userid = pick(
    shop?.userid,
    shop?.user_id,
    data?.userid,
    data?.user_id
  );

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
    shop?.portrait,
    shop?.shop_logo,
    data?.portrait,
    data?.shop_logo
  );

  const followers = pick(
    shop?.follower_count,
    data?.follower_count,
    0
  );

  const itemCount = pick(
    shop?.item_count,
    data?.item_count,
    0
  );

  const ratingStar = pick(
    shop?.rating_star,
    data?.rating_star,
    rating?.rating_star
  );

  const responseRate = pick(
    shop?.response_rate,
    data?.response_rate,
    rating?.response_rate
  );

  return {
    ton_tai: true,
    site: site.toUpperCase(),
    userid: userid || 0,
    shopid: shopid || 0,
    username: username || "Không rõ",
    ten_hien_thi: name,
    ten_shop: name,
    mo_ta: pick(
      shop?.description,
      data?.description,
      "Chưa có mô tả"
    ),
    quoc_gia: site.toUpperCase(),
    dia_diem: pick(
      shop?.shop_location,
      data?.shop_location,
      data?.place,
      "Chưa cập nhật"
    ),
    avatar: imageUrl(site, avatar),
    anh_bia: imageUrl(
      site,
      pick(
        shop?.cover,
        data?.cover
      )
    ),
    link_trang: username
      ? `https://${cfg.host}/${encodeURIComponent(username)}`
      : `https://${cfg.host}/shop/${shopid}`,
    so_nguoi_theo_doi: followers,
    so_san_pham: itemCount,
    diem_danh_gia:
      ratingStar == null
        ? "Chưa cập nhật"
        : Number(
            Number(ratingStar).toFixed(2)
          ),
    danh_gia: {
      tot: pick(
        data?.rating_good,
        rating?.rating_good,
        0
      ),
      trung_binh: pick(
        data?.rating_normal,
        rating?.rating_normal,
        0
      ),
      te: pick(
        data?.rating_bad,
        rating?.rating_bad,
        0
      )
    },
    ty_le_phan_hoi:
      responseRate == null
        ? "Chưa cập nhật"
        : `${responseRate}%`,
    nhan: {
      mall_chinh_hang:
        data?.is_official_shop ||
        shop?.is_official_shop
          ? "CÓ"
          : "KHÔNG",
      shopee_verified:
        data?.is_shopee_verified ||
        shop?.is_shopee_verified
          ? "CÓ"
          : "KHÔNG"
    },
    trang_thai: {
      dang_nghi_ban:
        data?.vacation ||
        shop?.vacation
          ? "CÓ"
          : "KHÔNG",
      la_nguoi_ban: "CÓ"
    },
    hoat_dong_gan_nhat:
      unix(
        pick(
          data?.last_active_time,
          shop?.last_active_time
        )
      ) || "Không rõ",
    ngay_tao:
      unix(
        pick(
          data?.ctime,
          shop?.ctime
        )
      ) || "Không rõ",
    nguon_du_lieu:
      data?.__source || "Shopee Public"
  };
}

async function lookupShopee(
  site,
  username,
  shopid
) {
  const api =
    await shopeeShopApi(
      site,
      username,
      shopid
    );

  if (api.success) {
    return normalizeShop(
      api.data,
      site,
      {
        username,
        shopid
      }
    );
  }

  const page =
    await shopeePublicPage(
      site,
      username,
      shopid
    );

  if (page.success) {
    const data =
      extractShopData(
        page.html
      );

    if (data) {
      data.__source =
        "Shopee Public Page";

      return normalizeShop(
        data,
        site,
        {
          username,
          shopid
        }
      );
    }
  }

  return {
    ton_tai: false,
    ma_loi: "SHOPEE_BLOCKED",
    thong_bao:
      "Không lấy được thông tin công khai từ Shopee. Shopee có thể đã giới hạn request hoặc thay đổi dữ liệu trang.",
    chi_tiet: {
      api: {
        http: api.status || 0,
        loi: api.error || null
      },
      page: {
        http: page.status || 0,
        loi: page.error || null
      }
    }
  };
}

module.exports = async (req, res) => {
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

  const protocol =
    req.headers["x-forwarded-proto"] ||
    "https";

  const host =
    req.headers.host ||
    "api-zhee.vercel.app";

  const baseUrl =
    `${protocol}://${host}`;

  const url =
    new URL(
      req.url || "",
      baseUrl
    );

  const params =
    url.searchParams;

  const body =
    req.body &&
    typeof req.body === "object"
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
      vi_du: [
        `${baseUrl}/api/mxh/shopee?=hoducminh2k9`,
        `${baseUrl}/api/mxh/shopee?username=hoducminh2k9`
      ],
      ghi_chu:
        "Chỉ kiểm tra thông tin công khai của shop/tài khoản Shopee."
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
      ma_loi: 400,
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
      await lookupShopee(
        site,
        parsed.username,
        parsed.shopid
      );

    if (!data.ton_tai) {
      return res.status(502).json({
        trang_thai: "that_bai",
        ma_loi: data.ma_loi,
        thong_bao: data.thong_bao,
        chi_tiet: data.chi_tiet
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc:
        "Shopee Shop / Account Lookup",
      du_lieu: data,
      tac_gia:
        "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao:
        "Đã xảy ra lỗi khi kiểm tra Shopee.",
      chi_tiet: error.message
    });
  }
};
