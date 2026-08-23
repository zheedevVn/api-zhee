exports.handler = async (event, context) => {
  // Lấy domain hiện tại
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
        full_url: `${baseUrl}/github`,
        description: "Lấy thông tin người dùng GitHub",
        params: {
          user: {
            type: "string",
            required: false,
            default: "zheedevVn",
            description: "Tên tài khoản GitHub cần tra cứu"
          }
        },
        examples: [
          `${baseUrl}/github`,
          `${baseUrl}/github?user=octocat`
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