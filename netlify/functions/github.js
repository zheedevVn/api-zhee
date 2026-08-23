exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Nhận diện username linh hoạt từ: ?={username}, ?user={username}, hoặc ?{username}
  let username = params.user || params.username || params[""] || null;

  if (!username && event.rawQuery) {
    username = event.rawQuery.replace(/^=/, "").trim();
  }

  // Kiểm tra nếu chưa nhập username
  if (!username) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập tên tài khoản GitHub (username).",
        huong_dan: "https://api-zhee.netlify.app/github?={username}"
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
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy tài khoản GitHub: ${username}`
        }, null, 2)
      };
    }

    const userData = await userRes.json();
    const reposData = reposRes.ok ? await reposRes.json() : [];

    // Định dạng danh sách kho lưu trữ (repos) thuần Tiếng Việt
    const danh_sach_repo = reposData.map((repo, index) => ({
      stt: index + 1,
      ten_repo: repo.name,
      link_repo: repo.html_url,
      mo_ta: repo.description || "Không có mô tả",
      ngon_ngu: repo.language || "Không xác định",
      so_sao: repo.stargazers_count,
      luot_fork: repo.forks_count,
      ngay_tao: repo.created_at,
      ngay_cap_nhat: repo.updated_at
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
        trang_thai: "thanh_cong",
        thong_tin_ca_nhan: {
          id: userData.id,
          tai_khoan: userData.login,
          ho_ten: userData.name || userData.login,
          anh_dai_dien: userData.avatar_url,
          link_trang_ca_nhan: userData.html_url,
          tieu_su: userData.bio || "Không có tiểu sử",
          cong_ty: userData.company || "Không có",
          trang_web: userData.blog || "Không có",
          dia_chi: userData.location || "Không có",
          email: userData.email || "Không công khai",
          twitter: userData.twitter_username || "Không có",
          tong_so_repo: userData.public_repos,
          tong_so_gist: userData.public_gists,
          nguoi_theo_doi: userData.followers,
          dang_theo_doi: userData.following,
          ngay_tao_tai_khoan: userData.created_at,
          ngay_cap_nhat_lan_cuoi: userData.updated_at
        },
        tong_so_repo_hien_tai: danh_sach_repo.length,
        danh_sach_repo: danh_sach_repo
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
        trang_thai: "that_bai",
        thong_bao: error.message
      }, null, 2)
    };
  }
};