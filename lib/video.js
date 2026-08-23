const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "minhhocgioi"];

// Cache bộ nhớ động chống trùng lặp khi random
const VIDEO_CACHE = {
  hentai2d: { pool: new Set(), history: [] },
  hentai3d: { pool: new Set(), history: [] },
  hentai3dvanguoi: { pool: new Set(), history: [] }
};

// Hàm lấy video ngẫu nhiên không trùng lặp
async function getRandomUniqueVideo(category) {
  const store = VIDEO_CACHE[category];
  let candidateUrl = "";
  let attempts = 0;

  while (attempts < 10) {
    attempts++;
    try {
      const res = await fetch(`https://api-random-video.netlify.app/api/${category}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          candidateUrl = json.url || json.link || json.video || json.data || "";
        } catch {
          candidateUrl = text.trim();
        }

        if (candidateUrl && /^https?:\/\//i.test(candidateUrl)) {
          // Lưu vào pool
          store.pool.add(candidateUrl);

          // Nếu chưa nằm trong lịch sử 30 video gần nhất -> Nhận link
          if (!store.history.includes(candidateUrl)) {
            store.history.push(candidateUrl);
            if (store.history.length > 30) store.history.shift();
            return candidateUrl;
          }
        }
      }
    } catch (e) {
      break;
    }
  }

  // Fallback nếu máy chủ nguồn trả về link cũ: lấy link từ pool khác với video vừa phát
  const poolArray = Array.from(store.pool);
  if (poolArray.length > 0) {
    const freshList = poolArray.filter(v => !store.history.slice(-5).includes(v));
    const finalChoice = freshList.length > 0 
      ? freshList[Math.floor(Math.random() * freshList.length)] 
      : poolArray[Math.floor(Math.random() * poolArray.length)];
    
    store.history.push(finalChoice);
    if (store.history.length > 30) store.history.shift();
    return finalChoice;
  }

  return candidateUrl;
}

// Hàm kết nối API Album Ảnh Anime/210
async function proxyImageAnime(searchParams) {
  const queryS = searchParams.get("s");
  const queryUrl = searchParams.get("url");
  const page = searchParams.get("page") || "1";

  let targetEndpoint = "";
  if (queryUrl) {
    targetEndpoint = `https://api-anh-210.netlify.app/anh?url=${encodeURIComponent(queryUrl)}`;
  } else if (queryS) {
    targetEndpoint = `https://api-anh-210.netlify.app/anh?s=${encodeURIComponent(queryS)}&page=${page}`;
  } else {
    targetEndpoint = `https://api-anh-210.netlify.app/anh`;
  }

  const res = await fetch(targetEndpoint, {
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`Máy chủ nguồn ảnh phản hồi mã lỗi HTTP: ${res.status}`);
  }

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

  // =============================================================
  // KIỂM TRA BẢO MẬT API KEY
  // =============================================================
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

  // =============================================================
  // SUB-ENDPOINT: BỘ SƯU TẬP ẢNH & TÌM KIẾM ANIME (/video/anh)
  // =============================================================
  if (pathname.includes("/anh")) {
    try {
      const data = await proxyImageAnime(searchParams);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        trang_thai: "that_bai",
        thong_bao: error.message || "Lỗi kết nối máy chủ ảnh."
      });
    }
  }

  // =============================================================
  // VIDEO STREAMING: RANDOM VIDEO KHÔNG TRÙNG LẶP
  // =============================================================
  const category = searchParams.get("type") || searchParams.get("category");

  if (category && ["hentai2d", "hentai3d", "hentai3dvanguoi"].includes(category)) {
    const isRaw = searchParams.get("raw") === "true";
    const videoUrl = await getRandomUniqueVideo(category);

    if (!videoUrl) {
      return res.status(502).json({
        trang_thai: "that_bai",
        thong_bao: "Không thể lấy luồng video từ máy chủ gốc."
      });
    }

    if (isRaw) return res.redirect(videoUrl);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      the_loai: category,
      co_che: "Random Dynamic (Khử trùng lặp)",
      link_video: videoUrl
    });
  }

  // =============================================================
  // TÀI LIỆU HƯỚNG DẪN KHI ĐÃ MỞ KHÓA BẰNG KEY
  // =============================================================
  return res.status(200).json({
    trang_thai: "da_xac_thuc",
    chuyen_muc: "Hệ Thống Đa Phương Tiện & Video Streaming (/video)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    danh_sach_tien_ich: {
      video_streaming_random: {
        mo_ta: "Phát video ngẫu nhiên không trùng lặp theo từng thể loại",
        the_loai_ho_tro: ["hentai2d", "hentai3d", "hentai3dvanguoi"],
        cu_phap_json: `${baseUrl}/video?type={the_loai}&key=${key}`,
        cu_phap_xem_ngay: `${baseUrl}/video?type={the_loai}&raw=true&key=${key}`,
        vi_du: `${baseUrl}/video?type=hentai2d&raw=true&key=${key}`
      },
      tim_kiem_anh_anime: {
        mo_ta: "Tìm kiếm bài viết hoặc album ảnh theo từ khóa",
        cu_phap: `${baseUrl}/video/anh?s={tu_khoa}&page=1&key=${key}`,
        vi_du: `${baseUrl}/video/anh?s=anime&page=1&key=${key}`
      },
      boc_tach_anh_album: {
        mo_ta: "Lấy toàn bộ ảnh trong bài viết chi tiết từ URL",
        cu_phap: `${baseUrl}/video/anh?url={link_bai_viet}&key=${key}`,
        vi_du: `${baseUrl}/video/anh?url=https://topanhanime.com/anh-anime-nam-chibi/&key=${key}`
      }
    }
  });
};