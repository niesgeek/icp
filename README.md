# 萌ICP备案 · Cloudflare 版本（`cf` 分支）

给个人小站领一个可爱备案号的趣味登记站：查号、申请、审核、公示、复制页脚代码。

> **重要声明：本站为趣味社区备案演示，与工信部 ICP 备案无关，请勿用于冒充正式备案。**
>
> 本分支与主线（Docker / Bun + 本地 SQLite）功能和 API 契约一致，区别只在运行层：
> 静态前端用 Cloudflare Pages 托管，API 用 Pages Functions，数据用 Cloudflare D1（托管 SQLite）。
> 主线版本在 `main` 分支。

## 架构

```text
public/                  Pages 静态前端（与主线同一套页面）
functions/api/           Pages Functions
  health.js              GET /api/health
  stats.js               GET /api/stats
  filings.js             GET /api/filings（分页/搜索）、POST /api/filings（申请）
  filings/[id].js        GET /api/filings/:id、PATCH（审核）、DELETE（注销）
schema.sql               D1 建表与索引
wrangler.toml            Pages 输出目录 + D1 绑定（binding = DB）
```

备案号规则与主线一致：`萌ICP备{年份}{id+10000 补零到 5 位}号`，同一域名同时只能有一条未被驳回的记录。
列表默认每页 30 条、最多 100 条，避免大表全量扫描烧 D1 读额度。

## 部署（见 DEPLOY.md）

简述：建 D1 库 → 把 `database_id` 填进 `wrangler.toml` → 用 `schema.sql` 建表 → Pages 连接本仓库的 `cf` 分支，构建命令留空、输出目录 `public`，并绑定 D1（`DB`）和可选的 `ADMIN_TOKEN`。

## 免费额度参考

Workers Free 每天 10 万次请求、D1 Free 每天 500 万行读 / 10 万行写、单库 500MB。
这个站读多写少，个人站 / 萌友圈量级免费版足够；超额后当天查询会报错、UTC 午夜重置，不会自动扣费。
