/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  req.query = req.query || {};
  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let username = req.query.user || req.query.username || req.query[""] || null;

  if (!username && rawQuery) {
    username = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!username) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập tên tài khoản GitHub (username).",
      cu_phap: "https://{domain}/api/mxh/github?username={username}"
    });
  }

  username = decodeURIComponent(username).trim().replace(/^@+/, "");

  try {
    const headers = { "User-Agent": "Vercel-Serverless-Function" };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers })
    ]);

    if (!userRes.ok) {
      return res.status(userRes.status).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản GitHub: ${username}`
      });
    }

    const userData = await userRes.json();
    const reposData = reposRes.ok ? await reposRes.json() : [];

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

    return res.status(200).json({
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
        tong_so_repo: userData.public_repos,
        nguoi_theo_doi: userData.followers,
        dang_theo_doi: userData.following,
        ngay_tao_tai_khoan: userData.created_at,
        ngay_cap_nhat_lan_cuoi: userData.updated_at
      },
      tong_so_repo_hien_tai: danh_sach_repo.length,
      danh_sach_repo: danh_sach_repo
    });
  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message });
  }
};