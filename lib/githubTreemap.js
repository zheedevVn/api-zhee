/**  * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.  * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.  * ZheeDevTool-Signed-2026  */
require("./zheeProtect.js").verifyOrThrow();
const { kvGetJson, kvSetJson } = require("./licenseStore");

const CACHE_TTL = 3600;
const MAX_FILES = 100000;

function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}
function ghHeaders() {
  const h = { "User-Agent": "ZheeAPI-Treemap", "Accept": "application/vnd.github+json" };
  const tok = String(process.env.GITHUB_TOKEN || "").trim();
  if (tok) h.Authorization = "Bearer " + tok;
  return h;
}
function parseRepo(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  s = s.replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
  const m = s.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (m) return { owner: m[1], repo: m[2] };
  const m2 = s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (m2) return { owner: m2[1], repo: m2[2] };
  return null;
}
async function ghJson(url) {
  const r = await fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) throw fail("Không tìm thấy repo (riêng tư hoặc không tồn tại).", 404);
  if (r.status === 403 && String(j.message || "").includes("rate limit")) {
    throw fail("GitHub giới hạn truy vấn (60/h). Thử lại sau hoặc thêm GITHUB_TOKEN vào server.", 429);
  }
  if (!r.ok) throw fail("GitHub API lỗi: " + (j.message || r.status), 502);
  return j;
}
function buildTree(entries) {
  const root = { name: "/", path: "", size: 0, type: "dir", children: [], files: 0, dirs: 0 };
  const dirs = { "": root };
  const sorted = entries.slice().sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const e of sorted) {
    if (e.type !== "blob") continue;
    const parts = e.path.split("/");
    const fname = parts.pop();
    const dpath = parts.join("/");
    let parent = dirs[dpath];
    if (!parent) {
      let cur = "";
      for (const p of parts) {
        const prev = cur;
        cur = cur ? cur + "/" + p : p;
        if (!dirs[cur]) {
          const node = { name: p, path: cur, size: 0, type: "dir", children: [], files: 0, dirs: 0 };
          dirs[cur] = node;
          (dirs[prev] || root).children.push(node);
        }
      }
      parent = dirs[dpath];
    }
    const f = { name: fname, path: e.path, size: e.size || 0, type: "file" };
    parent.children.push(f);
  }
  (function agg(n) {
    if (n.type === "file") return n.size;
    let s = 0, f = 0, d = 0;
    for (const c of n.children) {
      s += agg(c);
      if (c.type === "file") f += 1;
      else { d += 1; f += c.files; d += c.dirs; }
    }
    n.size = s; n.files = f; n.dirs = d;
    n.children.sort((a, b) => b.size - a.size);
    return s;
  })(root);
  root.files = root.children.reduce((a, c) => a + (c.type === "file" ? 1 : c.files), 0);
  return root;
}
function extStats(root) {
  const map = {};
  (function walk(n) {
    if (n.type === "file") {
      const i = n.name.lastIndexOf(".");
      const ext = i > 0 ? n.name.slice(i).toLowerCase() : "(không đuôi)";
      const e = map[ext] || (map[ext] = { ext, size: 0, files: 0 });
      e.size += n.size; e.files += 1;
    } else if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  })(root);
  return Object.values(map).sort((a, b) => b.size - a.size);
}
function prune(node, maxChildren = 60, depth = 0) {
  if (node.type === "file" || depth > 5) return node;
  if (node.children.length > maxChildren) {
    const top = node.children.slice(0, maxChildren - 1);
    const rest = node.children.slice(maxChildren - 1);
    let size = 0, files = 0;
    for (const r of rest) { size += r.size; files += r.type === "file" ? 1 : r.files; }
    top.push({ name: `… (${rest.length} mục)`, path: node.path, size, type: "other", files });
    node.children = top;
  }
  for (const c of node.children) if (c.type === "dir") prune(c, maxChildren, depth + 1);
  return node;
}

async function analyzeRepo(owner, repo) {
  const key = `zhee:github:treemap:${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const cached = await kvGetJson(key).catch(() => null);
  if (cached) return { ...cached, cached: true };
  const info = await ghJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (info.private) throw fail("Repo riêng tư — không phân tích được.", 403);
  const branch = info.default_branch || "main";
  const tree = await ghJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const entries = Array.isArray(tree.tree) ? tree.tree : [];
  if (tree.truncated) throw fail("Repo quá lớn (>100k file), GitHub không trả đủ dữ liệu.", 413);
  if (entries.length > MAX_FILES) throw fail("Repo quá lớn để phân tích.", 413);
  const root = prune(buildTree(entries));
  const result = {
    trang_thai: "thanh_cong",
    repo: { owner, name: repo, branch, stars: info.stargazers_count || 0, forks: info.forks_count || 0, url: info.html_url },
    tong_dung_luong: root.size,
    tong_file: root.files,
    tong_thu_muc: root.dirs,
    cay_thu_muc: root,
    theo_duoi: extStats(root).slice(0, 40)
  };
  await kvSetJson(key, result, CACHE_TTL).catch(() => {});
  return result;
}

async function handleApi(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.query || {};
    const input = q.repo || q.url || q[""] || "";
    const p = parseRepo(input);
    if (!p) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Nhập link repo hoặc owner/repo.",
        vi_du: "/api/github/treemap?repo=zheedevVn/api-zhee"
      });
    }
    const data = await analyzeRepo(p.owner, p.repo);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 500).json({ trang_thai: "that_bai", thong_bao: e.message || "Lỗi máy chủ." });
  }
}


function treemapPage() {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GitHub Treemap — Phân tích repo kiểu WizTree</title>
<meta name="description" content="Dán link GitHub repo bất kỳ, xem treemap dung lượng file/thư mục kiểu WizTree.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#07070f;color:#e8e8f2;min-height:100vh}
.bg{position:fixed;inset:0;pointer-events:none;background:radial-gradient(600px 400px at 15% 0%,rgba(99,102,241,.12),transparent 60%),radial-gradient(700px 450px at 85% 20%,rgba(168,85,247,.1),transparent 60%)}
.top{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:34px 20px 10px}
h1{font-size:clamp(24px,4vw,34px);font-weight:900;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#818cf8);background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:flow 6s linear infinite;margin-bottom:6px}
@keyframes flow{to{background-position:300% center}}
.top p{color:#9aa0b8;font-size:13.5px;margin-bottom:18px}
.bar{display:flex;gap:10px;flex-wrap:wrap}
.bar input{flex:1;min-width:240px;padding:13px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;font-size:14px;outline:none}
.bar input:focus{border-color:#818cf8}
.bar button{padding:13px 26px;border-radius:12px;border:none;font-weight:800;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;box-shadow:0 8px 24px rgba(124,58,237,.4)}
.bar button:hover{transform:translateY(-1px)}
.bar button:disabled{opacity:.5;cursor:wait;transform:none}
.meta{display:flex;gap:18px;flex-wrap:wrap;margin:16px 0 6px;font-size:13px;color:#9aa0b8}
.meta b{color:#fff;font-size:15px}
.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#fca5a5;padding:13px 16px;border-radius:12px;font-size:13.5px;margin:14px 0;display:none}
.main{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:10px 20px 60px;display:none}
.crumb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;margin:8px 0 12px;color:#9aa0b8}
.crumb button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#c6cbdE;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12.5px}
.crumb button:hover{border-color:#818cf8;color:#fff}
.crumb button.cur{background:rgba(99,102,241,.2);border-color:#818cf8;color:#fff;font-weight:700}
.grid{display:grid;grid-template-columns:1fr 300px;gap:16px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.tmap{position:relative;width:100%;height:70vh;min-height:420px;background:#0a0a16;border:1px solid rgba(255,255,255,.09);border-radius:16px;overflow:hidden}
.cell{position:absolute;overflow:hidden;border:1px solid rgba(0,0,0,.45);cursor:pointer;transition:filter .12s}
.cell:hover{filter:brightness(1.25)}
.cell.dir{cursor:pointer}
.cell .lb{position:absolute;top:0;left:0;right:0;padding:3px 6px;font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent)}
.cell .sz{position:absolute;bottom:2px;right:5px;font-size:10px;color:rgba(255,255,255,.85);text-shadow:0 1px 2px rgba(0,0,0,.8);pointer-events:none}
.inner{position:absolute;overflow:hidden}
.tip{position:fixed;z-index:50;pointer-events:none;background:rgba(10,10,22,.95);border:1px solid rgba(129,140,248,.4);border-radius:10px;padding:10px 13px;font-size:12px;max-width:320px;display:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.tip .p{color:#fff;font-weight:700;word-break:break-all;margin-bottom:4px}
.tip .s{color:#a5b4fc}
.panel{background:rgba(21,28,40,.75);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:18px;max-height:70vh;overflow-y:auto}
.panel h3{font-size:13px;text-transform:uppercase;letter-spacing:1.2px;color:#7c8598;margin-bottom:12px}
.erow{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;font-size:12.5px;cursor:default}
.erow:hover{background:rgba(255,255,255,.04)}
.sw{width:14px;height:14px;border-radius:4px;flex:none}
.erow .x{font-family:ui-monospace,monospace;color:#c6cbdE;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.erow .pc{color:#7c8598;width:48px;text-align:right}
.erow .s{color:#a5b4fc;width:76px;text-align:right;font-family:ui-monospace,monospace}
.ebar{height:5px;border-radius:3px;background:rgba(255,255,255,.07);margin:2px 6px 6px 30px;overflow:hidden}
.ebar i{display:block;height:100%;border-radius:3px}
.load{display:none;text-align:center;padding:60px 20px;color:#9aa0b8;font-size:14px}
.spin{width:44px;height:44px;margin:0 auto 16px;border-radius:50%;border:3px solid rgba(129,140,248,.2);border-top-color:#818cf8;animation:sp 0.8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
footer{text-align:center;padding:30px;color:#5b6478;font-size:12px;position:relative;z-index:1}
footer b{color:#a5b4fc;letter-spacing:2px}
</style></head><body>
<div class="bg"></div>
<div class="top">
<h1>GitHub Treemap</h1>
<p>Dán link repo GitHub bất kỳ — phân tích toàn bộ cây thư mục, hiện treemap dung lượng kiểu WizTree.</p>
<div class="bar">
<input id="repoIn" placeholder="https://github.com/zheedevVn/api-zhee  hoặc  owner/repo" value="">
<button id="scanBtn" onclick="scan()">Phân tích</button>
</div>
<div class="err" id="err"></div>
<div class="meta" id="meta" style="display:none"></div>
</div>
<div class="load" id="load"><div class="spin"></div>Đang quét repo...</div>
<div class="main" id="main">
<div class="crumb" id="crumb"></div>
<div class="grid">
<div class="tmap" id="tmap"></div>
<div class="panel"><h3>Theo đuôi file</h3><div id="exts"></div></div>
</div>
</div>
<div class="tip" id="tip"></div>
<footer><b>ZHEE API</b><br>© 2026 Hồ Đức Minh</footer>
<script>
const $ = id => document.getElementById(id);
let DATA = null, PATH = [];
const EC = {'.js':'#f7df1e','.ts':'#3178c6','.jsx':'#61dafb','.tsx':'#61dafb','.json':'#c09553','.html':'#e34c26','.css':'#7c5cd6','.scss':'#c6538c','.md':'#6b7280','.txt':'#9aa0b8','.py':'#3572A5','.java':'#b07219','.go':'#00add8','.rs':'#dea584','.php':'#777bb4','.rb':'#cc342d','.c':'#555','.h':'#555','.cpp':'#f34b7d','.cs':'#178600','.swift':'#f05138','.kt':'#7f52ff','.png':'#a855f7','.jpg':'#a855f7','.jpeg':'#a855f7','.gif':'#a855f7','.svg':'#c084fc','.ico':'#c084fc','.webp':'#a855f7','.mp4':'#ef4444','.mp3':'#f59e0b','.wav':'#f59e0b','.zip':'#10b981','.tar':'#10b981','.gz':'#10b981','.pdf':'#dc2626','.ttf':'#14b8a6','.woff':'#14b8a6','.woff2':'#14b8a6','.yml':'#cb171e','.yaml':'#cb171e','.toml':'#9c4221','.lock':'#5b6478','.env':'#5b6478','.gitignore':'#5b6478','.sh':'#4ade80','.sql':'#e38c00','.vue':'#41b883'};
function hue(ext){let h=0;for(const c of ext)h=(h*31+c.charCodeAt(0))%360;return 'hsl('+h+',55%,45%)'}
function color(n){if(n.type==='dir')return 'rgba(99,102,241,.28)';if(n.type==='other')return '#3a3f52';const i=n.name.lastIndexOf('.');const e=i>0?n.name.slice(i).toLowerCase():'';return EC[e]||hue(e||'?')}
function fmt(b){if(b>=1073741824)return (b/1073741824).toFixed(2)+' GB';if(b>=1048576)return (b/1048576).toFixed(2)+' MB';if(b>=1024)return (b/1024).toFixed(1)+' KB';return b+' B'}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function layout(kids,x,y,w,h){
  const items=kids.filter(k=>k.size>0).sort((a,b)=>b.size-a.size);
  const total=items.reduce((s,k)=>s+k.size,0);
  if(!total||w<1||h<1)return;
  const sc=w*h/total;
  let row=[],cx=x,cy=y,cw=w,ch=h;
  const area=r=>r.reduce((s,n)=>s+n.size*sc,0);
  const worst=(r,side)=>{if(!r.length)return 1e9;const s=area(r);let mx=0;for(const n of r){const a=n.size*sc;mx=Math.max(mx,side*side*a/(s*s),s*s/(side*side*a))}return mx};
  const put=()=>{const s=area(row);if(cw>=ch){const rw=s/ch;let oy=cy;for(const n of row){const nh=n.size*sc/rw;Object.assign(n,{x:cx,y:oy,w:rw,h:nh});oy+=nh}cx+=rw;cw-=rw}else{const rh=s/cw;let ox=cx;for(const n of row){const nw=n.size*sc/rh;Object.assign(n,{x:ox,y:cy,w:nw,h:rh});ox+=nw}cy+=rh;ch-=rh}row=[]};
  for(const n of items){const side=Math.min(cw,ch);if(row.length&&worst([...row,n],side)>worst(row,side))put();row.push(n)}
  if(row.length)put();
}
function nodeAt(path){let n=DATA.cay_thu_muc;for(const p of path){n=(n.children||[]).find(c=>c.name===p&&c.type==='dir');if(!n)return DATA.cay_thu_muc}return n}
function draw(){
  const tmap=$('tmap');tmap.innerHTML='';
  const W=tmap.clientWidth,H=tmap.clientHeight;
  const root=nodeAt(PATH);
  const kids=(root.children||[]).slice();
  layout(kids,0,0,W,H);
  for(const k of kids)drawCell(tmap,k,0);
  const cb=$('crumb');cb.innerHTML='';
  const mk=(label,path)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{PATH=path;draw()};if(JSON.stringify(path)===JSON.stringify(PATH))b.className='cur';cb.appendChild(b)};
  mk(DATA.repo.owner+'/'+DATA.repo.name,[]);
  PATH.forEach((p,i)=>{const s=document.createElement('span');s.textContent='/';s.style.margin='0 2px';cb.appendChild(s);mk(p,PATH.slice(0,i+1))});
}
function drawCell(parent,n,depth){
  const d=document.createElement('div');
  d.className='cell'+(n.type==='dir'?' dir':'');
  d.style.cssText='left:'+n.x+'px;top:'+n.y+'px;width:'+n.w+'px;height:'+n.h+'px;background:'+color(n);
  if(n.w>46&&n.h>30){
    d.innerHTML='<div class="lb">'+esc(n.name)+'</div>'+(n.w>70&&n.h>44?'<div class="sz">'+fmt(n.size)+'</div>':'');
  }
  d.onmousemove=e=>{const t=$('tip');t.style.display='block';t.style.left=Math.min(e.clientX+14,innerWidth-340)+'px';t.style.top=(e.clientY+14)+'px';
    t.innerHTML='<div class="p">'+esc(n.path||n.name)+'</div><div class="s">'+fmt(n.size)+(n.type==='dir'?' · '+n.files+' file · '+n.dirs+' thư mục':'')+'</div>'};
  d.onmouseleave=()=>{$('tip').style.display='none'};
  if(n.type==='dir'){d.onclick=e=>{e.stopPropagation();PATH=[...PATH,n.name];draw()}}
  parent.appendChild(d);
  if(n.type==='dir'&&depth<2&&n.w>150&&n.h>110&&(n.children||[]).length){
    const pad=20,inner=document.createElement('div');
    inner.className='inner';
    inner.style.cssText='left:'+(n.x+3)+'px;top:'+(n.y+pad)+'px;width:'+(n.w-6)+'px;height:'+(n.h-pad-3)+'px';
    parent.appendChild(inner);
    const kids=n.children.slice();layout(kids,0,0,n.w-6,n.h-pad-3);
    for(const k of kids){k.x+=n.x+3;k.y+=n.y+pad;drawCell(parent,k,depth+1)}
    inner.remove();
  }
}
async function scan(){
  const v=$('repoIn').value.trim();
  if(!v){$('err').style.display='block';$('err').textContent='Nhập link repo GitHub trước.';return}
  $('err').style.display='none';$('main').style.display='none';$('meta').style.display='none';
  $('load').style.display='block';$('scanBtn').disabled=true;
  try{
    const r=await fetch('/api/github/treemap?repo='+encodeURIComponent(v));
    const j=await r.json();
    if(!r.ok||j.trang_thai!=='thanh_cong')throw new Error(j.thong_bao||'Lỗi không xác định');
    DATA=j;PATH=[];
    $('meta').style.display='flex';
    $('meta').innerHTML='<span>Repo <b>'+esc(j.repo.owner+'/'+j.repo.name)+'</b></span><span>Dung lượng <b>'+fmt(j.tong_dung_luong)+'</b></span><span><b>'+j.tong_file+'</b> file</span><span><b>'+j.tong_thu_muc+'</b> thư mục</span>'+(j.cached?'<span style="color:#5b6478">(cache)</span>':'');
    const ex=$('exts');ex.innerHTML='';
    const tot=j.tong_dung_luong||1;
    j.theo_duoi.forEach(e=>{const i=e.ext.lastIndexOf('.');const c=EC[e.ext]||hue(e.ext);
      const row=document.createElement('div');row.innerHTML='<div class="erow"><span class="sw" style="background:'+c+'"></span><span class="x">'+esc(e.ext)+'</span><span class="pc">'+(100*e.size/tot).toFixed(1)+'%</span><span class="s">'+fmt(e.size)+'</span></div><div class="ebar"><i style="width:'+(100*e.size/tot).toFixed(1)+'%;background:'+c+'"></i></div>';
      ex.appendChild(row)});
    $('main').style.display='block';
    requestAnimationFrame(draw);
  }catch(e){$('err').style.display='block';$('err').textContent=e.message}
  $('load').style.display='none';$('scanBtn').disabled=false;
}
$('repoIn').addEventListener('keydown',e=>{if(e.key==='Enter')scan()});
addEventListener('resize',()=>{if(DATA)draw()});
const q=new URLSearchParams(location.search).get('repo');
if(q){$('repoIn').value=q;scan()}
</script>
</body></html>`;
}


module.exports = { handleApi, analyzeRepo, parseRepo, treemapPage };
