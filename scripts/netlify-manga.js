/**
 * Công cụ tự động đăng truyện lên Netlify và bảo vệ ảnh (Chặn 403 toàn bộ Internet, chỉ mở cho web chỉ định)
 * Sử dụng Netlify Token: nfp_BkhSuHWnWc3JynUgXCV139remW2ssJY67fd4
 */
const fs = require("fs");
const path = require("path");
const { createZipBuffer } = require("../lib/zip.js");

const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN || "nfp_BkhSuHWnWc3JynUgXCV139remW2ssJY67fd4";
const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

const headers = {
  Authorization: `Bearer ${NETLIFY_TOKEN}`,
  "User-Agent": "ZheeDev-MangaDeploy/1.0"
};

// 1. Lấy danh sách sites
async function listSites() {
  const res = await fetch(`${NETLIFY_API_BASE}/sites?per_page=100`, { headers });
  if (!res.ok) throw new Error(`Lỗi lấy sites: ${res.status} ${await res.text()}`);
  const sites = await res.json();
  return sites.map(s => ({ id: s.id, name: s.name, url: s.ssl_url || s.url }));
}

// 2. Tìm site theo tên hoặc ID
async function findSite(siteNameOrId) {
  const sites = await listSites();
  return sites.find(s => s.id === siteNameOrId || s.name === siteNameOrId);
}

// 3. Tạo site mới nếu chưa có
async function createSite(siteName) {
  const body = siteName ? JSON.stringify({ name: siteName }) : JSON.stringify({});
  const res = await fetch(`${NETLIFY_API_BASE}/sites`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body
  });
  if (!res.ok) throw new Error(`Lỗi tạo site: ${res.status} ${await res.text()}`);
  return await res.json();
}

// 4. Tạo mã Edge Function chặn 403 Hotlinking
function generateProtectEdgeFunction(allowedDomains = []) {
  const domainsJson = JSON.stringify(allowedDomains.map(d => d.trim().toLowerCase()).filter(Boolean));
  return `export default async (request, context) => {
  const url = new URL(request.url);

  // Cho phép trang chủ hiển thị thông tin trạng thái
  if (url.pathname === "/" || url.pathname === "/favicon.ico") {
    return new Response("Manga CDN - 403 Hotlink Protection Active", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const referer = request.headers.get("referer") || "";
  const allowedDomains = ${domainsJson};

  // Nếu không chỉ định domain nào, mặc định chặn tất cả
  if (!allowedDomains || allowedDomains.length === 0) {
    return new Response(JSON.stringify({ error: "403 Forbidden: No domain whitelisted" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  // Kiểm tra referer xem có chứa domain của hosting chỉ định không
  const isAllowed = allowedDomains.some(domain => referer.toLowerCase().includes(domain));

  if (!isAllowed) {
    return new Response(
      JSON.stringify({
        status: 403,
        error: "Forbidden",
        message: "Truy cap bi chan (403 Forbidden). Chi co trang web truyen chi dinh moi duoc xem anh!"
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*"
        }
      }
    );
  }

  return context.next();
};
`;
}

// 5. Đọc đệ quy toàn bộ file trong thư mục
function getFilesRecursively(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\\\/g, "/");
      results.push({
        path: relPath,
        fullPath
      });
    }
  }
  return results;
}

// 6. Đăng bộ truyện lên Netlify
async function deployManga({ folderPath, siteNameOrId, allowedDomains = [] }) {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Thư mục không tồn tại: ${folderPath}`);
  }

  console.log(`[1/5] Đang kiểm tra site Netlify: ${siteNameOrId}...`);
  let site = await findSite(siteNameOrId);
  if (!site) {
    console.log(`Không tìm thấy site "${siteNameOrId}", đang tự động tạo site mới...`);
    site = await createSite(siteNameOrId);
  }
  console.log(`✓ Đã kết nối site: ${site.name} (${site.url})`);

  console.log(`[2/5] Đang quét các file ảnh trong thư mục: ${folderPath}...`);
  const localFiles = getFilesRecursively(folderPath);
  console.log(`✓ Tìm thấy ${localFiles.length} file.`);

  // Đóng gói các file thành zip buffer
  const zipFiles = [];
  const imageUrls = [];

  for (const item of localFiles) {
    const data = fs.readFileSync(item.fullPath);
    zipFiles.push({
      name: item.path,
      data
    });
    imageUrls.push(`${site.url}/${item.path}`);
  }

  // Tự động tạo netlify.toml và Edge Function bảo vệ 403
  console.log(`[3/5] Đang cấu hình bảo mật 403 Forbidden cho domain: ${allowedDomains.join(", ") || "(chặn tất cả)"}...`);
  const netlifyToml = `[[edge_functions]]
  path = "/*"
  function = "protect"
`;
  const edgeFunctionCode = generateProtectEdgeFunction(allowedDomains);

  zipFiles.push({
    name: "netlify.toml",
    data: Buffer.from(netlifyToml, "utf8")
  });
  zipFiles.push({
    name: "netlify/edge-functions/protect.js",
    data: Buffer.from(edgeFunctionCode, "utf8")
  });

  console.log(`[4/5] Đang nén file zip...`);
  const zipBuffer = createZipBuffer(zipFiles);
  console.log(`✓ Dung lượng gói deploy: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  console.log(`[5/5] Đang tải lên Netlify qua API...`);
  const deployRes = await fetch(`${NETLIFY_API_BASE}/sites/${site.id}/deploys`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/zip"
    },
    body: zipBuffer
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    throw new Error(`Lỗi deploy: ${deployRes.status} ${errText}`);
  }

  const deployData = await deployRes.json();
  console.log(`\n🎉 ĐĂNG TRUYỆN THÀNH CÔNG!`);
  console.log(`- Trạng thái: ${deployData.state}`);
  console.log(`- Deploy ID: ${deployData.id}`);
  console.log(`- Site URL: ${site.url}`);
  console.log(`- Chặn 403: Đã kích hoạt cho toàn bộ Internet. Chỉ domain sau được load ảnh: [${allowedDomains.join(", ")}]`);
  console.log(`\nDanh sách link ảnh:`);
  imageUrls.forEach((url, i) => console.log(` [${i + 1}] ${url}`));

  return {
    success: true,
    site,
    deployId: deployData.id,
    imageUrls
  };
}

// CLI handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(`
=== CÔNG CỤ TỰ ĐỘNG ĐĂNG TRUYỆN TRANH LÊN NETLIFY ===
(Bảo mật 403 Forbidden - Chỉ cho phép web chỉ định truy cập)

Cách dùng:
  1. Xem danh sách các site hiện có:
     node scripts/netlify-manga.js list

  2. Tạo một site mới:
     node scripts/netlify-manga.js create <tên-site>

  3. Đăng truyện (tự nén, tự cài chặn 403, tự đẩy lên):
     node scripts/netlify-manga.js upload --folder <thư-mục-ảnh> --site <tên-site> --domain <tên-miền-web-của-bạn>

Ví dụ:
  node scripts/netlify-manga.js upload --folder ./chap-1 --site api-doctruyen210 --domain doctruyen.com,api-zhee.vercel.app
`);
    return;
  }

  if (command === "list") {
    console.log("Đang lấy danh sách các site Netlify...");
    const sites = await listSites();
    console.table(sites.map(s => ({ "Tên site": s.name, "ID": s.id, "URL": s.url })));
    return;
  }

  if (command === "create") {
    const name = args[1];
    console.log(`Đang tạo site mới: ${name || "tự tạo tên ngẫu nhiên"}...`);
    const site = await createSite(name);
    console.log(`✓ Đã tạo thành công site: ${site.name} (ID: ${site.id}) -> ${site.ssl_url || site.url}`);
    return;
  }

  if (command === "upload") {
    let folder = "";
    let site = "api-doctruyen210";
    let domains = [];

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--folder" && args[i + 1]) folder = args[i + 1];
      if (args[i] === "--site" && args[i + 1]) site = args[i + 1];
      if (args[i] === "--domain" && args[i + 1]) domains = args[i + 1].split(",");
    }

    if (!folder) {
      console.error("Vui lòng cung cấp đường dẫn thư mục ảnh: --folder <đường dẫn>");
      process.exit(1);
    }

    await deployManga({
      folderPath: folder,
      siteNameOrId: site,
      allowedDomains: domains
    });
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Thất bại:", err.message);
    process.exit(1);
  });
}

module.exports = {
  listSites,
  createSite,
  deployManga,
  generateProtectEdgeFunction
};
