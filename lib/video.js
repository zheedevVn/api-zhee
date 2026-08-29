const DOGGY_V5_LIST = require("./data/doggyv5.json");
const DOGGY_V6_LIST = require("./data/doggyv6.json");
const DOGGY_V7_LIST = require("./data/doggyv7.json");
const DOGGY_V8_LIST = require("./data/doggyv8.json");
const DOGGY_V9_LIST = require("./data/doggyv9.json");
const DOGGY_V10_LIST = require("./data/doggyv10.json");
const DOGGY_V11_LIST = require("./data/doggyv11.json");
const DOGGY_V12_LIST = require("./data/doggyv12.json");
const DOGGY_V13_LIST = require("./data/doggyv13.json");
const DOGGY_V14_LIST = require("./data/doggyv14.json");
const DOGGY_V15_LIST = require("./data/doggyv15.json");
const cheerio = require("cheerio");

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "minhhocgioi"];

const MEDIA_SERVERS = {
  doggyv1: { host: "https://doggyv1.netlify.app", max: 72, prefix: "", ext: "mp4" },
  doggyv2: { host: "https://doggyv2.netlify.app", max: 49, prefix: "", ext: "mp4" },
  doggyv3: { host: "https://doggyv3.netlify.app", max: 107, prefix: "", ext: "mp4" },
  doggyv4: { host: "https://doggyv4.netlify.app", max: 162, prefix: "", ext: "mp4" },
  doggyv5: { list: DOGGY_V5_LIST, max: DOGGY_V5_LIST.length },
  doggyv6: { list: DOGGY_V6_LIST, max: DOGGY_V6_LIST.length },
  doggyv7: { list: DOGGY_V7_LIST, max: DOGGY_V7_LIST.length },
  doggyv8: { list: DOGGY_V8_LIST, max: DOGGY_V8_LIST.length },
  doggyv9: { list: DOGGY_V9_LIST, max: DOGGY_V9_LIST.length },
  doggyv10: { list: DOGGY_V10_LIST, max: DOGGY_V10_LIST.length },
  doggyv11: { list: DOGGY_V11_LIST, max: DOGGY_V11_LIST.length },
  doggyv12: { list: DOGGY_V12_LIST, max: DOGGY_V12_LIST.length },
  doggyv13: { list: DOGGY_V13_LIST, max: DOGGY_V13_LIST.length },
  doggyv14: { list: DOGGY_V14_LIST, max: DOGGY_V14_LIST.length },
  doggyv15: { list: DOGGY_V15_LIST, max: DOGGY_V15_LIST.length },
  videoandanh247: { host: "https://videoandanh247.netlify.app", max: 26, prefix: "video", ext: "mp4" },
  videoxuattrong: { host: "https://videoxuattrong.netlify.app", max: 28, prefix: "", ext: "mp4" },
  andanhgif1: { host: "https://andanhgif1.netlify.app/images", max: 35, prefix: "image", ext: "gif" },
  andanhgif2: { host: "https://andanhgif2.netlify.app/images", max: 32, prefix: "image", ext: "gif" },
  andanhgif3: { host: "https://andanhgif3.netlify.app/images", max: 26, prefix: "image", ext: "gif" },
  andanhgif4: { host: "https://andanhgif4.netlify.app/images", max: 31, prefix: "image", ext: "gif" },
  andanhgif5: { host: "https://andanhgif5.netlify.app/images", max: 26, prefix: "image", ext: "gif" },
  andanhgif6: { host: "https://andanhgif6.netlify.app/images", max: 18, prefix: "image", ext: "gif" }
};

// Ánh xạ linh hoạt: Hỗ trợ cả tên gọi cũ lẫn alias ẩn danh node_xx
const NODE_SAFE_MAP = {
  "node_v1": "doggyv1", "node_v2": "doggyv2", "node_v3": "doggyv3", "node_v4": "doggyv4",
  "node_v5": "doggyv5", "node_v6": "doggyv6", "node_v7": "doggyv7", "node_v8": "doggyv8",
  "node_v9": "doggyv9", "node_v10": "doggyv10", "node_v11": "doggyv11", "node_v12": "doggyv12",
  "node_v13": "doggyv13", "node_v14": "doggyv14", "node_v15": "doggyv15",
  "node_media_247": "videoandanh247", "node_media_xt": "videoxuattrong",
  "node_gif_01": "andanhgif1", "node_gif_02": "andanhgif2", "node_gif_03": "andanhgif3",
  "node_gif_04": "andanhgif4", "node_gif_05": "andanhgif5", "node_gif_06": "andanhgif6",
  "node_stream_2d": "hentai2d", "node_stream_3d": "hentai3d", "node_stream_mix": "hentai3dvanguoi"
};

const RECENT_HISTORY = {
  doggyv1: [], doggyv2: [], doggyv3: [], doggyv4: [],
  doggyv5: [], doggyv6: [], doggyv7: [], doggyv8: [],
  doggyv9: [], doggyv10: [], doggyv11: [], doggyv12: [],
  doggyv13: [], doggyv14: [], doggyv15: [], videoandanh247: [], videoxuattrong: [],
  andanhgif1: [], andanhgif2: [], andanhgif3: [], andanhgif4: [], andanhgif5: [], andanhgif6: [],
  hentai2d: [], hentai3d: [], hentai3dvanguoi: []
};

function getMediaItem(category, requestedId) {
  const config = MEDIA_SERVERS[category];
  if (!config) return null;

  // Xử lý server có file JSON (V5 - V15)
  if (config.list) {
    if (requestedId) {
      let idNum = parseInt(requestedId, 10);
      if (isNaN(idNum) || idNum < 1) idNum = 1;
      if (idNum > config.max) idNum = config.max;
      const item = config.list[idNum - 1];
      return { id: idNum, tong_so: config.max, ten: item.name, url: item.video, thumbnail: item.thumbnail };
    }

    const history = RECENT_HISTORY[category];
    const allIndexes = Array.from({ length: config.max }, (_, i) => i);
    const available = allIndexes.filter(i => !history.includes(i));
    const chosenIdx = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : allIndexes[Math.floor(Math.random() * allIndexes.length)];

    history.push(chosenIdx);
    if (history.length > 20) history.shift();

    const item = config.list[chosenIdx];
    return { id: chosenIdx + 1, tong_so: config.max, ten: item.name, url: item.video, thumbnail: item.thumbnail };
  }

  // Xử lý server đánh số trực tiếp theo dải ID
  const prefix = config.prefix || "";
  const ext = config.ext || "mp4";

  if (requestedId) {
    let idNum = parseInt(requestedId, 10);
    if (isNaN(idNum) || idNum < 1) idNum = 1;
    if (idNum > config.max) idNum = config.max;
    return { id: idNum, tong_so: config.max, url: `${config.host}/${prefix}${idNum}.${ext}` };
  }

  const history = RECENT_HISTORY[category];
  const allIds = Array.from({ length: config.max }, (_, i) => i + 1);
  const availableIds = allIds.filter(id => !history.includes(id));
  const chosenId = availableIds.length > 0
    ? availableIds[Math.floor(Math.random() * availableIds.length)]
    : allIds[Math.floor(Math.random() * allIds.length)];

  history.push(chosenId);
  if (history.length > Math.min(20, Math.floor(config.max / 2))) history.shift();

  return { id: chosenId, tong_so: config.max, url: `${config.host}/${prefix}${chosenId}.${ext}` };
}

async function getRandomUniqueVideo(category) {
  const history = RECENT_HISTORY[category];
  let candidateUrl = "";
  let attempts = 0;

  while (attempts < 8) {
    attempts++;
    try {
      const res = await fetch(`https://api-random-video.netlify.app/api/${category}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          candidateUrl = json.url || json.link || json.video || json.data || "";
        } catch {
          candidateUrl = text.trim();
        }

        if (candidateUrl && /^https?:\/\//i.test(candidateUrl) && !history.includes(candidateUrl)) {
          history.push(candidateUrl);
          if (history.length > 25) history.shift();
          return candidateUrl;
        }
      }
    } catch (e) {
      break;
    }
  }

  return candidateUrl;
}

function isSafePublicUrl(value) {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]" && !hostname.endsWith(".local") && !/^10\./.test(hostname) && !/^192\.168\./.test(hostname) && !/^169\.254\./.test(hostname) && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch (_) {
    return false;
  }
}

function resolveImageUrl(value, pageUrl) {
  if (!value || /^data:/i.test(value)) return "";
  try {
    const url = new URL(value, pageUrl);
    return isSafePublicUrl(url.href) ? url.href : "";
  } catch (_) {
    return "";
  }
}

const DECORATIVE_IMAGE_PATTERN = /(?:logo|icon|favicon|avatar|sprite|banner|advert|ads?|promo|tracking|pixel|placeholder|loader|emoji|badge|share|qr)/i;
function isLikelyDecorativeImage(value, context = "") {
  return DECORATIVE_IMAGE_PATTERN.test(`${value} ${context}`) || /\.svg(?:[?#]|$)/i.test(value);
}

function requestedPageUrls(searchParams) {
  const raw = [searchParams.get("url"), searchParams.get("link"), searchParams.get("urls")]
    .filter(Boolean).join("\n");
  return [...new Set(raw.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean))].slice(0, 10);
}

async function collectSinglePageImages(pageUrl) {
  if (!isSafePublicUrl(pageUrl)) throw new Error("URL không hợp lệ hoặc không được phép truy cập.");
  const response = await fetch(pageUrl, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZheeImageCollector/1.1)" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Trang nguồn trả HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("URL phải là trang HTML công khai chứa ảnh.");
  const html = await response.text();
  const $ = cheerio.load(html);
  const images = [];
  const filtered = [];
  const add = (value, context = "") => {
    const rawValue = String(value || "").trim();
    const imageUrl = resolveImageUrl(rawValue, pageUrl);
    if (!imageUrl || images.includes(imageUrl) || filtered.some((item) => item.url === imageUrl)) return;
    if (isLikelyDecorativeImage(rawValue, context)) {
      filtered.push({ url: imageUrl, ly_do: "Có dấu hiệu logo, quảng cáo hoặc ảnh trang trí" });
      return;
    }
    if (images.length < 50) images.push(imageUrl);
  };
  $("meta[property=\"og:image\"], meta[name=\"twitter:image\"]").each((_, element) => add($(element).attr("content"), "social preview"));
  $("img").each((_, element) => {
    const context = [$(element).attr("alt"), $(element).attr("class"), $(element).attr("id"), $(element).attr("width"), $(element).attr("height")].filter(Boolean).join(" ");
    add($(element).attr("src"), context);
    add($(element).attr("data-src"), context);
    add($(element).attr("data-original"), context);
    String($(element).attr("srcset") || "").split(",").forEach((item) => add(item.trim().split(/\s+/)[0], context));
  });
  $("script[type=\"application/ld+json\"]").each((_, element) => {
    try {
      const json = JSON.parse($(element).text());
      const values = JSON.stringify(json).match(/https?:[^\"\s]+?\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\"\s]*)?/gi) || [];
      values.forEach((value) => add(value, "json-ld"));
    } catch (_) {}
  });
  return { trang_nguon: pageUrl, so_luong: images.length, danh_sach_anh: images, da_loc: filtered.length, danh_sach_da_loc: filtered.slice(0, 50) };
}

async function collectPageImages(searchParams) {
  const pageUrls = requestedPageUrls(searchParams);
  if (!pageUrls.length) throw new Error("Vui lòng cung cấp ít nhất một URL công khai.");
  const settled = await Promise.all(pageUrls.map(async (pageUrl) => {
    try { return { trang_thai: "thanh_cong", ...(await collectSinglePageImages(pageUrl)) }; }
    catch (error) { return { trang_thai: "that_bai", trang_nguon: pageUrl, thong_bao: error.message || "Không thể đọc trang." }; }
  }));
  const images = settled.flatMap((item) => item.danh_sach_anh || []).filter((url, index, list) => list.indexOf(url) === index).slice(0, 50);
  const filtered = settled.flatMap((item) => item.danh_sach_da_loc || []).slice(0, 50);
  return {
    trang_thai: "thanh_cong",
    loai: "image_link_collector",
    so_trang: pageUrls.length,
    so_luong: images.length,
    gioi_han: 50,
    danh_sach_anh: images,
    danh_sach_json: settled,
    da_loc: filtered.length,
    danh_sach_da_loc: filtered,
    ghi_chu: "JSON được trả trước để kiểm tra nguồn và bộ lọc; ảnh chỉ là phần xem trước. Logo/quảng cáo bị loại theo dấu hiệu URL, class, alt và metadata, không thể đảm bảo tuyệt đối.",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

async function proxyImageAnime(searchParams) {
  const queryS = searchParams.get("s");
  const queryUrl = searchParams.get("url");
  const page = searchParams.get("page") || "1";

  let targetEndpoint = queryUrl
    ? `https://api-anh-210.netlify.app/anh?url=${encodeURIComponent(queryUrl)}`
    : queryS
      ? `https://api-anh-210.netlify.app/anh?s=${encodeURIComponent(queryS)}&page=${page}`
      : `https://api-anh-210.netlify.app/anh`;

  const res = await fetch(targetEndpoint, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Lỗi kết nối ảnh HTTP: ${res.status}`);
  return await res.json();
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const pathname = requestUrl.pathname.toLowerCase();
  const searchParams = requestUrl.searchParams;

  let key = searchParams.get("key") || "";
  let hasKeyParam = searchParams.has("key");

  if (!key) {
    for (const [k, v] of searchParams.entries()) {
      if (!k && v) { key = v.trim(); hasKeyParam = true; break; }
      if (k && !v && !k.startsWith("/")) { key = k.replace(/^=/, "").trim(); hasKeyParam = true; break; }
    }
  }

  // 1. Kiểm tra xác thực API Key
  if (!key && !hasKeyParam) {
    return res.status(401).json({
      trang_thai: "that_bai",
      ma_loi: 401,
      thong_bao: "Vui lòng cung cấp API Key để truy cập khu vực này.",
      cu_phap_yeu_cau: `${baseUrl}/video?key={api_key}`
    });
  }

  if (!VALID_KEYS.includes(key)) {
    return res.status(403).json({
      trang_thai: "that_bai",
      ma_loi: 403,
      thong_bao: "API Key không hợp lệ hoặc đã hết hạn truy cập.",
      key_da_nhap: key
    });
  }

  // 2. Tool lấy ảnh từ trang công khai (/video/images)
  if (pathname.includes("/images")) {
    try {
      const data = await collectPageImages(searchParams);
      return res.status(200).json({ ...data, tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    } catch (error) {
      return res.status(502).json({ trang_thai: "that_bai", thong_bao: error.message || "Không thể lấy ảnh từ trang nguồn.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }
  }

  // 3. Sub-endpoint ảnh Anime (/video/anh)
  if (pathname.includes("/anh")) {
    try {
      const data = await proxyImageAnime(searchParams);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message || "Lỗi kết nối máy chủ ảnh." });
    }
  }

  // 4. Nhận diện Node/Category (nhận cả query `node=node_v1` hoặc `type=doggyv1` hoặc url path)
  let rawCategory = searchParams.get("node") || searchParams.get("type") || searchParams.get("category") || "";
  
  for (const srvType of Object.keys(MEDIA_SERVERS)) {
    if (pathname.includes(`/${srvType}`)) {
      rawCategory = srvType;
      break;
    }
  }

  const category = NODE_SAFE_MAP[rawCategory] || rawCategory;

  // 4. Xử lý Media Servers (Doggy V1-V15, Video247, Xuất Trong, GIF Ẩn Danh 1-6)
  if (category && MEDIA_SERVERS[category]) {
    const isRaw = searchParams.get("raw") === "true";
    const requestedId = searchParams.get("id") || searchParams.get("stt");
    const mediaObj = getMediaItem(category, requestedId);

    if (isRaw) return res.redirect(mediaObj.url);

    const isGif = MEDIA_SERVERS[category].ext === "gif";
    return res.status(200).json({
      trang_thai: "thanh_cong",
      server: category.toUpperCase(),
      node_id: rawCategory,
      dinh_dang: isGif ? "GIF Animation" : "Video MP4",
      che_do: requestedId ? "Theo thứ tự ID" : "Random không trùng lặp",
      id: mediaObj.id,
      tong_so: mediaObj.tong_so,
      ...(mediaObj.ten ? { ten_file: mediaObj.ten } : {}),
      link_media: mediaObj.url,
      ...(mediaObj.thumbnail ? { thumbnail: mediaObj.thumbnail } : {})
    });
  }

  // 5. Xử lý Streaming (2D, 3D, 3D và người)
  if (category && ["hentai2d", "hentai3d", "hentai3dvanguoi"].includes(category)) {
    const isRaw = searchParams.get("raw") === "true";
    const videoUrl = await getRandomUniqueVideo(category);

    if (!videoUrl) {
      return res.status(502).json({ trang_thai: "that_bai", thong_bao: "Không thể lấy luồng video từ máy chủ nguồn." });
    }

    if (isRaw) return res.redirect(videoUrl);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      the_loai: category,
      node_id: rawCategory,
      co_che: "Random Dynamic (Khử trùng lặp)",
      link_video: videoUrl
    });
  }

  // 6. Trả về bảng tài liệu toàn diện
  return res.status(200).json({
    trang_thai: "da_xac_thuc",
    chuyen_muc: "Hệ Thống Video Streaming, GIF & Album Ảnh Độc Quyền (/video)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tong_so_cluster: Object.keys(MEDIA_SERVERS).length + 3,
    danh_sach_server_media: {
      doggy_v1: {
        ten: "Doggy Server V1",
        so_luong: "72 video (1-72.mp4)",
        cu_phap_random: `${baseUrl}/video?type=doggyv1&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv1&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv1&raw=true&key=${key}`
      },
      doggy_v2: {
        ten: "Doggy Server V2",
        so_luong: "49 video (1-49.mp4)",
        cu_phap_random: `${baseUrl}/video?type=doggyv2&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv2&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv2&raw=true&key=${key}`
      },
      doggy_v3: {
        ten: "Doggy Server V3",
        so_luong: "107 video (1-107.mp4)",
        cu_phap_random: `${baseUrl}/video?type=doggyv3&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv3&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv3&raw=true&key=${key}`
      },
      doggy_v4: {
        ten: "Doggy Server V4",
        so_luong: "162 video (1-162.mp4)",
        cu_phap_random: `${baseUrl}/video?type=doggyv4&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv4&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv4&raw=true&key=${key}`
      },
      doggy_v5: {
        ten: "Doggy Server V5 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv5.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv5&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv5&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv5&raw=true&key=${key}`
      },
      doggy_v6: {
        ten: "Doggy Server V6 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv6.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv6&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv6&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv6&raw=true&key=${key}`
      },
      doggy_v7: {
        ten: "Doggy Server V7 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv7.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv7&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv7&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv7&raw=true&key=${key}`
      },
      doggy_v8: {
        ten: "Doggy Server V8 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv8.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv8&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv8&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv8&raw=true&key=${key}`
      },
      doggy_v9: {
        ten: "Doggy Server V9 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv9.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv9&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv9&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv9&raw=true&key=${key}`
      },
      doggy_v10: {
        ten: "Doggy Server V10 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv10.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv10&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv10&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv10&raw=true&key=${key}`
      },
      doggy_v11: {
        ten: "Doggy Server V11 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv11.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv11&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv11&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv11&raw=true&key=${key}`
      },
      doggy_v12: {
        ten: "Doggy Server V12 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv12.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv12&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv12&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv12&raw=true&key=${key}`
      },
      doggy_v13: {
        ten: "Doggy Server V13 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv13.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv13&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv13&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv13&raw=true&key=${key}`
      },
      doggy_v14: {
        ten: "Doggy Server V14 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv14.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv14&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv14&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv14&raw=true&key=${key}`
      },
      doggy_v15: {
        ten: "Doggy Server V15 (Kèm Thumbnail & Tên Video)",
        so_luong: `${MEDIA_SERVERS.doggyv15.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv15&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv15&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv15&raw=true&key=${key}`
      },
      videoandanh247: {
        ten: "Video & Ảnh 247 Server",
        so_luong: "26 video (video1.mp4 - video26.mp4)",
        cu_phap_random: `${baseUrl}/video?type=videoandanh247&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=videoandanh247&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=videoandanh247&raw=true&key=${key}`
      },
      videoxuattrong: {
        ten: "Video Xuất Trong Server",
        so_luong: "28 video (1.mp4 - 28.mp4)",
        cu_phap_random: `${baseUrl}/video?type=videoxuattrong&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=videoxuattrong&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=videoxuattrong&raw=true&key=${key}`
      },
      andanhgif1: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 1",
        so_luong: "35 ảnh GIF (image1.gif - image35.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif1&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif1&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif1&raw=true&key=${key}`
      },
      andanhgif2: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 2",
        so_luong: "32 ảnh GIF (image1.gif - image32.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif2&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif2&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif2&raw=true&key=${key}`
      },
      andanhgif3: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 3",
        so_luong: "26 ảnh GIF (image1.gif - image26.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif3&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif3&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif3&raw=true&key=${key}`
      },
      andanhgif4: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 4",
        so_luong: "31 ảnh GIF (image1.gif - image31.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif4&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif4&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif4&raw=true&key=${key}`
      },
      andanhgif5: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 5",
        so_luong: "26 ảnh GIF (image1.gif - image26.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif5&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif5&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif5&raw=true&key=${key}`
      },
      andanhgif6: {
        ten: "Kho Ảnh Động GIF Ẩn Danh 6",
        so_luong: "18 ảnh GIF (image1.gif - image18.gif)",
        cu_phap_random: `${baseUrl}/video?type=andanhgif6&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=andanhgif6&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=andanhgif6&raw=true&key=${key}`
      },
      hentai_streaming: {
        the_loai: ["hentai2d", "hentai3d", "hentai3dvanguoi"],
        cu_phap: `${baseUrl}/video?type=hentai2d&key=${key}`
      },
      album_anh_anime: {
        tim_kiem: `${baseUrl}/video/anh?s=anime&page=1&key=${key}`,
        lay_album: `${baseUrl}/video/anh?url=https://topanhanime.com/anh-anime-nam-chibi/&key=${key}`
      }
    }
  });
};