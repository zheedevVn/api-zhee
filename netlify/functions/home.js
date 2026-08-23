exports.handler = async (event, context) => {
  const protocol = event.headers["x-forwarded-proto"] || "https";
  const host = event.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const documentation = {
    github: {
      ten_api: "GitHub Info & Repos",
      duong_dan: "/github",
      phuong_thuc: "GET",
      mo_ta: "Lấy thông tin cá nhân và link toàn bộ repositories",
      cu_phap: `${baseUrl}/github?={username}`,
      vi_du: `${baseUrl}/github?=hoducminh123`
    },
    tiktok: {
      ten_api: "TikTok Info & Downloader",
      duong_dan: "/tiktok",
      phuong_thuc: "GET",
      mo_ta: "Tra cứu thông tin tài khoản TikTok hoặc lấy link video không logo",
      cu_phap: [
        `${baseUrl}/tiktok?={username}`,
        `${baseUrl}/tiktok?={link_video}`
      ],
      vi_du: [
        `${baseUrl}/tiktok?=tiktok`,
        `${baseUrl}/tiktok?=https://vt.tiktok.com/ZSjabcXYZ/`
      ]
    },
    discord: {
      ten_api: "Discord User & Server Lookup",
      duong_dan: "/discord",
      phuong_thuc: "GET",
      mo_ta: "Tra cứu thông tin tài khoản Discord qua User ID hoặc bóc tách dữ liệu máy chủ qua link mời",
      cu_phap: [
        `${baseUrl}/discord?={user_id}`,
        `${baseUrl}/discord?={invite_code_hoac_link}`
      ],
      vi_du: [
        `${baseUrl}/discord?=156114103282368512`,
        `${baseUrl}/discord?=https://discord.gg/discord-developers`
      ]
    }
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(documentation, null, 2)
  };
};