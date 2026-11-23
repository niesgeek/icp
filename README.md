# 涅槃ICP备案系统 · Cloudflare 版本（`cf` 分支）

给个人小站领一个备案号的趣味登记站：查号、申请、审核、公示、复制页脚代码。前端按 014 液态玻璃（Liquid Glass）风格重写，并用 unslop 做过一遍设计检查。

> **重要声明：本站为趣味社区备案演示，与工信部 ICP 备案无关，请勿用于冒充正式备案。**
>
> 本分支与主线（Docker / Bun + 本地 SQLite）API 契约一致，区别只在运行层：
> 静态前端用 Cloudflare Pages 托管，API 用 Pages Functions，数据用 Cloudflare D1（托管 SQLite）。
> 主线版本在 `main` 分支（仍为旧版界面与旧编号规则）。

## 架构

```text
public/                  Pages 静态前端（液态玻璃风格）
functions/api/           Pages Functions
  health.js              GET /api/health
  stats.js               GET /api/stats
  next.js                GET /api/next（下一个可申请的备案号）
  filings.js             GET /api/filings（分页/搜索）、POST /api/filings（申请）
  filings/[id].js        GET /api/filings/:id、PATCH（审核）、DELETE（注销）
  admin/check.js         GET /api/admin/check（管理员口令校验）
  admin/filings.js       GET /api/admin/filings、POST /api/admin/filings（添加预留号）
schema.sql               D1 建表与索引
wrangler.toml            Pages 输出目录 + D1 绑定（binding = DB）
```

## 备案号规则

- 格式：`涅ICP备{年份}{5 位序号}号`，例如 `涅ICP备202600101号`。
- **用户在线申请从 101 号开始**，按顺序自动分配。
- **1–100 号为管理员预留号**，只能在「管理员」里添加（添加后直接为已通过状态），不在在线申请里分配。
- 同一域名同时只能有一条未被驳回的记录；备案号唯一。
- 历史遗留的 `萌ICP备202610002号`（NieGe Monitor）保留原号，不参与新序号计算。

列表默认每页 30 条、最多 100 条，避免大表全量扫描烧 D1 读额度。

## 管理员

在 Pages 后台设置 `ADMIN_TOKEN`（Production 环境变量）后：

- 审核 / 注销、管理员接口都需要口令：请求头 `Authorization: Bearer <ADMIN_TOKEN>`。
- 页面上的「审核台」和「管理员」里填写同一口令即可，口令只保存在本页会话中。
- 未设置 `ADMIN_TOKEN` 时为演示模式，不校验口令。

## 部署（见 DEPLOY.md）

简述：建 D1 库 → 把 `database_id` 填进 `wrangler.toml` → 用 `schema.sql` 建表 → Pages 连接本仓库的 `cf` 分支，构建命令留空、输出目录 `public`，并绑定 D1（`DB`）和可选的 `ADMIN_TOKEN`。

## 免费额度参考

Workers Free 每天 10 万次请求、D1 Free 每天 500 万行读 / 10 万行写、单库 500MB。
这个站读多写少，个人站 / 萌友圈量级免费版足够；超额后当天查询会报错、UTC 午夜重置，不会自动扣费。
