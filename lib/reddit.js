const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const TIMEOUT_MS = 9000;
const cache = new Map();

function inputFromRequest(req) {
  const requestUrl = new URL(req.url || "", "https://api-zhee.local");
  const query = req.query || {};
  let value = query.url || query.username || query.user || query.subreddit || query[""] || "";
  if (!value) {
    for (const [key, item] of requestUrl.searchParams.entries()) {
      value = item || key;
      if (value) break;
    }
  }
  return String(value || "").trim();
}

function parseTarget(input) {
  const value = input.replace(/^@+/, "").trim();
  const urlMatch = value.match(/^https?:\/\/(?:www\.)?reddit\.com\/(.+?)(?:[?#].*)?\/?$/i);
  const path = (urlMatch ? urlMatch[1] : value).replace(/^\/+|\/+$/g, "");
  const userMatch = path.match(/^(?:user|u)\/([A-Za-z0-9_-]+)/i);
  const subredditMatch = path.match(/^(?:r|subreddit)\/([A-Za-z0-9_+-]+)/i);
  const postMatch = path.match(/^(?:r\/[^/]+\/)?comments\/([A-Za-z0-9]+)(?:\/([^/?#]+))?/i);

  if (postMatch) return { type: "post", name: postMatch[1], slug: postMatch[2] || "" };
  if (userMatch) return { type: "user", name: userMatch[1] };
  if (subredditMatch) return { type: "subreddit", name: subredditMatch[1] };
  if (/^u_/i.test(path)) return { type: "user", name: path };
  return { type: "user", name: path.split(/[/?#]/)[0] };
}

async function redditJson(endpoint) {
  const response = await fetch(`https://www.reddit.com${endpoint}`, {
    headers: {
      "User-Agent": "ZheeAPI/1.0 (public lookup; contact: zheedev)",
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Reddit trả HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function cached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...item.value, cache_hit: true };
}

function saveCache(key, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cache_hit: false };
}

function isoDate(seconds) {
  return Number.isFinite(Number(seconds)) ? new Date(Number(seconds) * 1000).toISOString() : null;
}

function imageUrl(value) {
  return value ? String(value).replace(/&amp;/g, "&") : null;
}

function mapPost(item) {
  const post = item?.data || item || {};
  return {
    id: post.id || null,
    tieu_de: post.title || null,
    noi_dung: post.selftext || "",
    tac_gia: post.author ? `u/${post.author}` : "[deleted]",
    subreddit: post.subreddit_name_prefixed || (post.subreddit ? `r/${post.subreddit}` : null),
    diem: post.score ?? 0,
    upvote_ratio: post.upvote_ratio ?? null,
    so_binh_luan: post.num_comments ?? 0,
    url_noi_dung: post.url || null,
    permalink: post.permalink ? `https://www.reddit.com${post.permalink}` : null,
    anh_thumbnail: imageUrl(post.thumbnail && /^https?:\/\//i.test(post.thumbnail) ? post.thumbnail : null),
    nsfw: Boolean(post.over_18),
    da_gan: Boolean(post.stickied),
    ngay_dang: isoDate(post.created_utc)
  };
}

function mapComment(item) {
  const comment = item?.data || item || {};
  return {
    id: comment.id || null,
    tac_gia: comment.author ? `u/${comment.author}` : "[deleted]",
    noi_dung: comment.body || "",
    diem: comment.score ?? 0,
    ngay_dang: isoDate(comment.created_utc),
    permalink: comment.permalink ? `https://www.reddit.com${comment.permalink}` : null
  };
}

async function lookupUser(name) {
  const key = `user:${name.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;
  const [about, posts, comments] = await Promise.all([
    redditJson(`/user/${encodeURIComponent(name)}/about.json`),
    redditJson(`/user/${encodeURIComponent(name)}/submitted.json?limit=10&raw_json=1`),
    redditJson(`/user/${encodeURIComponent(name)}/comments.json?limit=10&raw_json=1`)
  ]);
  const user = about?.data;
  if (!user?.name) throw Object.assign(new Error(`Không tìm thấy tài khoản Reddit: u/${name}`), { status: 404 });
  const data = {
    trang_thai: "thanh_cong",
    loai: "reddit_user",
    thong_tin_tai_khoan: {
      id: user.id,
      username: `u/${user.name}`,
      ten_hien_thi: user.subreddit?.title || user.name,
      tieu_su: user.subreddit?.public_description || "",
      anh_dai_dien: imageUrl(user.icon_img),
      anh_banner: imageUrl(user.subreddit?.banner_img),
      karma_bai_viet: user.link_karma ?? 0,
      karma_binh_luan: user.comment_karma ?? 0,
      karma_award: user.awarder_karma ?? 0,
      tong_karma: user.total_karma ?? ((user.link_karma || 0) + (user.comment_karma || 0)),
      da_xac_minh_email: Boolean(user.has_verified_email),
      la_moderator: Boolean(user.is_mod),
      reddit_premium: Boolean(user.is_gold),
      da_xac_thuc: Boolean(user.verified),
      tai_khoan_bi_cam: Boolean(user.is_suspended),
      ngay_tao: isoDate(user.created_utc),
      link_trang_ca_nhan: `https://www.reddit.com/user/${user.name}/`
    },
    bai_dang_gan_day: (posts?.data?.children || []).map(mapPost),
    binh_luan_gan_day: (comments?.data?.children || []).map(mapComment),
    nguon: "Reddit public JSON API"
  };
  return saveCache(key, data);
}

async function lookupSubreddit(name) {
  const key = `subreddit:${name.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;
  const [about, posts] = await Promise.all([
    redditJson(`/r/${encodeURIComponent(name)}/about.json`),
    redditJson(`/r/${encodeURIComponent(name)}/hot.json?limit=10&raw_json=1`)
  ]);
  const subreddit = about?.data;
  if (!subreddit?.display_name) throw Object.assign(new Error(`Không tìm thấy subreddit: r/${name}`), { status: 404 });
  const data = {
    trang_thai: "thanh_cong",
    loai: "reddit_subreddit",
    thong_tin_subreddit: {
      ten: `r/${subreddit.display_name}`,
      tieu_de: subreddit.title || subreddit.display_name,
      mo_ta: subreddit.public_description || subreddit.description || "",
      so_nguoi_dang_ky: subreddit.subscribers ?? 0,
      nguoi_dang_hoat_dong: subreddit.active_user_count ?? null,
      nsfw: Boolean(subreddit.over18),
      loai: subreddit.subreddit_type || null,
      anh_icon: imageUrl(subreddit.icon_img),
      anh_banner: imageUrl(subreddit.banner_background_image || subreddit.banner_img),
      ngay_tao: isoDate(subreddit.created_utc),
      link: `https://www.reddit.com/r/${subreddit.display_name}/`
    },
    bai_dang_noi_bat: (posts?.data?.children || []).map(mapPost),
    nguon: "Reddit public JSON API"
  };
  return saveCache(key, data);
}

async function lookupPost(id, slug) {
  const key = `post:${id}`;
  const hit = cached(key);
  if (hit) return hit;
  const payload = await redditJson(`/comments/${encodeURIComponent(id)}.json?limit=20&raw_json=1&depth=1`);
  const post = payload?.[0]?.data?.children?.[0];
  if (!post?.data?.id) throw Object.assign(new Error(`Không tìm thấy bài đăng Reddit: ${id}`), { status: 404 });
  const comments = (payload?.[1]?.data?.children || []).filter((item) => item.kind === "t1").map(mapComment);
  const data = {
    trang_thai: "thanh_cong",
    loai: "reddit_post",
    thong_tin_bai_dang: mapPost(post),
    binh_luan: comments,
    link_goc: `https://www.reddit.com/comments/${id}/${slug || ""}`.replace(/\/$/, ""),
    nguon: "Reddit public JSON API"
  };
  return saveCache(key, data);
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const input = inputFromRequest(req);
  if (!input) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username Reddit, link user, subreddit hoặc link bài đăng.",
      cu_phap: {
        user: "/api/mxh/reddit?=spez",
        subreddit: "/api/mxh/reddit?=r/programming",
        post: "/api/mxh/reddit?=https://www.reddit.com/r/programming/comments/{post_id}/{slug}/"
      },
      tac_gia: AUTHOR
    });
  }

  const target = parseTarget(input);
  if (!target.name || target.name.length > 100) {
    return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Định danh Reddit không hợp lệ.", tac_gia: AUTHOR });
  }

  try {
    const result = target.type === "post"
      ? await lookupPost(target.name, target.slug)
      : target.type === "subreddit" ? await lookupSubreddit(target.name) : await lookupUser(target.name);
    return res.status(200).json({ ...result, tac_gia: AUTHOR });
  } catch (error) {
    const status = [400, 404, 429].includes(error.status) ? error.status : 502;
    return res.status(status).json({
      trang_thai: "that_bai",
      thong_bao: error.status === 404 ? error.message : "Không thể lấy dữ liệu Reddit công khai lúc này.",
      chi_tiet: error.status === 429 ? "Reddit đang giới hạn tần suất. Vui lòng thử lại sau." : undefined,
      tac_gia: AUTHOR
    });
  }
};
