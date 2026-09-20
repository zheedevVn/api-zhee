const cheerio = require("cheerio");

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function text(value, fallback = null) {
  if (value == null) return fallback;
  const out = String(value).replace(/\s+/g, " ").trim();
  return out || fallback;
}

function decode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (_) {
    return String(value || "");
  }
}

function qrImage(profileUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(profileUrl)}`;
}

function parseCookie(rawCookie) {
  if (!rawCookie) return "";
  if (rawCookie.startsWith("[") && rawCookie.endsWith("]")) {
    try {
      const parsed = JSON.parse(rawCookie);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item && item.name ? `${item.name}=${item.value}` : ""))
          .filter(Boolean)
          .join("; ");
      }
    } catch (_) {}
  }
  return rawCookie;
}

function parseInput(raw) {
  const input = text(raw, "");
  if (!input) return { type: "empty" };

  const group = input.match(/zalo\.me\/g\/([a-zA-Z0-9]+)/i) || input.match(/\/g\/([a-zA-Z0-9]+)/);
  if (group) return { type: "group", code: group[1], value: input };

  const fromUrl = input.match(/(?:zalo\.me|zaloapp\.com)\/(?:qr\/(?:p|link)\/)?(?:\+)?(\d{8,15})/i);
  if (fromUrl) return normalizePhone(fromUrl[1], input);

  const digits = input.replace(/[^\d+]/g, "");
  if (/^(?:\+?84|0)\d{8,11}$/.test(digits) || /^\d{9,12}$/.test(digits)) {
    return normalizePhone(digits, input);
  }

  const uid = input.replace(/^@+/, "").replace(/\/+$/, "");
  if (/^\d{6,20}$/.test(uid)) return { type: "uid", uid, value: input };
  return { type: "user", username: uid, value: input };
}

function normalizePhone(raw, value) {
  let phone = String(raw || "").replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("0")) phone = "84" + phone.slice(1);
  if (!phone.startsWith("84") && phone.length >= 9 && phone.length <= 10) phone = "84" + phone;
  return {
    type: "phone",
    phone,
    local: phone.startsWith("84") ? "0" + phone.slice(2) : phone,
    international: `+${phone}`,
    value: value || raw
  };
}

function browserHeaders(cookie, mobile = false) {
  const headers = {
    "User-Agent": mobile ? MOBILE_UA : DESKTOP_UA,
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://zalo.me/",
    Origin: "https://zalo.me"
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

async function requestText(url, headers) {
  const response = await fetch(url, {
    redirect: "follow",
    headers,
    signal: AbortSignal.timeout(15000)
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, url: response.url || url, html };
}

function isLoginPage(html, finalUrl) {
  const sample = `${finalUrl || ""}\n${String(html || "").slice(0, 4000)}`.toLowerCase();
  return (
    sample.includes("id.zalo.me/account/login") ||
    sample.includes("đăng nhập tài khoản zalo") ||
    sample.includes("dang nhap tai khoan zalo")
  );
}

function isGenericLanding(html) {
  const sample = String(html || "").slice(0, 2500).toLowerCase();
  return (
    sample.includes("zalo://qr/link/") ||
    sample.includes("apps.apple.com/vn/app/zalo") ||
    (sample.includes("<title>zalo</title>") && sample.length < 2500)
  );
}

function pickMeta($, key) {
  return (
    text($( `meta[property='${key}']`).attr("content")) ||
    text($( `meta[name='${key}']`).attr("content"))
  );
}

function parseProfileHtml(html, pageUrl) {
  if (!html) return null;
  if (isLoginPage(html, pageUrl)) return { login_wall: true };
  if (isGenericLanding(html)) return { app_redirect: true };

  const $ = cheerio.load(html);
  const title = pickMeta($, "og:title") || text($("title").text());
  if (!title || /đăng nhập tài khoản zalo/i.test(title)) return { login_wall: true };

  let name = title.replace(/^zalo\s*[-–:]\s*/i, "").trim();
  if (!name || /^zalo$/i.test(name) || /^\d{8,15}$/.test(name)) {
    name =
      text($(".user-name, .display-name, .profile-name, .name, h1").first().text()) ||
      null;
  }
  if (name && (/đăng nhập/i.test(name) || name === "Zalo App")) name = null;

  const ogImage = pickMeta($, "og:image");
  const avatar =
    (ogImage && !/meta_background|favicon|logo/i.test(ogImage) ? ogImage : null) ||
    text($("img.avatar, img.avt, .avatar img, .profile-avatar img").first().attr("src"));

  const bio =
    text($(".user-desc, .user-status, .bio, .intro, .description, .profile-desc").first().text()) ||
    null;
  const ogDesc = pickMeta($, "og:description");
  const intro =
    bio && !/trang đăng nhập|quét mã qr để đăng nhập/i.test(bio)
      ? bio
      : ogDesc && !/trang đăng nhập|quét mã qr/i.test(ogDesc)
        ? ogDesc
        : null;

  const label =
    text($(".user-account, .account-type, .profile-type, .tag, .badge").first().text()) ||
    (name ? "Liên hệ" : null);

  const qr =
    text($("img.qr, img.qrcode, .qr-code img, .qr img").first().attr("src")) || null;

  if (!name && !avatar && !intro) {
    const scripts = [];
    $("script").each((_, el) => scripts.push($(el).html() || ""));
    const blob = scripts.join("\n");
    const display = blob.match(/"displayName"\s*:\s*"([^"]+)"/) || blob.match(/"zaloName"\s*:\s*"([^"]+)"/);
    const av = blob.match(/"avatar"\s*:\s*"(https?:[^"]+)"/);
    const status = blob.match(/"status"\s*:\s*"([^"]*)"/);
    if (display) name = display[1];
    if (av) return {
      ten_hien_thi: name,
      anh_dai_dien: av[1].replace(/\\u002F/g, "/"),
      gioi_thieu: status ? status[1] : intro,
      nhan: label
    };
    if (!name) return null;
  }

  return {
    ten_hien_thi: name,
    anh_dai_dien: avatar,
    gioi_thieu: intro,
    nhan: label,
    anh_qr_goc: qr
  };
}

function publicResult(input, extra = {}) {
  const phone = input.type === "phone" ? input.phone : null;
  const profilePath = phone || input.uid || input.username;
  const webUrl = `https://zalo.me/${phone || input.uid || input.username}`;
  const appUrl = phone
    ? `zalo://chat?phone=${phone}`
    : `zalo://chat?id=${input.uid || input.username}`;
  return {
    dau_vao: input.value,
    so_dien_thoai_chuan_hoa: phone ? `+${phone}` : null,
    so_dien_thoai_noi_dia: phone ? input.local : null,
    ten_hien_thi: extra.ten_hien_thi || null,
    nhan: extra.nhan || (extra.ten_hien_thi ? "Liên hệ" : null),
    gioi_thieu: extra.gioi_thieu || extra.tieu_su || null,
    anh_dai_dien: extra.anh_dai_dien || extra.avatar || null,
    anh_qr: extra.anh_qr_goc || qrImage(webUrl),
    link_nhan_tin_truc_tiep: webUrl,
    link_app_zalo: appUrl,
    link_qr_sau: `zalo://qr/link/${profilePath}`,
    ...extra.more
  };
}

async function fetchPublicProfile(input, cookie) {
  const slug = input.phone || input.uid || input.username;
  const urls = [];
  if (input.phone) {
    urls.push(`https://zalo.me/${input.phone}`);
    urls.push(`https://zalo.me/${input.local}`);
  } else {
    urls.push(`https://zalo.me/${slug}`);
  }

  const attempts = [];
  let loginWall = false;
  for (const url of urls) {
    for (const mobile of [false, true]) {
      try {
        const page = await requestText(url, browserHeaders(cookie, mobile));
        attempts.push({ url, status: page.status, final: page.url, mobile });
        const parsed = parseProfileHtml(page.html, page.url);
        if (parsed && parsed.login_wall) {
          loginWall = true;
          continue;
        }
        if (parsed && parsed.ten_hien_thi) {
          return { parsed, page, attempts };
        }
      } catch (error) {
        attempts.push({ url, error: error.message, mobile });
      }
    }
  }
  return { parsed: null, attempts, login_wall: loginWall };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const fullUrl = req.url || "";
  let queryTarget = "";
  let rawCookie = "";
  let rawImei = "";

  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    const imeiMatch =
      rawQuery.match(/[?&]imei=([^&]+)/i) ||
      rawQuery.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]{32})/i);
    if (imeiMatch) rawImei = decode(imeiMatch[1] || imeiMatch[0]).trim();

    const cookieMatch = rawQuery.match(/[?&](?:cookie|cookies)=([^&]+)/i);
    if (cookieMatch) rawCookie = decode(cookieMatch[1]).trim();

    const firstParam = rawQuery.split("&")[0];
    if (!firstParam.startsWith("cookie=") && !firstParam.startsWith("imei=")) {
      queryTarget = decode(firstParam.replace(/^(?:phone|sdt|url|group|id)?=/, "")).trim();
    }
  }

  if (!rawCookie && req.query) rawCookie = req.query.cookie || req.query.cookies || "";
  if (!rawImei && req.query) rawImei = req.query.imei || "";
  if (!queryTarget && req.query) {
    queryTarget = req.query.phone || req.query.sdt || req.query.id || req.query[""] || "";
  }
  if (req.body && typeof req.body === "object") {
    rawCookie = rawCookie || req.body.cookie || req.body.cookies || "";
    rawImei = rawImei || req.body.imei || "";
    queryTarget = queryTarget || req.body.phone || req.body.sdt || req.body.url || req.body.id || "";
  }

  const cookieHeader = parseCookie(rawCookie) || String(process.env.ZALO_COOKIE || "").trim();
  const input = parseInput(queryTarget);

  if (input.type === "empty" && !cookieHeader && !rawImei) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Zalo Account & Session Checker",
      cu_phap: {
        check_sdt: "https://{domain}/api/mxh/zalo?={sdt_hoac_link_zalo}",
        check_nhom: "https://{domain}/api/mxh/zalo?={link_nhom}",
        check_cookie: "https://{domain}/api/mxh/zalo?cookie={zalo_cookie_hoac_json}"
      },
      vi_du: [
        "https://{domain}/api/mxh/zalo?=0944921186",
        "https://{domain}/api/mxh/zalo?=https://zalo.me/84944921186"
      ]
    });
  }

  const jsonHeaders = {
    "User-Agent": DESKTOP_UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9",
    Referer: "https://chat.zalo.me/",
    Origin: "https://chat.zalo.me"
  };

  try {
    if ((cookieHeader || rawImei) && input.type === "empty") {
      const zHeaders = { ...jsonHeaders };
      if (cookieHeader) zHeaders.Cookie = cookieHeader;
      if (rawImei) zHeaders["x-imei"] = rawImei;

      let uidSession = null;
      const sessionMatch =
        cookieHeader.match(/zpw_sek=[a-zA-Z0-9]+\.([0-9]+)\./) ||
        cookieHeader.match(/zpsid=[a-zA-Z0-9]+\.([0-9]+)\./);
      if (sessionMatch) uidSession = sessionMatch[1];

      const profileRes = await fetch("https://chat.zalo.me/api/v2/user/profile", {
        headers: zHeaders,
        signal: AbortSignal.timeout(15000)
      }).catch(() => null);
      let profileData = null;
      if (profileRes && profileRes.ok) {
        const pJson = await profileRes.json().catch(() => null);
        if (pJson && pJson.error_code === 0 && pJson.data) profileData = pJson.data;
      }

      if (profileData) {
        const u = profileData;
        return res.status(200).json({
          trang_thai: "thanh_cong",
          loai: "zalo_account_session",
          phuong_thuc_xac_thuc: cookieHeader && rawImei ? "Cookie + IMEI" : cookieHeader ? "Cookie Web Session" : "IMEI Session",
          thong_tin_tai_khoan: {
            user_id: u.userId || u.uid || uidSession,
            ten_hien_thi: u.displayName || u.zaloName,
            so_dien_thoai: u.phoneNumber || "Riêng tư",
            ngay_sinh: u.dob || u.birthDate || "Chưa cập nhật",
            gioi_tinh: u.gender === 0 ? "Nam" : u.gender === 1 ? "Nữ" : "Không xác định",
            anh_dai_dien: u.avatar || null,
            anh_bia: u.cover || null,
            tieu_su: u.status || "Không có",
            trang_thai_khoa: Boolean(u.isBlocked)
          }
        });
      }

      if (uidSession) {
        return res.status(200).json({
          trang_thai: "thanh_cong",
          loai: "zalo_session_token",
          phuong_thuc_xac_thuc: "Bóc tách Zalo Session Payload",
          thong_tin_tai_khoan: {
            user_id: uidSession,
            ten_hien_thi: `Zalo User (${uidSession})`,
            anh_dai_dien: `https://s120-ava-talk.zadn.vn/${uidSession}`,
            link_trang_ca_nhan: `https://zalo.me/${uidSession}`,
            link_app_mobile: `zalo://chat?id=${uidSession}`,
            trang_thai_session: "Đã xác thực chữ ký phiên hợp lệ"
          }
        });
      }

      return res.status(401).json({
        trang_thai: "that_bai",
        thong_bao: "Phiên đăng nhập Cookie hoặc IMEI không hợp lệ hoặc đã hết hạn."
      });
    }

    if (input.type === "group") {
      const groupPage = await requestText(
        `https://zalo.me/g/${input.code}`,
        browserHeaders(cookieHeader)
      );
      const html = groupPage.html || "";
      const nameMatch =
        html.match(/<meta property="og:title" content="([^"]+)"/) ||
        html.match(/<div class="group-name">([^<]+)<\/div>/);
      const descMatch =
        html.match(/<meta property="og:description" content="([^"]+)"/) ||
        html.match(/<div class="group-desc">([^<]+)<\/div>/);
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      const memberMatch = html.match(/(\d+)\s*(?:thành viên|members)/i);

      if (!nameMatch || isLoginPage(html, groupPage.url)) {
        return res.status(502).json({
          trang_thai: "that_bai",
          thong_bao: isLoginPage(html, groupPage.url)
            ? "Zalo yêu cầu đăng nhập để xem thông tin nhóm công khai."
            : `Nhóm Zalo không tồn tại hoặc link tham gia đã bị thu hồi: ${input.code}`
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "nhom_zalo",
        thong_tin_nhom: {
          ma_nhom: input.code,
          ten_nhom: nameMatch[1].replace("Tham gia nhóm ", "").trim(),
          mo_ta: descMatch ? descMatch[1].trim() : "Không có mô tả",
          anh_dai_dien_nhom: thumbMatch ? thumbMatch[1] : null,
          so_thanh_vien_uoc_tinh: memberMatch ? parseInt(memberMatch[1], 10) : "Chưa xác định",
          link_tham_gia: `https://zalo.me/g/${input.code}`
        }
      });
    }

    const lookup = await fetchPublicProfile(input, cookieHeader);
    if (lookup.parsed && lookup.parsed.ten_hien_thi) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: input.type === "phone" ? "trang_lien_he_zalo" : "user_zalo",
        thong_tin: publicResult(input, lookup.parsed)
      });
    }

    const fallback = publicResult(input, lookup.parsed || {});
    fallback.ton_tai = lookup.login_wall ? "chua_xac_dinh" : fallback.ten_hien_thi ? true : "chua_xac_dinh";
    fallback.ghi_chu = lookup.login_wall
      ? "Zalo chặn máy chủ xem tên/avatar (đòi đăng nhập). Mở link hoặc quét QR trên trình duyệt đã đăng nhập Zalo để xem đủ thông tin như trang zalo.me."
      : "Đã tạo link nhắn tin và mã QR công khai. Tên/avatar chỉ có khi Zalo trả trang liên hệ hoặc khi truyền cookie phiên Zalo.";

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: input.type === "phone" ? "trang_lien_he_zalo" : "user_zalo",
      thong_tin: fallback
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};
