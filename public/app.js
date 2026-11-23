// 涅槃ICP备案系统 · 前端
// 备案号：涅ICP备{年份}{5位序号}号；用户申请从 101 号起，1-100 号为管理员预留号。
const $ = (s) => document.querySelector(s);
const CATEGORIES = ["个人博客", "工具站", "社区论坛", "作品集", "导航站", "其他"];
let all = [], hallTotal = 0, hallPage = 1, hallLimit = 30;
let fCat = "", adminItems = [];
const statusText = { pending: "待审核", approved: "已通过", rejected: "已驳回" };
const TOKEN_KEY = "np-admin-token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
    || ($("#adminToken")?.value || "").trim()
    || ($("#adminToken2")?.value || "").trim();
}
function adminHeaders() {
  const t = getToken();
  return t ? { Authorization: "Bearer " + t } : {};
}
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "content-type": "application/json", ...adminHeaders(), ...(opts.headers || {}) }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "请求失败");
  return d;
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function refresh() {
  const s = await api("/api/stats");
  $("#statTotal").textContent = s.total; $("#statApproved").textContent = s.approved; $("#statPending").textContent = s.pending;
  await loadHall(true);
  const pending = await api("/api/filings?status=pending&limit=100");
  renderReview(pending.items || pending);
  await loadNext();
  if (getToken()) await loadAdmin().catch(() => {});
}
async function loadNext() {
  try {
    const n = await api("/api/next");
    $("#heroSeal").textContent = n.icp_number;
    $("#nextNoMeta").textContent = `下一号：${n.icp_number} · 申请从 101 号起`;
    $("#applyNext").textContent = n.icp_number;
  } catch { $("#applyNext").textContent = "暂不可用"; }
}
async function loadHall(reset) {
  if (reset) { hallPage = 1; all = []; }
  const params = new URLSearchParams({ page: hallPage, limit: hallLimit });
  const q = $("#q").value.trim(); if (q) params.set("q", q);
  if (fCat) params.set("category", fCat);
  if ($("#fStatus").value) params.set("status", $("#fStatus").value);
  const d = await api("/api/filings?" + params);
  const items = d.items || d;
  hallTotal = d.total ?? items.length;
  all = reset ? items : all.concat(items);
  renderHall();
}
function renderHall() {
  $("#hall").innerHTML = all.length ? all.map(card).join("") : `<p class="muted">还没有符合条件的站点，来申请第一个吧。</p>`;
  $("#hallMore").innerHTML = all.length < hallTotal
    ? `<p><button class="btn-small" onclick="hallPage++; loadHall(false)">加载更多（已显示 ${all.length} / 共 ${hallTotal} 条）</button></p>`
    : `<p class="muted">共 ${hallTotal} 条</p>`;
  document.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => showDetail(Number(b.dataset.detail)));
}
function card(r) {
  return `<article class="card"><h3>${esc(r.site_name)}</h3><p class="num">${esc(r.icp_number)}</p>
  <p>${esc(r.domain)}</p><p>${esc(r.description || "暂无简介")}</p>
  <p class="rowline"><span class="tag">${esc(r.category)}</span> <span class="status ${r.status}">${statusText[r.status]}</span></p>
  <div class="actions"><button class="btn-small" data-detail="${r.id}">查看证书 / 代码</button></div></article>`;
}
function showDetail(id) {
  const r = all.find(x => x.id === id); if (!r) return;
  const code = `<a href="${location.origin}/?keyword=${encodeURIComponent(r.icp_number)}" target="_blank">${r.icp_number}</a>`;
  $("#detail").innerHTML = `<div class="detail-cert"><h3>${esc(r.site_name)}</h3><p class="seal">${esc(r.icp_number)}</p><p>域名：${esc(r.domain)} · 站长：${esc(r.owner_name || "-")} · 分类：${esc(r.category)}</p><p>${esc(r.description || "")}</p><p>状态：${statusText[r.status]}${r.review_note ? `（${esc(r.review_note)}）` : ""}</p><p>页脚代码：</p><pre class="code">${esc(code)}</pre><div class="actions"><button class="btn-ink" id="copyCodeBtn">复制页脚代码</button> <button class="btn-glass" onclick="delFiling(${r.id})">注销</button></div></div>`;
  // 复制逻辑绑在 JS 里，不拼进 onclick 属性：页脚代码自带双引号会打断属性
  $("#copyCodeBtn").onclick = () => navigator.clipboard.writeText(code).then(() => alert("已复制页脚代码")).catch(() => alert("复制失败，请手动复制上方代码"));
  $("#detail").scrollIntoView({ behavior: "smooth" });
}
async function delFiling(id) {
  if (!confirm("确定注销这条备案吗？")) return;
  try { await api(`/api/filings/${id}`, { method: "DELETE" }); await refresh(); $("#detail").innerHTML = ""; if (getToken()) await loadAdmin(); }
  catch (e) { alert("注销失败：" + e.message + "（若服务端设置了 ADMIN_TOKEN，审核台或管理员里要先填管理员口令）"); }
}
function renderReview(rows) {
  $("#review").innerHTML = rows.length ? rows.map(r => `<div class="card"><h3>${esc(r.site_name)}</h3><p class="num">${esc(r.icp_number)}</p><p>${esc(r.domain)} · ${esc(r.description || "")}</p><div class="actions"><button class="btn-small primary" onclick="review(${r.id},'approved')">通过</button> <button class="btn-small" onclick="review(${r.id},'rejected')">驳回</button></div></div>`).join("") : `<p class="muted">目前没有待审核申请。</p>`;
}
async function review(id, status) {
  const note = status === "rejected" ? prompt("驳回原因（可选）") || "" : "";
  try { await api(`/api/filings/${id}`, { method: "PATCH", body: JSON.stringify({ status, review_note: note }) }); await refresh(); }
  catch (e) { alert("审核失败：" + e.message + "（若服务端设置了 ADMIN_TOKEN，请先在上方填管理员口令）"); }
}

/* 管理员 */
function parseSeq(icp) {
  const m = /^涅ICP备\d{4}(\d{5})号$/.exec(String(icp || ""));
  return m ? parseInt(m[1], 10) : null;
}
async function loadAdmin() {
  const d = await api("/api/admin/filings");
  adminItems = d.items || [];
  $("#adminLogin").style.display = "none";
  $("#adminTools").style.display = "block";
  const taken = new Map();
  for (const r of adminItems) { const s = parseSeq(r.icp_number); if (s !== null && s >= 1 && s <= 100) taken.set(s, r); }
  let grid = "";
  for (let i = 1; i <= 100; i++) {
    const r = taken.get(i);
    grid += r
      ? `<button class="taken" title="${esc(r.site_name)} · ${esc(r.domain)}" onclick="pickSeq(${i})">${String(i).padStart(3, "0")}</button>`
      : `<button title="空闲，点击填入表单" onclick="pickSeq(${i})">${String(i).padStart(3, "0")}</button>`;
  }
  $("#reservedGrid").innerHTML = grid;
  $("#adminList").innerHTML = adminItems.length ? adminItems.map(r => `<div class="admin-row"><span><span class="num">${esc(r.icp_number)}</span> · ${esc(r.site_name)} · ${esc(r.domain)}</span><span>${statusText[r.status]} <button class="btn-small" onclick="delFiling(${r.id})">注销</button></span></div>`).join("") : `<p class="muted">暂无备案记录。</p>`;
}
function pickSeq(n) { $("#adminSeq").value = n; $("#adminSeq").focus(); }
async function adminLogin() {
  const t = ($("#adminToken2").value || "").trim();
  if (!t) { $("#adminLoginMsg").textContent = "请先填写管理员口令。"; return; }
  sessionStorage.setItem(TOKEN_KEY, t);
  try { await api("/api/admin/check"); $("#adminLoginMsg").textContent = ""; await loadAdmin(); }
  catch (e) { sessionStorage.removeItem(TOKEN_KEY); $("#adminLoginMsg").textContent = "口令不正确：" + e.message; }
}
function adminLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  $("#adminToken2").value = ""; $("#adminToken").value = "";
  $("#adminLogin").style.display = "block";
  $("#adminTools").style.display = "none";
}

function showTab(name, scroll = true) {
  document.querySelectorAll(".nav-tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.style.display = p.id === "panel-" + name ? "block" : "none");
  if (scroll) document.querySelector("main").scrollIntoView({ behavior: "smooth" });
  if (name === "admin" && getToken()) loadAdmin().catch(() => {});
}
document.querySelectorAll(".nav-tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* 分类 chips */
$("#catChips").innerHTML = ["", ...CATEGORIES].map(c => `<button data-cat="${c}" class="${c === "" ? "active" : ""}">${c === "" ? "全部" : esc(c)}</button>`).join("");
document.querySelectorAll("#catChips button").forEach(b => b.onclick = () => {
  fCat = b.dataset.cat;
  document.querySelectorAll("#catChips button").forEach(x => x.classList.toggle("active", x === b));
  loadHall(true);
});
let searchTimer;
$("#q").oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadHall(true), 300); };
$("#fStatus").onchange = () => loadHall(true);
$("#adminToken").oninput = (e) => { if (e.target.value.trim()) sessionStorage.setItem(TOKEN_KEY, e.target.value.trim()); };
$("#adminLoginBtn").onclick = adminLogin;
$("#adminLogoutBtn").onclick = adminLogout;
$("#applyForm").onsubmit = async (e) => {
  e.preventDefault(); $("#applyMsg").textContent = "提交中…";
  try {
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await api("/api/filings", { method: "POST", body: JSON.stringify(data) });
    $("#applyMsg").textContent = `申请成功！你的备案号是 ${r.icp_number}，请等待审核。`;
    $("#preview").innerHTML = `<p class="seal-inline">${esc(r.icp_number)}</p><pre class="code">&lt;a href="/?keyword=${encodeURIComponent(r.icp_number)}" target="_blank"&gt;${esc(r.icp_number)}&lt;/a&gt;</pre>`;
    e.target.reset(); await refresh(); showTab("hall");
  } catch (err) { $("#applyMsg").textContent = "提交失败：" + err.message; }
};
$("#adminAddForm").onsubmit = async (e) => {
  e.preventDefault(); $("#adminAddMsg").textContent = "添加中…";
  try {
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.seq = Number(data.seq);
    const r = await api("/api/admin/filings", { method: "POST", body: JSON.stringify(data) });
    $("#adminAddMsg").textContent = `已添加：${r.icp_number}（已通过）`;
    e.target.reset(); await refresh(); await loadAdmin();
  } catch (err) { $("#adminAddMsg").textContent = "添加失败：" + err.message; }
};
refresh(); showTab("hall", false);
