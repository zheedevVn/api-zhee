module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.id || req.query.invite || req.query[""] || null;

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

  try {
    const isInvite = cleanQuery.includes("discord.gg/") || cleanQuery.includes("discord.com/invite/") || (!/^\d{17,20}$/.test(cleanQuery));

    if (isInvite) {
      let inviteCode = cleanQuery;
      if (cleanQuery.includes("discord.gg/")) {
        inviteCode = cleanQuery.split("discord.gg/")[1]?.split(/[\/?#]/)[0];
      } else if (cleanQuery.includes("discord.com/invite/")) {
        inviteCode = cleanQuery.split("discord.com/invite/")[1]?.split(/[\/?#]/)[0];
      }

      const inviteRes = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`);
      if (!inviteRes.ok) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Lời mời hoặc máy chủ Discord không tồn tại: ${inviteCode}`
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

    const userRes = await fetch(`https://discordlookup.mesalytic.moe/v1/user/${cleanQuery}`);
    if (!userRes.ok) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy người dùng Discord với ID: ${cleanQuery}`
      });
    }

    const u = await userRes.json();
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai_du_lieu: "nguoi_dung_discord",
      thong_tin_nguoi_dung: {
        id: u.id,
        tai_khoan: u.username,
        ten_hien_thi: u.global_name || u.username,
        tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
        bot: u.bot || false,
        anh_dai_dien: u.avatar?.link || null,
        anh_banner: u.banner?.link || null,
        mau_banner_hex: u.banner?.color || null,
        huy_hieu_badges: u.badges || []
      }
    });
  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message });
  }
};