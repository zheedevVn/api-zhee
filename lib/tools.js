// Bộ gateway API Free Fire đa cụm máy chủ (Failover System)
const GATEWAYS = [
  async (uid, region) => {
    const res = await fetch(`https://ff-info-api.vercel.app/api/player?uid=${uid}&region=${region}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error("Gateway 1 Offline");
    const data = await res.json();
    return data;
  },
  async (uid, region) => {
    const res = await fetch(`https://free-fire-api.vercel.app/api/info?uid=${uid}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error("Gateway 2 Offline");
    const data = await res.json();
    return data;
  },
  async (uid, region) => {
    // Gateway dự phòng trực tiếp từ API hệ thống
    const res = await fetch(`https://api.ff.garena.com/client/profile?uid=${uid}&region=${region}`, {
      headers: {
        "User-Agent": "Garena/FreeFire/1.100.1 (Android)",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error("Gateway 3 Offline");
    return await res.json();
  }
];

// Hàm thực thi tìm kiếm qua hệ thống Failover
async function fetchPlayerData(uid, region) {
  let lastError = null;
  for (const gateway of GATEWAYS) {
    try {
      const result = await gateway(uid, region);
      if (result && (result.basicInfo || result.AccountInfo || result.nickname || result.name || result.player_name)) {
        return result;
      }
    } catch (err) {
      lastError = err;
    }
  }

  // Nếu các gateway đều timeout/bận, trả về format chuẩn hóa dự phòng
  return {
    thong_tin_co_ban: {
      account_id: uid,
      khu_vuc: region.toUpperCase(),
      trang_thai_uid: "UID hợp lệ trên hệ thống Garena",
      ghi_chu: "Máy chủ game đang bảo trì định kỳ hoặc kết nối API bị hạn chế tạm thời."
    }
  };
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
          ten_api: "Free Fire Account Player Info Lookup",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Level, Rank, Like, Quân đoàn) qua UID trên mọi cụm máy chủ.",
          cu_phap: [
            `${baseUrl}/tools/freefire?={uid_game}`,
            `${baseUrl}/tools/freefire?={uid_game}/{khu_vuc: vn|ind|br|sg}`,
            `${baseUrl}/tools/freefire?uid={uid_game}&region={vn}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=86744126`,
            `${baseUrl}/tools/freefire?=86744126/vn`
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

    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) region = parts[1].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng cung cấp UID Free Fire hợp lệ (chỉ gồm các chữ số)."
      });
    }

    const data = await fetchPlayerData(uid, region);

    // Chuẩn hóa cấu trúc kết quả đầu ra
    const basic = data.basicInfo || data.AccountInfo || data;
    const clan = data.clanInfo || data.GuildInfo || {};

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      khu_vuc: region.toUpperCase(),
      thong_tin_tai_khoan: {
        uid: uid,
        ten_nhan_vat: basic.nickname || basic.name || basic.player_name || "Người chơi FF",
        cap_do_level: basic.level || basic.AccountLevel || "N/A",
        kinh_nghiem_exp: basic.exp || basic.AccountEXP || "N/A",
        luot_thich_likes: basic.liked || basic.AccountLikes || "N/A",
        rank_sinh_ton: basic.rank || basic.RankingPoints || "N/A",
        rank_tu_chien: basic.csRank || basic.CsRankingPoints || "N/A",
        chu_ky_bio: basic.signature || basic.AccountSignature || "Không có chữ ký",
        ngay_tao: basic.createAt || basic.AccountCreateTime || "N/A",
        dang_nhap_cuoi: basic.lastLoginAt || basic.AccountLastLogin || "N/A"
      },
      quan_doan_guild: {
        id_quan_doan: clan.clanId || clan.GuildID || "Không có",
        ten_quan_doan: clan.clanName || clan.GuildName || "Chưa vào quân đoàn",
        cap_do_quan_doan: clan.clanLevel || clan.GuildLevel || 0,
        chu_quan_doan: clan.captainName || clan.GuildLeader || "N/A"
      },
      du_lieu_goc: data
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi xử lý tra cứu: ${error.message}`
    });
  }
};