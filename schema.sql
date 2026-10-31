-- 萌ICP备案数据库结构（SQLite，与 server/index.ts 首次启动建表一致）
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
-- 同一域名同时只能有一条未被驳回的记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_filings_domain_active
  ON filings(domain) WHERE status != 'rejected';
CREATE INDEX IF NOT EXISTS idx_filings_status ON filings(status);
CREATE INDEX IF NOT EXISTS idx_filings_category ON filings(category);
CREATE INDEX IF NOT EXISTS idx_filings_created ON filings(id DESC);
