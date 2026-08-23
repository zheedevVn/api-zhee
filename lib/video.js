const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Bộ nhớ đệm tĩnh lưu trữ danh sách link video cố định (khử trùng lặp)
const STATIC_VIDEO_STORE = {
  "hentai2d": new Set(),
  "hentai3d": new Set(),
  "hentai3dvanguoi": new Set()
};

// Hàm quét và thu thập link từ nguồn, bỏ qua các link trùng
async function harvestFixedVideos(category, targetCount = 228) {
  const currentSet = STATIC_VIDEO_STORE[category];
  let attempts = 0;
  const maxAttempts = 30; // Giới hạn số lần fetch gom link

  while (currentSet.size < targetCount && attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(`https://api-random-video.netlify.app/api/${category}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const text = await res.text();
        let videoUrl = "";

        // Trích xuất link video từ phản hồi (hỗ trợ JSON hoặc Text URL)
        try {
          const json = JSON.parse(text);
          videoUrl = json.url || json.link || json.video || json.data || "";
        } catch {
          videoUrl = text.trim();
        }

        if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
          currentSet.add(videoUrl);
        }
      }
    } catch (e) {
      break;
    }
  }

  return Array.from(currentSet);
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

  // Lấy key từ query param (?key=... hoặc ?=key)
  let key = searchParams.get("key") || "";
  if (!key) {
    for (const [k, v] of searchParams.entries()) {
      if (!k && v) { key = v.trim(); break; }
      if (k && !v && !k.startsWith("/")) { key = k.replace(/^=/, "").trim(); break; }
    }
  }

  // =============================================================
  // BẢO VỆ VÙNG RIÊNG TƯ: YÊU CẦU KEY CHÍNH XÁC
  // =============================================================
  if (!key || !VALID_KEYS.includes(key)) {
    return res.status(403).json({
      trang_thai: "that_bai",
      ma_loi: 403,
      thong_bao: "Khu vực giới hạn riêng tư. Vui lòng cung cấp API Key hợp lệ để mở khóa hệ thống.",
      cu_phap_yeu_cau: `${baseUrl}/video?key={api_key}`
    });
  }

  // 1. Khi nhập đúng Key tại route gốc /video -> Mở khóa toàn bộ hướng dẫn
  if (pathname === "/video" || pathname === "/video/" || pathname === "/api/video") {
    const category = searchParams.get("type") || searchParams.get("category");

    // Nếu có truyền thể loại -> Trả về danh sách link cố định đã khử trùng lặp
    if (category && ["hentai2d", "hentai3d", "hentai3dvanguoi"].includes(category)) {
      const isRandom = searchParams.get("random") === "true";
      const isRaw = searchParams.get("raw") === "true";
      
      const videoList = await harvestFixedVideos(category);

      if (videoList.length === 0) {
        return res.status(502).json({
          trang_thai: "that_bai",
          thong_bao: "Không thể kết nối đến máy chủ nguồn video."
        });
      }

      if (isRandom) {
        const randomItem = videoList[Math.floor(Math.random() * videoList.length)];
        if (isRaw) return res.redirect(randomItem);
        return res.status(200).json({
          trang_thai: "thanh_cong",
          the_loai: category,
          link_video: randomItem
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        the_loai: category,
        tong_so_video_co_dinh: videoList.length,
        danh_sach_video: videoList
      });
    }

    // Bảng hướng dẫn khi đã xác thực Key thành công
    return res.status(200).json({
      trang_thai: "da_xac_thuc",
      chuyen_muc: "Hệ Thống Video Streaming Độc Quyền (/video)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cac_the_loai_ho_tro: ["hentai2d", "hentai3d", "hentai3dvanguoi"],
      huong_dan_su_dung: {
        lay_danh_sach_co_dinh: {
          mo_ta: "Tự động thu thập và lưu trữ danh sách link video cố định không trùng lặp",
          cu_phap: `${baseUrl}/video?type={the_loai}&key=${key}`,
          vi_du: `${baseUrl}/video?type=hentai2d&key=${key}`
        },
        lay_1_video_ngau_nhien: {
          mo_ta: "Trích xuất 1 video ngẫu nhiên từ kho lưu trữ cố định",
          cu_phap: `${baseUrl}/video?type={the_loai}&random=true&key=${key}`
        },
        chuyen_huong_xem_ngay: {
          mo_ta: "Chuyển hướng trực tiếp đến trình phát video (MP4/Stream)",
          cu_phap: `${baseUrl}/video?type={the_loai}&random=true&raw=true&key=${key}`
        }
      }
    });
  }

  return res.status(404).json({
    trang_thai: "that_bai",
    thong_bao: "Đường dẫn không tồn tại."
  });
};