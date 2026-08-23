// Danh sách KEY do bạn tự quản lý và tạo
const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Gateway danh sách các cụm máy chủ khu vực của Free Fire
const FF_SERVERS = {
  VN: "https://ff-api-server.vercel.app/api/player",
  IND: "https://freefireapi.com.br/api/search_id",
  BR: "https://freefireapi.com.br/api/search_id",
  SG: "https://ff-api-server.vercel.app/api/player"
};

// Hàm tra cứu player theo cơ chế siambhau/FreeFireApi
async function fetchFreeFireProfile(uid, region = "VN") {
  const reg = region.toUpperCase();
  
  // Endpoint direct API proxy đa khu vực
  const endpoints = [
    `https://free-fire-api-six.vercel.app/api/player?uid=${uid}&region=${reg}`,
    `https://ff-info-service.onrender.com/api/v1/player?uid=${uid}&region=${reg}`,
    `https://player-info-ff.vercel.app/api?uid=${uid}`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "FreeFire/2026 (Android; Mobile; High-Speed-API)",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && (data.basicInfo || data.AccountInfo || data.nickname || data.name || data.player_name || data.PlayerNickname)) {
          return data;
        }
      }
    } catch (e) {}
  }

  // Gateway dự phòng chính xác qua Open Garena Gateway
  const backupRes = await fetch(`https://api.gametools.club/freefire/player/${uid}?region=${reg}`, {
    headers: { "User-Agent": "Zhee-FF-Bot/1.0" },
    signal: AbortSignal.timeout(5000)
  }).catch(() => null);

  if (backupRes && backupRes.ok) {
    return await backupRes.json();
  }

  throw new Error(`Không thể lấy dữ liệu UID: ${uid} (Máy chủ khu vực ${reg} đang bận hoặc UID không tồn tại)`);
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const pathname = fullUrl.split("?")[0].toLowerCase();
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  const firstParam = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /tools
  // -------------------------------------------------------------
  if (!firstParam || (!fullUrl.includes("?") && (pathname === "/tools" || pathname === "/api/tools"))) {
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Game Utilities (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Free Fire Full Player Profile Lookup (siambhau Style)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu đầy đủ thông tin tài khoản Free Fire (Tên nhân vật, Cấp độ, Điểm Rank Tử Chiến / Sinh Tồn, Lượt Like, Chữ ký, Quân Đoàn, Avatar) theo UID và Vùng.",
          cu_phap: [
            `${baseUrl}/tools/freefire?uid={uid}&region={vn|ind|br}&key={api_key}`,
            `${baseUrl}/tools/freefire?={uid}/{region}`,
            `${baseUrl}/tools/freefire?={uid}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=86744126/vn`,
            `${baseUrl}/tools/freefire?uid=86744126&region=VN&key=zhee_vip`
          ]
        }
      }
    });
  }

  // =============================================================
  // XỬ LÝ TRA CỨU FREE FIRE
  // =============================================================
  try {
    let uid = req.query.uid || req.query.id || "";
    let region = req.query.region || "VN";
    let key = req.query.key || "";

    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) region = parts[1].trim();
      if (parts[2]) key = parts[2].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập UID Free Fire hợp lệ (chỉ bao gồm chữ số)."
      });
    }

    // Kiểm tra Key nếu người dùng có truyền lên
    const isValidKey = key ? VALID_KEYS.includes(key) : true;
    if (key && !isValidKey) {
      return res.status(403).json({
        trang_thai: "that_bai",
        thong_bao: "API Key không hợp lệ. Bạn có thể tự định nghĩa thêm Key trong mã nguồn."
      });
    }

    const rawData = await fetchFreeFireProfile(uid, region);

    // Chuẩn hóa bóc tách các trường dữ liệu theo format chuẩn của siambhau
    const basic = rawData.basicInfo || rawData.AccountInfo || rawData.basic || rawData;
    const clan = rawData.clanInfo || rawData.GuildInfo || rawData.clan || {};
    const social = rawData.socialInfo || rawData.social || {};

    const formattedData = {
      trang_thai: "thanh_cong",
      loai: "freefire_player_profile",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      khu_vuc_may_chu: region.toUpperCase(),
      thong_tin_nhan_vat: {
        uid: uid,
        ten_nhan_vat: basic.nickname || basic.name || basic.player_name || basic.PlayerNickname || "Unknown",
        cap_do_level: basic.level || basic.AccountLevel || basic.AccountLevelVal || 1,
        diem_kinh_nghiem_exp: basic.exp || basic.AccountEXP || 0,
        luot_thich_likes: basic.liked || basic.AccountLikes || basic.likes || 0,
        rank_sinh_ton_br: basic.rank || basic.RankingPoints || basic.BrRank || "N/A",
        rank_tu_chien_cs: basic.csRank || basic.CsRankingPoints || basic.CsRank || "N/A",
        chu_ky_bio: social.signature || basic.signature || basic.AccountSignature || "Không có chữ ký",
        thoi_gian_tao_acc: basic.createAt ? new Date(basic.createAt * 1000).toLocaleString("vi-VN") : "N/A",
        dang_nhap_cuoi: basic.lastLoginAt ? new Date(basic.lastLoginAt * 1000).toLocaleString("vi-VN") : "Gần đây"
      },
      quan_doan_guild: {
        id_quan_doan: clan.clanId || clan.GuildID || null,
        ten_quan_doan: clan.clanName || clan.GuildName || "Chưa tham gia quân đoàn",
        cap_do: clan.clanLevel || clan.GuildLevel || 0,
        so_thanh_vien: clan.memberNum || clan.GuildMemberNum || 0,
        chu_quan_doan: clan.captainName || clan.GuildLeader || "N/A"
      },
      du_lieu_raw_json: rawData
    };

    return res.status(200).json(formattedData);

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};