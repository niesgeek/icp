// 萌ICP备案后端：Bun + SQLite（bun:sqlite，零外部依赖）
// 运行：bun run server/index.ts ，或见 Dockerfile / docker-compose.yml
// 数据文件：DB_PATH（默认 data/icp.db），首次启动自动建表，见 schema.sql
// 可选鉴权：设置 ADMIN_TOKEN 后，审核（PATCH）与注销（DELETE）需带
//   Authorization: Bearer <ADMIN_TOKEN>；不设置则为演示模式（不鉴权）。
// 注意：本站是萌友圈趣味备案演示，与工信部 ICP 备案无关。
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || "data/icp.db";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
mkdirSync(dirname(DB_PATH) || ".", { recursive: true });
const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS filings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '个人博客',
  icp_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_filings_domain_active ON filings(domain) WHERE status != 'rejected';
CREATE INDEX IF NOT EXISTS idx_filings_status ON filings(status);
CREATE INDEX IF NOT EXISTS idx_filings_category ON filings(category);
CREATE INDEX IF NOT EXISTS idx_filings_created ON filings(id DESC);
`);

const CATEGORIES = ["个人博客", "工具站", "社区论坛", "作品集", "导航站", "其他"];
const STATUSES = ["pending", "approved", "rejected"];

function clean(s: unknown) { return String(s ?? "").trim(); }
function normalizeDomain(d: string) {
  return clean(d).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
function err(message: string, status = 400) { return json({ error: message }, status); }
async function body(req: Request) { try { return await req.json(); } catch { return {}; } }
function escapeLike(s: string) { return s.replace(/[%_\\]/g, (c) => "\\" + c); }
function requireAdmin(req: Request) {
  if (!ADMIN_TOKEN) return true;
  return req.headers.get("authorization") === `Bearer ${ADMIN_TOKEN}`;
}
// 简单的申请限流：同一 IP 每分钟最多 20 次 POST，避免被刷号。
const postHits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now(), list = (postHits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now); postHits.set(ip, list);
  return list.length > 20;
}

function listFilings(url: URL) {
  const q = clean(url.searchParams.get("q"));
  const status = clean(url.searchParams.get("status"));
  const category = clean(url.searchParams.get("category"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const where: string[] = [], params: unknown[] = [];
  if (status && STATUSES.includes(status)) { where.push("status=?"); params.push(status); }
  if (category && CATEGORIES.includes(category)) { where.push("category=?"); params.push(category); }
  if (q) { where.push("(site_name LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\' OR icp_number LIKE ? ESCAPE '\\')"); const like = `%${escapeLike(q)}%`; params.push(like, like, like); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.query(`SELECT COUNT(*) c FROM filings ${clause}`).get(...params) as any).c;
  const items = db.query(`SELECT * FROM filings ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  return { items, total, page, limit };
}
function stats() {
  const total = (db.query("SELECT COUNT(*) c FROM filings").get() as any).c;
  const approved = (db.query("SELECT COUNT(*) c FROM filings WHERE status='approved'").get() as any).c;
  const pending = (db.query("SELECT COUNT(*) c FROM filings WHERE status='pending'").get() as any).c;
  return { total, approved, pending, rejected: total - approved - pending };
}

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/health" && req.method === "GET") return json({ ok: true, total: stats().total });
    if (path === "/api/filings" && req.method === "GET") return json(listFilings(url));
    if (path === "/api/stats" && req.method === "GET") return json(stats());

    if (path === "/api/filings" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
      if (rateLimited(ip)) return err("申请过于频繁，请稍后再试", 429);
      const b = await body(req);
      const site_name = clean(b.site_name), domain = normalizeDomain(b.domain);
      const owner_name = clean(b.owner_name), contact = clean(b.contact);
      const description = clean(b.description);
      const category = CATEGORIES.includes(b.category) ? b.category : "个人博客";
      if (!site_name || !domain) return err("请填写网站名称和域名");
      if (site_name.length > 100 || domain.length > 253) return err("名称或域名过长");
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return err("域名格式不正确，例如 example.com");
      const dup = db.query("SELECT id FROM filings WHERE domain=? AND status!='rejected'").get(domain);
      if (dup) return err("该域名已被登记（未被驳回的记录）", 409);
      const info = db.query(
        "INSERT INTO filings (site_name, domain, owner_name, contact, description, category) VALUES (?,?,?,?,?,?)"
      ).run(site_name, domain, owner_name, contact, description, category);
      const id = Number(info.lastInsertRowid);
      const year = new Date().getFullYear();
      const icp_number = `萌ICP备${year}${String(id + 10000).padStart(5, "0")}号`;
      db.query("UPDATE filings SET icp_number=?, updated_at=datetime('now') WHERE id=?").run(icp_number, id);
      return json(db.query("SELECT * FROM filings WHERE id=?").get(id), 201);
    }

    const m = path.match(/^\/api\/filings\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      const row = db.query("SELECT * FROM filings WHERE id=?").get(id) as any;
      if (!row) return err("记录不存在", 404);
      if (req.method === "GET") return json(row);
      if (req.method === "PATCH" || req.method === "DELETE") {
        if (!requireAdmin(req)) return err("需要管理员鉴权", 401);
      }
      if (req.method === "PATCH") {
        const b = await body(req);
        const status = b.status !== undefined ? clean(b.status) : row.status;
        if (!STATUSES.includes(status)) return err("状态不正确");
        const review_note = b.review_note !== undefined ? clean(b.review_note) : row.review_note;
        const site_name = b.site_name !== undefined ? clean(b.site_name) : row.site_name;
        const description = b.description !== undefined ? clean(b.description) : row.description;
        db.query("UPDATE filings SET status=?, review_note=?, site_name=?, description=?, updated_at=datetime('now') WHERE id=?")
          .run(status, review_note, site_name, description, id);
        return json(db.query("SELECT * FROM filings WHERE id=?").get(id));
      }
      if (req.method === "DELETE") {
        db.query("DELETE FROM filings WHERE id=?").run(id);
        return json({ ok: true });
      }
    }

    // 静态前端
    let file = join("public", path === "/" ? "index.html" : path.slice(1));
    if (!existsSync(file) || !file.startsWith(join(process.cwd(), "public"))) file = "public/index.html";
    const data = readFileSync(file);
    const ext = extname(file);
    const headers: Record<string, string> = { "content-type": MIME[ext] || "application/octet-stream" };
    headers["cache-control"] = ext === ".html" ? "no-cache" : "public, max-age=3600";
    return new Response(data, { headers });
  },
});
console.log(`萌ICP备案已启动：http://localhost:${PORT}（DB: ${DB_PATH}，管理员鉴权：${ADMIN_TOKEN ? "已开启" : "未设置，演示模式"}）`);
