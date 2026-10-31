// Cloudflare Pages Functions：单条备案详情 / 审核 / 注销
// 动态路由文件 [id].js 对应 /api/filings/:id，id 由 context.params.id 提供。
const STATUSES = ["pending", "approved", "rejected"];
const clean = (v) => String(v ?? "").trim();
const json = (data, status = 200) => Response.json(data, { status });
const err = (message, status = 400) => json({ error: message }, status);
function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet({ params, env }) {
  const row = await env.DB.prepare("SELECT * FROM filings WHERE id=?").bind(Number(params.id)).first();
  if (!row) return err("记录不存在", 404);
  return json(row);
}

export async function onRequestPatch({ request, params, env }) {
  if (!requireAdmin(request, env)) return err("需要管理员鉴权", 401);
  const id = Number(params.id);
  const row = await env.DB.prepare("SELECT * FROM filings WHERE id=?").bind(id).first();
  if (!row) return err("记录不存在", 404);
  let b = {};
  try { b = await request.json(); } catch { b = {}; }
  const status = b.status !== undefined ? clean(b.status) : row.status;
  if (!STATUSES.includes(status)) return err("状态不正确");
  const review_note = b.review_note !== undefined ? clean(b.review_note) : row.review_note;
  const site_name = b.site_name !== undefined ? clean(b.site_name) : row.site_name;
  const description = b.description !== undefined ? clean(b.description) : row.description;
  await env.DB.prepare(
    "UPDATE filings SET status=?, review_note=?, site_name=?, description=?, updated_at=datetime('now') WHERE id=?"
  ).bind(status, review_note, site_name, description, id).run();
  const updated = await env.DB.prepare("SELECT * FROM filings WHERE id=?").bind(id).first();
  return json(updated);
}

export async function onRequestDelete({ request, params, env }) {
  if (!requireAdmin(request, env)) return err("需要管理员鉴权", 401);
  await env.DB.prepare("DELETE FROM filings WHERE id=?").bind(Number(params.id)).run();
  return json({ ok: true });
}
