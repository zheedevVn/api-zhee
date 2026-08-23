const DOGGY_V5_LIST = require("./data/doggyv5.json");
const DOGGY_V6_LIST = require("./data/doggyv6.json");

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "minhhocgioi"];

const DOGGY_SERVERS = {
  doggyv1: { host: "https://doggyv1.netlify.app", max: 72 },
  doggyv2: { host: "https://doggyv2.netlify.app", max: 49 },
  doggyv3: { host: "https://doggyv3.netlify.app", max: 107 },
  doggyv4: { host: "https://doggyv4.netlify.app", max: 162 },
  doggyv5: { list: DOGGY_V5_LIST, max: DOGGY_V5_LIST.length },
  doggyv6: { list: DOGGY_V6_LIST, max: DOGGY_V6_LIST.length }
};

const RECENT_HISTORY = {
  doggyv1: [], doggyv2: [], doggyv3: [], doggyv4: [], doggyv5: [], doggyv6: [],
  hentai2d: [], hentai3d: [], hentai3dvanguoi: []
};

function getDoggyVideo(category, requestedId) {
  const config = DOGGY_SERVERS[category];
  if (!config) return null;

  // Xử lý V5 & V6 (có metadata Tên + Thumbnail)
  if (category === "doggyv5" || category === "doggyv6") {
    if (requestedId) {
      let idNum = parseInt(requestedId, 10);
      if (isNaN(idNum) || idNum < 1) idNum = 1;
      if (idNum > config.max) idNum = config.max;
      const item = config.list[idNum - 1];
      return { id: idNum, tong_so: config.max, ten_video: item.name, link_video: item.video, thumbnail: item.thumbnail };
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
    return { id: chosenIdx + 1, tong_so: config.max, ten_video: item.name, link_video: item.video, thumbnail: item.thumbnail };
  }

  // Xử lý V1 - V4
  if (requestedId) {
    let idNum = parseInt(requestedId, 10);
    if (isNaN(idNum) || idNum < 1) idNum = 1;
    if (idNum > config.max) idNum = config.max;
    return { id: idNum, tong_so: config.max, link_video: `${config.host}/${idNum}.mp4` };
  }

  const history = RECENT_HISTORY[category];
  const allIds = Array.from({ length: config.max }, (_, i) => i + 1);
  const availableIds = allIds.filter(id => !history.includes(id));
  const chosenId = availableIds.length > 0
    ? availableIds[Math.floor(Math.random() * availableIds.length)]
    : allIds[Math.floor(Math.random() * allIds.length)];

  history.push(chosenId);
  if (history.length > Math.min(20, Math.floor(config.max / 2))) history.shift();

  return { id: chosenId, tong_so: config.max, link_video: `${config.host}/${chosenId}.mp4` };
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

  // 2. Sub-endpoint ảnh (/video/anh)
  if (pathname.includes("/anh")) {
    try {
      const data = await proxyImageAnime(searchParams);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message || "Lỗi kết nối máy chủ ảnh." });
    }
  }

  // 3. Xử lý Server Doggy V1 - V6
  let category = searchParams.get("type") || searchParams.get("category") || "";
  for (const doggyType of Object.keys(DOGGY_SERVERS)) {
    if (pathname.includes(`/${doggyType}`)) {
      category = doggyType;
      break;
    }
  }

  if (category && DOGGY_SERVERS[category]) {
    const isRaw = searchParams.get("raw") === "true";
    const requestedId = searchParams.get("id") || searchParams.get("stt");
    const videoObj = getDoggyVideo(category, requestedId);

    if (isRaw) return res.redirect(videoObj.link_video);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      server: category.toUpperCase(),
      che_do: requestedId ? "Theo thứ tự ID" : "Random không trùng lặp",
      ...videoObj
    });
  }

  // 4. Xử lý Hentai Streaming
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
      co_che: "Random Dynamic (Khử trùng lặp)",
      link_video: videoUrl
    });
  }

  // 5. Bảng tài liệu tổng hợp chuẩn thứ tự từ V1 đến V6
  return res.status(200).json({
    trang_thai: "da_xac_thuc",
    chuyen_muc: "Hệ Thống Video Streaming & Album Ảnh Độc Quyền (/video)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    danh_sach_server_video: {
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
        so_luong: `${DOGGY_SERVERS.doggyv5.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv5&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv5&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv5&raw=true&key=${key}`
      },
      doggy_v6: {
        ten: "Doggy Server V6 (Kèm Thumbnail & Tên Video)",
        so_luong: `${DOGGY_SERVERS.doggyv6.max} video`,
        cu_phap_random: `${baseUrl}/video?type=doggyv6&key=${key}`,
        cu_phap_theo_id: `${baseUrl}/video?type=doggyv6&id=1&key=${key}`,
        xem_truc_tiep: `${baseUrl}/video?type=doggyv6&raw=true&key=${key}`
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