// 萌ICP备案后端：Bun + SQLite（bun:sqlite，零外部依赖）
// 运行：bun run server/index.ts ，默认监听 http://localhost:3000
// 数据文件：data/icp.db（首次启动自动建表，见 schema.sql）
// 注意：本站是萌友圈趣味备案演示，与工信部 ICP 备案无关。
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const PORT = Number(process.env.PORT || 3000);
mkdirSync("data", { recursive: true });
const db = new Database("data/icp.db");
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

function listFilings(url: URL) {
  const q = clean(url.searchParams.get("q")).toLowerCase();
  const status = clean(url.searchParams.get("status"));
  const category = clean(url.searchParams.get("category"));
  let rows = db.query("SELECT * FROM filings ORDER BY id DESC").all() as any[];
  if (status && STATUSES.includes(status)) rows = rows.filter((r) => r.status === status);
  if (category && CATEGORIES.includes(category)) rows = rows.filter((r) => r.category === category);
  if (q) rows = rows.filter((r) => [r.site_name, r.domain, r.icp_number].join(" ").toLowerCase().includes(q));
  return rows;
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

    if (path === "/api/filings" && req.method === "GET") return json(listFilings(url));
    if (path === "/api/stats" && req.method === "GET") return json(stats());

    if (path === "/api/filings" && req.method === "POST") {
      const b = await body(req);
      const site_name = clean(b.site_name), domain = normalizeDomain(b.domain);
      const owner_name = clean(b.owner_name), contact = clean(b.contact);
      const description = clean(b.description);
      const category = CATEGORIES.includes(b.category) ? b.category : "个人博客";
      if (!site_name || !domain) return err("请填写网站名称和域名");
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
    return new Response(data, { headers: { "content-type": MIME[extname(file)] || "application/octet-stream" } });
  },
});
console.log(`萌ICP备案已启动：http://localhost:${PORT}`);
