# 萌ICP备案 · Cloudflare 部署说明（`cf` 分支）

> **重要声明：本站为趣味社区备案演示，与工信部 ICP 备案无关，请勿用于冒充正式备案。**
>
> 本分支是 Pages + Pages Functions + D1 版本。主线 Docker / Bun 版本在 `main` 分支。

## 1. 创建 D1 数据库

```bash
npx wrangler d1 create moe-icp-db
# 输出里有 database_id，把它填到 wrangler.toml 的 database_id 处，
# 替换掉 REPLACE_WITH_YOUR_D1_ID
```

## 2. 建表

```bash
# 远端（生产库）建表：
npx wrangler d1 execute moe-icp-db --remote --file=schema.sql

# 本地开发库建表（可选）：
npx wrangler d1 execute moe-icp-db --local --file=schema.sql
```

`schema.sql` 与主线一致：`filings` 表 + 域名部分唯一索引 + 状态/分类/倒序索引。

## 3. Pages 部署（推荐：连接 GitHub）

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → 选 `niesgeek/icp` 仓库
2. 分支选 `cf`
3. Framework preset：None；Build command：留空；Build output directory：`public`
4. 保存后部署，得到 `https://<项目>.pages.dev`

然后在 Pages 项目设置里补绑定（如果 `wrangler.toml` 已填 `database_id`，部署时也会带上）：

- Settings → Functions → D1 database bindings：Variable name `DB` → 选 `moe-icp-db`
- Settings → Functions → Environment variables：可选 `ADMIN_TOKEN`（生产务必设置；设置后审核/注销需在审核台填口令，请求头为 `Authorization: Bearer <口令>`；不设置则为演示模式）

也可以直接用命令行部署：

```bash
npx wrangler pages deploy public
```

## 4. 自定义域名（可选）

Pages 项目 → Custom domains → 添加你的域名，按提示做 CNAME 到 `<项目>.pages.dev`，开启 Always Use HTTPS。

## 5. 本地开发

```bash
npx wrangler pages dev public
# 需要 D1 时：npx wrangler pages dev public --d1 DB=moe-icp-db
```

## 免费额度与性能注意

- Workers Free：每天 10 万次请求；D1 Free：每天 500 万行读 / 10 万行写，单库 500MB。
- 列表已分页（默认 30 条/页），不要改回全量拉取，否则大表会同时拖慢速度和烧读额度。
- D1 单库单线程写，写多时会排队；这个站的申请量远不到瓶颈。
- 超免费额度后当天查询报错、UTC 午夜重置；需要更大额度时升 Workers Paid（$5/月起）。

## 常见问题

- **部署后接口 500 / 找不到 DB**：先确认 D1 绑定变量名是 `DB`，且 `schema.sql` 已在远端库执行过。
- **`database_id` 占位符没替换**：`wrangler pages deploy` 会失败，先执行第 1 步填 id。
- **审核提示需要鉴权**：说明 `ADMIN_TOKEN` 已设置，在审核台上方填入同一口令再操作。
