# 萌ICP备案 · 可部署源码版

给个人小站领一个可爱备案号的趣味登记站：查号、申请、审核、公示、复制页脚代码。

> **重要声明：本站为趣味社区备案演示，与工信部 ICP 备案无关，请勿用于冒充正式备案。**
>
> 这是托管演示站的可部署源码版本：功能与演示站一致（搜索、申请、自动生成备案号、域名查重、审核、注销、统计），
> 实现上做了轻量化——后端用 Bun + SQLite（`bun:sqlite`，零外部依赖），前端为静态页面 + 原生 JS，
> 因此可以直接 `bun run` 跑起来，无需构建 React / Drizzle 工程。

## 本地运行

```bash
bun run server/index.ts
# 打开 http://localhost:3000
# 可选演示数据：bun run scripts/seed.ts（仅库为空时写入）
```

环境变量：`PORT`（默认 3000）。数据文件在 `data/icp.db`，首次启动按 `schema.sql` 自动建表，**不要把数据库文件提交进仓库**。

## 备案号规则

后端按自增 id 生成：`萌ICP备{年份}{id+10000 补零到 5 位}号`，例如第一条是 `萌ICP备202610001号`。
同一域名同时只能有一条未被驳回的记录；被驳回后可以重新申请。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/filings?q=&status=&category=` | 列表 / 搜索 |
| GET | `/api/stats` | 累计 / 已通过 / 待审核 |
| GET | `/api/filings/:id` | 详情 |
| POST | `/api/filings` | 申请（字段：site_name、domain、owner_name、contact、description、category） |
| PATCH | `/api/filings/:id` | 审核 / 编辑（status：pending / approved / rejected，review_note） |
| DELETE | `/api/filings/:id` | 注销 |

## 文件结构

```text
public/index.html   前端页面
public/app.js       前端逻辑（搜索、申请、详情、审核台）
public/style.css    现代粉紫渐变样式
server/index.ts     Bun 后端 + SQLite + 静态文件服务
scripts/seed.ts     演示数据（可选）
schema.sql          数据库结构
package.json        启动脚本（无外部依赖）
```

## 生产部署注意

- 审核台在演示版暂不设登录，**上线前务必加管理员鉴权**，不要把审核接口公开暴露。
- 建议用反向代理 + HTTPS 部署，并定期备份 `data/icp.db`。
