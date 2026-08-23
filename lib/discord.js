module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.id || req.query.invite || req.query.token || req.query.user || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Token Discord, User ID hoặc Link/Mã mời Server.",
      cu_phap: {
        check_token: "https://{domain}/api/mxh/discord?={discord_token}",
        check_user_id: "https://{domain}/api/mxh/discord?={user_id}",
        check_invite: "https://{domain}/api/mxh/discord?={invite_link_hoac_code}"
      }
    });
  }

  const cleanQuery = query.trim();
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: KIỂM TRA TÀI KHOẢN QUA TOKEN DISCORD
    // -------------------------------------------------------------
    const isToken = cleanQuery.includes(".") && cleanQuery.length > 50 && !cleanQuery.includes("discord.gg");

    if (isToken) {
      const authHeaders = {
        ...browserHeaders,
        "Authorization": cleanQuery
      };

      const [userRes, guildsRes, connectionsRes] = await Promise.all([
        fetch("https://discord.com/api/v9/users/@me", { headers: authHeaders }),
        fetch("https://discord.com/api/v9/users/@me/guilds?with_counts=true", { headers: authHeaders }).catch(() => null),
        fetch("https://discord.com/api/v9/users/@me/connections", { headers: authHeaders }).catch(() => null)
      ]);

      if (!userRes.ok) {
        return res.status(401).json({
          trang_thai: "that_bai",
          loai: "discord_token",
          thong_bao: "Token Discord không hợp lệ hoặc đã hết hạn / bị vô hiệu hóa."
        });
      }

      const u = await userRes.json();
      const guilds = guildsRes && guildsRes.ok ? await guildsRes.json() : [];
      const connections = connectionsRes && connectionsRes.ok ? await connectionsRes.json() : [];

      const avatarExt = u.avatar?.startsWith("a_") ? "gif" : "png";
      const bannerExt = u.banner?.startsWith("a_") ? "gif" : "png";

      // Phân loại gói Nitro
      let nitroType = "Không có";
      if (u.premium_type === 1) nitroType = "Nitro Classic";
      if (u.premium_type === 2) nitroType = "Nitro Boost";
      if (u.premium_type === 3) nitroType = "Nitro Basic";

      // Danh sách máy chủ tham gia
      const danhSachServer = Array.isArray(guilds) ? guilds.map((g, idx) => ({
        stt: idx + 1,
        id_server: g.id,
        ten_server: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        la_chu_phong: Boolean(g.owner),
        quyen_admin: (BigInt(g.permissions || "0") & 0x8n) === 0x8n,
        so_thanh_vien_uoc_tinh: g.approximate_member_count || null
      })) : [];

      // Danh sách kết nối mạng xã hội
      const danhSachLienKet = Array.isArray(connections) ? connections.map((c, idx) => ({
        stt: idx + 1,
        nen_tang: c.type,
        ten_tai_khoan: c.name,
        da_xac_minh: Boolean(c.verified)
      })) : [];

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "discord_token_account",
        thong_tin_tai_khoan: {
          id: u.id,
          tai_khoan: u.username,
          ten_hien_thi: u.global_name || u.username,
          tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
          email: u.email || "Không công khai / Chưa liên kết",
          da_xac_minh_email: Boolean(u.verified),
          so_dien_thoai: u.phone || "Chưa thêm số điện thoại",
          xac_thuc_2fa: Boolean(u.mfa_enabled),
          tinh_trang_nitro: nitroType,
          anh_dai_dien: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${avatarExt}?size=1024` : null,
          anh_banner: u.banner ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.${bannerExt}?size=1024` : null,
          mau_banner_hex: u.banner_color || null,
          ngon_ngu: u.locale || "N/A",
          che_do_nsfw: Boolean(u.nsfw_allowed),
          huy_hieu_badges: u.public_flags || 0
        },
        thong_ke_hoat_dong: {
          tong_so_may_chu: danhSachServer.length,
          danh_sach_may_chu: danhSachServer,
          tong_so_ket_noi: danhSachLienKet.length,
          cac_tai_khoan_lien_ket: danhSachLienKet
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: KIỂM TRA MÁY CHỦ / LINK MỜI DISCORD
    // -------------------------------------------------------------
    const isInvite = cleanQuery.includes("discord.gg/") || cleanQuery.includes("discord.com/invite/") || (!/^\d{17,20}$/.test(cleanQuery));

    if (isInvite) {
      let inviteCode = cleanQuery;
      if (cleanQuery.includes("discord.gg/")) {
        inviteCode = cleanQuery.split("discord.gg/")[1]?.split(/[\/?#]/)[0];
      } else if (cleanQuery.includes("discord.com/invite/")) {
        inviteCode = cleanQuery.split("discord.com/invite/")[1]?.split(/[\/?#]/)[0];
      }

      const inviteRes = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`, { headers: browserHeaders });
      if (!inviteRes.ok) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Lời mời hoặc máy chủ Discord không tồn tại / đã hết hạn: ${inviteCode}`
        });
      }

      const d = await inviteRes.json();
      const g = d.guild || {};

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai_du_lieu: "may_chu_discord",
        thong_tin_may_chu: {
          id: g.id,
          ten_server: g.name,
          mo_ta: g.description || "Không có mô tả",
          anh_icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith("a_") ? "gif" : "png"}?size=1024` : null,
          anh_banner: g.banner ? `https://cdn.discordapp.com/banners/${g.id}/${g.banner}.png?size=1024` : null,
          link_moi: `https://discord.gg/${d.code}`,
          thong_ke: {
            thanh_vien_online: d.approximate_presence_count || 0,
            tong_thanh_vien: d.approximate_member_count || 0
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 3: TRA CỨU USER ID DISCORD
    // -------------------------------------------------------------
    const userId = cleanQuery;
    let userData = null;

    try {
      const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { headers: browserHeaders });
      if (lanyardRes.ok) {
        const lData = await lanyardRes.json();
        if (lData.success && lData.data?.discord_user) {
          const u = lData.data.discord_user;
          const avatarExt = u.avatar?.startsWith("a_") ? "gif" : "png";
          userData = {
            id: u.id,
            tai_khoan: u.username,
            ten_hien_thi: u.global_name || u.username,
            tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
            bot: u.bot || false,
            anh_dai_dien: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${avatarExt}?size=1024` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`,
            anh_banner: u.banner ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.png?size=1024` : null,
            mau_banner_hex: u.banner_color || null,
            trang_thai_hoat_dong: lData.data.discord_status || "offline"
          };
        }
      }
    } catch (e) {}

    if (!userData) {
      const epoch = 1420070400000n;
      const snowflakeTime = Number((BigInt(userId) >> 22n) + epoch);
      const createdAt = new Date(snowflakeTime).toISOString();
      const defaultAvatarIndex = Number((BigInt(userId) >> 22n) % 6n);

      userData = {
        id: userId,
        tai_khoan: `User_${userId}`,
        ten_hien_thi: "Người dùng Discord",
        tag: "N/A",
        bot: false,
        ngay_tao_tai_khoan: new Date(createdAt).toLocaleString("vi-VN"),
        anh_dai_dien: `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`,
        anh_banner: null,
        mau_banner_hex: null
      };
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai_du_lieu: "nguoi_dung_discord",
      thong_tin_nguoi_dung: userData
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};