const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function pick(params, ...keys) {
  if (!params || typeof params !== "object") return "";
  for (const key of keys) {
    const val = params[key];
    const v = Array.isArray(val) ? val[0] : val;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function decodeSafe(s) {
  const str = String(s || "");
  try { return decodeURIComponent(str.replace(/\+/g, " ")); } catch (_) { return str; }
}

function parseRawQuery(reqUrl) {
  const str = String(reqUrl || "");
  const idx = str.indexOf("?");
  const blob = idx < 0 ? str : str.slice(idx + 1);
  const out = {};
  for (const part of blob.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? "" : part.slice(eq + 1);
    const key = decodeSafe(rawKey);
    const val = decodeSafe(rawVal);
    if (!key) {
      if (val) out[""] = val;
      continue;
    }
    out[key] = val;
  }
  return out;
}

function queryBlob(req) {
  const url = String(req.url || "");
  if (url.includes("?")) return url.slice(url.indexOf("?") + 1);
  const h = req.headers || {};
  const invoke = h["x-invoke-query"];
  if (invoke) return decodeSafe(Array.isArray(invoke) ? invoke[0] : invoke);
  const forwarded = String(h["x-forwarded-uri"] || h["x-original-uri"] || h["x-invoke-path"] || "");
  if (forwarded.includes("?")) return forwarded.slice(forwarded.indexOf("?") + 1);
  return "";
}

function extractInput(req) {
  const q = req.query && typeof req.query === "object" ? req.query : {};
  let raw = pick(q, "username", "user", "u", "url", "profile", "pin", "q", "link", "");
  if (raw) return raw;

  const blob = queryBlob(req);
  const params = parseRawQuery("?" + blob);
  raw = pick(params, "username", "user", "u", "url", "profile", "pin", "q", "link", "");
  if (raw) return raw;

  if (blob.startsWith("=")) return decodeSafe(blob.slice(1).split("&")[0]);
  if (/^https?:\/\//i.test(blob)) return decodeSafe(blob.split("&")[0]);

  for (const [k, v] of Object.entries(q)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (!k && val) return String(val).trim();
    const key = String(k || "").trim();
    if (!val && (/^https?:\/\//i.test(key) || /pinterest\.|pin\.it/i.test(key) || /^[a-zA-Z0-9._-]{1,64}$/.test(key))) {
      return key;
    }
    if (val && /^https?:\/\//i.test(String(val))) return String(val).trim();
  }

  const first = blob.split("&")[0];
  if (first && !first.includes("=")) return decodeSafe(first);
  return "";
}

function compact(value) {
  if (Array.isArray(value)) {
    return value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || v === null || v === "" || v === false) continue;
      if (Array.isArray(v) && !v.length) continue;
      out[k] = compact(v);
    }
    return out;
  }
  return value;
}

function isoDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function bestImage(images) {
  if (!images || typeof images !== "object") return undefined;
  const orig = images.orig || images["orig"] || images["736x"] || images["474x"] || images["236x"];
  if (orig && orig.url) {
    return compact({
      url: orig.url,
      rong: orig.width,
      cao: orig.height
    });
  }
  const first = Object.values(images).find((item) => item && item.url);
  return first ? { url: first.url, rong: first.width, cao: first.height } : undefined;
}

function videoUrl(pin) {
  const list = pin?.videos?.video_list;
  if (!list || typeof list !== "object") return undefined;
  return list.V_720P?.url || list.V_480P?.url || list.V_360P?.url || list.V_HLSV3_MOBILE?.url;
}

function mapPin(pin) {
  if (!pin || typeof pin !== "object") return null;
  const anh = bestImage(pin.images) || (pin.image_medium_url ? { url: pin.image_medium_url } : undefined);
  return compact({
    id: pin.id,
    tieu_de: pin.title || pin.grid_title || pin.seo_title || pin.auto_alt_text,
    mo_ta: String(pin.description || pin.grid_description || pin.closeup_description || "").trim(),
    alt: pin.auto_alt_text,
    link_pin: pin.id ? `https://www.pinterest.com/pin/${pin.id}/` : undefined,
    link_goc: pin.link,
    ten_mien: pin.domain,
    anh,
    video: videoUrl(pin),
    luot_luu: pin.repin_count,
    luot_chia_se: pin.share_count,
    hashtag: Array.isArray(pin.hashtags) ? pin.hashtags.filter(Boolean).slice(0, 12) : undefined,
    bang: pin.board ? compact({
      ten: pin.board.name,
      url: pin.board.url ? `https://www.pinterest.com${pin.board.url}` : undefined
    }) : undefined,
    nguoi_dang: pin.pinner ? compact({
      id: pin.pinner.id,
      username: pin.pinner.username,
      ten: pin.pinner.full_name,
      avatar: pin.pinner.image_medium_url || pin.pinner.image_xlarge_url
    }) : undefined,
    ngay_tao: isoDate(pin.created_at)
  });
}

function mapBoard(board) {
  if (!board || !board.node_id) return null;
  return compact({
    id: board.id,
    ten: board.name,
    mo_ta: board.description,
    so_pin: board.pin_count,
    so_nguoi_theo_doi: board.follower_count,
    anh_bia: board.image_cover_hd_url || board.image_cover_url,
    url: board.url ? `https://www.pinterest.com${board.url}` : undefined,
    rieng_tu: board.privacy && board.privacy !== "public" ? board.privacy : undefined,
    ngay_tao: isoDate(board.created_at)
  });
}

function mapUser(user) {
  if (!user || !user.username) return null;
  const verified = user.verified_identity?.verified === true;
  return compact({
    id: user.id,
    username: user.username,
    ten_hien_thi: user.full_name || user.first_name,
    gioi_thieu: user.about,
    website: user.website_url,
    domain: user.domain_url,
    followers: user.follower_count,
    following: user.following_count,
    so_pin: user.pin_count,
    so_bang: user.board_count,
    avatar: user.image_xlarge_url || user.image_medium_url,
    anh_bia: user.profile_cover?.images?.originals?.url || user.profile_cover?.images?.["1200x"]?.url,
    xac_minh: verified || undefined,
    doi_tac: user.is_partner || undefined,
    ho_so_rieng_tu: user.is_private_profile || undefined,
    website_da_xac_minh: user.domain_verified || user.is_primary_website_verified || undefined,
    ngay_tao: isoDate(user.created_at),
    pin_gan_nhat: isoDate(user.last_pin_save_time),
    seo: compact({
      tieu_de: user.seo_title,
      mo_ta: user.seo_description
    }),
    link: `https://www.pinterest.com/${user.username}/`
  });
}

async function pinterestResource(name, sourceUrl, options, handler) {
  const data = JSON.stringify({ options, context: {} });
  const url = `https://www.pinterest.com/resource/${name}/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(data)}&_=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "x-pinterest-pws-handler": handler,
      Referer: `https://www.pinterest.com${sourceUrl}`
    },
    signal: AbortSignal.timeout(9000)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return null;
  return json?.resource_response?.data ?? null;
}

async function resolveShortUrl(input) {
  if (!/pin\.it\//i.test(input)) return input;
  try {
    const res = await fetch(input, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });
    return res.url || input;
  } catch (_) {
    return input;
  }
}

function parseInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return { loai: "trong" };
  const resolved = text;
  const pinMatch = resolved.match(/pinterest\.[^/]+\/pin\/(\d+)/i) || resolved.match(/(?:^|[?&])pin=(\d+)/i);
  if (pinMatch) return { loai: "pin", id: pinMatch[1] };
  const boardMatch = resolved.match(/pinterest\.[^/]+\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/?/i);
  if (boardMatch && !["pin", "search", "ideas", "today", "news_hub", "settings"].includes(boardMatch[1].toLowerCase())) {
    return { loai: "bang", username: boardMatch[1], slug: boardMatch[2] };
  }
  const userMatch = resolved.match(/pinterest\.[^/]+\/([a-zA-Z0-9._-]+)\/?/i);
  if (userMatch && !["pin", "search", "ideas", "today"].includes(userMatch[1].toLowerCase())) {
    return { loai: "user", username: userMatch[1] };
  }
  const clean = resolved.replace(/^@/, "").replace(/\/+$/, "").trim();
  if (/^\d{6,}$/.test(clean)) return { loai: "pin", id: clean };
  if (/^[a-zA-Z0-9._-]{1,64}$/.test(clean)) return { loai: "user", username: clean };
  return { loai: "tim", query: clean };
}

async function lookupUser(username) {
  const user = await pinterestResource(
    "UserResource",
    `/${username}/_created`,
    { username, field_set_key: "unauth_profile" },
    "www/[username]/_created.js"
  );
  const profile = mapUser(user);
  if (!profile) {
    const pidgets = await fetch(`https://api.pinterest.com/v3/pidgets/users/${encodeURIComponent(username)}/pins/`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    }).then((r) => r.json()).catch(() => null);
    const u = pidgets?.data?.user;
    if (!u) return null;
    const pins = Array.isArray(pidgets.data.pins) ? pidgets.data.pins.slice(0, 12).map(mapPin).filter(Boolean) : [];
    return compact({
      id: u.id,
      username,
      ten_hien_thi: u.full_name,
      gioi_thieu: u.about ? String(u.about).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))) : undefined,
      followers: u.follower_count,
      so_pin: u.pin_count,
      avatar: u.image_small_url,
      link: u.profile_url || `https://www.pinterest.com/${username}/`,
      pins_gan_day: pins
    });
  }

  const [pinsRaw, boardsRaw] = await Promise.all([
    pinterestResource(
      "UserActivityPinsResource",
      `/${username}/_created`,
      {
        exclude_add_pin_rep: true,
        field_set_key: "grid_item",
        is_own_profile_pins: false,
        user_id: user.id,
        username
      },
      "www/[username]/_created.js"
    ).catch(() => null),
    pinterestResource(
      "BoardsFeedResource",
      `/${username}/_saved`,
      {
        field_set_key: "profile_grid_item",
        filter_stories: false,
        sort: "last_pinned_to",
        username
      },
      "www/[username]/_saved.js"
    ).catch(() => null)
  ]);

  const pins = Array.isArray(pinsRaw) ? pinsRaw.slice(0, 12).map(mapPin).filter(Boolean) : [];
  const boards = Array.isArray(boardsRaw) ? boardsRaw.slice(0, 15).map(mapBoard).filter(Boolean) : [];
  return compact({ ...profile, pins_gan_day: pins, bang: boards });
}

async function lookupPin(id) {
  const pin = await pinterestResource(
    "PinResource",
    `/pin/${id}/`,
    { id, field_set_key: "unauth_react_main_pin" },
    "www/pin/[id].js"
  );
  const mapped = mapPin(pin);
  if (mapped) return mapped;
  const oembed = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(`https://www.pinterest.com/pin/${id}/`)}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000)
  }).then((r) => r.json()).catch(() => null);
  if (!oembed || !oembed.title) return null;
  return compact({
    id,
    tieu_de: oembed.title,
    link_pin: `https://www.pinterest.com/pin/${id}/`,
    anh: oembed.thumbnail_url ? { url: oembed.thumbnail_url, rong: oembed.thumbnail_width, cao: oembed.thumbnail_height } : undefined,
    nguoi_dang: compact({
      ten: oembed.author_name,
      username: oembed.author_url ? String(oembed.author_url).split("/").filter(Boolean).pop() : undefined
    })
  });
}

async function lookupBoard(username, slug) {
  const boards = await pinterestResource(
    "BoardsFeedResource",
    `/${username}/_saved`,
    {
      field_set_key: "profile_grid_item",
      filter_stories: false,
      sort: "last_pinned_to",
      username
    },
    "www/[username]/_saved.js"
  );
  const list = Array.isArray(boards) ? boards.map(mapBoard).filter(Boolean) : [];
  const hit = list.find((b) => (b.url || "").includes(`/${username}/${slug}`)) || list.find((b) => (b.url || "").endsWith(`/${slug}/`));
  return compact({
    username,
    bang: hit || undefined,
    danh_sach_bang: list.slice(0, 20)
  });
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Tra cứu Pinterest (/mxh/pinterest)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Tra cứu hồ sơ Pinterest (followers, pins, boards, avatar, bio), chi tiết Pin, bảng ghim. Không cần đăng nhập.",
    cu_phap: [
      `${baseUrl}/api/mxh/pinterest?username={username}`,
      `${baseUrl}/api/mxh/pinterest?url={link_profile_hoac_pin}`,
      `${baseUrl}/api/mxh/pinterest?pin={pin_id}`,
      `${baseUrl}/api/mxh/pinterest?={username}`
    ],
    vi_du: [
      `${baseUrl}/api/mxh/pinterest?username=pinterest`,
      `${baseUrl}/api/mxh/pinterest?username=ohjoy`,
      `${baseUrl}/api/mxh/pinterest?url=https://www.pinterest.com/pinterest/`,
      `${baseUrl}/api/mxh/pinterest?url=https://www.pinterest.com/pin/424605071145711021/`
    ]
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();
  const send = (code, obj) => {
    const body = JSON.stringify(obj, null, 2);
    if (typeof res.status === "function" && typeof res.send === "function") return res.status(code).send(body);
    res.statusCode = code;
    return res.end(body);
  };

  let raw = extractInput(req);
  if (!raw) return send(200, buildGuide(baseUrl));

  raw = await resolveShortUrl(raw);
  const parsed = parseInput(raw);

  try {
    if (parsed.loai === "pin") {
      const pin = await lookupPin(parsed.id);
      if (!pin) {
        return send(404, {
          trang_thai: "that_bai",
          thong_bao: "Không lấy được Pin. Kiểm tra link hoặc ID."
        });
      }
      return send(200, compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Pinterest Pin",
        loai: "pin",
        du_lieu: pin,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }));
    }

    if (parsed.loai === "bang") {
      const board = await lookupBoard(parsed.username, parsed.slug);
      if (!board || (!board.bang && !(board.danh_sach_bang || []).length)) {
        return send(404, {
          trang_thai: "that_bai",
          thong_bao: "Không lấy được bảng ghim."
        });
      }
      return send(200, compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Pinterest Board",
        loai: "bang",
        du_lieu: board,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }));
    }

    const username = parsed.username || parsed.query;
    if (!username) return send(200, buildGuide(baseUrl));
    const profile = await lookupUser(username);
    if (!profile) {
      return send(404, {
        trang_thai: "that_bai",
        thong_bao: "Không tìm thấy tài khoản Pinterest công khai."
      });
    }
    return send(200, compact({
      trang_thai: "thanh_cong",
      chuyen_muc: "Pinterest Profile",
      loai: "ho_so",
      du_lieu: profile,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    }));
  } catch (error) {
    return send(502, {
      trang_thai: "that_bai",
      thong_bao: error.message || "Không truy vấn được Pinterest."
    });
  }
};
