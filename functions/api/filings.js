// Cloudflare Pages Functions：备案列表（分页）与申请
// 与主线 Bun 版保持同一 API 契约：
//   GET  /api/filings?page=&limit=&q=&status=&category= -> { items, total, page, limit }
//   POST /api/filings -> 201 新记录，备案号自动生成
const CATEGORIES = ["个人博客", "工具站", "社区论坛", "作品集", "导航站", "其他"];
const STATUSES = ["pending", "approved", "rejected"];
const clean = (v) => String(v ?? "").trim();
const normalizeDomain = (d) => clean(d).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const escapeLike = (s) => s.replace(/[%_\\]/g, (c) => "\\" + c);
const json = (data, status = 200) => Response.json(data, { status });
const err = (message, status = 400) => json({ error: message }, status);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = clean(url.searchParams.get("q"));
  const status = clean(url.searchParams.get("status"));
  const category = clean(url.searchParams.get("category"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const where = [], params = [];
  if (status && STATUSES.includes(status)) { where.push("status=?"); params.push(status); }
  if (category && CATEGORIES.includes(category)) { where.push("category=?"); params.push(category); }
  if (q) { where.push("(site_name LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\' OR icp_number LIKE ? ESCAPE '\\')"); const like = `%${escapeLike(q)}%`; params.push(like, like, like); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM filings ${clause}`).bind(...params).first();
  const { results } = await env.DB.prepare(
    `SELECT * FROM filings ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, (page - 1) * limit).all();
  return json({ items: results || [], total: totalRow?.c ?? 0, page, limit });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch { b = {}; }
  const site_name = clean(b.site_name), domain = normalizeDomain(b.domain);
  const owner_name = clean(b.owner_name), contact = clean(b.contact);
  const description = clean(b.description);
  const category = CATEGORIES.includes(b.category) ? b.category : "个人博客";
  if (!site_name || !domain) return err("请填写网站名称和域名");
  if (site_name.length > 100 || domain.length > 253) return err("名称或域名过长");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return err("域名格式不正确，例如 example.com");
  const dup = await env.DB.prepare("SELECT id FROM filings WHERE domain=? AND status!='rejected'").bind(domain).first();
  if (dup) return err("该域名已被登记（未被驳回的记录）", 409);
  const info = await env.DB.prepare(
    "INSERT INTO filings (site_name, domain, owner_name, contact, description, category) VALUES (?,?,?,?,?,?)"
  ).bind(site_name, domain, owner_name, contact, description, category).run();
  const id = Number(info.meta?.last_row_id);
  if (!id) return err("创建失败，请重试", 500);
  const year = new Date().getFullYear();
  const icp_number = `萌ICP备${year}${String(id + 10000).padStart(5, "0")}号`;
  await env.DB.prepare("UPDATE filings SET icp_number=?, updated_at=datetime('now') WHERE id=?").bind(icp_number, id).run();
  const row = await env.DB.prepare("SELECT * FROM filings WHERE id=?").bind(id).first();
  return json(row, 201);
}
