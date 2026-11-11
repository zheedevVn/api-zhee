/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  req.query = req.query || {};
  const fullUrl = req.url || "";
  let query = req.query.user || req.query.username || req.query.id || req.query[""] || "";

  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    query = decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim());
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Roblox Username hoặc Roblox User ID.",
      cu_phap: [
        "https://{domain}/api/mxh/roblox?user={username}",
        "https://{domain}/api/mxh/roblox?id={user_id}"
      ],
      vi_du: [
        "https://{domain}/api/mxh/roblox?user=Roblox",
        "https://{domain}/api/mxh/roblox?id=1"
      ]
    });
  }

  try {
    let userId = null;
    let username = "";

    // 1. Kiểm tra đầu vào là ID hay Username
    if (/^\d+$/.test(query)) {
      userId = query;
    } else {
      // Tìm User ID qua Username
      const userSearchRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [query],
          excludeBannedUsers: false
        })
      });

      const userSearchData = await userSearchRes.json();
      if (!userSearchData.data || userSearchData.data.length === 0) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy tài khoản Roblox có tên: ${query}`
        });
      }
      userId = userSearchData.data[0].id;
      username = userSearchData.data[0].name;
    }

    // 2. Lấy thông tin chi tiết người dùng
    const userDetailRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!userDetailRes.ok) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản Roblox có ID: ${userId}`
      });
    }
    const userData = await userDetailRes.json();
    username = userData.name;

    // 3. Lấy thông số bạn bè, follow và ảnh đại diện đồng thời
    const [friendsRes, followersRes, followingsRes, avatarRes, headshotRes] = await Promise.all([
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`).catch(() => null),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`).catch(() => null),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`).catch(() => null),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`).catch(() => null),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`).catch(() => null)
    ]);

    const friendsCount = friendsRes?.ok ? (await friendsRes.json()).count : 0;
    const followersCount = followersRes?.ok ? (await followersRes.json()).count : 0;
    const followingsCount = followingsRes?.ok ? (await followingsRes.json()).count : 0;

    let fullBodyAvatar = null;
    if (avatarRes?.ok) {
      const avatarData = await avatarRes.json();
      fullBodyAvatar = avatarData.data?.[0]?.imageUrl || null;
    }

    let headshotAvatar = null;
    if (headshotRes?.ok) {
      const headshotData = await headshotRes.json();
      headshotAvatar = headshotData.data?.[0]?.imageUrl || null;
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      nen_tang: "Roblox",
      thong_tin_tai_khoan: {
        id: userData.id,
        ten_tai_khoan: userData.name,
        ten_hien_thi: userData.displayName,
        tieu_su: userData.description || "Không có tiểu sử",
        ngay_tao_tai_khoan: new Date(userData.created).toLocaleString("vi-VN"),
        trang_thai_khoa: userData.isBanned ? "Đã bị cấm (Banned)" : "Hoạt động bình thường",
        da_xac_minh: userData.hasVerifiedBadge,
        ten_cu_truoc_day: userData.externalAppDisplayName || null,
        lien_ket_trang_ca_nhan: `https://www.roblox.com/users/${userData.id}/profile`
      },
      chi_so_tuong_tac: {
        ban_be: friendsCount,
        nguoi_theo_doi: followersCount,
        dang_theo_doi: followingsCount
      },
      hinh_anh_avatar: {
        avatar_toan_than_3d: fullBodyAvatar,
        avatar_headshot_chan_dung: headshotAvatar
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};