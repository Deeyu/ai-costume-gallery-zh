# SEO / GEO 维护说明

## 优化范围与核验边界

项目名称统一为“AI 参考图库中文版”，面向需要服装、虚构人物脸型、人体动作线稿、深度图及二次元角色参考的成年创作者。五库导航保持不变，服装库内部区分写实／动画两个版本。本轮保留图库交互、素材来源、内容提示和已有访问统计，不新增第三方追踪服务。

2026-11-02 核查发现：About 漏了服装动画版；每库只有前 12 条静态预览，其余记录依赖 JavaScript；案例页缺少完整 Twitter 信息及视频结构化描述；页面内容更新与数据快照日期没有分开说明。这里记录实现与检查结果，不代表已获得搜索排名、自然流量或 AI 引用。

## GitHub About 与仓库检索

About 简介：

> AI 参考图库中文版｜服装（写实 1,407 套／动画 1,320 套）、脸型 1,499 张、姿势线稿与深度图各 1,439 张、二次元 843 条目。面向 AI 绘画、角色设计与漫剧分镜，支持中文检索、多视角浏览、图片复制与下载。开源静态站点，保留原始来源及使用条件。

网站地址：<https://deeyu.github.io/ai-costume-gallery-zh/>

主题标签保留现有内容与技术主题，并补充 `anime-costume`、`character-reference`、`text-to-image`。这些标签用于描述真实内容，不代表本站提供图像生成模型或服务。README 保留五库独立介绍、真实数量、截图、用法与底部来源表，增加文字目录入口及常见联合使用问题。

## 页面内容与搜索意图

| 页面 | 主要检索意图 | 内容依据 |
| --- | --- | --- |
| 服装写实版 | AI 服装库、衣装搭配、角色服装设计 | 1,407 套服装；季节、场合、颜色、材质与 PNG |
| 服装动画版 | 动漫衣装、动画角色造型 | 1,320 套；独立原站、编号及关键词 |
| 脸型库 | AI 人像、人物五官、发型、角色定妆 | 1,499 张图像记录；893 张正面脸图与 606 张造型参考 |
| 姿势库 | 人体动作线稿、绘画参考、漫剧动作 | 288 组、1,439 张；4 体系及 5 种视角 |
| 深度库 | 姿态、空间遮挡、分镜参考 | 与姿势库配对的 288 组、1,439 张深度图 |
| 二次元库 | 二次元发型、衣装、英文标签 | 843 基础条目、1,027 张彩图（含发色变体）及 281 张线稿 |
| 联合案例 | AI 绘画多图参考、脸型＋服装＋姿势 | 用户提供的视频与两张参考合集、中文步骤及半格原帖 |

标题与摘要按各页用途编写，H1 保留现有图库名称。可见说明、Markdown 摘要与 Schema 使用一致的名称、计数和来源。不会用隐藏关键词、虚构评分或改写使用条件来增加曝光。

## 完整文字目录与无限滚动

交互图库仍按原有逻辑滚动加载图片，并保留首批 12 条静态预览。新增 `/directory/` 及六个版本的完整 HTML 文字目录，共七个页面。它们与图库使用同一份 JSON，按分类直接列出编号、中文名称与原始词条。无需启用 JavaScript、点击“加载更多”或滚动到底，浏览器查找即可定位全部记录。

六个目录合计 8,131 条索引记录：1,407＋1,320＋1,499＋1,439＋1,439＋1,027。它们不是 8,131 个独立人物或造型；姿势视角、二次元发色变体及线稿与基础条目的区别分别说明。目录只包含文字，未新增图片镜像、批量下载或第三方请求。

图库介绍、README、`catalog.md`、案例页与 `llms.txt` 提供目录链接。站点地图列出七个原有页面和七个目录页，共 14 个自引用 canonical HTML 地址。目录有实际记录内容，不为同一条素材生成大量重复的关键词页面，也不单独提交筛选和排序 URL。

## 元数据与结构化信息

- 各页提供独立标题、摘要、自引用 HTTPS canonical、Open Graph 与 Twitter 卡片；分享图尺寸与实际文件核对。
- 图库保留 WebSite、Person、ImageGallery、Dataset、BreadcrumbList，并明确源码仓库的 SoftwareSourceCode。
- MIT 许可只标在独立代码节点上；Dataset 与第三方图片指向原始来源和使用条件，不继承代码许可。
- 原作者发布推文加入对应 Dataset 的 citation；姿势与深度保留 Anhao 中文来源引用。
- 二次元基础条目数、彩图记录数与线稿数分开表示，避免把 843 和 1,027 混为同一计数。
- 案例页用 WebPage 与 VideoObject 描述实际演示文件、封面和时长。`ffprobe` 测得 5.178005 秒，Schema 使用 `PT5.178S`；视频首次纳入公开仓库的提交时间为 `2026-10-30T17:14:59+08:00`。
- 姿势、深度图库及其文字目录保留 `rating=adult`、`isFamilyFriendly=false`；所有页面底部保留完整内容提示。

首批静态预览与目录面向所有访问者开放，不按爬虫身份更换内容。目录不加载第三方图片，图库的成人向标签确认逻辑保持原样。

## 日期与生成维护

`scripts/seo.py` 统一管理页面、Markdown、目录、站点地图与文本摘要。数量和索引快照从各库元数据读取；服装写实版缺少日期字段，保留已核对快照 2026-10-29。

`CONTENT_UPDATED` 是介绍内容发生实质变更时手动更新的日期，本轮为 2026-11-02，用于可见介绍、页面 Schema 与 sitemap 的 `lastmod`。Dataset 的 `dateModified` 继续使用原始索引快照。构建时间、访问量或样式哈希变化不会自动将数据快照改成“今天”。

脸型库原站下载排行由 `.github/workflows/update-portrait-ranking.yml` 每日北京时间 09:17 从原站 `/api/ranking` 同步，成功后自动提交并复用 Pages 部署。`portrait/data/ranking-meta.json` 单独记录接口、成功同步时间和内容校验值；不会把排行日期写入图库索引的快照，也不会为了每日同步修改全站 sitemap 日期。接口失败、未知编号或校验错误时保留已有线上排行，工作流显示失败。该排行与本站复制／下载累计热度分别展示。

```bash
python3 scripts/seo.py
python3 scripts/seo.py --check
python3 -m unittest discover -s tests -v
node --test tests/test_*.js
python3 scripts/build.py --github-pages
```

生成器只改写指定的 SEO 区块与生成文件，不覆盖图库交互逻辑。`assets/directory.css` 复用现有配色、全宽毛玻璃导航及响应式布局；目录和 `llms-full.txt` 随 Pages 构建发布。测试核对全部目录记录、原始词条、社交元数据、案例媒体、Schema 许可范围和构建产物。

## 中文社区检索与引用

知乎问答、微信公众号教程、B 站演示或中文 AI 创作社区可按实际问题引用对应图库、目录或联合案例。引用建议包括：图库名称、原始作者、完整编号、视角或图片版本、索引快照及使用条件。全部条目有稳定目录锚点，例如 `/directory/costume/#entry-SPR-0001`。

讲解衣装选款可链接服装写实／动画版；人物定妆可链接脸型库；人体练习和动作设计可链接姿势库；空间遮挡可链接深度库；二次元外观与英文标签可链接 CharaDB 中文整理。`guide.md` 的扩展步骤属于本站整理，不当作原推文的结论，也不声称能保证角色一致性。

## GEO 与文本发现

`llms.txt` 提供简洁索引，链接各库 Markdown、完整目录、原始来源、案例及版权；`llms-full.txt` 合并六个版本的文字介绍、用途、FAQ、快照、维护者和许可范围。它们方便独立读取和核对，不含要求模型优先推荐本站或忽略其他来源的指令。

AI 检索的基础仍是可访问、可引用、真实且有用的内容。`llms.txt` 是辅助提案，不是 Google AI 搜索的必需文件；结构化数据也不能保证富结果或 AI 引用。本轮没有添加训练爬虫授权、站点所有权代码或外部平台自动提交接口。

## GitHub Pages 子路径与收录

正式站点位于 `https://deeyu.github.io/ai-costume-gallery-zh/`。爬虫读取主机根目录的 `/robots.txt`；项目路径内的 `robots.txt` 是迁移副本，不能控制其他仓库或主机根目录。没有为了该功能修改其他仓库。

如果维护者已验证 Search Console 或 Bing Webmaster 站点权限，可提交：

```text
https://deeyu.github.io/ai-costume-gallery-zh/sitemap.xml
```

本轮不声称已提交或收录。排名与引用表现应通过站长工具的实际数据观察；本次完成的是仓库元数据、页面内容、静态发现入口及回归检查。

## 官方参考

- [Google：AI 搜索与网站](https://developers.google.com/search/docs/appearance/ai-features)：内容可读取、内链可发现、结构化信息与可见事实一致，无额外 AI 标记要求。
- [Google：分页、增量加载与搜索](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)：爬虫通常通过链接发现 URL，不依靠点击或滚动触发内容。
- [Google：站点地图](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)：提交正式 URL，`lastmod` 反映实际的重要内容更新。
- [Google：视频结构化数据](https://developers.google.com/search/docs/appearance/structured-data/video)。
- [Schema.org：SoftwareSourceCode](https://schema.org/SoftwareSourceCode)。
- [Google：robots.txt 位置与创建](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)。
