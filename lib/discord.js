const DISCORD_EPOCH = 1420070400000n;
const BADGE_FLAGS = [
  [1 << 0, "staff", "Nhân viên Discord"],
  [1 << 1, "partner", "Đối tác Discord"],
  [1 << 2, "hypesquad", "HypeSquad Events"],
  [1 << 3, "bug_hunter_level_1", "Thợ săn lỗi cấp 1"],
  [1 << 6, "hypesquad_house_1", "HypeSquad Bravery"],
  [1 << 7, "hypesquad_house_2", "HypeSquad Brilliance"],
  [1 << 8, "hypesquad_house_3", "HypeSquad Balance"],
  [1 << 9, "early_supporter", "Người ủng hộ sớm"],
  [1 << 14, "bug_hunter_level_2", "Thợ săn lỗi cấp 2"],
  [1 << 16, "verified_bot", "Bot đã xác minh"],
  [1 << 17, "verified_developer", "Nhà phát triển bot sớm"],
  [1 << 18, "certified_moderator", "Kiểm duyệt viên được chứng nhận"],
  [1 << 22, "active_developer", "Nhà phát triển năng nổ"]
];
const BADGE_NAMES = Object.fromEntries(BADGE_FLAGS.map((item) => [item[1], item[2]]));
const CONNECTION_NAMES = {
  battlenet: "Battle.net",
  domain: "Tên miền",
  epicgames: "Epic Games",
  facebook: "Facebook",
  github: "GitHub",
  instagram: "Instagram",
  leagueoflegends: "Liên Minh Huyền Thoại",
  paypal: "PayPal",
  playstation: "PlayStation",
  reddit: "Reddit",
  riotgames: "Riot Games",
  roblox: "Roblox",
  spotify: "Spotify",
  steam: "Steam",
  tiktok: "TikTok",
  twitch: "Twitch",
  twitter: "Twitter / X",
  xbox: "Xbox",
  youtube: "YouTube"
};

function normalizeDiscordToken(value) {
  let token = String(value || "").trim().replace(/^['"]|['"]$/g, "");
  const bot = /^bot\s+/i.test(token);
  token = token.replace(/^(?:bot|bearer)\s+/i, "").replace(/\s+/g, "");
  return { token, bot };
}

function nitroLabel(type) {
  if (type === 1) return "Nitro Classic";
  if (type === 2) return "Nitro Boost";
  if (type === 3) return "Nitro Basic";
  return "Không có";
}

function formatVi(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

function ageLabel(date) {
  const now = new Date();
  let months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + (now.getUTCMonth() - date.getUTCMonth());
  if (now.getUTCDate() < date.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years && rest) return `${years} năm ${rest} tháng`;
  if (years) return `${years} năm`;
  if (rest) return `${rest} tháng`;
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
  return `${days} ngày`;
}

function createdFromSnowflake(id) {
  try {
    return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
  } catch (_) {
    return null;
  }
}

function hexColor(value) {
  const color = Number(value);
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff) return null;
  return `#${color.toString(16).padStart(6, "0")}`;
}

function discordCdn(kind, id, hash) {
  if (!id || !hash) return null;
  const ext = String(hash).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/${kind}/${id}/${hash}.${ext}?size=1024`;
}

function hasAdmin(permissions) {
  try {
    return (BigInt(permissions || "0") & 0x8n) === 0x8n;
  } catch (_) {
    return false;
  }
}

function badgeIcon(icon) {
  return icon ? `https://cdn.discordapp.com/badge-icons/${icon}.png` : null;
}

function badgeList(flags, profileBadges, premiumType) {
  const seen = new Set();
  const items = [];
  const push = (id, ten, moTa, icon) => {
    const key = String(id || ten || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ id: id || null, ten: ten || "Huy hiệu", mo_ta: moTa || null, icon: badgeIcon(icon) });
  };
  if (Array.isArray(profileBadges)) {
    profileBadges.forEach((badge) => {
      push(badge?.id, BADGE_NAMES[badge?.id] || badge?.description || "Huy hiệu", badge?.description || null, badge?.icon);
    });
  }
  BADGE_FLAGS.forEach(([bit, id, ten]) => {
    if ((Number(flags) & bit) === bit) push(id, ten, ten, null);
  });
  if (premiumType > 0) push("premium", nitroLabel(premiumType), "Đang có Nitro", null);
  return items;
}

function summarizeNitro(premiumType, profile, subscriptions) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const sub = list.slice().sort((a, b) => Date.parse(b?.current_period_end || 0) - Date.parse(a?.current_period_end || 0))[0] || null;
  const since = profile?.premium_since ? new Date(profile.premium_since) : null;
  const sinceGuild = profile?.premium_guild_since ? new Date(profile.premium_guild_since) : null;
  const start = sub?.current_period_start ? new Date(sub.current_period_start) : null;
  const end = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const endOk = end && !Number.isNaN(end.getTime());
  const remaining = endOk ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null;
  const canceled = Boolean(sub?.canceled_at);
  let trangThai = "Không có gói";
  if (sub && endOk && remaining < 0) trangThai = "Đã hết hạn";
  else if (sub && canceled) trangThai = "Còn hạn, đã tắt gia hạn";
  else if (sub || premiumType > 0) trangThai = "Đang hoạt động";
  return {
    loai: nitroLabel(premiumType),
    ma_premium: premiumType || 0,
    tu_ngay: since && !Number.isNaN(since.getTime()) ? since.toISOString() : null,
    tu_ngay_chu: formatVi(since),
    nitro_may_chu_tu: sinceGuild && !Number.isNaN(sinceGuild.getTime()) ? sinceGuild.toISOString() : null,
    bat_dau_chu_ky: formatVi(start),
    het_han: endOk ? end.toISOString() : null,
    het_han_chu: formatVi(end),
    con_ngay: remaining === null ? null : Math.max(remaining, 0),
    da_huy: canceled,
    trang_thai: trangThai,
    so_goi: list.length,
    ma_trang_thai: sub?.status ?? null
  };
}

function summarizeBoosts(slots) {
  const list = Array.isArray(slots) ? slots : [];
  const slot = list.map((item) => {
    const guild = item?.premium_guild_subscription || null;
    const cool = item?.cooldown_ends_at ? new Date(item.cooldown_ends_at) : null;
    const cooling = Boolean(cool && !Number.isNaN(cool.getTime()) && cool.getTime() > Date.now());
    return {
      id_server: guild?.guild_id || null,
      het_han: guild?.ends_at || null,
      dang_gan: Boolean(guild && guild.ended !== true),
      dang_hoi_chieu: cooling,
      het_hoi_chieu: cooling ? formatVi(cool) : null,
      da_huy: Boolean(item?.canceled)
    };
  });
  const dangGan = slot.filter((item) => item.dang_gan && item.id_server).length;
  return { tong_slot: list.length, dang_gan: dangGan, con_trong: Math.max(list.length - dangGan, 0), slot };
}

function summarizePayments(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const phuongThuc = list.map((item) => ({
    loai: item?.type === 1 ? "Thẻ" : item?.type === 2 ? "PayPal" : "Khác",
    thuong_hieu: item?.brand || null,
    bon_so_cuoi: item?.last_4 || null,
    hop_le: item?.invalid !== true,
    het_han: item?.expires_month && item?.expires_year ? `${item.expires_month}/${item.expires_year}` : null,
    quoc_gia: item?.billing_address?.country || null,
    mac_dinh: Boolean(item?.default)
  }));
  return {
    so_phuong_thuc: phuongThuc.length,
    so_hop_le: phuongThuc.filter((item) => item.hop_le).length,
    phuong_thuc: phuongThuc
  };
}

function mapGuild(guild, index) {
  return {
    stt: index + 1,
    id_server: guild.id,
    ten_server: guild.name,
    icon: discordCdn("icons", guild.id, guild.icon),
    anh_banner: discordCdn("banners", guild.id, guild.banner),
    la_chu_phong: Boolean(guild.owner),
    quyen_admin: hasAdmin(guild.permissions),
    so_thanh_vien_uoc_tinh: guild.approximate_member_count || null,
    so_thanh_vien_online: guild.approximate_presence_count ?? null,
    cap_boost: guild.premium_tier ?? null
  };
}

function mapConnection(connection, index) {
  const type = connection.type || "";
  return {
    stt: index + 1,
    nen_tang: type,
    ten_nen_tang: CONNECTION_NAMES[String(type).toLowerCase()] || type || null,
    ten_tai_khoan: connection.name,
    da_xac_minh: Boolean(connection.verified),
    hien_thi_cong_khai: connection.visibility === 1,
    dong_bo_ban_be: Boolean(connection.friend_sync),
    lien_ket_hai_chieu: Boolean(connection.two_way_link)
  };
}

async function discordGet(url, headers) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    const data = await response.json().catch(() => null);
    const retryAfter = Number(response.headers.get("retry-after") || data?.retry_after || 0);
    return { ok: response.ok, status: response.status, data, retryAfter };
  } catch (_) {
    return { ok: false, status: 0, data: null, retryAfter: 0 };
  }
}

function tokenFailure(hit) {
  if (!hit || hit.status === 0) {
    return { status: 502, body: { trang_thai: "that_bai", loai: "discord_token", thong_bao: "Không kết nối được Discord. Thử lại sau." } };
  }
  if (hit.status === 429) {
    const seconds = Math.max(1, Math.ceil(Number(hit.retryAfter) || 1));
    return {
      status: 429,
      body: {
        trang_thai: "that_bai",
        loai: "discord_token",
        thong_bao: `Discord đang giới hạn lượt kiểm tra. Thử lại sau ${seconds} giây.`,
        thu_lai_sau_giay: seconds
      }
    };
  }
  if (hit.status === 403) {
    const locked = hit.data?.code === 40002;
    return {
      status: 403,
      body: {
        trang_thai: "that_bai",
        loai: "discord_token",
        thong_bao: locked
          ? "Tài khoản Discord cần xác minh email hoặc số điện thoại trước khi token dùng được."
          : "Token bị từ chối. Tài khoản có thể đang bị khóa hoặc bị Discord giới hạn."
      }
    };
  }
  return {
    status: 401,
    body: { trang_thai: "that_bai", loai: "discord_token", thong_bao: "Token Discord không hợp lệ hoặc đã hết hạn / bị vô hiệu hóa." }
  };
}

async function fetchAllGuilds(headers) {
  const all = [];
  let after = "";
  for (let page = 0; page < 5; page += 1) {
    const url = `https://discord.com/api/v9/users/@me/guilds?with_counts=true&limit=200${after ? `&after=${after}` : ""}`;
    const hit = await discordGet(url, headers);
    if (!hit.ok || !Array.isArray(hit.data) || !hit.data.length) break;
    all.push(...hit.data);
    if (hit.data.length < 200) break;
    after = hit.data[hit.data.length - 1]?.id || "";
    if (!after) break;
  }
  return all;
}

const QUEST_TASK_NAMES = {
  ACHIEVEMENT_IN_ACTIVITY: "Hoàn thành thành tựu trong activity",
  ACHIEVEMENT_IN_GAME: "Hoàn thành thành tựu trong game",
  PLAY_ACTIVITY: "Chơi activity",
  PLAY_ON_DESKTOP: "Chơi trên máy tính",
  PLAY_ON_DESKTOP_V2: "Chơi trên máy tính",
  PLAY_ON_PLAYSTATION: "Chơi trên PlayStation",
  PLAY_ON_XBOX: "Chơi trên Xbox",
  STREAM_ON_DESKTOP: "Phát trực tiếp trên máy tính",
  WATCH_VIDEO: "Xem video",
  WATCH_VIDEO_ON_MOBILE: "Xem video trên điện thoại"
};
const QUEST_REWARD_TYPES = {
  1: "Mã thưởng",
  2: "Trong game",
  3: "Vật phẩm Discord",
  4: "Orbs",
  5: "Nitro dùng thử"
};

function questConfig(quest) {
  return quest?.config && typeof quest.config === "object" ? quest.config : (quest || {});
}

function questAsset(questId, name) {
  if (!questId || !name) return null;
  const value = String(name);
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.discordapp.com/quests/${questId}/${value}`;
}

function asOrbCount(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function rewardAmount(reward, keys) {
  for (const key of keys) {
    const amount = asOrbCount(reward?.[key]);
    if (amount) return amount;
  }
  return null;
}

function orbsFromText(value) {
  const match = String(value || "").match(/(\d[\d.]*)\s*orbs?/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function questRewards(config) {
  const buckets = [config?.rewards_config?.rewards, config?.rewardsConfig?.rewards, config?.rewards];
  const list = buckets.find(Array.isArray) || [];
  return list.filter((item) => item && typeof item === "object");
}

function rewardSummary(config, hasNitro) {
  const rewards = questRewards(config);
  const messages = config?.messages || {};
  let base = 0;
  let nitroAmount = 0;
  let sawPremium = false;
  const names = [];
  rewards.forEach((reward) => {
    const text = [reward.messages?.name, reward.messages?.name_with_article, reward.name, reward.name_with_article].filter(Boolean).join(" ");
    const amount = rewardAmount(reward, ["orb_quantity", "orbQuantity", "orbs", "orb_amount", "orbAmount"]) || orbsFromText(text);
    if (!amount) return;
    base += amount;
    const boosted = rewardAmount(reward, ["premium_orb_quantity", "premiumOrbQuantity", "premium_orb_amount", "premiumOrbAmount"]);
    if (boosted) {
      sawPremium = true;
      nitroAmount += boosted;
    } else {
      nitroAmount += amount;
    }
    if (reward.messages?.name || reward.name) names.push(reward.messages?.name || reward.name);
  });
  if (!base) base = orbsFromText(messages.quest_name || messages.questName || "") || 0;
  if (!base) return { orbs: null, orbs_goc: null, orbs_nitro: null, he_so: null, ten_thuong: names[0] || null, loai_thuong: null };
  const features = Array.isArray(config?.features) ? config.features.map(Number) : [];
  const blocked = features.includes(38);
  let heSo = null;
  if (blocked) {
    heSo = null;
    nitroAmount = null;
  } else if (sawPremium && nitroAmount !== base) {
    heSo = Math.round((nitroAmount / base) * 100) / 100;
  } else if (!sawPremium) {
    heSo = 1.2;
    nitroAmount = Math.round(base * 1.2);
  } else {
    heSo = null;
    nitroAmount = base;
  }
  const orbReward = rewards.find((reward) => reward.type === 4 || rewardAmount(reward, ["orb_quantity", "orbQuantity"]) || orbsFromText(reward.messages?.name || reward.name));
  return {
    orbs: hasNitro && nitroAmount ? nitroAmount : base,
    orbs_goc: base,
    orbs_nitro: nitroAmount,
    he_so: heSo,
    ten_thuong: names[0] || null,
    loai_thuong: orbReward ? (QUEST_REWARD_TYPES[orbReward.type] || "Orbs") : "Orbs"
  };
}

function questTasks(config, status) {
  const taskRoot = config?.task_config_v2 || config?.taskConfigV2 || config?.task_config || config?.taskConfig || {};
  const tasks = taskRoot.tasks && typeof taskRoot.tasks === "object" ? taskRoot.tasks : {};
  const progress = status?.progress && typeof status.progress === "object" ? status.progress : {};
  return Object.values(tasks).filter((task) => task && typeof task === "object").map((task) => {
    const type = task.type || "";
    const current = progress[type]?.value ?? 0;
    const target = Number.isFinite(task.target) ? task.target : null;
    const duration = /PLAY|STREAM|WATCH/.test(type);
    return {
      loai: QUEST_TASK_NAMES[type] || type || "Nhiệm vụ",
      ma: type || null,
      hien_tai: current,
      muc_tieu: target,
      don_vi: duration ? "giây" : "lần",
      hoan_thanh: Boolean(progress[type]?.completed_at) || (target != null && current >= target),
      mo_ta: task.messages?.task_description || task.messages?.task_title || null
    };
  });
}

function mapQuest(quest, hasNitro, fromClaimed = false) {
  const config = questConfig(quest);
  const messages = config.messages || {};
  const status = quest?.user_status || quest?.userStatus || null;
  const reward = rewardSummary(config, hasNitro);
  const tasks = questTasks(config, status);
  const accepted = Boolean(status?.enrolled_at || status?.enrolledAt) || fromClaimed;
  const completed = Boolean(status?.completed_at || status?.completedAt) || fromClaimed;
  const claimed = Boolean(status?.claimed_at || status?.claimedAt) || fromClaimed;
  let trangThai = "Chưa nhận";
  if (claimed) trangThai = "Đã nhận thưởng";
  else if (completed) trangThai = "Đã xong, chưa nhận thưởng";
  else if (accepted) trangThai = "Đang làm";
  const expiresAt = config.expires_at || config.expiresAt || null;
  const startsAt = config.starts_at || config.startsAt || null;
  const expires = expiresAt ? new Date(expiresAt) : null;
  const remaining = expires && !Number.isNaN(expires.getTime()) ? Math.ceil((expires.getTime() - Date.now()) / 86400000) : null;
  const description = messages.quest_description || messages.description || tasks.find((task) => task.mo_ta)?.mo_ta || null;
  return {
    id: quest?.id || config.id || null,
    ten: messages.quest_name || messages.questName || messages.game_title || messages.gameTitle || "Nhiệm vụ Discord",
    game: messages.game_title || messages.gameTitle || config.application?.name || null,
    nha_phat_hanh: messages.game_publisher || messages.gamePublisher || null,
    mo_ta: description ? String(description).slice(0, 500) : null,
    bat_dau: startsAt,
    bat_dau_chu: formatVi(startsAt),
    ket_thuc: expiresAt,
    ket_thuc_chu: formatVi(expiresAt),
    con_ngay: remaining === null ? null : Math.max(remaining, 0),
    trang_thai: trangThai,
    da_nhan_nhiem_vu: accepted,
    da_hoan_thanh: completed,
    da_nhan_thuong: claimed,
    orbs: reward.orbs,
    orbs_goc: reward.orbs_goc,
    orbs_nitro: reward.orbs_nitro,
    he_so: reward.he_so,
    ten_thuong: reward.ten_thuong,
    loai_thuong: reward.loai_thuong,
    anh_bia: questAsset(quest?.id || config.id, config.assets?.hero),
    anh_game: questAsset(quest?.id || config.id, config.assets?.game_tile),
    lien_ket: typeof config.cta_config?.link === "string" && /^https:\/\//i.test(config.cta_config.link) ? config.cta_config.link : null,
    tien_do: tasks
  };
}

function summarizeQuests(currentHit, claimedHit, hasNitro) {
  const current = currentHit.ok && currentHit.data && typeof currentHit.data === "object" ? currentHit.data : {};
  const claimedBody = claimedHit.ok && claimedHit.data && typeof claimedHit.data === "object" ? claimedHit.data : {};
  const available = (Array.isArray(current.quests) ? current.quests : []).map((quest) => mapQuest(quest, hasNitro));
  const claimed = (Array.isArray(claimedBody.quests) ? claimedBody.quests : []).map((quest) => mapQuest(quest, hasNitro, true));
  available.sort((a, b) => Date.parse(a.ket_thuc || 0) - Date.parse(b.ket_thuc || 0));
  claimed.sort((a, b) => Date.parse(b.ket_thuc || 0) - Date.parse(a.ket_thuc || 0));
  const completedIds = new Set();
  let completedWithoutId = 0;
  const countCompleted = (item) => {
    if (item.id) completedIds.add(String(item.id));
    else completedWithoutId += 1;
  };
  available.forEach((item) => { if (item.da_hoan_thanh) countCompleted(item); });
  claimed.forEach(countCompleted);
  return {
    quet_duoc: Boolean(currentHit.ok),
    tong_hien_co: available.length,
    tong_hoan_thanh: completedIds.size + completedWithoutId,
    chua_lam: available.filter((item) => !item.da_hoan_thanh).length,
    dang_lam: available.filter((item) => item.trang_thai === "Đang làm").length,
    chua_nhan: available.filter((item) => item.trang_thai === "Chưa nhận").length,
    da_xong_chua_nhan_thuong: available.filter((item) => item.trang_thai === "Đã xong, chưa nhận thưởng").length,
    khong_du_dieu_kien: Array.isArray(current.excluded_quests) ? current.excluded_quests.length : 0,
    bi_chan_den: formatVi(current.quest_enrollment_blocked_until),
    hien_co: available.slice(0, 40),
    tong_da_nhan_thuong: claimed.length,
    da_nhan_thuong_quet_duoc: Boolean(claimedHit.ok),
    da_nhan_thuong: claimed.slice(0, 30)
  };
}

function summarizeOrbs(balanceHit, rewardsHit, hasNitro) {
  const balance = balanceHit.ok && balanceHit.data && typeof balanceHit.data === "object" ? balanceHit.data : null;
  const rewards = rewardsHit.ok && rewardsHit.data && typeof rewardsHit.data === "object" && !Array.isArray(rewardsHit.data) ? rewardsHit.data : null;
  const multiplier = [rewards?.orbs_multiplier, rewards?.multiplier, rewards?.premium_orbs_multiplier, rewards?.quest_orbs_multiplier]
    .find((value) => typeof value === "number") ?? null;
  return {
    so_du: balance && typeof balance.balance === "number" ? balance.balance : null,
    quet_duoc: Boolean(balanceHit.ok && balance && typeof balance.balance === "number"),
    he_so_nitro: multiplier,
    co_nitro: hasNitro
  };
}

function authHeaders(authorization, browserHeaders) {
  return { ...browserHeaders, Authorization: authorization };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.id || req.query.invite || req.query.token || req.query.user || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Token Discord, User ID hoặc Link/Mã mời Server.",
      cu_phap: {
        check_token: "https://{domain}/api/mxh/discord?token={discord_token}",
        check_user_id: "https://{domain}/api/mxh/discord?id={user_id}",
        check_invite: "https://{domain}/api/mxh/discord?invite={invite_link_hoac_code}"
      }
    });
  }

  const cleanQuery = query.trim();
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: KIỂM TRA TÀI KHOẢN QUA TOKEN DISCORD
    // -------------------------------------------------------------
    const isToken = cleanQuery.includes(".") && cleanQuery.length > 50 && !cleanQuery.includes("discord.gg");

    if (isToken) {
      const parsed = normalizeDiscordToken(cleanQuery);
      let kieuToken = parsed.bot ? "bot" : "user";
      let authorization = kieuToken === "bot" ? `Bot ${parsed.token}` : parsed.token;
      let userHit = await discordGet("https://discord.com/api/v9/users/@me", authHeaders(authorization, browserHeaders));
      if (!userHit.ok && userHit.status === 401 && kieuToken === "user") {
        const botHit = await discordGet("https://discord.com/api/v9/users/@me", authHeaders(`Bot ${parsed.token}`, browserHeaders));
        if (botHit.ok) {
          userHit = botHit;
          kieuToken = "bot";
          authorization = `Bot ${parsed.token}`;
        }
      }
      if (!userHit.ok || !userHit.data || typeof userHit.data !== "object") {
        const failure = tokenFailure(userHit);
        return res.status(failure.status).json(failure.body);
      }

      const headers = authHeaders(authorization, browserHeaders);
      const questHeaders = { ...headers, Referer: "https://discord.com/quest-home", Origin: "https://discord.com" };
      const userAccount = kieuToken === "user";
      const [profileHit, guilds, connectionsHit, subscriptionHit, slotHit, paymentHit, settingsHit, applicationHit, questHit, claimedHit, orbHit, rewardHit] = await Promise.all([
        discordGet("https://discord.com/api/v9/users/@me/profile", headers),
        fetchAllGuilds(headers),
        discordGet("https://discord.com/api/v9/users/@me/connections", headers),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/billing/subscriptions", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/guilds/premium/subscription-slots", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/billing/payment-sources", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/settings", headers) : Promise.resolve({ ok: false, data: null }),
        kieuToken === "bot" ? discordGet("https://discord.com/api/v9/oauth2/applications/@me", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/quests/@me", questHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/quests/@me/claimed", questHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/virtual-currency/balance", questHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/program-rewards", questHeaders) : Promise.resolve({ ok: false, data: null })
      ]);

      const profile = profileHit.ok && profileHit.data && typeof profileHit.data === "object" ? profileHit.data : {};
      const profileUser = profile.user && typeof profile.user === "object" ? profile.user : {};
      const u = { ...profileUser, ...userHit.data };
      ["clan", "primary_guild", "avatar_decoration_data", "banner", "bio"].forEach((key) => {
        if (u[key] == null && profileUser[key] != null) u[key] = profileUser[key];
      });
      const profileCard = profile.user_profile && typeof profile.user_profile === "object" ? profile.user_profile : {};
      const clan = u.primary_guild || u.clan || null;
      const created = createdFromSnowflake(u.id);
      const nitro = summarizeNitro(u.premium_type || 0, profile, subscriptionHit.ok ? subscriptionHit.data : []);
      const danhSachServer = guilds.map(mapGuild);
      const connections = connectionsHit.ok && Array.isArray(connectionsHit.data) ? connectionsHit.data : [];
      const danhSachLienKet = connections.map(mapConnection);
      const settings = settingsHit.ok && settingsHit.data && typeof settingsHit.data === "object" ? settingsHit.data : {};
      const decoration = u.avatar_decoration_data?.asset
        ? `https://cdn.discordapp.com/avatar-decoration-presets/${u.avatar_decoration_data.asset}.png`
        : null;
      const application = applicationHit.ok && applicationHit.data && typeof applicationHit.data === "object" ? applicationHit.data : null;

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "discord_token_account",
        thong_tin_tai_khoan: {
          id: u.id,
          tai_khoan: u.username,
          ten_hien_thi: u.global_name || u.username,
          tag: u.discriminator && u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
          email: u.email || "Không công khai / Chưa liên kết",
          da_xac_minh_email: Boolean(u.verified),
          so_dien_thoai: u.phone || "Chưa thêm số điện thoại",
          xac_thuc_2fa: Boolean(u.mfa_enabled),
          tinh_trang_nitro: nitro.loai,
          anh_dai_dien: discordCdn("avatars", u.id, u.avatar),
          anh_banner: discordCdn("banners", u.id, u.banner),
          mau_banner_hex: u.banner_color || null,
          ngon_ngu: u.locale || "N/A",
          che_do_nsfw: Boolean(u.nsfw_allowed),
          huy_hieu_badges: u.public_flags || 0,
          kieu_token: kieuToken,
          link_ho_so: u.id ? `https://discord.com/users/${u.id}` : null,
          ngay_tao: created ? formatVi(created) : null,
          ngay_tao_iso: created ? created.toISOString() : null,
          tuoi_tai_khoan: created ? ageLabel(created) : null,
          ten_cu: profile.legacy_username || null,
          tieu_su: profileCard.bio || u.bio || null,
          dai_tu: profileCard.pronouns || null,
          mau_nhan: hexColor(u.accent_color ?? profileCard.accent_color),
          mau_chu_de: Array.isArray(profileCard.theme_colors) ? profileCard.theme_colors.map(hexColor).filter(Boolean) : [],
          trang_tri_avatar: decoration,
          the_clan: clan && (clan.tag || clan.badge) ? {
            the: clan.tag || null,
            dang_bat: Boolean(clan.identity_enabled),
            id_server: clan.identity_guild_id || null,
            huy_hieu: clan.badge && clan.identity_guild_id ? `https://cdn.discordapp.com/clan-badges/${clan.identity_guild_id}/${clan.badge}.png` : null
          } : null,
          trang_thai: settings.status || null,
          trang_thai_tuy_chinh: settings.custom_status?.text || null,
          emoji_trang_thai: settings.custom_status?.emoji_name || null,
          huy_hieu: badgeList(u.public_flags || 0, profile.badges, u.premium_type || 0),
          nitro,
          boost: summarizeBoosts(slotHit.ok ? slotHit.data : []),
          thanh_toan: summarizePayments(paymentHit.ok ? paymentHit.data : []),
          orbs: summarizeOrbs(orbHit, rewardHit, u.premium_type === 1 || u.premium_type === 2),
          nhiem_vu: summarizeQuests(questHit, claimedHit, u.premium_type === 1 || u.premium_type === 2),
          ung_dung: application ? {
            ten: application.name || null,
            mo_ta: application.description || null,
            cong_khai: Boolean(application.bot_public)
          } : null
        },
        thong_ke_hoat_dong: {
          tong_so_may_chu: danhSachServer.length,
          so_may_chu_so_huu: danhSachServer.filter((item) => item.la_chu_phong).length,
          so_may_chu_admin: danhSachServer.filter((item) => item.la_chu_phong || item.quyen_admin).length,
          danh_sach_may_chu: danhSachServer,
          tong_so_ket_noi: danhSachLienKet.length,
          cac_tai_khoan_lien_ket: danhSachLienKet
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: KIỂM TRA MÁY CHỦ / LINK MỜI DISCORD
    // -------------------------------------------------------------
    const isInvite = cleanQuery.includes("discord.gg/") || cleanQuery.includes("discord.com/invite/") || (!/^\d{17,20}$/.test(cleanQuery));

    if (isInvite) {
      let inviteCode = cleanQuery;
      if (cleanQuery.includes("discord.gg/")) {
        inviteCode = cleanQuery.split("discord.gg/")[1]?.split(/[\/?#]/)[0];
      } else if (cleanQuery.includes("discord.com/invite/")) {
        inviteCode = cleanQuery.split("discord.com/invite/")[1]?.split(/[\/?#]/)[0];
      }

      const inviteRes = await fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`, { headers: browserHeaders });
      if (!inviteRes.ok) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Lời mời hoặc máy chủ Discord không tồn tại / đã hết hạn: ${inviteCode}`
        });
      }

      const d = await inviteRes.json();
      const g = d.guild || {};

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai_du_lieu: "may_chu_discord",
        thong_tin_may_chu: {
          id: g.id,
          ten_server: g.name,
          mo_ta: g.description || "Không có mô tả",
          anh_icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith("a_") ? "gif" : "png"}?size=1024` : null,
          anh_banner: g.banner ? `https://cdn.discordapp.com/banners/${g.id}/${g.banner}.png?size=1024` : null,
          link_moi: `https://discord.gg/${d.code}`,
          thong_ke: {
            thanh_vien_online: d.approximate_presence_count || 0,
            tong_thanh_vien: d.approximate_member_count || 0
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 3: TRA CỨU USER ID DISCORD
    // -------------------------------------------------------------
    const userId = cleanQuery;
    let userData = null;

    try {
      const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { headers: browserHeaders });
      if (lanyardRes.ok) {
        const lData = await lanyardRes.json();
        if (lData.success && lData.data?.discord_user) {
          const u = lData.data.discord_user;
          const avatarExt = u.avatar?.startsWith("a_") ? "gif" : "png";
          userData = {
            id: u.id,
            tai_khoan: u.username,
            ten_hien_thi: u.global_name || u.username,
            tag: u.discriminator !== "0" ? `#${u.discriminator}` : "Mới (Không dùng tag)",
            bot: u.bot || false,
            anh_dai_dien: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${avatarExt}?size=1024` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`,
            anh_banner: u.banner ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.png?size=1024` : null,
            mau_banner_hex: u.banner_color || null,
            trang_thai_hoat_dong: lData.data.discord_status || "offline"
          };
        }
      }
    } catch (e) {}

    if (!userData) {
      const epoch = 1420070400000n;
      const snowflakeTime = Number((BigInt(userId) >> 22n) + epoch);
      const createdAt = new Date(snowflakeTime).toISOString();
      const defaultAvatarIndex = Number((BigInt(userId) >> 22n) % 6n);

      userData = {
        id: userId,
        tai_khoan: `User_${userId}`,
        ten_hien_thi: "Người dùng Discord",
        tag: "N/A",
        bot: false,
        ngay_tao_tai_khoan: new Date(createdAt).toLocaleString("vi-VN"),
        anh_dai_dien: `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`,
        anh_banner: null,
        mau_banner_hex: null
      };
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai_du_lieu: "nguoi_dung_discord",
      thong_tin_nguoi_dung: userData
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};