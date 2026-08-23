module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  let queryTarget = "";
  let userCookie = "";
  let userImei = "";

  // Bóc tách query string an toàn
  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    const searchParams = new URLSearchParams(rawQuery);

    for (const [key, value] of searchParams.entries()) {
      if (key === "" || key === "phone" || key === "sdt" || key === "group" || key === "id" || key === "url") {
        if (!queryTarget) queryTarget = value || key;
      } else if (key === "cookie" || key === "cookies") {
        userCookie = value;
      } else if (key === "imei") {
        userImei = value;
      } else if (key === "code") {
        if (value.includes("=") || value.includes(";")) userCookie = value;
        else userImei = value;
      }
    }

    if (!queryTarget) {
      const firstPart = rawQuery.split("&")[0];
      queryTarget = decodeURIComponent(firstPart.replace(/^(?:phone|sdt|url)?=/, "").trim());
    }
  }

  // Fallback từ req.query
  if (!queryTarget && req.query) {
    queryTarget = req.query.phone || req.query.sdt || req.query.group || req.query.id || req.query[""] || "";
  }
  if (!userCookie && req.query) {
    userCookie = req.query.cookie || req.query.cookies || "";
  }
  if (!userImei && req.query) {
    userImei = req.query.imei || "";
  }

  if (!queryTarget && !userCookie) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Số điện thoại, Link nhóm Zalo hoặc đính kèm Cookie + IMEI để kiểm tra tài khoản.",
      cu_phap: {
        check_sdt_hoac_nhom: "https://{domain}/api/mxh/zalo?={sdt_hoac_link_nhom}",
        check_full_acc_session: "https://{domain}/api/mxh/zalo?cookie={zalo_cookie}&imei={zalo_imei}"
      }
    });
  }

  const cleanTarget = queryTarget.trim();
  const isGroup = cleanTarget.includes("zalo.me/g/") || cleanTarget.includes("/g/");

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: CHECK FULL TÀI KHOẢN QUA ZALO WEB COOKIE + IMEI
    // -------------------------------------------------------------
    if (userCookie) {
      const zaloHeaders = {
        ...browserHeaders,
        "Cookie": userCookie,
        "Referer": "https://chat.zalo.me/",
        "Origin": "https://chat.zalo.me"
      };

      if (userImei) {
        zaloHeaders["x-imei"] = userImei;
      }

      // Gọi cổng Profile Me của Zalo Web API
      const profileRes = await fetch("https://chat.zalo.me/api/v2/user/profile", { headers: zaloHeaders }).catch(() => null);
      
      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json();
        
        if (pData.error_code === 0 && pData.data) {
          const u = pData.data;

          // Lấy danh bạ và nhóm song song
          const [friendsRes, groupsRes] = await Promise.all([
            fetch("https://chat.zalo.me/api/v2/friend/getlist", { headers: zaloHeaders }).catch(() => null),
            fetch("https://chat.zalo.me/api/v2/group/getlist", { headers: zaloHeaders }).catch(() => null)
          ]);

          const friendsData = friendsRes && friendsRes.ok ? await friendsRes.json() : null;
          const groupsData = groupsRes && groupsRes.ok ? await groupsRes.json() : null;

          const friendList = (friendsData?.data || []).map((f, idx) => ({
            stt: idx + 1,
            user_id: f.userId || f.id,
            ten_hien_thi: f.displayName || f.zaloName,
            avatar: f.avatar || null,
            sdt: f.phoneNumber || "Riêng tư"
          }));

          const groupList = (groupsData?.data || []).map((g, idx) => ({
            stt: idx + 1,
            group_id: g.grid || g.id,
            ten_nhom: g.name,
            icon_nhom: g.avatar || null,
            tong_thanh_vien: g.totalMember || 0,
            la_truong_nhom: Boolean(g.isOwner)
          }));

          return res.status(200).json({
            trang_thai: "thanh_cong",
            loai: "zalo_account_session",
            thong_tin_tai_khoan: {
              user_id: u.userId || u.uid,
              ten_hien_thi: u.displayName || u.zaloName,
              so_dien_thoai: u.phoneNumber || "Ẩn",
              ngay_sinh: u.dob || u.birthDate || "Chưa cập nhật",
              gioi_tinh: u.gender === 0 ? "Nam" : u.gender === 1 ? "Nữ" : "Không xác định",
              anh_dai_dien: u.avatar || null,
              anh_bia: u.cover || null,
              tieu_su: u.status || "Không có",
              trang_thai_khoa: Boolean(u.isBlocked)
            },
            thong_ke: {
              tong_so_ban_be: friendList.length,
              danh_sach_ban_be: friendList.slice(0, 20),
              tong_so_nhom_tham_gia: groupList.length,
              danh_sach_nhom: groupList
            }
          });
        }
      }

      return res.status(401).json({
        trang_thai: "that_bai",
        thong_bao: "Cookie hoặc IMEI Zalo không hợp lệ / phiên đăng nhập đã hết hạn."
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: BÓC TÁCH THÔNG TIN NHÓM QUA LINK ZALO.ME/G/...
    // -------------------------------------------------------------
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
    // TRƯỜNG HỢP 3: TRA CỨU SỐ ĐIỆN THOẠI / USER ID CÔNG KHAI
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
        link_app_zalo: isPhoneNumber ? `zalo://chat?phone=${phone}` : `zalo://chat?id=${cleanTarget}`,
        anh_dai_dien: isPhoneNumber ? `https://avatar.talk.zdn.vn/default` : null,
        huong_dan_check_full: "Để xem tên đầy đủ, ngày sinh, danh bạ bạn bè và nhóm, hãy truyền kèm ?cookie={zalo_cookie}&imei={zalo_imei}"
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};