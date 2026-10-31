// Cloudflare Pages Functions：统计
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS total, COALESCE(SUM(status='approved'),0) AS approved, COALESCE(SUM(status='pending'),0) AS pending FROM filings"
  ).first();
  const total = row?.total ?? 0, approved = row?.approved ?? 0, pending = row?.pending ?? 0;
  return Response.json({ total, approved, pending, rejected: total - approved - pending });
}
