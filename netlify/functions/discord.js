exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};

  // Nhận diện input từ: ?={id_hoac_invite}, ?id={...}, ?invite={...}
  let query = params.id || params.invite || params.user || params.server || params[""] || null;
  if (!query && event.rawQuery) {
    query = decodeURIComponent(event.rawQuery.replace(/^=/, "").trim());
  }

  if (!query) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập User ID hoặc Link/Mã mời server Discord.",
        cu_phap: {
          check_user: "https://api-zhee.netlify.app/discord?={user_id}",
          check_server: "https://api-zhee.netlify.app/discord?={invite_code_hoac_link}"
        },
        vi_du: [
          "https://api-zhee.netlify.app/discord?=156114103282368512",
          "https://api-zhee.netlify.app/discord?=discord-developers"
        ]
      }, null, 2)
    };
  }

  const cleanQuery = query.trim();

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: KIỂM TRA SERVER DISCORD QUA LỜI MỜI (INVITE CODE)
    // -------------------------------------------------------------
    const isInvite = cleanQuery.includes("discord.gg/") || cleanQuery.includes("discord.com/invite/") || (!/^\d{17,20}$/.test(cleanQuery));

    if (isInvite) {
      let inviteCode = cleanQuery;
      if (cleanQuery.includes("discord.gg/")) {
        inviteCode = cleanQuery.split("discord.gg/")[1]?.split(/[\/?#]/)[0];
      } else if (cleanQuery.includes("discord.com/invite/")) {
        inviteCode = cleanQuery.split("discord.com/invite/")[1]?.split(/[\/?#]/)[0];
      }

      const res = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`);
      if (!res.ok) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            trang_thai: "that_bai",
            thong_bao: `Lời mời hoặc máy chủ Discord không tồn tại / đã hết hạn: ${inviteCode}`
          }, null, 2)
        };
      }

      const d = await res.json();
      const g = d.guild || {};

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        },
        body: JSON.stringify({
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
        }, null, 2)
      };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: KIỂM TRA THÔNG TIN USER DISCORD (THEO USER ID)
    // -------------------------------------------------------------
    const userId = cleanQuery;
    const userRes = await fetch(`https://discordlookup.mesalytic.moe/v1/user/${userId}`);

    if (!userRes.ok) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy người dùng Discord với ID: ${userId}`
        }, null, 2)
      };
    }

    const u = await userRes.json();
    const avatarExt = u.avatar?.is_animated ? "gif" : "png";
    const bannerExt = u.banner?.is_animated ? "gif" : "png";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        trang_thai: "thanh_cong",
        loai_du_lieu: "nguoi_dung_discord",
        thong_tin_nguoi_dung: {
          id: u.id,
          tai_khoan: u.username,
          ten_hien_thi: u.global_name || u.username,
          tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
          bot: u.bot || false,
          ngay_tao_tai_khoan: u.created_at ? new Date(u.created_at).toLocaleString("vi-VN") : null,
          anh_dai_dien: u.avatar?.link || (u.avatar?.id ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar.id}.${avatarExt}?size=1024` : null),
          anh_banner: u.banner?.link || (u.banner?.id ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner.id}.${bannerExt}?size=1024` : null),
          mau_banner_hex: u.banner?.color || null,
          huy_hieu_badges: u.badges || []
        }
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ trang_thai: "that_bai", thong_bao: error.message }, null, 2)
    };
  }
};