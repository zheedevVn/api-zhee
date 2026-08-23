const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Gateway danh sách các API Free Fire chuẩn hoạt động 100%
async function getFreeFireProfile(uid) {
  const targetUid = String(uid).trim();

  const gateways = [
    async () => {
      const res = await fetch(`https://free-fire-apis.vercel.app/api/player?uid=${targetUid}`, {
        headers: { "User-Agent": "ZheeDevTool/1.0" },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error("GW1");
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://player-info-free-fire.vercel.app/api/info?uid=${targetUid}`, {
        headers: { "User-Agent": "ZheeDevTool/1.0" },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error("GW2");
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://ff-community-api.vercel.app/api/uid?id=${targetUid}`, {
        headers: { "User-Agent": "ZheeDevTool/1.0" },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error("GW3");
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://api-ff-player.vercel.app/uid/${targetUid}`, {
        headers: { "User-Agent": "ZheeDevTool/1.0" },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error("GW4");
      return await res.json();
    }
  ];

  for (const gw of gateways) {
    try {
      const data = await gw();
      const nickname = data.Nickname || data.nickname || data.name || data.player_name || data.PlayerName;
      if (nickname) {
        return {
          Region: data.Region || data.region || "VN",
          Nickname: nickname,
          Uid: targetUid,
          Author: "ZheeDevTool"
        };
      }
    } catch (e) {}
  }

  throw new Error(`Không thể tra cứu thông tin cho UID: ${targetUid}`);
}

module.exports = async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const fullUrl = req.url || "";
    const pathname = fullUrl.split("?")[0].toLowerCase();
    const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
    const firstParam = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

    // Trang hướng dẫn
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
            mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Region, UID) qua UID.",
            cu_phap: [
              `${baseUrl}/tools/freefire?={uid_game}`,
              `${baseUrl}/tools/freefire?uid={uid_game}&key={api_key}`
            ],
            vi_du: [
              `${baseUrl}/tools/freefire?=86744126`,
              `${baseUrl}/tools/freefire?uid=86744126&key=zhee_vip`
            ]
          }
        }
      });
    }

    let uid = req.query?.uid || req.query?.id || "";
    let key = req.query?.key || "";

    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) key = parts[1].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập UID Free Fire hợp lệ (chỉ gồm các chữ số)."
      });
    }

    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({
        trang_thai: "that_bai",
        thong_bao: "API Key không hợp lệ."
      });
    }

    const data = await getFreeFireProfile(uid);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: data.Region,
      Nickname: data.Nickname,
      Uid: data.Uid,
      Author: data.Author
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý serverless"
    });
  }
};