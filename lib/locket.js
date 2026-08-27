function extractFirstParam(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function normalizeUsername(input) {
  if (!input) return "";

  let raw = String(input).trim();
  try {
    raw = decodeURIComponent(raw);
  } catch (_) {}

  const camMatch = raw.match(/locket\.cam\/([a-zA-Z0-9._]+)/i);
  if (camMatch && camMatch[1]) {
    raw = camMatch[1];
  }

  return raw.replace(/^@+/, "").replace(/\/+$/, "").trim().toLowerCase();
}

function extractInviteUid(html) {
  const decoded = html.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  const encodedMatch = decoded.match(/locket\.camera(?:%2F|\/)invites(?:%2F|\/)([A-Za-z0-9]+)/i);
  const plainMatch = decoded.match(/locket\.camera\/invites\/([A-Za-z0-9]+)/i);
  const fullId = (encodedMatch && encodedMatch[1]) || (plainMatch && plainMatch[1]) || "";
  if (!fullId) return { uid: "", inviteId: "" };
  return {
    uid: fullId.slice(0, 28),
    inviteId: fullId
  };
}

function extractAvatar(html) {
  const imgMatch = html.match(/class=["']?profile-pic-img["']?[^>]*src=["']?([^"'\s>]+)/i)
    || html.match(/src=["']?([^"'\s>]*locket-img[^"'\s>]*)["']?[^>]*class=["']?profile-pic-img/i);
  if (!imgMatch || !imgMatch[1]) return "";
  return imgMatch[1].replace("firebasestorage.googleapis.com:443", "firebasestorage.googleapis.com").trim();
}

function extractInitials(html) {
  const match = html.match(/class=["']?profile-pic-initials["']?[^>]*>([^<]+)</i);
  return match && match[1] ? match[1].trim() : "";
}

function isCelebrityProfile(html) {
  const body = html.split(/<body[^>]*>/i)[1] || "";
  return /class=["'][^"']*celebrity-container/i.test(body);
}

async function lookupLocketUsername(username) {
  const profileUrl = `https://locket.cam/${encodeURIComponent(username)}`;
  const res = await fetch(profileUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });

  const html = await res.text();
  const isNotFound = res.status === 404 || /Page Not Found/i.test(html) || /<title>\s*Page Not Found\s*<\/title>/i.test(html);
  const { uid, inviteId } = extractInviteUid(html);

  if (isNotFound || !uid) {
    return {
      ton_tai: false,
      username,
      link_profile: profileUrl
    };
  }

  const avatar = extractAvatar(html);
  const initials = extractInitials(html);

  return {
    ton_tai: true,
    username,
    uid,
    ma_moi: inviteId,
    chu_cai_viet_tat: initials || null,
    anh_dai_dien: avatar || null,
    tai_khoan_noi_tieng: isCelebrityProfile(html),
    link_profile: profileUrl,
    link_moi_ban_be: `https://locket.camera/invites/${inviteId}`,
    link_dong_bo: `https://locket.cam/${username}`
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;
  const firstParam = extractFirstParam(searchParams);

  const rawInput =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("q") ||
    firstParam;

  const username = normalizeUsername(rawInput);

  if (!username) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Tra Cứu Username Locket Widget (Locket Camera)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      mo_ta: "Kiểm tra username Locket còn trống hay đã được đăng ký. Nếu đã tồn tại sẽ trả về UID, avatar công khai và link mời bạn bè.",
      cu_phap: [
        `${baseUrl}/api/tools/locket?={username}`,
        `${baseUrl}/api/tools/locket?username={username}`,
        `${baseUrl}/api/tools/locket?user={username}`
      ],
      vi_du: [
        `${baseUrl}/api/tools/locket?=minh`,
        `${baseUrl}/api/tools/locket?username=alex`,
        `${baseUrl}/api/tools/locket?user=https://locket.cam/minh`
      ]
    });
  }

  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Username Locket không hợp lệ. Chỉ dùng chữ thường, số, dấu chấm hoặc gạch dưới (tối đa 30 ký tự).",
      username
    });
  }

  try {
    const data = await lookupLocketUsername(username);

    if (!data.ton_tai) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "Locket Username Lookup",
        du_lieu: {
          username: data.username,
          co_ton_tai: false,
          tinh_trang: "CÒN TRỐNG — Username chưa được đăng ký trên Locket.",
          link_profile: data.link_profile,
          may_chu_kiem_tra: "Locket.cam Public Profile Gateway",
          tac_gia: "Hồ Đức Minh (Zhee Dev)"
        }
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Locket Username Lookup",
      du_lieu: {
        username: data.username,
        uid: data.uid,
        ma_moi: data.ma_moi,
        co_ton_tai: true,
        tinh_trang: "ĐÃ ĐĂNG KÝ — Username đang được sử dụng.",
        chu_cai_viet_tat: data.chu_cai_viet_tat,
        anh_dai_dien: data.anh_dai_dien,
        tai_khoan_noi_tieng: data.tai_khoan_noi_tieng ? "CÓ" : "KHÔNG",
        link_profile: data.link_profile,
        link_moi_ban_be: data.link_moi_ban_be,
        may_chu_kiem_tra: "Locket.cam Public Profile Gateway",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Không thể kết nối tới máy chủ Locket. Vui lòng thử lại sau.",
      chi_tiet: error.message
    });
  }
};
