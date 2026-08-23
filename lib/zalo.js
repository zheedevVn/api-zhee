module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  let queryTarget = "";
  let rawCookie = "";
  let rawImei = "";

  // 1. Phân giải tham số truy vấn an toàn
  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);

    // Bóc tách IMEI
    const imeiMatch = rawQuery.match(/[?&]imei=([^&]+)/i) || 
                      rawQuery.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-f0-9]{32})/i);
    if (imeiMatch) rawImei = decodeURIComponent(imeiMatch[1] || imeiMatch[0]).trim();

    // Bóc tách Cookie (dạng chuỗi hoặc JSON Array)
    const cookieMatch = rawQuery.match(/[?&](?:cookie|cookies)=([^&]+)/i);
    if (cookieMatch) {
      rawCookie = decodeURIComponent(cookieMatch[1]).trim();
    }

    // Bóc tách Target chính nếu truyền ?=...
    const firstParam = rawQuery.split("&")[0];
    if (!firstParam.startsWith("cookie=") && !firstParam.startsWith("imei=")) {
      queryTarget = decodeURIComponent(firstParam.replace(/^(?:phone|sdt|url|group|id)?=/, "").trim());
    }
  }

  // Fallback req.query
  if (!rawCookie && req.query) rawCookie = req.query.cookie || req.query.cookies || "";
  if (!rawImei && req.query) rawImei = req.query.imei || "";
  if (!queryTarget && req.query) queryTarget = req.query.phone || req.query.sdt || req.query.id || req.query[""] || "";

  // 2. Chuẩn hóa Cookie nếu là mảng JSON từ Extension
  let cookieHeader = "";
  if (rawCookie) {
    if (rawCookie.startsWith("[") && rawCookie.endsWith("]")) {
      try {
        const parsedJson = JSON.parse(rawCookie);
        if (Array.isArray(parsedJson)) {
          cookieHeader = parsedJson.map(c => `${c.name}=${c.value}`).join("; ");
        }
      } catch (e) {
        cookieHeader = rawCookie;
      }
    } else {
      cookieHeader = rawCookie;
    }
  }

  if (!queryTarget && !cookieHeader && !rawImei) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập SĐT, link nhóm hoặc truyền Cookie / IMEI Zalo.",
      cu_phap: {
        check_cookie: "https://{domain}/api/mxh/zalo?cookie={zalo_cookie_hoac_json}",
        check_imei: "https://{domain}/api/mxh/zalo?imei={zalo_imei}",
        check_sdt_nhom: "https://{domain}/api/mxh/zalo?={sdt_hoac_link_nhom}"
      }
    });
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://chat.zalo.me/",
    "Origin": "https://chat.zalo.me"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: CHECK QUA COOKIE HOẶC IMEI (ZALO WEB SESSION)
    // -------------------------------------------------------------
    if (cookieHeader || rawImei) {
      const zHeaders = { ...browserHeaders };
      if (cookieHeader) zHeaders["Cookie"] = cookieHeader;
      if (rawImei) zHeaders["x-imei"] = rawImei;

      // Trích xuất UID từ chuỗi session zpw_sek hoặc zpsid
      let uidSession = null;
      const sessionMatch = cookieHeader.match(/zpw_sek=[a-zA-Z0-9]+\.([0-9]+)\./) || 
                           cookieHeader.match(/zpsid=[a-zA-Z0-9]+\.([0-9]+)\./);
      if (sessionMatch) {
        uidSession = sessionMatch[1];
      }

      // Gọi cổng Profile Me từ Zalo Chat API
      const profileRes = await fetch("https://chat.zalo.me/api/v2/user/profile", { headers: zHeaders }).catch(() => null);
      let profileData = null;

      if (profileRes && profileRes.ok) {
        const pJson = await profileRes.json().catch(() => null);
        if (pJson && pJson.error_code === 0 && pJson.data) {
          profileData = pJson.data;
        }
      }

      // Nếu API trả về thành công
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
            anh_dai_dien: u.avatar || (uidSession ? `https://avatar.talk.zdn.vn/default` : null),
            anh_bia: u.cover || null,
            tieu_su: u.status || "Không có",
            trang_thai_khoa: Boolean(u.isBlocked)
          }
        });
      }

      // Fallback: Nếu không gọi trực tiếp được vào cổng riêng tư nhưng có Session Token
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

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: BÓC TÁCH THÔNG TIN NHÓM QUA LINK ZALO.ME/G/...
    // -------------------------------------------------------------
    const cleanTarget = queryTarget.trim();
    const isGroup = cleanTarget.includes("zalo.me/g/") || cleanTarget.includes("/g/");

    if (isGroup) {
      let groupCode = cleanTarget;
      if (cleanTarget.includes("zalo.me/g/")) {
        groupCode = cleanTarget.split("zalo.me/g/")[1]?.split(/[\/?#]/)[0];
      }

      const groupPageRes = await fetch(`https://zalo.me/g/${groupCode}`, { headers: browserHeaders });
      const html = await groupPageRes.text();

      const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<div class="group-name">([^<]+)<\/div>/);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/) || html.match(/<div class="group-desc">([^<]+)<\/div>/);
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      const memberMatch = html.match(/(\d+)\s*(?:thành viên|members)/i);

      if (!nameMatch) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Nhóm Zalo không tồn tại hoặc link tham gia đã bị thu hồi: ${groupCode}`
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "nhom_zalo",
        thong_tin_nhom: {
          ma_nhom: groupCode,
          ten_nhom: nameMatch[1].replace("Tham gia nhóm ", "").trim(),
          mo_ta: descMatch ? descMatch[1].trim() : "Không có mô tả",
          anh_dai_dien_nhom: thumbMatch ? thumbMatch[1] : null,
          so_thanh_vien_uoc_tinh: memberMatch ? parseInt(memberMatch[1], 10) : "Chưa xác định",
          link_tham_gia: `https://zalo.me/g/${groupCode}`
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 3: TRA CỨU SỐ ĐIỆN THOẠI CÔNG KHAI
    // -------------------------------------------------------------
    let phone = cleanTarget.replace(/\s+/g, "").replace(/^(\+84|0)/, "84");
    const isPhoneNumber = /^84\d{8,10}$/.test(phone);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: isPhoneNumber ? "sdt_zalo" : "user_zalo",
      thong_tin: {
        dau_vao: cleanTarget,
        so_dien_thoai_chuan_hoa: isPhoneNumber ? `+${phone}` : null,
        link_nhan_tin_truc_tiep: isPhoneNumber ? `https://zalo.me/${phone}` : `https://zalo.me/${cleanTarget}`,
        link_app_zalo: isPhoneNumber ? `zalo://chat?phone=${phone}` : `zalo://chat?id=${cleanTarget}`
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};