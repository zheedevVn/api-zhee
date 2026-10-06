/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
/**
 * ZheeDevTool — (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Phan mem doc quyen — Cam sao chep / phan phoi lai khi chua duoc cap phep.
 * Xem giay phep day du tai file LICENSE.
 */
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
  token = token.replace(/^(?:token|auth|key|bearer|bot)\s*[:=]\s*/i, "");
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

let cachedBuildNumber = 504649;
let lastBuildFetch = 0;

async function getDiscordBuildNumber() {
  if (Date.now() - lastBuildFetch < 3600000 && cachedBuildNumber) {
    return cachedBuildNumber;
  }
  try {
    const res = await fetch("https://discord.com/app", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const html = await res.text();
      const assets = [...html.matchAll(/\/assets\/([a-f0-9]+)\.js/g)].map((m) => m[1]);
      for (const h of assets.slice(-5)) {
        try {
          const jsRes = await fetch(`https://discord.com/assets/${h}.js`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(4000)
          });
          const jsText = await jsRes.text();
          const m = jsText.match(/buildNumber["\s:]+["\s]*(\d{5,7})/);
          if (m && m[1]) {
            cachedBuildNumber = Number(m[1]);
            lastBuildFetch = Date.now();
            return cachedBuildNumber;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  lastBuildFetch = Date.now();
  return cachedBuildNumber || 504649;
}

function makeSuperProperties(buildNumber) {
  const obj = {
    os: "Windows",
    browser: "Discord Client",
    release_channel: "stable",
    client_version: "1.0.9175",
    os_version: "10.0.26100",
    os_arch: "x64",
    app_arch: "x64",
    system_locale: "en-US",
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36",
    browser_version: "32.2.7",
    client_build_number: buildNumber,
    native_build_number: 59498,
    client_event_source: null
  };
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

async function getQuestHeaders(token, region = "US") {
  const build = await getDiscordBuildNumber();
  const superProps = makeSuperProperties(build);
  const isVn = String(region || "US").toUpperCase() === "VN";
  return {
    "Authorization": token,
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Accept-Language": isVn ? "vi-VN,vi;q=0.9,en-US;q=0.8" : "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36",
    "X-Super-Properties": superProps,
    "X-Discord-Locale": isVn ? "vi" : "en-US",
    "X-Discord-Timezone": isVn ? "Asia/Ho_Chi_Minh" : "America/New_York",
    "Origin": "https://discord.com",
    "Referer": "https://discord.com/channels/@me"
  };
}

function getQuestDisplayName(quest) {
  const config = questConfig(quest);
  const messages = config.messages || {};
  return messages.quest_name || messages.questName || messages.game_title || messages.gameTitle || config.application?.name || `Nhiệm vụ #${quest?.id || config?.id || "Discord"}`;
}

async function executeDiscordQuest(rawToken, questId, region = "US") {
  const parsed = normalizeDiscordToken(rawToken);
  if (parsed.bot || !parsed.token) {
    return {
      status: 400,
      body: { trang_thai: "that_bai", loai: "discord_run_quest", thong_bao: "Token Discord không hợp lệ hoặc là Bot token (chỉ áp dụng cho tài khoản người dùng)." }
    };
  }

  const cleanQuestId = String(questId || "").trim();
  if (!cleanQuestId || !/^\d{16,22}$/.test(cleanQuestId)) {
    return {
      status: 400,
      body: { trang_thai: "that_bai", loai: "discord_run_quest", thong_bao: `Mã nhiệm vụ Quest ID (${cleanQuestId}) không hợp lệ.` }
    };
  }

  const headers = await getQuestHeaders(parsed.token, region);

  // 1. Kiểm tra danh sách nhiệm vụ hiện tại
  let questsRes = await discordGet("https://discord.com/api/v9/quests/@me", headers);
  if (!questsRes.ok) {
    if (questsRes.status === 401 || questsRes.status === 403) {
      return {
        status: questsRes.status,
        body: { trang_thai: "that_bai", loai: "discord_run_quest", thong_bao: "Token Discord không hợp lệ, đã hết hạn hoặc bị Discord giới hạn truy cập nhiệm vụ." }
      };
    }
    await new Promise((r) => setTimeout(r, 1200));
    questsRes = await discordGet("https://discord.com/api/v9/quests/@me", headers);
  }

  const questsData = (questsRes.ok && questsRes.data && typeof questsRes.data === "object") ? questsRes.data : {};
  const activeQuests = Array.isArray(questsData.quests) ? questsData.quests : [];
  let targetQuest = activeQuests.find((q) => String(q.id) === cleanQuestId || String(q.config?.id) === cleanQuestId);

  // Nếu không thấy trong danh sách đang mở, kiểm tra danh sách đã nhận thưởng
  if (!targetQuest) {
    const claimedRes = await discordGet("https://discord.com/api/v9/quests/@me/claimed", headers);
    const claimedList = (claimedRes.ok && claimedRes.data?.quests) || [];
    const alreadyClaimed = claimedList.find((q) => String(q.id) === cleanQuestId || String(q.config?.id) === cleanQuestId);
    if (alreadyClaimed) {
      const qName = getQuestDisplayName(alreadyClaimed);
      return {
        status: 200,
        body: {
          trang_thai: "thanh_cong",
          loai: "discord_run_quest",
          thong_bao: `Nhiệm vụ "${qName}" đã hoàn thành và ĐÃ NHẬN THƯỞNG từ trước rồi!`,
          ket_qua: {
            id_nhiem_vu: cleanQuestId,
            ten_nhiem_vu: qName,
            da_hoan_thanh: true,
            da_nhan_thuong: true,
            trang_thai: "Đã nhận thưởng"
          }
        }
      };
    }
  }

  // Nếu vẫn chưa có targetQuest, thử enroll trực tiếp
  if (!targetQuest) {
    try {
      const enrollAttempt = await fetch(`https://discord.com/api/v9/quests/${cleanQuestId}/enroll`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          location: 11,
          is_targeted: false,
          metadata_raw: null,
          metadata_sealed: null
        }),
        signal: AbortSignal.timeout(8000)
      }).then((r) => r.json()).catch(() => null);

      if (enrollAttempt && enrollAttempt.id) {
        targetQuest = enrollAttempt;
      }
    } catch (_) {}
  }

  if (!targetQuest) {
    return {
      status: 404,
      body: {
        trang_thai: "that_bai",
        loai: "discord_run_quest",
        thong_bao: `Không tìm thấy nhiệm vụ ID ${cleanQuestId} trong tài khoản Discord này (Có thể quest chưa xuất hiện hoặc không đủ điều kiện).`
      }
    };
  }

  const qName = getQuestDisplayName(targetQuest);

  // Chặn sớm: Discord vẫn trả quest đã hết hạn trong danh sách — chạy sẽ 404
  const _expAt = questConfig(targetQuest)?.expires_at || questConfig(targetQuest)?.expiresAt;
  if (_expAt && !Number.isNaN(Date.parse(_expAt)) && Date.parse(_expAt) < Date.now()) {
    return {
      status: 410,
      body: {
        trang_thai: "that_bai",
        loai: "discord_run_quest",
        thong_bao: `Nhiệm vụ "${qName}" ĐÃ HẾT HẠN trên Discord (hết hạn lúc ${new Date(_expAt).toLocaleString("vi-VN")}). Discord vẫn liệt kê quest hết hạn trong danh sách. Hãy bấm "Gửi Request" để tải lại danh sách mới nhất.`,
        ket_qua: { id_nhiem_vu: cleanQuestId, ten_nhiem_vu: qName, da_het_han: true }
      }
    };
  }

  const userStatus = targetQuest.user_status || targetQuest.userStatus || {};

  // Nếu đã hoàn thành từ trước
  if (userStatus.completed_at || userStatus.completedAt) {
    return {
      status: 200,
      body: {
        trang_thai: "thanh_cong",
        loai: "discord_run_quest",
        thong_bao: `Nhiệm vụ "${qName}" ĐÃ HOÀN TẤT TỪ TRƯỚC (DONE)! Bạn chỉ cần mở Discord lên và tự tay bấm "Nhận phần thưởng" (Claim Reward).`,
        ket_qua: {
          id_nhiem_vu: cleanQuestId,
          ten_nhiem_vu: qName,
          da_hoan_thanh: true,
          da_nhan_thuong: Boolean(userStatus.claimed_at || userStatus.claimedAt),
          trang_thai: "DONE",
          huong_dan_nhan_thuong: "Mở Discord > Cài đặt (Settings) > Nhiệm vụ (Quests) hoặc kênh chat > Bấm 'Nhận phần thưởng' (Claim Reward)."
        }
      }
    };
  }

  // Kiểm tra tình trạng enroll
  let isEnrolled = Boolean(userStatus.enrolled_at || userStatus.enrolledAt);
  let enrolledTs = isEnrolled ? Date.parse(userStatus.enrolled_at || userStatus.enrolledAt) / 1000 : 0;

  if (!isEnrolled) {
    try {
      const enrollRes = await fetch(`https://discord.com/api/v9/quests/${cleanQuestId}/enroll`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          location: 11,
          is_targeted: false,
          metadata_raw: null,
          metadata_sealed: null,
          traffic_metadata_raw: targetQuest.traffic_metadata_raw || null,
          traffic_metadata_sealed: targetQuest.traffic_metadata_sealed || null
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (enrollRes.status === 429) {
        const ra = Number(enrollRes.headers.get("retry-after") || 4);
        await new Promise((r) => setTimeout(r, (ra + 1) * 1000));
      } else if (enrollRes.ok) {
        isEnrolled = true;
        enrolledTs = Date.now() / 1000;
      }
    } catch (_) {}
    if (!enrolledTs) enrolledTs = Date.now() / 1000;
  }

  // Trích xuất cấu hình task
  const config = questConfig(targetQuest);
  const taskRoot = config?.task_config_v2 || config?.taskConfigV2 || config?.task_config || config?.taskConfig || {};
  const tasksObj = taskRoot.tasks || {};

  let taskType = "WATCH_VIDEO";
  let targetSeconds = 30;
  for (const tKey of ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY"]) {
    if (tasksObj[tKey]) {
      taskType = tKey;
      targetSeconds = Number(tasksObj[tKey].target) || 30;
      break;
    }
  }
  if (!tasksObj[taskType] && Object.keys(tasksObj).length > 0) {
    taskType = Object.keys(tasksObj)[0];
    targetSeconds = Number(tasksObj[taskType]?.target) || 30;
  }

  let currentSecondsDone = Number(userStatus.progress?.[taskType]?.value) || 0;
  let isDone = false;

  // Biến dùng chung cho cả 2 nhánh (video / heartbeat) và block return ở cuối
  let lastHbStatus = 0;
  let lastHbError = "";
  const hbTrace = [];
  const traceHb = (sentTs, httpStatus, respSnippet) => {
    hbTrace.push({ gui_timestamp: sentTs, http: httpStatus, discord_tra_ve: String(respSnippet || "").slice(0, 300) });
    if (hbTrace.length > 4) hbTrace.shift();
  };
  let hbCount = 0;
  const progressAtStart = Number(currentSecondsDone) || 0;

  // Xử lý nhiệm vụ Video — giả lập người xem thật:
  // timestamp tăng theo thời gian thực (~1s mỗi nhịp), số lẻ thập phân,
  // nhịp poll 3.5-4.75s như client Discord thật. Nhảy cóc +7s/số nguyên
  // bị Discord (siết anti-auto từ 04/2026) nhận diện là bot: vẫn trả 200
  // nhưng không bao giờ đánh dấu hoàn thành -> kẹt 99%.
  if (taskType === "WATCH_VIDEO" || taskType === "WATCH_VIDEO_ON_MOBILE") {
    const runStart = Date.now();
    const baseProgress = Number(currentSecondsDone) || 0;
    const deadline = runStart + 40000; // 40s — luôn trả về trước khi Vercel kill ở 60s
    let lastSentTs = 0;

    while (currentSecondsDone < targetSeconds && Date.now() < deadline) {
      const wallElapsed = (Date.now() - runStart) / 1000;
      // Tiến độ như đang xem tiếp video: điểm cũ + thời gian thực + lẻ ngẫu nhiên
      let ts = baseProgress + wallElapsed + Math.random() * 0.9;
      if (ts > targetSeconds) ts = targetSeconds;
      // Không vượt quá (thời gian từ lúc enroll + 10s)
      const maxAllowed = (Date.now() / 1000 - enrolledTs) + 10;
      if (ts > maxAllowed) ts = maxAllowed;
      // Không gửi lùi so với lần trước
      if (ts <= lastSentTs + 0.05) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      try {
        const vRes = await fetch(`https://discord.com/api/v9/quests/${cleanQuestId}/video-progress`, {
          method: "POST",
          headers,
          body: JSON.stringify({ timestamp: Math.round(ts * 100) / 100 }),
          signal: AbortSignal.timeout(8000)
        });
        lastHbStatus = vRes.status;
        if (vRes.status === 200) {
          const vData = await vRes.json().catch(() => ({}));
          traceHb(Math.round(ts * 100) / 100, 200, JSON.stringify(vData).slice(0, 300));
          const taskProg = (vData.progress && vData.progress[taskType]) || {};
          if (vData.completed_at || taskProg.completed_at) {
            isDone = true;
            currentSecondsDone = targetSeconds;
            break;
          }
          if (taskProg.value != null) {
            currentSecondsDone = Number(taskProg.value);
          } else {
            currentSecondsDone = Math.min(targetSeconds, ts);
          }
          lastSentTs = ts;
          if (currentSecondsDone >= targetSeconds) {
            isDone = true;
            break;
          }
        } else if (vRes.status === 429) {
          const ra = Number(vRes.headers.get("retry-after") || 3);
          await new Promise((r) => setTimeout(r, (ra + 1) * 1000));
          continue;
        } else {
          let snippet = "";
          try { snippet = String(await vRes.text() || ""); } catch (_) { snippet = ""; }
          lastHbError = snippet.slice(0, 200);
          traceHb(Math.round(ts * 100) / 100, vRes.status, snippet.slice(0, 300));
        }
      } catch (e) {
        lastHbError = String((e && e.message) || e || "").slice(0, 200);
      }
      if (currentSecondsDone >= targetSeconds || isDone) break;
      // Nhịp poll như client Discord thật: 3.5 - 4.75s
      await new Promise((r) => setTimeout(r, 3500 + Math.random() * 1250));
    }

    // Chốt mốc cuối: gửi đúng targetSeconds tối đa 2 lần
    if (!isDone && currentSecondsDone < targetSeconds) {
      for (let attempt = 0; attempt < 2 && !isDone; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        try {
          const finalRes = await fetch(`https://discord.com/api/v9/quests/${cleanQuestId}/video-progress`, {
            method: "POST",
            headers,
            body: JSON.stringify({ timestamp: Math.ceil(targetSeconds) }),
            signal: AbortSignal.timeout(6000)
          });
          lastHbStatus = finalRes.status;
          if (finalRes.ok) {
            const body = await finalRes.json().catch(() => ({}));
            const tp = (body.progress && body.progress[taskType]) || {};
            if (body.completed_at || tp.completed_at || (tp.value != null && Number(tp.value) >= targetSeconds)) {
              isDone = true;
              currentSecondsDone = targetSeconds;
            }
          } else {
            try { lastHbError = String(await finalRes.text() || "").slice(0, 200); } catch (_) { lastHbError = ""; }
          }
        } catch (e) {
          lastHbError = String((e && e.message) || e || "").slice(0, 200);
        }
      }
    }

    // Kiểm tra lại trạng thái thực tế từ Discord @me để tránh bị kẹt 99%
    try {
      const checkRes = await discordGet("https://discord.com/api/v9/quests/@me", headers);
      const checkQuests = (checkRes.ok && checkRes.data?.quests) || [];
      const found = checkQuests.find((q) => String(q.id) === cleanQuestId || String(q.config?.id) === cleanQuestId);
      if (found?.user_status?.completed_at) {
        isDone = true;
        currentSecondsDone = targetSeconds;
      } else if (found?.user_status?.progress?.[taskType]?.value != null) {
        const val = Number(found.user_status.progress[taskType].value);
        if (val > currentSecondsDone) currentSecondsDone = val;
        if (currentSecondsDone >= targetSeconds) isDone = true;
      }
    } catch (_) {}
  } else {
    // Nhiệm vụ Heartbeat (Play / Stream / Activity):
    // Discord tính tiến độ theo THỜI GIAN THỰC giữa các heartbeat, nên 1 heartbeat
    // duy nhất không đủ. Gửi lặp lại mỗi ~15s trong ~45s (giới hạn 60s của Vercel).
    // Mỗi lượt chạy cộng dồn ~45s tiến độ — quest 15 phút cần chạy nhiều lượt.
    const hbStart = Date.now();
    const hbDeadline = hbStart + 45000;
    const pid = Math.floor(Math.random() * 20000) + 1000;
    const streamKey = taskType === "PLAY_ACTIVITY" ? "call:0:1" : `call:0:${pid}`;
    while (Date.now() < hbDeadline && !isDone) {
      const isTerminal = (currentSecondsDone + 20 >= targetSeconds);
      try {
        const hbRes = await fetch(`https://discord.com/api/v9/quests/${cleanQuestId}/heartbeat`, {
          method: "POST",
          headers,
          body: JSON.stringify({ stream_key: streamKey, terminal: isTerminal }),
          signal: AbortSignal.timeout(8000)
        });
        lastHbStatus = hbRes.status;
        hbCount++;
        if (hbRes.ok) {
          const hbData = await hbRes.json().catch(() => ({}));
          traceHb(`hb#${hbCount}`, 200, JSON.stringify(hbData).slice(0, 300));
          if (hbData.completed_at) isDone = true;
          const pv = hbData.progress?.[taskType]?.value;
          if (pv != null) {
            currentSecondsDone = Number(pv);
            if (currentSecondsDone >= targetSeconds) isDone = true;
          }
        } else {
          let snippet = "";
          try { snippet = String(await hbRes.text() || ""); } catch (_) { snippet = ""; }
          lastHbError = snippet.slice(0, 200);
          traceHb(`hb#${hbCount}`, hbRes.status, snippet.slice(0, 300));
          if (hbRes.status === 429) {
            const ra = Number(hbRes.headers.get("retry-after") || 5);
            await new Promise((r) => setTimeout(r, (ra + 1) * 1000));
            continue;
          }
        }
      } catch (e) {
        lastHbError = String((e && e.message) || e || "").slice(0, 200);
      }
      if (isDone || currentSecondsDone >= targetSeconds) break;
      await new Promise((r) => setTimeout(r, 15000));
    }
  }

  const isActuallyCompleted = isDone || (targetSeconds > 0 && currentSecondsDone >= targetSeconds);
  const remainingSecs = Math.max(0, targetSeconds - Math.round(currentSecondsDone));
  const percentDone = targetSeconds > 0
    ? (isActuallyCompleted ? 100 : Math.min(99, Math.round((currentSecondsDone / targetSeconds) * 100)))
    : (isActuallyCompleted ? 100 : 0);
  const reward = rewardSummary(config, true);
  const expiredErr = /expired/i.test(lastHbError || "");
  const failReason = !isActuallyCompleted
    ? (expiredErr
      ? "Discord báo quest ĐÃ HẾT HẠN (Quest has expired). Hãy bấm \"Gửi Request\" để tải danh sách quest mới nhất."
      : lastHbStatus === 429
      ? "Discord đang giới hạn request (HTTP 429). Hãy đợi vài phút rồi bấm Chạy ngay để thử lại."
      : lastHbStatus
        ? `Discord từ chối heartbeat cuối (HTTP ${lastHbStatus}). Quest này có thể yêu cầu xem video thật hoặc tài khoản đang bị giới hạn, hãy thử lại sau.`
        : (/WATCH|VIDEO/.test(taskType)
          ? "Discord chưa ghi nhận đủ tiến độ trong thời gian chạy (có thể do mạng chậm hoặc quest yêu cầu xem video thật). Hãy bấm Chạy ngay để thử tiếp."
          : `Quest game/activity tính tiến độ theo thời gian thực — mỗi lượt chạy cộng dồn ~45s (lượt này: +${Math.max(0, Math.round(currentSecondsDone - progressAtStart))}s, tổng ${Math.round(currentSecondsDone)}/${targetSeconds}s). Hãy bấm "Chạy ngay" chạy tiếp nhiều lượt cho đến khi đủ số phút yêu cầu.`)
      )
    : "";

  return {
    status: 200,
    body: {
      trang_thai: "thanh_cong",
      loai: "discord_run_quest",
      thong_bao: isActuallyCompleted
        ? `ĐÃ CHẠY HOÀN THÀNH NHIỆM VỤ THÀNH CÔNG (DONE 100%)! Hệ thống không tự nhận thưởng, bạn vui lòng mở Discord để tự tay bấm "Nhận phần thưởng" (Claim Reward) an toàn 100%.`
        : `Chưa thể hoàn tất nhiệm vụ (${currentSecondsDone}/${targetSeconds}s - ${percentDone}%). ${failReason}`,
      ket_qua: {
        id_nhiem_vu: cleanQuestId,
        ten_nhiem_vu: qName,
        game: config.application?.name || config.messages?.game_title || null,
        loai_nhiem_vu: QUEST_TASK_NAMES[taskType] || taskType,
        loai_task: taskType,
        loi_heartbeat_cuoi: lastHbStatus || null,
        chi_tiet_loi: lastHbError || null,
        ly_do_chua_xong: failReason || null,
        debug_heartbeat: hbTrace,
        thoi_gian_yeu_cau: `${targetSeconds} giây`,
        thoi_gian_yeu_cau_giay: targetSeconds,
        tien_do_giay: currentSecondsDone,
        tien_do_phan_tram: percentDone,
        con_lai_giay: remainingSecs,
        tien_do_hien_tai: `${Math.min(targetSeconds, Math.round(currentSecondsDone))}/${targetSeconds}s (${percentDone}%)`,
        da_hoan_thanh: isActuallyCompleted,
        da_nhan_thuong: false,
        orbs_du_kien: reward.orbs || reward.orbs_goc || null,
        trang_thai: isActuallyCompleted ? "DONE (Chờ bạn vào Discord tự nhận thưởng)" : "Đang tiến hành",
        huong_dan_nhan_thuong: "1. Mở Discord trên máy tính hoặc điện thoại (nhớ bật VPN Mỹ nếu là quest game của khu vực Mỹ).\n2. Vào Cài đặt (Settings) > Quests (Nhiệm vụ) hoặc góc dưới bên trái.\n3. Nhấn nút 'Nhận phần thưởng' (Claim Reward) để nhận Orbs chính chủ an toàn tuyệt đối."
      }
    }
  };
}

function mapQuest(quest, hasNitro, fromClaimed = false, rawToken = null) {
  const config = questConfig(quest);
  const messages = config.messages || {};
  const status = quest?.user_status || quest?.userStatus || null;
  const reward = rewardSummary(config, hasNitro);
  const tasks = questTasks(config, status);
  const accepted = Boolean(status?.enrolled_at || status?.enrolledAt) || fromClaimed;
  const completed = Boolean(status?.completed_at || status?.completedAt) || fromClaimed;
  const claimed = Boolean(status?.claimed_at || status?.claimedAt) || fromClaimed;
  const expiresAt = config.expires_at || config.expiresAt || null;
  const startsAt = config.starts_at || config.startsAt || null;
  const isExpired = Boolean(expiresAt) && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) < Date.now();
  let trangThai = "Chưa nhận";
  if (claimed) trangThai = "Đã nhận thưởng";
  else if (completed) trangThai = "Đã xong, chưa nhận thưởng";
  else if (isExpired) trangThai = "Đã hết hạn";
  else if (accepted) trangThai = "Đang làm";
  const expires = expiresAt ? new Date(expiresAt) : null;
  const remaining = expires && !Number.isNaN(expires.getTime()) ? Math.ceil((expires.getTime() - Date.now()) / 86400000) : null;
  const description = messages.quest_description || messages.description || tasks.find((task) => task.mo_ta)?.mo_ta || null;
  const qId = quest?.id || config.id || null;
  const questCode = (qId && rawToken) ? `RUN_QUEST:${qId}:${rawToken}` : null;
  const canAutoRun = !claimed && (tasks.length === 0 || tasks.some((t) => /WATCH|VIDEO|PLAY|STREAM|ACTIVITY/i.test(t.ma || "")));

  return {
    id: qId,
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
    da_het_han: isExpired,
    ma_chay_nhiem_vu: !claimed ? questCode : null,
    ho_tro_tu_chay: canAutoRun,
    loai_chay: tasks.some((t) => /WATCH|VIDEO/i.test(t.ma || "")) ? "Xem video quảng cáo tự động (15-30s)" : "Tự động gửi heartbeat",
    huong_dan_chay: !claimed ? "Copy chuỗi 'ma_chay_nhiem_vu' này dán lại vào ô kiểm tra Discord để hệ thống tự chạy video quảng cáo (báo DONE), sau đó tự tay vào Discord nhận thưởng." : null,
    cu_phap_api: questCode ? `https://{domain}/api/mxh/discord?quest=${encodeURIComponent(questCode)}` : null,
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

function summarizeQuests(currentHit, claimedHit, hasNitro, rawToken = null) {
  const current = currentHit.ok && currentHit.data && typeof currentHit.data === "object" ? currentHit.data : {};
  const claimedBody = claimedHit.ok && claimedHit.data && typeof claimedHit.data === "object" ? claimedHit.data : {};
  const available = (Array.isArray(current.quests) ? current.quests : []).map((quest) => mapQuest(quest, hasNitro, false, rawToken));
  const claimed = (Array.isArray(claimedBody.quests) ? claimedBody.quests : []).map((quest) => mapQuest(quest, hasNitro, true, rawToken));
  // Quest còn hạn xếp trước (theo hạn tăng dần), quest đã hết hạn xếp cuối để user thấy ngay quest chạy được
  available.sort((a, b) => {
    const ae = a.da_het_han ? 1 : 0, be = b.da_het_han ? 1 : 0;
    if (ae !== be) return ae - be;
    return Date.parse(a.ket_thuc || 0) - Date.parse(b.ket_thuc || 0);
  });
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

  const parsedUrl = new URL(req.url, "https://localhost");
  const qObj = req.query && typeof req.query === "object" ? req.query : {};
  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";

  let tokenParam = qObj.token || parsedUrl.searchParams.get("token") || null;
  let questParam = qObj.quest || qObj.quest_id || parsedUrl.searchParams.get("quest") || parsedUrl.searchParams.get("quest_id") || null;
  let idParam = qObj.id || parsedUrl.searchParams.get("id") || null;
  let inviteParam = qObj.invite || parsedUrl.searchParams.get("invite") || null;
  let userParam = qObj.user || parsedUrl.searchParams.get("user") || null;
  let defParam = qObj[""] || parsedUrl.searchParams.get("") || null;

  let query = tokenParam || questParam || idParam || inviteParam || userParam || defParam || null;

  if (!query && rawQuery) {
    const firstPart = rawQuery.replace(/^=/, "").split("&")[0];
    query = decodeURIComponent(firstPart).trim();
    if (/^[a-zA-Z0-9_-]+=/.test(query)) {
      query = query.replace(/^[a-zA-Z0-9_-]+=/, "").trim();
    }
  }

  if (query) {
    query = query.replace(/^(?:token|quest|quest_id|id|invite|user)\s*[:=]\s*/i, "").trim();
  }

  // -------------------------------------------------------------
  // TRƯỜNG HỢP ĐẶC BIỆT: CHẠY NHIỆM VỤ ORBS / VIDEO DISCORD
  // -------------------------------------------------------------
  let isQuestRun = false;
  let runQuestId = null;
  let runToken = null;

  const questCodePattern = /(?:RUN_QUEST|DISCORD_QUEST|QUEST)\s*[:=]\s*(\d{16,22})\s*[:|=,]\s*([^\s&"']+)/i;
  const questMatch = (query && query.match(questCodePattern)) || (rawQuery && decodeURIComponent(rawQuery).match(questCodePattern));

  if (questMatch) {
    isQuestRun = true;
    runQuestId = questMatch[1].trim();
    runToken = questMatch[2].trim();
  } else if ((req.query.quest_id || req.query.quest || parsedUrl.searchParams.get("quest_id") || parsedUrl.searchParams.get("quest")) && (req.query.token || parsedUrl.searchParams.get("token") || (query && query.includes(".")))) {
    isQuestRun = true;
    runQuestId = (req.query.quest_id || req.query.quest || parsedUrl.searchParams.get("quest_id") || parsedUrl.searchParams.get("quest") || "").trim();
    runToken = (req.query.token || parsedUrl.searchParams.get("token") || query || "").trim();
  } else if (/^(?:RUN_QUEST_|QUEST_RUN_)/i.test(query || "")) {
    try {
      const b64 = (query || "").replace(/^(?:RUN_QUEST_|QUEST_RUN_)/i, "").trim();
      const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      if (payload.token && (payload.quest_id || payload.q || payload.id)) {
        isQuestRun = true;
        runQuestId = String(payload.quest_id || payload.q || payload.id).trim();
        runToken = String(payload.token).trim();
      }
    } catch (_) {}
  }

  if (isQuestRun && runQuestId && runToken) {
    const region = (req.query.region || req.query.khu_vuc || parsedUrl.searchParams.get("region") || parsedUrl.searchParams.get("khu_vuc") || "US").toUpperCase();
    const result = await executeDiscordQuest(runToken, runQuestId, region);
    return res.status(result.status).json(result.body);
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Token Discord, User ID, Link/Mã mời Server hoặc Mã chạy nhiệm vụ (RUN_QUEST).",
      cu_phap: {
        check_token: "https://{domain}/api/mxh/discord?token={discord_token}",
        run_quest: "https://{domain}/api/mxh/discord?quest=RUN_QUEST:{quest_id}:{discord_token}",
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

      const region = (req.query.region || req.query.khu_vuc || parsedUrl.searchParams.get("region") || parsedUrl.searchParams.get("khu_vuc") || "US").toUpperCase();
      const headers = authHeaders(authorization, browserHeaders);
      const userAccount = kieuToken === "user";
      const desktopQuestHeaders = userAccount ? await getQuestHeaders(authorization, region) : headers;
      const [profileHit, guilds, connectionsHit, subscriptionHit, slotHit, paymentHit, settingsHit, applicationHit, questHit, claimedHit, orbHit, rewardHit] = await Promise.all([
        discordGet("https://discord.com/api/v9/users/@me/profile", headers),
        fetchAllGuilds(headers),
        discordGet("https://discord.com/api/v9/users/@me/connections", headers),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/billing/subscriptions", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/guilds/premium/subscription-slots", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/billing/payment-sources", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/settings", headers) : Promise.resolve({ ok: false, data: null }),
        kieuToken === "bot" ? discordGet("https://discord.com/api/v9/oauth2/applications/@me", headers) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/quests/@me", desktopQuestHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/quests/@me/claimed", desktopQuestHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/virtual-currency/balance", desktopQuestHeaders) : Promise.resolve({ ok: false, data: null }),
        userAccount ? discordGet("https://discord.com/api/v9/users/@me/program-rewards", desktopQuestHeaders) : Promise.resolve({ ok: false, data: null })
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
          khu_vuc_quet: region,
          orbs: summarizeOrbs(orbHit, rewardHit, u.premium_type === 1 || u.premium_type === 2),
          nhiem_vu: summarizeQuests(questHit, claimedHit, u.premium_type === 1 || u.premium_type === 2, parsed.token),
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