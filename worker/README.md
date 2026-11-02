# 图库统计服务

部署配置见 `wrangler.toml`，表结构见 `schema.sql`。公开接口为 `GET /stats?gallery=costume`、`GET /stars` 和 `POST /events`；写入仅允许配置的本站来源，图片 ID 必须属于仓库索引。完整口径与维护说明见 [statistics.md](../statistics.md)。

本机发布：`WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 deploy`。首次数据库初始化：`WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 d1 execute ai-reference-gallery-stats --remote --file=schema.sql`。先更新 `catalog.json` 并通过测试，再发布；不要重建已有数据库。
