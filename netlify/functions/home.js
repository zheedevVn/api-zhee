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
    youtube: {
      ten_api: "YouTube Channel & Video Info",
      duong_dan: "/youtube",
      phuong_thuc: "GET",
      mo_ta: "Lấy thông tin kênh kèm 10 video mới nhất hoặc bóc tách dữ liệu video YouTube",
      cu_phap: [
        `${baseUrl}/youtube?={handle_hoac_ten_kenh}`,
        `${baseUrl}/youtube?={link_video_youtube}`
      ],
      vi_du: [
        `${baseUrl}/youtube?=@SonTungMTP`,
        `${baseUrl}/youtube?=https://www.youtube.com/watch?v=dQw4w9WgXcQ`
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