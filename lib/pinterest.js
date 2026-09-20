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

function extractParams(req) {
  const q = req.query && typeof req.query === "object" ? req.query : {};
  const blob = queryBlob(req);
  const params = parseRawQuery("?" + blob);
  const get = (...keys) => pick(q, ...keys) || pick(params, ...keys);
  return {
    username: get("username", "user", "u", "profile"),
    pin: get("pin"),
    query: get("q", "keyword", "tim", "search"),
    site: get("site", "domain", "web", "website"),
    action: String(get("action", "loai") || "").toLowerCase(),
    page: Number(get("page") || 1) || 1,
    raw: get("") || pick(q, "url", "link") || pick(params, "url", "link")
  };
}

function extractInput(req) {
  const parsed = extractParams(req);
  if (parsed.username || parsed.query || parsed.site || parsed.pin || parsed.raw) {
    return parsed.username || parsed.query || parsed.site || parsed.pin || parsed.raw;
  }
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
    signal: AbortSignal.timeout(12000)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return null;
  return json?.resource_response?.data ?? null;
}

function extractUserFromHtml(html, username) {
  if (!html) return null;
  const wanted = String(username || "").toLowerCase();
  const re = /"username"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    if (String(match[1]).toLowerCase() !== wanted) continue;
    const window = html.slice(Math.max(0, match.index - 900), match.index + 1400);
    const fullName = (window.match(/"full_name"\s*:\s*"([^"]+)"/) || [])[1];
    const followers = (window.match(/"follower_count"\s*:\s*(\d+)/) || [])[1];
    const following = (window.match(/"following_count"\s*:\s*(\d+)/) || [])[1];
    const pins = (window.match(/"pin_count"\s*:\s*(\d+)/) || [])[1];
    const boards = (window.match(/"board_count"\s*:\s*(\d+)/) || [])[1];
    const about = (window.match(/"about"\s*:\s*"((?:\\.|[^"\\])*)"/) || [])[1];
    const avatar = (window.match(/"image_(?:xlarge|medium|small)_url"\s*:\s*"(https:[^"]+)"/) || [])[1];
    const id = (window.match(/"id"\s*:\s*"(\d+)"/) || [])[1];
    if (!fullName && !followers && !avatar) continue;
    return compact({
      id,
      username: match[1],
      ten_hien_thi: fullName,
      gioi_thieu: about ? about.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, "\"") : undefined,
      followers: followers ? Number(followers) : undefined,
      following: following ? Number(following) : undefined,
      so_pin: pins ? Number(pins) : undefined,
      so_bang: boards ? Number(boards) : undefined,
      avatar,
      link: `https://www.pinterest.com/${match[1]}/`
    });
  }
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "";
  const named = title.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*Profile/i);
  if (named) {
    return compact({
      username: named[2],
      ten_hien_thi: named[1].trim(),
      link: `https://www.pinterest.com/${named[2]}/`
    });
  }
  return null;
}

async function scrapePinterestPage(path) {
  const res = await fetch(`https://www.pinterest.com${path}`, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) return { url: res.url, html: "" };
  return { url: res.url || `https://www.pinterest.com${path}`, html: await res.text() };
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
  let text = String(raw || "").trim().replace(/[<>]/g, "");
  try { text = decodeURIComponent(text); } catch (_) {}
  if (!text) return { loai: "trong" };
  const embedded = text.match(/https?:\/\/(?:www\.)?(?:[a-z]{2}\.)?(?:pinterest\.[^\s]+|pin\.it\/[^\s]+)/i);
  if (embedded) text = embedded[0].replace(/[),.;]+$/, "");
  const resolved = text;
  const pinMatch = resolved.match(/pinterest\.[^/]+\/pin\/(\d+)/i) || resolved.match(/(?:^|[?&])pin[=/](\d+)/i);
  if (pinMatch) return { loai: "pin", id: pinMatch[1] };
  const boardMatch = resolved.match(/pinterest\.[^/]+\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:[/?#]|$)/i);
  if (boardMatch && !["pin", "search", "ideas", "today", "news_hub", "settings"].includes(boardMatch[1].toLowerCase())) {
    return { loai: "bang", username: boardMatch[1], slug: boardMatch[2] };
  }
  const userMatch = resolved.match(/pinterest\.[^/]+\/(?:[a-z]{2}\/)?([a-zA-Z0-9._-]+)(?:[/?#]|$)/i);
  if (userMatch && !["pin", "search", "ideas", "today", "news_hub", "settings"].includes(userMatch[1].toLowerCase())) {
    return { loai: "user", username: userMatch[1] };
  }
  const clean = resolved.replace(/^@/, "").replace(/\/+$/, "").split(/[?#]/)[0].trim();
  if (/^\d{6,}$/.test(clean)) return { loai: "pin", id: clean };
  if (/^[a-zA-Z0-9._-]{1,64}$/.test(clean)) return { loai: "user", username: clean };
  return { loai: "tim", query: clean };
}

async function lookupUser(username) {
  username = String(username || "").replace(/^@/, "").split(/[/?#]/)[0].trim();
  if (!username) return null;
  const user = await pinterestResource(
    "UserResource",
    `/${username}/_created`,
    { username, field_set_key: "unauth_profile" },
    "www/[username]/_created.js"
  ).catch(() => null);
  const profile = mapUser(user);
  if (!profile) {
    const pidgets = await fetch(`https://api.pinterest.com/v3/pidgets/users/${encodeURIComponent(username)}/pins/`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    }).then((r) => r.json()).catch(() => null);
    const u = pidgets?.data?.user;
    if (u) {
      const pins = Array.isArray(pidgets.data.pins) ? pidgets.data.pins.slice(0, 12).map(mapPin).filter(Boolean) : [];
      return compact({
        id: u.id,
        username: u.username || username,
        ten_hien_thi: u.full_name,
        gioi_thieu: u.about ? String(u.about).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))) : undefined,
        followers: u.follower_count,
        so_pin: u.pin_count,
        avatar: u.image_small_url,
        link: u.profile_url || `https://www.pinterest.com/${username}/`,
        pins_gan_day: pins
      });
    }
    const page = await scrapePinterestPage(`/${encodeURIComponent(username)}/`).catch(() => null);
    const scraped = extractUserFromHtml(page?.html || "", username);
    if (scraped) return scraped;
    return null;
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
  ).catch(() => null);
  const mapped = mapPin(pin);
  if (mapped) return mapped;
  const oembed = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(`https://www.pinterest.com/pin/${id}/`)}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  }).then((r) => r.json()).catch(() => null);
  if (oembed && (oembed.title || oembed.thumbnail_url)) {
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
  const page = await scrapePinterestPage(`/pin/${encodeURIComponent(id)}/`).catch(() => null);
  const html = page?.html || "";
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  const image = (html.match(/property="og:image"[^>]*content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]*property="og:image"/i) || [])[1];
  if (!title && !image) return null;
  return compact({
    id,
    tieu_de: title ? title.replace(/\s+\|\s+Pinterest.*$/i, "").trim() : undefined,
    link_pin: `https://www.pinterest.com/pin/${id}/`,
    anh: image ? { url: image } : undefined
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

const vqdCache = new Map();
const SEARCH_PAGE_SIZE = 10;

function normalizeSite(value) {
  let s = String(value || "").trim();
  if (!s) return "";
  try {
    if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
    return new URL(s).hostname.replace(/^www\./i, "");
  } catch (_) {
    return s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  }
}

function looksLikeWebsite(value) {
  const s = String(value || "").trim();
  if (/^https?:\/\//i.test(s)) return !/pinterest\.|pin\.it/i.test(s);
  return /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(s);
}

function betterPinImage(url) {
  if (!url) return url;
  return String(url).replace(/[?].*$/, "").replace(/i\.pinimg\.com\/\d+x\//, "i.pinimg.com/originals/");
}

function mapSearchHit(hit) {
  if (!hit || typeof hit !== "object") return null;
  const image = betterPinImage(hit.image);
  if (!image) return null;
  const pinId = String(hit.url || "").match(/\/pin\/(?:[^/?#]*--)?(\d+)/);
  return compact({
    tieu_de: hit.title,
    anh: compact({ url: image, rong: hit.width, cao: hit.height }),
    thumbnail: hit.thumbnail,
    link_pin: hit.url,
    pin_id: pinId ? pinId[1] : undefined,
    kich_thuoc: hit.width && hit.height ? `${hit.width}x${hit.height}` : undefined
  });
}

async function getVqd(query) {
  const key = String(query || "").trim().toLowerCase();
  const cached = vqdCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.vqd;
  const res = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(12000)
  });
  const html = await res.text();
  const vqd = (html.match(/vqd=['"]([^'"]+)['"]/) || html.match(/vqd=([\w-]+)/) || [])[1];
  if (vqd) vqdCache.set(key, { vqd, expires: Date.now() + 10 * 60 * 1000 });
  return vqd || "";
}

async function searchPinterestImages({ query, site, page = 1, limit = SEARCH_PAGE_SIZE } = {}) {
  const keyword = String(query || "").trim();
  const domain = normalizeSite(site);
  if (!keyword && !domain) return null;
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(20, Math.max(1, Number(limit) || SEARCH_PAGE_SIZE));
  const searchQuery = domain
    ? `${domain} site:pinterest.com`
    : `${keyword} site:pinterest.com`;
  const vqd = await getVqd(searchQuery);
  if (!vqd) return null;
  const offset = (page - 1) * limit;
  const url = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(searchQuery)}&vqd=${encodeURIComponent(vqd)}&s=${offset}&f=,,,`;
  const json = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://duckduckgo.com/"
    },
    signal: AbortSignal.timeout(15000)
  }).then((r) => r.json()).catch(() => null);
  const rows = Array.isArray(json?.results) ? json.results : [];
  const items = rows.map(mapSearchHit).filter(Boolean).slice(0, limit);
  if (!items.length) return null;
  return compact({
    trang_thai: "thanh_cong",
    chuyen_muc: domain ? "Pinterest Ảnh theo website" : "Pinterest Ảnh theo từ khóa",
    loai: domain ? "anh_website" : "anh_tu_khoa",
    du_lieu: {
      tu_khoa: keyword || null,
      website: domain || null,
      page,
      per_page: limit,
      so_anh: items.length,
      has_more: Boolean(json?.next) || rows.length >= limit,
      link_tim: domain
        ? `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(domain)}`
        : `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}`,
      anh: items
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
}

async function lookupAny(raw, extra = {}) {
  const action = String(extra.action || "").toLowerCase();
  const page = extra.page || 1;
  if (action === "search" || action === "tim" || extra.query) {
    return searchPinterestImages({ query: extra.query || raw, page });
  }
  if (action === "web" || action === "site" || extra.site) {
    return searchPinterestImages({ site: extra.site || raw, query: extra.query, page });
  }
  let input = String(raw || "").trim();
  if (!input) return null;
  if (looksLikeWebsite(input) && !/pinterest\.|pin\.it/i.test(input)) {
    return searchPinterestImages({ site: input, page });
  }
  input = await resolveShortUrl(input);
  const parsed = parseInput(input);

  if (parsed.loai === "pin") {
    const pin = await lookupPin(parsed.id);
    if (!pin) return null;
    return compact({
      trang_thai: "thanh_cong",
      chuyen_muc: "Pinterest Pin",
      loai: "pin",
      du_lieu: pin,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  if (parsed.loai === "bang") {
    const board = await lookupBoard(parsed.username, parsed.slug);
    if (!board || (!board.bang && !(board.danh_sach_bang || []).length)) return null;
    return compact({
      trang_thai: "thanh_cong",
      chuyen_muc: "Pinterest Board",
      loai: "bang",
      du_lieu: board,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  const username = parsed.username || parsed.query;
  if (!username) return null;
  const profile = await lookupUser(username);
  if (!profile) return null;
  return compact({
    trang_thai: "thanh_cong",
    chuyen_muc: "Pinterest Profile",
    loai: "ho_so",
    du_lieu: profile,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  });
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Tra cứu Pinterest (/mxh/pinterest)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Hai action: (1) tra username/profile/pin, (2) tìm 10 ảnh/trang theo từ khóa hoặc website. Thêm page=2,3,... để phân trang.",
    cu_phap: [
      `${baseUrl}/api/mxh/pinterest?={username}`,
      `${baseUrl}/api/mxh/pinterest?username={username}`,
      `${baseUrl}/api/mxh/pinterest?q={tu_khoa}&page=1`,
      `${baseUrl}/api/mxh/pinterest?action=search&q={tu_khoa}&page=1`,
      `${baseUrl}/api/mxh/pinterest?site={domain_hoac_url}&page=1`,
      `${baseUrl}/api/mxh/pinterest?action=web&site={domain}&page=1`
    ],
    vi_du: [
      `${baseUrl}/api/mxh/pinterest?=pinterest`,
      `${baseUrl}/api/mxh/pinterest?username=ohjoy`,
      `${baseUrl}/api/mxh/pinterest?q=cat&page=1`,
      `${baseUrl}/api/mxh/pinterest?site=nytimes.com&page=1`
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

  const params = extractParams(req);
  const raw = params.username || params.query || params.site || params.pin || params.raw || extractInput(req);
  if (!raw && !params.action) return send(200, buildGuide(baseUrl));

  try {
    const payload = await lookupAny(raw, {
      action: params.action,
      query: params.query,
      site: params.site,
      page: params.page
    });
    if (!payload) {
      return send(404, {
        trang_thai: "that_bai",
        thong_bao: params.action === "search" || params.query || params.site
          ? "Không tìm thấy ảnh Pinterest cho từ khóa/website này."
          : "Không tìm thấy tài khoản Pinterest công khai."
      });
    }
    return send(200, payload);
  } catch (error) {
    return send(502, {
      trang_thai: "that_bai",
      thong_bao: error.message || "Không truy vấn được Pinterest."
    });
  }
};

module.exports.lookupAny = lookupAny;
module.exports.searchPinterestImages = searchPinterestImages;
module.exports.looksLikeWebsite = looksLikeWebsite;
