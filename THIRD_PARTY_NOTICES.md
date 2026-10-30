# 第三方内容、版权与致谢

## 服装库素材来源

- 原始站点：[衣装集 COSTUME-DB-01](https://ai-costume-gallery.pages.dev/)。
- 原作者：[ギア（@giaaibusi）](https://x.com/giaaibusi)。
- 原作者推文：[查看原文](https://x.com/giaaibusi/status/2115638135208260002)。
- 当前数据快照：2026-10-29，1,407 套服装；每套包含缩略图、预览图、PNG 原图三个版本。

感谢原作者制作并公开上述服装参考图库。本项目保留原始 ID、英文关键词和素材路径，另附中文翻译供检索与参考。本项目是独立的中文整理与静态站点学习实践，不代表原作者的官方版本或背书。

## 脸型库素材来源与原站说明

- 原始站点：[AIモデル顔データベース](https://ai-portrait-gallery.pages.dev/)。
- 原作者：[あぎ（@agi_aibusi）](https://x.com/agi_aibusi)。
- 原作者推文：[查看原文](https://x.com/agi_aibusi/status/2113187345814204557)。
- 当前索引快照：2026-10-30，1,499 张参考图（893 张正面脸图、606 张造型参考）。该计数不是独立人物数量。

原站将图片标注为 CC0 1.0，说明人物为 AI 生成的虚构人物，允许商用、编辑和参考使用；同时要求不要冒充真实人物，并请求不要重新分发、转载图像数据。原始说明见[原站使用规则](https://ai-portrait-gallery.pages.dev/#rules)，许可说明见 [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hans)。

本仓库仅保存脸型库元数据、中文翻译及排行快照，图片仍从原站加载和下载，没有将脸型库图片镜像到仓库。感谢原作者公开参考图库；中文版本独立编写，不代表原作者的官方版本或背书。翻译用于辅助理解，请以原始说明为准。

## 姿势库素材与中文词条来源

- 原始图片与日文索引：[AI 姿势图库](https://ai-pose-gallery.pages.dev/)，原作者 [ギア（@giaaibusi）](https://x.com/giaaibusi)。
- 中文词条：[Anhao/ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh)，Copyright (c) 2026 Anhao。
- 固定来源提交：[`072a3690af6e7e0011abbe0fa1ccc08939fbb47d`](https://github.com/anhao/ai-pose-gallery-zh/tree/072a3690af6e7e0011abbe0fa1ccc08939fbb47d)。
- 当前快照：2026-10-30；完整 288 组、1,439 条图片记录，涵盖 4 个体系、26 个分类。标准全身 365 张、另一全身体系 399 张、上半身 400 张、双人 275 张；保留来源体系与分类名称。
- 用途：人体动作教学、绘画练习、身体结构与构图参考。素材是无面部、无生殖器细节的人体模型线稿。本项目的用途说明不代表原作者的教学认证、背书或额外授权。
- 上游缺项：`full_sexy_P018` 缺少仰视图，仅有 4 个视角，其余 287 组各有 5 个视角。按实际记录收录，不补造图片。

原站说明允许商用、编辑及绘画参考，禁止图片批量下载（含工具自动获取），以及图像数据的再分发、转载和转售。因此本仓库仅保存完整日文与中文索引，姿势图片按需从原站逐张加载和下载，没有将图片上传到仓库，也不提供批量图片下载功能。

感谢 Anhao 的中文词条整理；`pose/data/upstream-zh.json` 保留完整 1,439 条中文快照，`pose/data/pose.json` 保留完整原始日文记录，`pose/data/pose-zh.json` 在其基础上添加原站 URL、分组与双语检索字段，`pose/data/translations.csv` 保留对照。参考项目完整许可原样附于 [pose/UPSTREAM_LICENSE](pose/UPSTREAM_LICENSE)。其 MIT 适用范围仅限代码，并排除原始数据及图片，对原始素材另有“不得用于商业用途”的表述，与原站说明并不完全一致。本项目不更改上游许可，不对第三方数据或译文扩大授权；商用范围应向原权利人确认。

姿势库界面与维护脚本为独立实现，未复制 Anhao 的程序代码。中文整理不代表原作者或参考项目维护者的官方版本、背书或授权。

## 深度库素材与中文词条来源

- 原始站点：[POSE-DB-02 深度图库](https://ai-pose-depth-gallery.pages.dev/)，原作者 [ギア（@giaaibusi）](https://x.com/giaaibusi)。
- 当前快照：2026-10-30，288 组、1,439 张人体模型深度图；保留四个体系、26 个分类、原始编号及实际视角。`full_sexy_P018` 缺少仰视图。
- 中文词条：复用本项目姿势库的 Anhao 固定提交 `072a3690af6e7e0011abbe0fa1ccc08939fbb47d` 快照，已核对深度原站每条 ID、日文姿势名、分类与视角完全一致。中文快照存于 `depth/data/upstream-zh.json`，完整来源许可附于 [depth/UPSTREAM_LICENSE](depth/UPSTREAM_LICENSE)，署名 Copyright (c) 2026 Anhao。

原站允许作品创作中的商用、编辑、参考使用，禁止图像数据（含原尺寸及加工后）的再分发、转载和转售，以及图片批量下载（含工具自动获取）。因此本仓库仅存储元数据与译文，图片按需从深度原站加载和单张下载，不镜像图片。翻译参考项目的素材范围另有表述，沿用上文姿势库的许可范围说明，不扩大第三方素材或中文词条授权。

深度库的 HTML、JavaScript 为本项目独立实现，共用姿势库的筛选函数与布局样式，不复制或执行原站程序，不接入原站的统计或引流。整理不代表原作者或中文词条维护者的官方版本、背书或授权。

## 许可范围

| 内容 | 路径 | 说明 |
| --- | --- | --- |
| 服装库图片 | `thumbs/`、`img/`、`png/` | 相关权利归原权利人所有，不适用本项目 MIT 许可 |
| GitHub 官方 Logo | `assets/github-mark.svg` | 来源于 [GitHub 官方品牌素材](https://brand.github.com/foundations/logo)，用于链接本项目仓库；相关商标及素材权利归 GitHub, Inc. 所有，不适用本项目 MIT 许可 |
| 服装库原始与中文数据 | `data/` | 基于原站元数据及其译文；不因汉化或镜像而获得额外素材授权，不适用本项目 MIT 许可 |
| 脸型库图片 | 原站图片 URL，未存储在仓库 | 原站标注 CC0，并附上述使用说明及不再分发图片的请求 |
| 脸型库原始与中文索引 | `portrait/data/` | 原站元数据、译文和排行快照；素材使用条件以脸型库原站说明为准，不适用代码 MIT 许可 |
| 姿势库图片 | 原站图片 URL，未存储在仓库 | 相关权利归原权利人所有，适用上文的来源说明，不适用代码 MIT 许可 |
| 姿势库原始与中文索引 | `pose/data/` | 原始数据归原作者，中文词条基于 Anhao 的整理；保留来源及参考项目许可，不适用本项目独立代码的 MIT 许可 |
| 深度图及索引 | 图片引用原站，元数据与译文位于 `depth/data/` | 适用上文深度库来源与中文词条许可说明，不适用独立代码 MIT 许可 |
| 本项目独立程序代码 | `index.html`、`assets/`、`portrait/`、`pose/`、`depth/` 中的 HTML/CSS/JavaScript、`scripts/`、`tests/`、工作流 | 依照 [LICENSE](LICENSE) 中的 MIT 许可使用，不覆盖上列第三方素材及数据 |

本项目不对第三方素材主张权利，也不扩大原作者的许可范围。四个图库分别适用各自来源说明；中文翻译不能替代原作者的原始说明。

## 参考项目致谢

感谢 [Anhao](https://github.com/anhao) 开源的 [ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh)。本项目参考其素材镜像、完整汉化、可复现下载与静态画廊的整理思路，并应用于服装图库；姿势库进一步完整接入其 1,439 条中文记录，用于人体动作教学与绘画参考，来源与许可保留如上。界面和脚本由本项目独立编写，未复制参考项目代码。该参考关系不意味着参考项目维护者为本项目或素材使用提供背书或授权。

## 权利联系

权利人如对收录内容有异议，请通过 [本项目 GitHub Issue](https://github.com/Deeyu/ai-costume-gallery-zh/issues) 提供素材 ID、涉及路径和相关说明。维护者将核实并及时删除或调整相关内容。

## 筛选与浏览界面参考

姿势库与深度库的直接筛选、取消选项、展开动作和缩略图视角切换等交互，参考 [HAL-9909](https://github.com/HAL-9909) 提交的 [Anhao/ai-pose-gallery-zh PR #3](https://github.com/anhao/ai-pose-gallery-zh/pull/3)，参考提交为 `3651dd8f4af0f5632752c06e949ba959f31a67a0`。本项目在现有页面、脚本与样式基础上独立适配，未引入该 PR 的图标、标志或其他第三方依赖。该交互参考不改变图库图片与中文词条的原有使用条件。

## 联合使用案例媒体

`examples/joint-reference-demo.mp4`、`costume-reference.png`、`pose-reference.jpeg` 为用户提供的案例视频与参考合集；`joint-reference-poster.jpg` 从该视频截取。关联使用思路见 [半格的原帖](https://x.com/ai_bange/status/2115651909948477678)。原始服装与姿势素材归ギア等原权利人所有，媒体展示不适用本项目独立代码的 MIT 许可，不提供额外授权。
