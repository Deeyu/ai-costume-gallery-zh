# 访问统计与图片热度说明

本站使用 Cloudflare Worker 和 D1 保存访问与图片操作的聚合计数，页面继续由 GitHub Pages 托管。统计从功能上线时开始，不补造历史数据。

| 指标 | 计数口径 |
| --- | --- |
| 累计访问 | 五库及联合案例页打开后成功上报一次计一次；刷新页面会增加访问量 |
| 访客（估算） | 按随机浏览器标识去重；同一浏览器访问不同图库仍计一位访客 |
| 复制图片 | 剪贴板写入成功后计数；复制 ID、英文标签、预览图片不计入 |
| 下载 | 图片获取成功并发起文件保存后计数；浏览器无法确认用户最终是否保留文件 |
| 热门排序 | 当前筛选范围内，按复制图片次数＋下载次数从高到低排列；并列保持原始顺序 |

服装库的写实版与动画版分别统计；相同服装 ID 不跨版本合并。姿势库和深度库按姿势分组时，合计该组实际各视角的操作次数；单图模式按当前图片计数。两库分别统计。二次元库的发色变体分别统计，发型卡片的热门排序合计其五色变体；彩图和线稿归入同一姿势 ID。点击“打开原图”或在新标签页手动保存，无法可靠确认下载结果，因此不计入。

每次操作有独立事件编号，重复上报不重复累计。每个匿名浏览器每分钟最多接收 30 次同类上报。用于去重和限流的访问／操作明细保留约两天，之后清理；累计值与访客标识哈希保留。初始没有操作数据时保持原始顺序，不生成虚假热门记录。

## 访客估算与隐私

统计使用浏览器生成的随机标识，并保存在本机 localStorage；数据库仅保存该标识的 SHA-256 哈希，不保存原始标识、IP 地址、User-Agent、搜索关键词、完整页面 URL 或来源网页。访客数是浏览器级估算：清理本机数据、更换浏览器或使用隐私模式可能再次计为新访客，不能理解为精确的自然人人数。

尊重浏览器的 Do Not Track 与 Global Privacy Control：启用时不上报访问或图片操作，但仍可读取公开聚合数据。可以通过清除站点的 localStorage 重置本机标识。本地开发预览不向正式统计写入数据。

统计与热门接口暂时不可用时，会显示不可用提示；图库浏览、复制和下载仍可使用。公开接口只返回聚合计数，不返回访客标识或操作明细。

## GitHub Star

导航的 Star 数来自本仓库 GitHub API，通常缓存 15 分钟。接口不可用时显示“—”，不以 0 替代未知数据。点击 GitHub 入口在新标签页打开项目；是否点 Star 由访问者自行决定。

## 维护

- 前端：`assets/site.js`；服务地址：`assets/site-config.js`。
- 后端：`worker/src/index.js`；数据库结构：`worker/schema.sql`。
- 图片白名单：`worker/catalog.json`，由 `python3 scripts/metrics_catalog.py` 从五库索引生成。
- 保留现有字段的增量更新使用 `worker/schema.sql`；未来数据库结构变更应使用独立迁移，避免覆盖累计数据。
- 服务使用 Cloudflare 免费计划，达到计划限制时请求可能暂时失败，不自动升级付费计划。

```bash
python3 scripts/metrics_catalog.py --check
node --test tests/test_metrics.js tests/test_site.js
cd worker
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 deploy --dry-run
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.156.0 deploy
```

发布需要有本机 Cloudflare 登录授权。登录凭据留在本机，不能写入仓库或前端配置；只有公开服务 URL 和非秘密资源 ID 随项目发布。首次创建数据库时执行 schema，定时触发器每天清理过期明细。

参考：[Cloudflare D1 文档](https://developers.cloudflare.com/d1/)、[D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[Workers 定时触发器](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。
