# 图库统计服务

正式服务：<https://ai-reference-gallery-stats.deeyu54321.workers.dev>。健康检查：`GET /health`。已绑定现有 D1，并每天在北京时间 03:00 清理约两天前的事件明细，保留累计计数及访客哈希。

部署配置见 `wrangler.toml`，表结构见 `schema.sql`。公开接口为 `GET /stats?gallery=costume`、`GET /stars` 和 `POST /events`；写入仅允许配置的本站来源，图片 ID 必须属于仓库索引。完整口径与维护说明见 [statistics.md](../statistics.md)。

本机发布：`WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 deploy`。首次数据库初始化：`WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 d1 execute ai-reference-gallery-stats --remote --file=schema.sql`。先更新 `catalog.json` 并通过测试，再发布；不要重建已有数据库。

部署排行功能前，运行 `WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 d1 execute ai-reference-gallery-stats --remote --file=migrations/portrait-ranking.sql` 添加排行表。每日北京时间 09:17 的 Cron 从原站同步，公开接口 `GET /portrait-ranking` 返回最后一次成功的排行及同步时间。同步失败可在 Workers 的 Cron 事件记录中排查；不会清空已有排行。
