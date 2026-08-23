const fs = require("fs");
const path = require("path");

const DB_PATH = path.join("/tmp", "video_store_db.json");
const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "minhhocgioi"];
const TARGET_COUNT = 228;

// Đọc kho dữ liệu từ bộ nhớ server
function readStore() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch (e) {}
  return {
    hentai2d: [],
    hentai3d: [],
    hentai3dvanguoi: []
  };
}

// Ghi dữ liệu vào bộ nhớ server
function saveStore(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

// Thu thập link khử trùng lặp và ghi đè vào file trên server
async function collectUniqueVideos(category) {
  const store = readStore();
  let list = Array.isArray(store[category]) ? store[category] : [];
  const uniqueSet = new Set(list);

  let loopLimit = 0;
  while (uniqueSet.size < TARGET_COUNT && loopLimit < 40) {
    loopLimit++;
    try {
      const res = await fetch(`https://api-random-video.netlify.app/api/${category}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const text = await res.text();
        let videoUrl = "";
        try {
          const json = JSON.parse(text);
          videoUrl = json.url || json.link || json.video || json.data || "";
        } catch {
          videoUrl = text.trim();
        }

        if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
          uniqueSet.add(videoUrl);
        }
      }
    } catch (e) {
      break;
    }
  }

  store[category] = Array.from(uniqueSet);
  saveStore(store);
  return store[category];
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
  // KIỂM TRA VÀ BÁO LỖI API KEY
  // =============================================================
  // Trường hợp 1: Không truyền key
  if (!key && !hasKeyParam) {
    return res.status(401).json({
      trang_thai: "that_bai",
      ma_loi: 401,
      thong_bao: "Vui lòng cung cấp API Key để truy cập khu vực này.",
      cu_phap_yeu_cau: `${baseUrl}/video?key={api_key}`
    });
  }

  // Trường hợp 2: Có truyền key nhưng sai key
  if (!VALID_KEYS.includes(key)) {
    return res.status(403).json({
      trang_thai: "that_bai",
      ma_loi: 403,
      thong_bao: "API Key không hợp lệ hoặc đã hết hạn truy cập.",
      key_da_nhap: key
    });
  }

  // =============================================================
  // KHI ĐÃ NHẬP ĐÚNG KEY
  // =============================================================
  const category = searchParams.get("type") || searchParams.get("category");

  if (category && ["hentai2d", "hentai3d", "hentai3dvanguoi"].includes(category)) {
    const isRandom = searchParams.get("random") === "true";
    const isRaw = searchParams.get("raw") === "true";

    const videos = await collectUniqueVideos(category);

    if (videos.length === 0) {
      return res.status(502).json({
        trang_thai: "that_bai",
        thong_bao: "Không thể kết nối lấy link từ máy chủ gốc."
      });
    }

    if (isRandom) {
      const randomUrl = videos[Math.floor(Math.random() * videos.length)];
      if (isRaw) return res.redirect(randomUrl);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        the_loai: category,
        link_video: randomUrl
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      the_loai: category,
      tong_so_video_da_luu: videos.length,
      gioi_han_toi_da: TARGET_COUNT,
      danh_sach_video: videos
    });
  }

  return res.status(200).json({
    trang_thai: "da_xac_thuc",
    chuyen_muc: "Hệ Thống Video Streaming Độc Quyền Lưu Trữ Server (/video)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    cac_the_loai_ho_tro: ["hentai2d", "hentai3d", "hentai3dvanguoi"],
    huong_dan_su_dung: {
      lay_danh_sach_video_da_luu: {
        mo_ta: "Tự động thu thập đủ 228 link video không trùng lặp và lưu vào server",
        cu_phap: `${baseUrl}/video?type={the_loai}&key=${key}`,
        vi_du: `${baseUrl}/video?type=hentai2d&key=${key}`
      },
      lay_1_video_ngau_nhien: {
        mo_ta: "Lấy 1 video ngẫu nhiên từ 228 link đã lưu trong server",
        cu_phap: `${baseUrl}/video?type={the_loai}&random=true&key=${key}`
      },
      xem_truc_tiep_ngay: {
        mo_ta: "Chuyển hướng trực tiếp vào trình phát video",
        cu_phap: `${baseUrl}/video?type={the_loai}&random=true&raw=true&key=${key}`
      }
    }
  });
};