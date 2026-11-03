# 项目维护手册

[返回项目首页](../README.md) · [SEO / GEO 维护](seo.md) · [统计与隐私](../statistics.md)

下面的命令均从仓库根目录执行。在线使用请看[使用指南](../guide.md)。

## 目录

```text
index.html                 中文静态画廊
assets/                    CSS、JavaScript、图标
data/costume.json          原始记录（保持原始日文字段）
data/costume-zh.json       中文分类、关键词及双语检索字段
data/meta-zh.json          分类计数
data/translations.csv      分类及关键词对照
thumbs/                    WebP 缩略图
img/                       WebP 预览图
png/                       PNG 原图
scripts/                   提取、翻译、下载、校验、构建
costume-anime/             服装库动画版（独立索引与链接，复用服装页面程序）
scripts/costume_anime.py   动画衣装公开 JSON 提取、翻译及校验，不下载图片
tests/                     数据与提取安全校验
portrait/                  脸型库中文版（独立子页面、界面与数据）
portrait/data/portrait.json 原始脸型库元数据
portrait/data/portrait-zh.json 中文发长、发型及检索字段
portrait/data/ranking-zh.json 原站下载排行快照
scripts/portrait.py        脸型库元数据提取、翻译及校验
pose/                      姿势库中文版（分组、单图与多视角浏览）
pose/data/pose.json         完整 1,439 条原始日文记录
pose/data/upstream-zh.json  Anhao 完整中文词条快照（1,439 条）
pose/data/pose-zh.json      中文检索、分组与原站图片 URL
pose/UPSTREAM_LICENSE      Anhao 参考项目的完整许可与范围说明
scripts/pose.py            姿势索引同步、来源记录与校验
depth/                     深度图中文版（页面、完整索引与来源许可）
scripts/depth.py           深度原站索引提取、中文词条核对及校验
anime/                     二次元库（完整公开索引、五色预览、线稿与图片复制）
scripts/anime.py           CharaDB 安全提取、中文翻译与完整性校验
scripts/seo.py             五库搜索元数据、静态介绍与摘要生成/校验
examples/                  项目演示播放器、视频与封面
sitemap.xml                各图库、文字目录与演示页的正式地址
llms.txt                   AI 检索摘要与来源入口
catalog.md                 服装库纯文本介绍（各子库也有独立文件）
guide.md                   五库使用指南
docs/seo.md                SEO/GEO 维护方法、中文检索场景与托管边界
.github/workflows/         数据校验与 GitHub Pages 自动部署
LICENSE                    本项目独立程序代码的 MIT 许可
THIRD_PARTY_NOTICES.md      第三方素材、许可范围与致谢
statistics.md              访问人数、图片热度、隐私与维护说明
worker/                    Cloudflare 统计服务、D1 表结构与图片 ID 白名单
```

## 服装库数据结构

`data/costume.json` 保留原始日文字段；`data/costume-zh.json` 是前端读取的中文记录。

| 字段           | 示例或含义                           |
| -------------- | ------------------------------------ |
| `id`         | `SPR-0001`，沿用原站唯一编号       |
| `分类`       | 春装等 8 个中文分类                  |
| `关键词`     | 中文关键词数组                       |
| `英文关键词` | 原始英文关键词，便于对照与搜索       |
| `缩略图`     | `thumbs/SPR-0001.webp`             |
| `预览图`     | `img/SPR-0001.webp`                |
| `原图`       | `png/SPR-0001.png`                 |
| `检索`       | ID、分类及中英文关键词组成的检索文本 |

GitHub Pages 构建只在 `dist/data/costume-zh.json` 中将 `原图` 改为 GitHub 地址，自动部署时固定到对应提交；仓库源数据保持本地相对路径。

## 本地预览与更新

使用 Python 3.10+，所有脚本仅依赖标准库。

```bash
python3 scripts/sync.py                      # 重新提取原站数据、生成中文数据
python3 scripts/sync.py --html /path/to/saved.html  # 也支持浏览器另存的页面
python3 scripts/download.py                  # 下载所有素材，已完成的文件自动跳过
python3 scripts/verify.py --assets           # 校验全部 4,221 张图片及数据
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 [http://127.0.0.1:8000](http://127.0.0.1:8000)。由于页面通过 fetch 读取 JSON，请通过 HTTP 预览。代理可通过标准 `HTTPS_PROXY` 环境变量指定；勿将凭证写入仓库。更新原站数据时如出现新关键词，先补充 `scripts/translate.py`，避免漏译。

```bash
python3 scripts/translate.py
python3 -m unittest discover -s tests -v
node --check assets/app.js
python3 scripts/build.py
```

## 自动部署到 GitHub Pages

本仓库使用 [GitHub Actions 工作流](../.github/workflows/deploy.yml) 自动部署到：

**https://deeyu.github.io/ai-costume-gallery-zh/**

每次推送到 `main`，工作流会运行五个图库及服装动画版的单元测试、导航与内容提示检查、JavaScript 语法检查、写实服装素材校验，以及各库完整索引校验，执行 `python3 scripts/build.py --github-pages`，然后发布到 `dist/`。服装库写实版保持根路径，动画版位于 `/costume-anime/`；脸型库位于 `/portrait/`，姿势库位于 `/pose/`，深度库位于 `/depth/`，二次元库位于 `/anime/`。也可进入 Actions →「部署 GitHub Pages」→ Run workflow 手动部署。使用仓库内置的 `GITHUB_TOKEN`，无需额外配置密钥。

GitHub Pages 的[站点大小上限为 1 GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。Pages 发布目录包含页面、数据、版权文件、演示媒体及写实服装缩略图和预览图；构建时会报告实际体积并检查大小上限。写实服装 PNG 原图仍完整保留在 `png/`，下载按钮从 GitHub 获取原图并保存。动画服装、脸型库、姿势库、深度库与二次元库图片分别由各自原站提供。下载失败时可使用「打开原图」后保存。

Fork 后部署：

1. 在仓库 Settings → Pages → Build and deployment 中，将 Source 设为 **GitHub Actions**。
2. 启用仓库 Actions，推送到 `main` 或手动运行「部署 GitHub Pages」。
3. 工作流会使用当前仓库与提交生成原图地址。页面中的维护者、仓库链接，以及项目 README 的站点地址需按实际情况修改。

本地验证 Pages 发布目录：

```bash
python3 scripts/build.py --github-pages
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

页面资源使用相对路径，支持 `/ai-costume-gallery-zh/` 这样的项目子路径。`_headers` 是 Cloudflare Pages 配置，GitHub Pages 不使用该文件。

## 其他静态托管

Cloudflare Pages 可连接本仓库，框架选择 None，构建命令 `python3 scripts/build.py --github-pages`，输出目录 `dist`。该构建保留网页预览，原始写实服装 PNG 通过 GitHub 提供。若使用不带参数的完整构建，请先确认托管平台的容量限制。构建目录排除 Git 历史和维护脚本。

## 更新各库索引

| 图库 | 更新 | 校验 |
| --- | --- | --- |
| 服装写实版 | `python3 scripts/sync.py` | `python3 scripts/verify.py --assets` |
| 服装动画版 | `python3 scripts/costume_anime.py sync` | `python3 scripts/costume_anime.py verify` |
| 脸型库 | `python3 scripts/portrait.py sync` | `python3 scripts/portrait.py verify` |
| 姿势库 | `python3 scripts/pose.py sync` | `python3 scripts/pose.py verify` |
| 深度库 | `python3 scripts/depth.py sync` | `python3 scripts/depth.py verify` |
| 二次元库 | `python3 scripts/anime.py sync` | `python3 scripts/anime.py verify` |

服装写实版 1,407 套，每套有缩略图、预览图和 PNG 三个版本，共 4,221 个文件。其余图库保存公开索引，图片由原站逐张提供。同步脚本解析公开元数据，不执行原站 JavaScript。写实服装下载请使用仓库已有的下载脚本；其余图库的原站素材使用条件见[第三方说明](../THIRD_PARTY_NOTICES.md)。

- 动画服装与深度库可用 `sync --html /path/to/saved.html` 读取已保存页面。
- 脸型库可用 `sync --images-js /path/to/images.js --ranking-js /path/to/ranking.js` 读取本地快照。`check-images --limit 8` 通过 HEAD 抽查远程图片。
- 姿势库可用 `--commit` 指定上游提交，或同时提供 `--original-json`、`--chinese-json`、`--license` 使用本地索引。深度库会逐条核对编号、日文名称和视角。两库的 `full_sexy_P018` 均缺少仰视图。
- 二次元库可用 `sync --data-js /path/to/data.js` 读取公开快照。若出现未翻译词条或索引异常，先校正词典与来源，再提交。

### 脸型库每日排行

[每日工作流](../.github/workflows/update-portrait-ranking.yml)在北京时间 09:17 从原站 `/api/ranking` 获取排行，校验后自动提交并部署。失败时保留上次发布的数据。排行同步时间独立于图库索引的快照日期。

```bash
python3 scripts/portrait.py sync-ranking
python3 scripts/portrait.py verify
```

### 提交前校验

```bash
python3 scripts/seo.py
python3 scripts/seo.py --check
python3 -m unittest discover -s tests -v
node --test tests/test_*.js
python3 scripts/build.py --github-pages
```

## 替换项目演示

`examples/` 保留播放器的公开地址。更新 `project-demo.mp4` 与 `project-demo-poster.png` 后，用 `ffprobe` 核对时长，更新 `scripts/seo.py` 中的演示元数据并重新生成。README 封面链接到播放器，GitHub Pages 托管视频与下载入口。
