const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Hàm tra cứu có tích hợp Proxy Relay để bypass việc Garena chặn IP Vercel
async function fetchFreeFireProfile(uid) {
  const targetUid = String(uid).trim();

  // 1. Thử gọi trực tiếp qua cổng Garena
  try {
    const directRes = await fetch("https://shop.garena.my/api/auth/player_id_login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://shop.garena.my",
        "Referer": "https://shop.garena.my/app/100067/idlogin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify({ app_id: 100067, login_id: targetUid }),
      signal: AbortSignal.timeout(4000)
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data.nickname || data.player_name) {
        return {
          Region: data.region || "VN",
          Nickname: data.nickname || data.player_name,
          Uid: targetUid,
          Author: "ZheeDevTool"
        };
      }
    }
  } catch (e) {}

  // 2. Thử qua các Open API Proxy Relays (Bypass IP Block của Serverless)
  const proxyEndpoints = [
    `https://api-allorigins.win/raw?url=${encodeURIComponent(`https://shop.garena.my/api/auth/player_id_login`)}`,
    `https://ff-api-gamma.vercel.app/api/player?uid=${targetUid}`,
    `https://free-fire-api.deno.dev/uid/${targetUid}`,
    `https://player-info-ff.vercel.app/api?uid=${targetUid}`
  ];

  for (const ep of proxyEndpoints) {
    try {
      let res;
      if (ep.includes("api-allorigins")) {
        res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: 100067, login_id: targetUid }),
          signal: AbortSignal.timeout(5000)
        });
      } else {
        res = await fetch(ep, {
          headers: { "User-Agent": "ZheeDevTool/1.0" },
          signal: AbortSignal.timeout(5000)
        });
      }

      if (res && res.ok) {
        const json = await res.json();
        const nickname = json.Nickname || json.nickname || json.name || json.player_name;
        if (nickname) {
          return {
            Region: json.Region || json.region || "VN",
            Nickname: nickname,
            Uid: targetUid,
            Author: "ZheeDevTool"
          };
        }
      }
    } catch (err) {}
  }

  return null;
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Xử lý WHATWG URL để triệt tiêu cảnh báo DEP0169
  const requestUrl = new URL(req.url, baseUrl);
  const pathname = requestUrl.pathname.toLowerCase();
  const searchParams = requestUrl.searchParams;

  // Lấy tham số dạng shortcut: ?=86744126
  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value) { firstParam = key.replace(/^=/, "").trim(); break; }
  }

  // 1. Tài liệu chuyên mục /tools
  if (!firstParam && !searchParams.get("uid") && (pathname === "/tools" || pathname === "/api/tools")) {
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

  // 2. Tra cứu UID
  let uid = searchParams.get("uid") || searchParams.get("id") || "";
  let key = searchParams.get("key") || "";

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

  const result = await fetchFreeFireProfile(uid);

  if (!result) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy thông tin cho UID: ${uid}`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    loai: "freefire_player_lookup",
    xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
    Region: result.Region,
    Nickname: result.Nickname,
    Uid: result.Uid,
    Author: result.Author
  });
};