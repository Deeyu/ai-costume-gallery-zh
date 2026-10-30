"""Generate crawlable gallery descriptions and SEO files from the actual catalog metadata."""
import argparse
from html import escape
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://deeyu.github.io/ai-costume-gallery-zh/'
REPOSITORY = 'https://github.com/Deeyu/ai-costume-gallery-zh'
SITE_NAME = 'AI 参考图库中文版'
NOTICE = '图库包含成人向姿势参考（部分分类名称涉及性行为术语），仅供艺术创作、动作参考与前端技术学习使用。请勿用于违法用途。未成年人请勿访问。'
CATALOGS = [
    dict(key='costume', path='', name='服装库', label='AI 服装参考库中文版',
         meta='data/meta-zh.json', data='data/costume-zh.json', snapshot='2026-10-29',
         source='https://ai-costume-gallery.pages.dev/', creator='ギア',
         creator_url='https://x.com/giaaibusi',
         aliases=['AI 服装库', '衣装参考库'],
         scenario='中文创作场景：为 AI 绘画、漫剧和短剧选取角色服装，建立角色定妆参考；用春装、外套等中文关键词查找，再结合脸库与姿势库制作分镜。',
         purpose='无人物衣装搭配、角色服装设计与漫剧造型参考',
         coverage='春装、夏装、秋装、冬装、内衣、派对、泳装、性感，共 8 个分类',
         feature='中文分类、中英文关键词与 ID 搜索、服装预览、PNG 原图下载',
         delivery='服装图片保存在仓库；在线预览由 GitHub Pages 提供，PNG 原图由 GitHub 仓库提供。',
         questions=[('服装库适合用来做什么？', '用于查找不含人物的服装搭配，为角色设定、AI 绘画和漫剧造型提供参考；脸、体型和背景需要另行指定。'),
                    ('服装数量和图片文件数有什么区别？', '每套服装有缩略图、预览图、PNG 原图三个版本，三份文件对应同一套服装，不能按图片文件数计算不同服装。'),
                    ('可以直接将标签当成生成提示词吗？', '标签来自原站元数据的中文翻译，用于检索，可能不完整；请结合图片和创作需求补充提示词。'),
                    ('做漫剧角色定妆，服装库和脸库怎么配合？', '先选单套衣装 PNG，再选脸库的虚构人物参考，在支持多图参考的工具中分别说明衣装和五官要求；保存确认后的定妆图，供后续分镜复用。')]),
    dict(key='portrait', path='portrait/', name='脸库', label='AI 脸库中文版',
         meta='portrait/data/meta-zh.json', data='portrait/data/portrait-zh.json',
         source='https://ai-portrait-gallery.pages.dev/', creator='あぎ',
         creator_url='https://x.com/agi_aibusi',
         aliases=['AI 人像参考库', 'AI 虚构人物脸库'],
         scenario='中文创作场景：为 AI 绘画和漫剧挑选人物五官与发型，配合服装库建立角色设定。固定同一张脸部参考图有助于说明外观要求，角色一致性仍需逐镜核对。',
         purpose='AI 虚构人物的五官、发型与角色造型参考',
         coverage='正面脸图与造型参考两种模式，4 类发长、50 种细分发型',
         feature='中文发型与发长筛选、中日文及 ID 搜索、PNG 下载、原站下载排行快照',
         delivery='仓库保存原始与中文索引、排行快照；脸库图片和 PNG 由脸库原站提供。',
         questions=[('脸库里的图片是真实人物照片吗？', '原站说明这些是 AI 生成的虚构人物。图片用于五官、发型与角色外观参考，不代表真实人物，也不是人脸识别服务。'),
                    ('正面脸图和造型参考有什么区别？', '正面脸图便于观察五官与脸型；造型参考展示发型质感、服装与整体氛围，人物朝向可能不同。图片记录数不代表互不重复的人物数量。'),
                    ('脸库图片在仓库里吗？', '不在。仓库保存中文索引，页面按需加载原站图片；浏览和原图下载需要能够访问脸库原站。'),
                    ('做 AI 漫剧，脸库能保证角色一致性吗？', '固定脸图可以明确五官和发型参考，但不能保证不同镜头的人物完全一致；应复用已确认的定妆图，并逐镜检查脸型、发际线与服装细节。')]),
    dict(key='pose', path='pose/', name='姿势库', label='AI 姿势库中文版',
         meta='pose/data/meta.json', data='pose/data/pose-zh.json',
         source='https://ai-pose-gallery.pages.dev/', creator='ギア',
         creator_url='https://x.com/giaaibusi',
         aliases=['人体姿势参考库', '动作线稿库'],
         scenario='中文创作场景：为绘画人体练习、漫剧和短剧分镜选择站姿、坐姿与俯仰视角；配合服装参考说明动作和穿搭，保留完整姿势 ID 以便复用。',
         purpose='人体模型线稿的动作、身体结构与双人构图参考',
         coverage='4 个体系、26 个分类；正面、斜侧、侧面、俯视、仰视五种视角',
         feature='中文动作检索、体系与视角筛选、分组或单图浏览、键盘切换、PNG 下载',
         delivery='完整双语索引保存在仓库，姿势线稿和 PNG 按需由姿势原站提供。',
         questions=[('姿势库包含哪些参考内容？', '完整保留参考仓库的四个体系和原始分类名称，使用人体模型线稿观察动作与构图。包含成人向姿势及相关术语，仅限成年人艺术与动作参考。'),
                    ('为什么不是每组都显示五个视角？', '上游 full_sexy_P018 缺少仰视图，实际只有四张；其余 287 组各有五张。页面按已有图片显示，不生成缺失视角。'),
                    ('姿势线稿和深度图有什么区别？', '线稿强调身体轮廓、关节与动作结构；深度图用灰度表达远近。观察动作可使用姿势库，参考空间前后关系可使用深度库。'),
                    ('姿势图怎么用于中文 AI 绘画和分镜？', '先选动作与观察视角，再搭配服装或已确认的角色定妆图，明确每张图负责的内容；记录完整姿势 ID，便于在深度库匹配。人体线稿不等于 OpenPose 骨架控制图。')]),
    dict(key='depth', path='depth/', name='深度库', label='AI 深度图库中文版',
         meta='depth/data/meta.json', data='depth/data/depth-zh.json',
         source='https://ai-pose-depth-gallery.pages.dev/', creator='ギア',
         creator_url='https://x.com/giaaibusi',
         aliases=['人体深度图库', '姿势深度图参考库'],
         scenario='中文创作场景：为 AI 绘画、漫剧和短剧分镜选择深度参考，观察透视、肢体遮挡与空间前后关系；与姿势库使用相同体系、姿势编号和视角配对。',
         purpose='人体模型深度图的姿态、遮挡与空间前后关系参考',
         coverage='4 个体系、26 个分类；与姿势库对应的编号和实际视角',
         feature='中文检索、多视角预览、分组或单图浏览、原尺寸深度 PNG 下载',
         delivery='完整双语索引保存在仓库，深度图和 PNG 按需由独立的深度原站提供。',
         questions=[('深度图的黑白代表什么？', '本图库的约定是白色越近、黑色越远，灰度表达模型与观察视角之间的前后关系。深度图不是姿势线稿，也不是法线图。'),
                    ('深度图怎么用于 AI 创作？', '选择姿势与视角，下载 PNG，再导入所用 AI 工具的深度参照功能。脸型、服装和背景需另行指定，具体参数以工具说明为准。'),
                    ('深度库与姿势库的内容是否对应？', '两库使用对应的姿势 ID、分类与视角，但图片来源和图像形式不同。full_sexy_P018 同样只有四个视角。包含成人向分类，仅限成年人艺术与动作参考。'),
                    ('漫剧分镜的姿势图和深度图怎么配对？', '用相同体系、姿势编号和视角组成的完整 ID 配对，例如 full_single_P015_front。深度 PNG 应导入工具支持的深度参照输入，普通图片参考不等于启用了深度控制。')]),
]


def info(catalog, root):
    meta = json.loads((root / catalog['meta']).read_text(encoding='utf-8'))
    unit = '套服装' if catalog['key'] == 'costume' else '张参考图'
    if catalog['key'] == 'depth':
        unit = '张深度图'
    elif catalog['key'] == 'pose':
        unit = '张人体模型线稿'
    count = f'{meta["total"]:,} {unit}'
    if 'groups' in meta:
        count = f'{meta["groups"]} 组、' + count
    snapshot = meta.get('snapshot', catalog.get('snapshot'))
    description = f'{catalog["label"]}，收录 {count}，用于{catalog["purpose"]}。{catalog["feature"]}。'
    if catalog['key'] in ['pose', 'depth']:
        description += '含成人向分类，仅限成年人艺术参考。'
    keywords = [catalog['name'], *catalog['aliases'], 'AI 绘画', '漫剧', '角色设定']
    return dict(catalog, keywords=keywords, total=meta['total'], groups=meta.get('groups'), count=count,
                snapshot=snapshot, description=description, url=BASE + catalog['path'])


def structured(data):
    url, site = data['url'], BASE + '#website'
    rights = BASE + 'THIRD_PARTY_NOTICES.md'
    dataset = {'@type': 'Dataset', '@id': url + '#dataset', 'name': data['label'] + '中文索引',
               'alternateName': data['aliases'], 'keywords': data['keywords'],
               'description': data['description'], 'url': url + 'catalog.md', 'inLanguage': 'zh-CN',
               'dateModified': data['snapshot'], 'creator': {'@type': 'Person', 'name': data['creator'], 'url': data['creator_url']},
               'contributor': {'@id': BASE + '#maintainer'}, 'isBasedOn': data['source'],
               'citation': [data['source'], REPOSITORY], 'usageInfo': rights,
               'conditionsOfAccess': '第三方图片及来源数据不适用项目代码的 MIT 许可，使用条件见版权与致谢。',
               'variableMeasured': [{'@type': 'PropertyValue', 'name': '索引记录数', 'value': data['total'], 'unitText': '条'}],
               'distribution': {'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': BASE + data['data']}}
    if data['groups']:
        dataset['variableMeasured'].append({'@type': 'PropertyValue', 'name': '姿势组数', 'value': data['groups'], 'unitText': '组'})
    if data['key'] in ['pose', 'depth']:
        dataset['citation'].append('https://github.com/anhao/ai-pose-gallery-zh')
    gallery = {'@type': 'ImageGallery', '@id': url + '#gallery', 'url': url, 'name': data['label'],
               'alternateName': data['aliases'], 'keywords': data['keywords'],
               'description': data['description'], 'inLanguage': 'zh-CN', 'isPartOf': {'@id': site},
               'publisher': {'@id': BASE + '#maintainer'}, 'mainEntity': {'@id': url + '#dataset'},
               'breadcrumb': {'@id': url + '#breadcrumb'},
               'primaryImageOfPage': {'@type': 'ImageObject', 'contentUrl': BASE + f'assets/og-{data["key"]}.png', 'width': 1200, 'height': 630}}
    if data['key'] in ['pose', 'depth']:
        gallery['isFamilyFriendly'] = False
    crumbs = [{'@type': 'ListItem', 'position': 1, 'name': SITE_NAME, 'item': BASE}]
    if data['path']:
        crumbs.append({'@type': 'ListItem', 'position': 2, 'name': data['name'], 'item': url})
    return {'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', '@id': site, 'url': BASE, 'name': SITE_NAME, 'inLanguage': 'zh-CN',
         'description': '服装、AI 人像、人体姿势线稿与深度图四库中文检索，供成年人艺术创作和角色设定参考。',
         'publisher': {'@id': BASE + '#maintainer'},
         'hasPart': [{'@id': BASE + item['path'] + '#gallery'} for item in CATALOGS]},
        {'@type': 'Person', '@id': BASE + '#maintainer', 'name': 'Deeyu', 'url': 'https://github.com/Deeyu'},
        gallery, dataset, {'@type': 'BreadcrumbList', '@id': url + '#breadcrumb', 'itemListElement': crumbs}]}


def head(data):
    prefix = '../' if data['path'] else ''
    image = BASE + f'assets/og-{data["key"]}.png'
    unit = {'costume': '套衣装', 'portrait': '张人像参考', 'pose': '张动作线稿', 'depth': '张深度图'}[data['key']]
    title = f'{data["label"]}｜{data["total"]:,} {unit}'
    fields = [('name', 'description', data['description']), ('name', 'author', 'Deeyu'),
              ('name', 'robots', 'index,follow,max-image-preview:large'),
              ('name', 'theme-color', '#364e79'), ('property', 'og:type', 'website'),
              ('property', 'og:site_name', SITE_NAME), ('property', 'og:locale', 'zh_CN'),
              ('property', 'og:title', title), ('property', 'og:description', data['description']),
              ('property', 'og:url', data['url']), ('property', 'og:image', image),
              ('property', 'og:image:type', 'image/png'), ('property', 'og:image:width', '1200'),
              ('property', 'og:image:height', '630'), ('property', 'og:image:alt', data['label'] + '：中文检索与 PNG 参考图'),
              ('name', 'twitter:card', 'summary_large_image'), ('name', 'twitter:title', title),
              ('name', 'twitter:description', data['description']), ('name', 'twitter:image', image),
              ('name', 'twitter:image:alt', data['label'] + '分享卡片')]
    if data['key'] in ['pose', 'depth']:
        fields.append(('name', 'rating', 'adult'))
    lines = [f'  <title>{escape(title)}</title>']
    lines += [f'  <meta {kind}="{key}" content="{escape(value, quote=True)}">' for kind, key, value in fields]
    lines += [f'  <link rel="canonical" href="{data["url"]}">',
              f'  <link rel="sitemap" type="application/xml" href="{prefix}sitemap.xml">',
              f'  <link rel="alternate" type="text/markdown" title="{data["label"]}纯文本介绍" href="catalog.md">',
              f'  <link rel="alternate" type="text/plain" title="AI 检索参考" href="{prefix}llms.txt">',
              '  <script type="application/ld+json">' + json.dumps(structured(data), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>']
    return '  <!-- seo:head:start -->\n' + '\n'.join(lines) + '\n  <!-- seo:head:end -->'


def overview(data):
    prefix = '../' if data['path'] else ''
    paragraphs = [f'{data["label"]}（{"、".join(data["aliases"])}）收录 {data["count"]}，用于{data["purpose"]}。{data["coverage"]}。', data['delivery'], data['scenario']]
    details = ''.join(f'<details><summary>{escape(question)}</summary><p>{escape(answer)}</p></details>' for question, answer in data['questions'])
    related = ' · '.join(f'<a href="{prefix + other["path"] if other["path"] else prefix or "./"}">{other["label"]}</a>' for other in CATALOGS if other['key'] != data['key'])
    body = '\n'.join(f'      <p>{escape(p)}</p>' for p in paragraphs)
    return f'''    <!-- seo:overview:start -->
    <section id="catalog-guide" class="catalog-guide" aria-labelledby="catalog-guide-title">
      <h2 id="catalog-guide-title">{data['name']}：收录内容与使用方法</h2>
{body}
      <p>索引快照：<time datetime="{data['snapshot']}">{data['snapshot']}</time> · 中文整理：<a href="https://github.com/Deeyu">Deeyu</a> · <a href="{prefix + data['data']}">中文 JSON 索引</a> · <a href="catalog.md">纯文本介绍</a></p>
      <h3>常见问题</h3>
      {details}
      <p>其他图库：{related}</p>
      <h3>四库联合使用：角色定妆与分镜</h3>
      <p>先用姿势线稿说明动作、服装图说明穿搭，再加入脸部参考明确人物外观；需要空间参照时选择同编号同视角的深度图。按工具实际支持的参考功能分步使用，并检查人物一致性与遮挡关系。</p>
      <p><a href="{prefix}guide.md">中文联合使用指南与提示词示例</a> · 思路参考：<a href="https://x.com/ai_bange/status/2115651909948477678" target="_blank" rel="noopener">半格（@ai_bange）的姿势与服装联合参考案例</a></p>
    </section>
    <!-- seo:overview:end -->'''


def previews(data, root):
    rows = json.loads((root / data['data']).read_text(encoding='utf-8'))
    if data['key'] in ['pose', 'depth']:
        rows = [row for row in rows if row['体系'] == '全身单人・标准系' and row['角度'] == '正面']
    elif data['key'] == 'portrait':
        rows = [row for row in rows if row['模式'] == 'face']
    cards = []
    for index, row in enumerate(rows[:12]):
        if data['key'] == 'costume':
            name = f'{row["分类"]} · {row["id"]}'
            detail = '、'.join(row['关键词'][:3])
            original, size = row['预览图'], (300, 450)
        elif data['key'] == 'portrait':
            name = f'{row["发长"]} · {row["id"]}'
            detail, original, size = row['发型'] or '正面脸图', row['原图'], (300, 400)
        else:
            name = row['姿势名称']
            detail, original, size = f'{row["姿势编号"]} · {row["分类"]} · {row["角度"]}', row['原图'], (300, 400)
        priority = 'loading="eager" fetchpriority="high"' if index == 0 else 'loading="lazy"'
        pose_class = ' pose-card' if data['key'] in ['pose', 'depth'] else ''
        cards.append(f'<a class="card static-preview{pose_class}" href="{escape(original, quote=True)}" target="_blank" rel="noopener"><img src="{escape(row["缩略图"], quote=True)}" alt="{escape(name + " · " + detail, quote=True)}" width="{size[0]}" height="{size[1]}" {priority} decoding="async"><div class="card-info"><h3>{escape(name)}</h3><p>{escape(detail)}</p></div></a>')
    return '<!-- seo:previews:start -->\n' + '\n'.join(cards) + '\n<!-- seo:previews:end -->'


def markdown(data):
    lines = [f'# {data["label"]}', '', f'> {data["description"]}', '',
             f'- 在线入口：{data["url"]}', f'- 收录：{data["count"]}', f'- 分类与视角：{data["coverage"]}',
             f'- 索引快照：{data["snapshot"]}', f'- 功能：{data["feature"]}', f'- 图片提供：{data["delivery"]}',
             '- 中文整理与维护：Deeyu（https://github.com/Deeyu）',
             f'- 原始素材来源：{data["source"]}，原作者 {data["creator"]}（{data["creator_url"]}）',
             f'- 中文 JSON 索引：{BASE + data["data"]}', '', '## 中文创作用法', '',
             f'常用名称：{"、".join(data["aliases"])}。', '', data['scenario'], '',
             f'联合使用指南（角色定妆、姿势与穿搭、分镜深度参考）：{BASE}guide.md', '',
             '## 内容提示', '', NOTICE, '', '## 常见问题', '']
    for question, answer in data['questions']:
        lines += ['### ' + question, '', answer, '']
    lines += ['## 来源与使用条件', '', f'本项目为独立中文整理。原作者图片与索引、Anhao 中文词条及代码许可分别适用各自说明，不能将代码 MIT 许可当作素材商用授权。详见：{BASE}THIRD_PARTY_NOTICES.md', '']
    if data['key'] in ['pose', 'depth']:
        lines += ['中文词条来源：https://github.com/anhao/ai-pose-gallery-zh ，固定提交 072a3690af6e7e0011abbe0fa1ccc08939fbb47d。', '']
    lines += ['## 相关入口', ''] + [f'- [{item["label"]}]({BASE + item["path"]})' for item in CATALOGS]
    return '\n'.join(lines) + '\n'


def source_directory():
    items = []
    for catalog in CATALOGS:
        handle = catalog['creator_url'].rsplit('/', 1)[-1]
        items.append(f'<li><strong>{catalog["name"]}</strong><a href="{catalog["source"]}" target="_blank" rel="noopener">{catalog["source"]}</a><span>原作者：<a href="{catalog["creator_url"]}" target="_blank" rel="noopener">{catalog["creator"]}（@{handle}）</a></span></li>')
    return '<!-- seo:sources:start --><section class="source-directory" aria-labelledby="source-directory-title"><h2 id="source-directory-title">四库原始来源与作者</h2><ul>' + ''.join(items) + '</ul></section><!-- seo:sources:end -->'


def outputs(root=ROOT):
    result, summaries = {}, []
    for catalog in CATALOGS:
        data = info(catalog, root)
        summaries.append(data)
        path = data['path'] + 'index.html'
        html = (root / path).read_text(encoding='utf-8')
        if '<!-- seo:head:start -->' in html:
            html = re.sub(r'  <!-- seo:head:start -->.*?<!-- seo:head:end -->', lambda _: head(data), html, flags=re.S)
        else:
            html = re.sub(r'  <title>.*?</title>\s*<meta name="description"[^>]*>', lambda _: head(data), html, count=1, flags=re.S)
        html = re.sub(r'<h1>.*?</h1>', lambda _: '<h1>' + data['label'] + '</h1>', html, count=1)
        html = re.sub(r'(<(?:p|strong)\b[^>]*\bid="total"[^>]*>)[^<]*(</(?:p|strong)>)',
                      lambda match: match[1] + escape(data['count']) + match[2], html, count=1)
        prefix = '../' if data['path'] else ''
        fallback = f'<!-- seo:fallback:start --><noscript><p>当前显示首批 12 条静态预览。启用 JavaScript 可使用完整筛选和大图浏览；也可查看<a href="{prefix + data["data"]}">完整 JSON 索引</a>和<a href="catalog.md">纯文本介绍</a>。</p></noscript><!-- seo:fallback:end -->'
        if '<!-- seo:fallback:start -->' in html:
            html = re.sub(r'<!-- seo:fallback:start -->.*?<!-- seo:fallback:end -->', lambda _: fallback, html, flags=re.S)
        else:
            html = html.replace('<div id="grid" class="grid">', fallback + '\n      <div id="grid" class="grid">', 1)
        if '<!-- seo:previews:start -->' in html:
            html = re.sub(r'<!-- seo:previews:start -->.*?<!-- seo:previews:end -->', lambda _: previews(data, root), html, flags=re.S)
        else:
            html = html.replace('<div id="grid" class="grid"></div>', '<div id="grid" class="grid">' + previews(data, root) + '</div>', 1)
        if '<!-- seo:overview:start -->' in html:
            html = re.sub(r'    <!-- seo:overview:start -->.*?<!-- seo:overview:end -->', lambda _: overview(data), html, flags=re.S)
        else:
            html = html.replace('  </main>', overview(data) + '\n  </main>', 1)
        if '<!-- seo:footer -->' not in html:
            links = f'<p><!-- seo:footer --><a href="#catalog-guide">图库介绍与常见问题</a> · <a href="{prefix}sitemap.xml">站点地图</a> · <a href="{prefix}llms.txt">AI 检索参考</a></p>'
            html = html.replace('</footer>', links + '</footer>', 1)
        if '<!-- seo:sources:start -->' in html:
            html = re.sub(r'<!-- seo:sources:start -->.*?<!-- seo:sources:end -->', lambda _: source_directory(), html, flags=re.S)
        else:
            html = re.sub(r'(<footer\b[^>]*>)', lambda match: match[1] + '\n' + source_directory(), html, count=1)
        result[path] = html
        result[data['path'] + 'catalog.md'] = markdown(data)
    ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    sitemap = ET.Element('{http://www.sitemaps.org/schemas/sitemap/0.9}urlset')
    for data in summaries:
        ET.SubElement(ET.SubElement(sitemap, 'url'), 'loc').text = data['url']
    ET.indent(sitemap, space='  ')
    result['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(sitemap, encoding='unicode') + '\n'
    result['robots.txt'] = '# Project-path copy; robots rules apply only when served at the origin root.\nUser-agent: *\nAllow: /\nSitemap: ' + BASE + 'sitemap.xml\n'
    lines = ['# ' + SITE_NAME, '', '> 服装、人像、姿势线稿与深度图四库的中文参考索引。供成年人艺术创作、角色设定、绘画与前端技术学习使用。', '',
             '## 四个图库', '']
    lines += [f'- [{data["label"]}]({data["url"]}catalog.md): {data["count"]}；{data["purpose"]}；快照 {data["snapshot"]}。' for data in summaries]
    lines += ['', '## 项目与来源', '', f'- [项目说明]({REPOSITORY}#readme): 四库用途、功能、本地预览与部署说明。',
              f'- [中文联合使用指南]({BASE}guide.md): AI 绘画、角色定妆、漫剧与短剧分镜的多图参考步骤及中文提示词示例，附原始案例链接。',
              f'- [版权与致谢]({BASE}THIRD_PARTY_NOTICES.md): 原始素材、Anhao 中文词条及独立代码的许可范围。',
              f'- [站点地图]({BASE}sitemap.xml): 四个正式图库入口。', '', '## 内容和计数说明', '', NOTICE, '',
              '服装按套数统计，三个文件版本不计为三套；脸库按图片记录统计，不等于独立人物数；姿势与深度两库各自有 288 组，full_sexy_P018 缺少仰视图。', '',
              '脸库、姿势库和深度库图片由各自原站按需提供。代码 MIT 许可不覆盖第三方素材及数据。本文为检索摘要，不改变来源使用条件。', '']
    result['llms.txt'] = '\n'.join(lines)
    return result


def generate(root=ROOT, check=False):
    changed = []
    for name, content in outputs(root).items():
        path = root / name
        if not path.exists() or path.read_text(encoding='utf-8') != content:
            changed.append(name)
            if not check:
                path.write_text(content, encoding='utf-8')
    if check and changed:
        raise ValueError('SEO 文件需要更新：' + '、'.join(changed))
    print('SEO/GEO 文件校验通过。' if check else f'SEO/GEO 文件已更新：{len(changed)} 个。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    generate(check=parser.parse_args().check)
