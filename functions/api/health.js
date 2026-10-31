// Cloudflare Pages Functions：健康检查
// 绑定：wrangler.toml 里 [[d1_databases]] binding = "DB"
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM filings").first();
  return Response.json({ ok: true, total: row?.c ?? 0 });
}
