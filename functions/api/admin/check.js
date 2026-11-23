// 管理员口令校验：GET /api/admin/check
// 带 Authorization: Bearer <ADMIN_TOKEN> 请求；正确返回 { admin: true }，
// 错误返回 401。未设置 ADMIN_TOKEN 时为演示模式，直接返回 admin: true。
function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return Response.json({ error: "需要管理员鉴权" }, { status: 401 });
  return Response.json({ admin: true, demo: !env.ADMIN_TOKEN });
}
