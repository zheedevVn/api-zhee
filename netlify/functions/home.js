exports.handler = async (event, context) => {
  const protocol = event.headers["x-forwarded-proto"] || "https";
  const host = event.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const documentation = {
    name: "Zhee API Service",
    version: "1.0.0",
    description: "Tài liệu danh sách các API đang hoạt động",
    endpoints: [
      {
        path: "/home",
        method: "GET",
        full_url: `${baseUrl}/home`,
        description: "Xem danh sách và hướng dẫn sử dụng API",
        params: {}
      },
      {
        path: "/github",
        method: "GET",
        full_url: `${baseUrl}/github?user={username}`,
        description: "Lấy thông tin tài khoản GitHub",
        formats: [
          `${baseUrl}/github?user={username}`,
          `${baseUrl}/github?={username}`
        ],
        examples: [
          `${baseUrl}/github?user=zheedevVn`,
          `${baseUrl}/github?=torvalds`
        ]
      }
    ]
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