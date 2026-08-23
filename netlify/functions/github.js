exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Hỗ trợ bắt: ?user=..., ?username=..., ?=..., hoặc ?<username>
  let username = params.user || params.username || params[""] || null;

  if (!username && event.rawQuery) {
    username = event.rawQuery.replace(/^=/, "").trim();
  }

  // Nếu không truyền username -> Trả về JSON hướng dẫn
  if (!username) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "error",
        message: "Thiếu tên tài khoản GitHub (username).",
        usage: {
          standard: "https://api-zhee.netlify.app/github?user={username}",
          shorthand: "https://api-zhee.netlify.app/github?={username}",
          example: "https://api-zhee.netlify.app/github?user=torvalds"
        }
      }, null, 2)
    };
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        "User-Agent": "Netlify-Serverless-Function"
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          status: "error",
          message: `Không tìm thấy tài khoản GitHub: ${username}`
        }, null, 2)
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "success",
        data: {
          id: data.id,
          username: data.login,
          name: data.name,
          avatar_url: data.avatar_url,
          html_url: data.html_url,
          bio: data.bio,
          location: data.location,
          public_repos: data.public_repos,
          followers: data.followers,
          following: data.following
        }
      }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "error",
        message: error.message
      }, null, 2)
    };
  }
};