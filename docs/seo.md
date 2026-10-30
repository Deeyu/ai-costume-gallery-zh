# SEO / GEO 维护说明

## 本次优化的范围

仓库面向需要服装、虚构人物、人体姿势和深度图参考的成年创作者。四个正式入口分别对应这四种检索意图，保留现有 URL、四库常驻导航、内容提示与来源署名，不创建重复关键词页面，不引入统计、遥测或第三方运行时依赖。

优化前，页面只有基础标题和摘要，图片卡片由 JavaScript 生成，缺少 canonical、分享元数据、结构化索引与站点地图；仓库 About 仍只介绍服装库。这里记录的是实现及验证，不是自然搜索流量或排名报告。

## 已实现

| 范围 | 实现 |
| --- | --- |
| GitHub About | 四库介绍、实际规模、在线主页及主题标签 |
| 页面语义 | 四个独立 H1、标题和摘要，直接说明各库用途 |
| 正式地址 | 每页自引用 HTTPS canonical，与 sitemap、OG URL、结构化数据一致 |
| 分享预览 | 自制 1200×630 PNG；Open Graph 与 Twitter 标题、摘要及图片 |
| 静态可读 | 首批 12 张参考卡片、图库介绍、快照日期、数据入口和常见问题直接写入 HTML |
| 结构化信息 | WebSite、ImageGallery、Dataset、Person、BreadcrumbList；索引记录数与源数据校验 |
| 来源与权限 | 原作者、Anhao 中文词条、维护者及第三方使用条件分开表述，不把 MIT 扩展到图片 |
| 成人内容 | 保留用户指定的可见内容提示；姿势与深度页面标注 `rating=adult`、`isFamilyFriendly=false` |
| 发现入口 | 四页面 sitemap、页脚内链、每库 `catalog.md` 与项目 `llms.txt` |
| 回归保护 | 生成文件一致性、计数、canonical、分享图尺寸、静态卡片、结构化数据及构建打包测试 |

静态卡片是交互图库的首批真实记录；JavaScript 加载后由原有筛选逻辑接管。关闭 JavaScript 时仍可看到这些图片、点击查看预览或原图，并阅读介绍与常见问题。图像原有来源和下载限制保持不变。

## 更新方法

`scripts/seo.py` 统一管理四库的描述、用途与常见问题，数量及日期从各库元数据读取。服装库元数据没有日期字段，其已核对快照日期单独注明为 2026-10-29。更新原始索引后运行：

```bash
python3 scripts/seo.py
python3 scripts/seo.py --check
python3 -m unittest discover -s tests -v
node --test tests/test_*.js
python3 scripts/build.py --github-pages
```

生成器只更新带有 `seo:` 注释标记的页面块、H1、初始计数与指定静态文件，不覆盖图库交互程序、导航或内容提示。构建会重新生成 SEO 文件，CI 在构建前检查已提交版本，避免依赖构建才能发现未同步内容。

`assets/og-costume.png`、`og-portrait.png`、`og-pose.png`、`og-depth.png` 是项目自制文字分享卡片，不包含第三方图库图片。若收录规模、标题或品牌发生变化，需要同步更新分享图；常规 CI 不需要图像处理依赖。

## 中文社区检索与引用

站点使用简体中文内容与 `zh-CN` 语言标记，围绕中文创作者的具体问题编写说明。没有把同义词堆入隐藏文本，也没有创建内容相同的关键词页面。别名同步写入可见介绍、`catalog.md` 以及 ImageGallery / Dataset 的 `alternateName`；结构化关键词与页面实际主题一致。

| 中文检索问题 | 对应内容与入口 | 可分享的中文标题 |
| --- | --- | --- |
| AI 服装库、衣装参考、角色服装设计 | 服装库：季节、场合、双语关键词及 PNG | 1,407 套衣装参考：为 AI 绘画与漫剧选择角色穿搭 |
| AI 脸库、人像参考、角色定妆、发型参考 | 脸库：正面脸图与造型参考；说明图像数不等于人物数 | AI 脸库中文版：挑选五官、发型与角色外观参考 |
| 人体姿势参考、动作线稿、绘画人体练习 | 姿势库：体系、动作、视角与完整 ID | 288 组人体姿势参考：按动作与机位选择线稿 |
| 深度图、空间遮挡、漫剧分镜透视 | 深度库：灰度远近及同 ID 配对 | 深度图参考怎么用：匹配姿势、视角与空间关系 |
| 姿势和服装怎么一起用、AI 漫剧角色一致性 | [四库联合使用指南](../guide.md)：三种组合、中文提示词及核对方法 | 从衣装到分镜：四个 AI 参考图库的联合使用方法 |

微信公众号教程、知乎回答和 B 站演示可按主题引用对应图库入口，并附项目链接、素材作者及使用条件。项目名称统一为“AI 参考图库中文版”，单库名称与页面标题保持一致；图像引用还需遵守原站规则。以上是供维护者使用的选题与引用建议，本次没有向社区发帖，也没有接入统计、站长验证或自动提交接口。

面向中文问答与生成式检索，四页均直接提供“做什么、怎么选、如何配合、有哪些限制”的静态答案；每页页脚显示四库完整来源网址及原作者。`llms.txt` 链接可独立读取的中文指南与四库摘要，方便核对实际数量、素材编号和来源。案例思路链接到[半格的原帖](https://x.com/ai_bange/status/2115651909948477678)，脸库、深度库的扩展流程明确标注为本站整理，不当作原帖结论或实测效果。

## GitHub Pages 子路径限制

正式站点位于 `https://deeyu.github.io/ai-costume-gallery-zh/`。搜索引擎读取主机根目录的 `https://deeyu.github.io/robots.txt`；本项目内 `/ai-costume-gallery-zh/robots.txt` 是可供迁移使用的副本，不能代替或修改主机根目录策略。没有为了该功能创建或修改其他仓库。

页面通过 sitemap 链接与常驻导航提供发现入口。若维护者拥有 Search Console / Bing Webmaster 的站点权限，可提交：

```text
https://deeyu.github.io/ai-costume-gallery-zh/sitemap.xml
```

没有添加未经验证的站点所有权 meta，没有声称已提交搜索平台或已完成收录。Fork、更换域名或改变项目路径时，需要修改 `scripts/seo.py` 的 `BASE`、`REPOSITORY`，重新生成并检查 canonical、站点地图、摘要链接和分享图片地址。

## GEO 的实际含义与限制

本项目的 GEO（生成式引擎优化）以可读取、可抽取、可核验为目标：说明“是什么、多少条、做什么、来自哪里、何时快照、如何使用、许可边界”。`llms.txt` 和各库 Markdown 摘要提供简洁入口，不包含要求模型推荐本站或忽略其他信息的指令。

`llms.txt` 仍是辅助格式提案，不是 Google AI 搜索的收录条件。结构化数据只描述页面中可见的事实，不虚构评分、用户规模、权威身份或授权。正常抓取、有效 schema 和完整元数据均不保证搜索排名、富结果或 AI 引用，也不代替搜索平台的实际表现监测。

## 官方与原始参考

- [Google：AI 搜索与网站](https://developers.google.com/search/docs/appearance/ai-features)：无需专门 AI 标记，重要内容应以文本呈现，结构化信息应与可见内容一致。
- [Google：结构化数据政策](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)。
- [Google：robots.txt 的位置与创建](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)。
- [Google：成人内容元数据](https://developers.google.com/search/docs/specialty/explicit/guidelines)。
- [Schema.org ImageGallery](https://schema.org/ImageGallery)、[Dataset](https://schema.org/Dataset)。
- [llms.txt 原始提案](https://llmstxt.org/)。
