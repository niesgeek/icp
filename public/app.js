const $ = (s) => document.querySelector(s);
let all = [], hallTotal = 0, hallPage = 1, hallLimit = 30;
const statusText = { pending: "待审核", approved: "已通过", rejected: "已驳回" };
function adminHeaders() {
  const t = ($("#adminToken")?.value || "").trim();
  return t ? { Authorization: "Bearer " + t } : {};
}
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "content-type": "application/json", ...adminHeaders(), ...(opts.headers || {}) }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "请求失败");
  return d;
}
async function refresh() {
  const s = await api("/api/stats");
  $("#statTotal").textContent = s.total; $("#statApproved").textContent = s.approved; $("#statPending").textContent = s.pending;
  await loadHall(true);
  const pending = await api("/api/filings?status=pending&limit=100");
  renderReview(pending.items || pending);
}
async function loadHall(reset) {
  if (reset) { hallPage = 1; all = []; }
  const params = new URLSearchParams({ page: hallPage, limit: hallLimit });
  const q = $("#q").value.trim(); if (q) params.set("q", q);
  if ($("#fCat").value) params.set("category", $("#fCat").value);
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
    ? `<p><button class="ghost" onclick="hallPage++; loadHall(false)">加载更多（已显示 ${all.length} / 共 ${hallTotal} 条）</button></p>`
    : `<p class="muted">共 ${hallTotal} 条</p>`;
  document.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => showDetail(Number(b.dataset.detail)));
}
function card(r) {
  return `<article class="card"><h3>${esc(r.site_name)}</h3><p class="num">${esc(r.icp_number)}</p>
  <p>🌐 ${esc(r.domain)}</p><p>${esc(r.description || "暂无简介")}</p>
  <p><span class="tag">${esc(r.category)}</span> <span class="status ${r.status}">${statusText[r.status]}</span></p>
  <button class="ghost" data-detail="${r.id}">查看证书 / 代码</button></article>`;
}
function showDetail(id) {
  const r = all.find(x => x.id === id); if (!r) return;
  const code = `<a href="${location.origin}/?keyword=${encodeURIComponent(r.icp_number)}" target="_blank">${esc(r.icp_number)}</a>`;
  $("#detail").innerHTML = `<h3>${esc(r.site_name)}</h3><p class="num">${esc(r.icp_number)}</p><p>域名：${esc(r.domain)} · 站长：${esc(r.owner_name || "-")} · 分类：${esc(r.category)}</p><p>${esc(r.description || "")}</p><p>状态：${statusText[r.status]}${r.review_note ? `（${esc(r.review_note)}）` : ""}</p><p>页脚代码：</p><pre class="code">${esc(code)}</pre><button class="primary" onclick="navigator.clipboard.writeText(${JSON.stringify(code)}).then(()=>alert('已复制页脚代码'))">复制页脚代码</button> <button class="ghost" onclick="delFiling(${r.id})">注销</button>`;
  $("#detail").scrollIntoView({ behavior: "smooth" });
}
async function delFiling(id) {
  if (!confirm("确定注销这条备案吗？")) return;
  try { await api(`/api/filings/${id}`, { method: "DELETE" }); await refresh(); $("#detail").innerHTML = ""; }
  catch (e) { alert("注销失败：" + e.message + "（若服务端设置了 ADMIN_TOKEN，审核台里要先填管理员口令）"); }
}
function renderReview(rows) {
  $("#review").innerHTML = rows.length ? rows.map(r => `<div class="card"><h3>${esc(r.site_name)}</h3><p class="num">${esc(r.icp_number)}</p><p>${esc(r.domain)} · ${esc(r.description || "")}</p><button class="primary" onclick="review(${r.id},'approved')">通过</button> <button class="ghost" onclick="review(${r.id},'rejected')">驳回</button></div>`).join("") : `<p class="muted">目前没有待审核申请。</p>`;
}
async function review(id, status) {
  const note = status === "rejected" ? prompt("驳回原因（可选）") || "" : "";
  try { await api(`/api/filings/${id}`, { method: "PATCH", body: JSON.stringify({ status, review_note: note }) }); await refresh(); }
  catch (e) { alert("审核失败：" + e.message + "（若服务端设置了 ADMIN_TOKEN，请先在上方填管理员口令）"); }
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.style.display = p.id === "panel-" + name ? "block" : "none");
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));
let searchTimer;
$("#q").oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadHall(true), 300); };
$("#fCat").onchange = () => loadHall(true); $("#fStatus").onchange = () => loadHall(true);
$("#applyForm").onsubmit = async (e) => {
  e.preventDefault(); $("#applyMsg").textContent = "提交中…";
  try {
    const data = Object.fromEntries(new FormData(e.target).entries());
    const r = await api("/api/filings", { method: "POST", body: JSON.stringify(data) });
    $("#applyMsg").textContent = `申请成功！你的备案号是 ${r.icp_number}，请等待审核。`;
    $("#preview").innerHTML = `<p class="num">${esc(r.icp_number)}</p><pre class="code">&lt;a href="/?keyword=${encodeURIComponent(r.icp_number)}" target="_blank"&gt;${esc(r.icp_number)}&lt;/a&gt;</pre>`;
    e.target.reset(); await refresh(); showTab("hall");
  } catch (err) { $("#applyMsg").textContent = "提交失败：" + err.message; }
};
refresh(); showTab("hall");
