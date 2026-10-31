# 萌ICP备案 · 部署说明（主线：Docker / Bun 版本）

给个人小站领一个可爱备案号的趣味登记站：查号、申请、审核、公示、复制页脚代码。

> **重要声明：本站为趣味社区备案演示，与工信部 ICP 备案无关，请勿用于冒充正式备案。**
>
> 主线是轻量可部署版本：后端用 Bun + SQLite（`bun:sqlite`，零外部依赖），前端为静态页面 + 原生 JS。
> Cloudflare 版本在 `cf` 分支，见该分支的 `DEPLOY.md`。

## Docker 部署（推荐）

```bash
export ADMIN_TOKEN="换成你的强口令"   # 生产务必设置
docker compose up -d --build
# 打开 http://localhost:3000
curl http://localhost:3000/api/health
```

- 端口：默认 `3000`，改端口用 `PORT=8080 docker compose up -d --build`（冒号左边是宿主机端口）。
- 数据：保存在 `icp-data` 卷里，容器重建、升级都不会丢；`docker compose down -v` 会删卷清空数据，慎用。
- 备份：`docker run --rm -v icp-data:/data -v "$PWD":/backup alpine tar czf /backup/icp-data.tgz -C /data .`
- 恢复：把备份解压回卷，或把 `icp.db` 放回 `data/` 再启动。
- 升级：`git pull && docker compose up -d --build`
- 看日志：`docker compose logs -f`

只用镜像、不想用 compose 也可以：

```bash
docker build -t moe-icp .
docker run -d --name moe-icp -p 3000:3000 \
  -e ADMIN_TOKEN="换成你的强口令" \
  -v icp-data:/app/data moe-icp
```

## 本地运行（无 Docker）

```bash
bun run server/index.ts
# 打开 http://localhost:3000
# 可选演示数据：bun run scripts/seed.ts（仅库为空时写入）
```

环境变量：`PORT`（默认 3000）、`DB_PATH`（默认 `data/icp.db`）、`ADMIN_TOKEN`（留空则审核/注销不鉴权，仅演示）。
数据文件在 `data/icp.db`，首次启动按 `schema.sql` 自动建表，**不要把数据库文件提交进仓库**。

## 备案号规则

后端按自增 id 生成：`萌ICP备{年份}{id+10000 补零到 5 位}号`，例如第一条是 `萌ICP备202610001号`。
同一域名同时只能有一条未被驳回的记录；被驳回后可以重新申请。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/filings?page=&limit=&q=&status=&category=` | 列表 / 搜索（默认每页 30 条，最多 100 条） |
| GET | `/api/stats` | 累计 / 已通过 / 待审核 |
| GET | `/api/filings/:id` | 详情 |
| POST | `/api/filings` | 申请（字段：site_name、domain、owner_name、contact、description、category；同一 IP 每分钟限 20 次） |
| PATCH | `/api/filings/:id` | 审核 / 编辑（status：pending / approved / rejected，review_note；设置 ADMIN_TOKEN 后需 `Authorization: Bearer <口令>`） |
| DELETE | `/api/filings/:id` | 注销（同上鉴权） |

## 文件结构

```text
public/index.html   前端页面
public/app.js       前端逻辑（搜索、分页、申请、详情、审核台）
public/style.css    现代粉紫渐变样式
server/index.ts     Bun 后端 + SQLite + 静态文件服务
scripts/seed.ts     演示数据（可选）
schema.sql          数据库结构与索引
Dockerfile          轻量镜像（oven/bun:1-alpine）
docker-compose.yml  一键部署（数据卷持久化）
```

## 生产部署注意

- 务必设置 `ADMIN_TOKEN`，不要把审核接口公开暴露。
- 建议用反向代理 + HTTPS 部署，并定期备份数据库。
