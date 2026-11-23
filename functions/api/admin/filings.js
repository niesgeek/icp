// 管理员接口：预留号（1-100 号）添加与管理列表。
//   GET  /api/admin/filings -> { items, total }（精简字段，按 id 倒序，最多 500 条）
//   POST /api/admin/filings { seq, site_name, domain, owner_name, contact, description, category }
//     seq 只能是 1-100 的整数；新建记录直接为已通过状态，号码为 涅ICP备{年份}{seq 补 5 位}号。
// 均需管理员鉴权（Authorization: Bearer <ADMIN_TOKEN>；未设置时为演示模式）。
const CATEGORIES = ["个人博客", "工具站", "社区论坛", "作品集", "导航站", "其他"];
const PREFIX = "涅ICP备";
const RESERVED_MAX = 100;
const clean = (v) => String(v ?? "").trim();
const normalizeDomain = (d) => clean(d).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const json = (data, status = 200) => Response.json(data, { status });
const err = (message, status = 400) => json({ error: message }, status);
function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return err("需要管理员鉴权", 401);
  const { results } = await env.DB.prepare(
    "SELECT id, icp_number, site_name, domain, status, created_at FROM filings ORDER BY id DESC LIMIT 500"
  ).all();
  const totalRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM filings").first();
  return json({ items: results || [], total: totalRow?.c ?? 0 });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return err("需要管理员鉴权", 401);
  let b = {};
  try { b = await request.json(); } catch { b = {}; }
  const seq = Number(b.seq);
  if (!Number.isInteger(seq) || seq < 1 || seq > RESERVED_MAX) return err(`预留号只能是 1-${RESERVED_MAX} 之间的整数`);
  const site_name = clean(b.site_name), domain = normalizeDomain(b.domain);
  const owner_name = clean(b.owner_name), contact = clean(b.contact);
  const description = clean(b.description);
  const category = CATEGORIES.includes(b.category) ? b.category : "个人博客";
  if (!site_name || !domain) return err("请填写网站名称和域名");
  if (site_name.length > 100 || domain.length > 253) return err("名称或域名过长");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return err("域名格式不正确，例如 example.com");
  const year = new Date().getFullYear();
  const icp_number = `${PREFIX}${year}${String(seq).padStart(5, "0")}号`;
  const taken = await env.DB.prepare("SELECT id FROM filings WHERE icp_number=?").bind(icp_number).first();
  if (taken) return err(`${icp_number} 已被占用`, 409);
  const dup = await env.DB.prepare("SELECT id FROM filings WHERE domain=? AND status!='rejected'").bind(domain).first();
  if (dup) return err("该域名已被登记（未被驳回的记录）", 409);
  const info = await env.DB.prepare(
    "INSERT INTO filings (site_name, domain, owner_name, contact, description, category, icp_number, status) VALUES (?,?,?,?,?,?,?, 'approved')"
  ).bind(site_name, domain, owner_name, contact, description, category, icp_number).run();
  const id = Number(info.meta?.last_row_id);
  if (!id) return err("创建失败，请重试", 500);
  const row = await env.DB.prepare("SELECT * FROM filings WHERE id=?").bind(id).first();
  return json(row, 201);
}
