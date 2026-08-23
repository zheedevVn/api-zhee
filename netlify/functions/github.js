exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện username từ: ?={username}, ?user={username}, hoặc ?{username}
  let username = params.user || params.username || params[""] || null;

  if (!username && event.rawQuery) {
    username = event.rawQuery.replace(/^=/, "").trim();
  }

  // Báo lỗi cú pháp nếu thiếu username
  if (!username) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "error",
        message: "Vui lòng cung cấp username GitHub.",
        usage: {
          syntax: "https://api-zhee.netlify.app/github?={username}",
          alternative: "https://api-zhee.netlify.app/github?user={username}"
        }
      }, null, 2)
    };
  }

  const headers = { "User-Agent": "Netlify-Serverless-Function" };

  try {
    // Gọi song song Profile và Repositories
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

    // Bóc tách toàn bộ link chi tiết và đẹp mắt cho từng repo
    const formattedRepositories = reposData.map((repo, index) => {
      const defaultBranch = repo.default_branch || "main";
      return {
        stt: index + 1,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || "Không có mô tả",
        language: repo.language || "Unknown",
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        open_issues: repo.open_issues_count,
        default_branch: defaultBranch,
        is_fork: repo.fork,
        is_archived: repo.archived,
        urls: {
          web_url: repo.html_url,
          homepage: repo.homepage || null,
          clone_https: repo.clone_url,
          clone_ssh: repo.ssh_url,
          git_url: repo.git_url,
          download_zip: `${repo.html_url}/archive/refs/heads/${defaultBranch}.zip`,
          download_tar: `${repo.html_url}/archive/refs/heads/${defaultBranch}.tar.gz`,
          commits_url: `${repo.html_url}/commits`,
          issues_url: repo.has_issues ? `${repo.html_url}/issues` : null,
          releases_url: `${repo.html_url}/releases`
        },
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at
      };
    });

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
        author: "Zhee API Service",
        data: {
          profile: {
            id: userData.id,
            username: userData.login,
            name: userData.name || userData.login,
            avatar_url: userData.avatar_url,
            profile_url: userData.html_url,
            bio: userData.bio || "Không có tiểu sử",
            company: userData.company || null,
            blog: userData.blog || null,
            location: userData.location || null,
            email: userData.email || null,
            twitter: userData.twitter_username || null,
            public_repos: userData.public_repos,
            followers: userData.followers,
            following: userData.following,
            created_at: userData.created_at,
            updated_at: userData.updated_at
          },
          total_repos: formattedRepositories.length,
          repositories: formattedRepositories
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