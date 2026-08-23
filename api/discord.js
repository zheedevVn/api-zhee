module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.id || req.query.invite || req.query.user || req.query.server || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập User ID hoặc Link/Mã mời server Discord.",
      cu_phap: "https://{domain}/api/mxh/discord?={user_id_hoac_invite}"
    });
  }

  const cleanQuery = query.trim();
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: KIỂM TRA MÁY CHỦ / LINK MỜI DISCORD
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
          anh_splash: g.splash ? `https://cdn.discordapp.com/splashes/${g.id}/${g.splash}.png?size=1024` : null,
          link_moi: `https://discord.gg/${d.code}`,
          thong_ke: {
            thanh_vien_online: d.approximate_presence_count || 0,
            tong_thanh_vien: d.approximate_member_count || 0,
            muc_do_xac_thuc: g.verification_level
          },
          nguoi_tao_loi_moi: d.inviter ? {
            id: d.inviter.id,
            username: d.inviter.username,
            ten_hien_thi: d.inviter.global_name || d.inviter.username,
            avatar: d.inviter.avatar ? `https://cdn.discordapp.com/avatars/${d.inviter.id}/${d.inviter.avatar}.png` : null
          } : null
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: KIỂM TRA USER ID DISCORD (ĐA NGUỒN FALLBACK)
    // -------------------------------------------------------------
    const userId = cleanQuery;
    let userData = null;

    // Nguồn 1: Lanyard REST API (rất nhanh và không bị rate-limit)
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
            trang_thai_hoat_dong: lData.data.discord_status || "offline",
            dang_choi_game: lData.data.activities?.map(a => a.name) || []
          };
        }
      }
    } catch (e) {}

    // Nguồn 2: Japi API
    if (!userData) {
      try {
        const japiRes = await fetch(`https://discord.com/api/v9/users/${userId}`, {
          headers: {
            "Authorization": "Bot MTAwMDAwMDAwMDAwMDAwMDAwMA.xxxxxx.xxxxxx", // placeholder bypass
            ...browserHeaders
          }
        });
        // Sử dụng Japi lookup công khai
        const japiLookup = await fetch(`https://japi.rest/discord/v1/user/${userId}`, { headers: browserHeaders });
        if (japiLookup.ok) {
          const resJapi = await japiLookup.json();
          if (resJapi.data) {
            const u = resJapi.data;
            userData = {
              id: u.id,
              tai_khoan: u.username,
              ten_hien_thi: u.global_name || u.username,
              tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
              bot: u.bot || false,
              ngay_tao_tai_khoan: u.createdAt || null,
              anh_dai_dien: u.avatar?.url || `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`,
              anh_banner: u.banner?.url || null,
              mau_banner_hex: u.banner_color || null,
              huy_hieu_badges: u.public_flags_array || []
            };
          }
        }
      } catch (e) {}
    }

    // Nguồn 3: Tính toán dữ liệu mặc định từ Snowflake ID (Discord Snowflake Decoding)
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
        mau_banner_hex: null,
        ghi_chu: "Dữ liệu được tạo từ Discord Snowflake Decoder"
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