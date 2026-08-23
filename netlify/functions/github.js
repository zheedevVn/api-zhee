exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện username từ: ?={username}, ?user={username}, hoặc ?{username}
  let username = params.user || params.username || params[""] || null;

  if (!username && event.rawQuery) {
    username = event.rawQuery.replace(/^=/, "").trim();
  }

  // Kiểm tra username
  if (!username) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "error",
        message: "Vui lòng nhập username GitHub.",
        example: "https://api-zhee.netlify.app/github?=hoducminh123"
      }, null, 2)
    };
  }

  const headers = { "User-Agent": "Netlify-Serverless-Function" };

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers })
    ]);

    if (!userRes.ok) {
      return {
        statusCode: userRes.status,
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

    const userData = await userRes.json();
    const reposData = reposRes.ok ? await reposRes.json() : [];

    // Chỉ lấy tên và link trực tiếp của từng Repo
    const repositories = reposData.map((repo, index) => ({
      stt: index + 1,
      repo_name: repo.name,
      repo_url: repo.html_url,
      description: repo.description || null,
      language: repo.language || null
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        status: "success",
        profile: {
          username: userData.login,
          name: userData.name || userData.login,
          avatar: userData.avatar_url,
          profile_url: userData.html_url,
          total_repos: userData.public_repos
        },
        repositories: repositories
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