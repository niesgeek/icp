// 演示数据：仅在库为空时写入。运行：bun run scripts/seed.ts
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
mkdirSync("data", { recursive: true });
const db = new Database("data/icp.db");
db.exec(`CREATE TABLE IF NOT EXISTS filings (id INTEGER PRIMARY KEY AUTOINCREMENT, site_name TEXT NOT NULL, domain TEXT NOT NULL, owner_name TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '个人博客', icp_number TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', review_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
const count = (db.query("SELECT COUNT(*) c FROM filings").get() as any).c;
if (count > 0) { console.log(`库中已有 ${count} 条记录，跳过演示数据。`); process.exit(0); }
const demo = [
  ["樱花小站", "sakura.example.com", "小樱", "sakura@example.com", "记录二次元日常与手作的个人博客。", "个人博客", "approved"],
  ["萌工具箱", "tools.example.com", "阿萌", "moe@example.com", "给站长用的小工具合集。", "工具站", "approved"],
  ["星空导航", "nav.example.com", "星野", "hoshi@example.com", "萌系站点导航，正在等待审核。", "导航站", "pending"],
];
const year = new Date().getFullYear();
for (const [site_name, domain, owner_name, contact, description, category, status] of demo) {
  const info = db.query("INSERT INTO filings (site_name, domain, owner_name, contact, description, category, status) VALUES (?,?,?,?,?,?,?)").run(site_name, domain, owner_name, contact, description, category, status);
  const id = Number(info.lastInsertRowid);
  db.query("UPDATE filings SET icp_number=? WHERE id=?").run(`萌ICP备${year}${String(id + 10000).padStart(5, "0")}号`, id);
}
console.log("已写入 3 条演示数据。");
