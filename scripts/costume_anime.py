"""Maintain the animation costume index without downloading image files."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

from sync import extract
from translate import ROOT, CATEGORIES, translate

SOURCE = 'https://ai-costume-anime-gallery.pages.dev/'
TWEET = 'https://x.com/giaaibusi/status/2117089256015622274'
FOLDER = ROOT / 'costume-anime/data'


def convert(rows, upstream):
    counts = Counter(row['カテゴリ'] for row in rows)
    if upstream.get('total') != len(rows) or upstream.get('counts') != dict(counts):
        raise ValueError('动画服装索引与原站分类计数不一致')
    if upstream.get('cats') != list(CATEGORIES):
        raise ValueError('动画服装分类已变化，请先更新中文词典')
    translated = translate(rows)
    for row in translated:
        for key in ['缩略图', '预览图', '原图']:
            row[key] = SOURCE + row[key]
    return translated


def sync(html):
    rows = extract(html)
    match = re.search(r'const\s+META\s*=\s*(\{[^\n]+\});', html)
    if not match:
        raise ValueError('动画原站未找到 META JSON')
    upstream = json.loads(match[1])
    translated = convert(rows, upstream)
    from datetime import date
    meta = dict(total=len(rows), categories=dict(Counter(row['分类'] for row in translated)),
                snapshot=date.today().isoformat(), source=SOURCE, creator='ギア',
                creator_url='https://x.com/giaaibusi', tweet=TWEET, upstream=upstream)
    FOLDER.mkdir(parents=True, exist_ok=True)
    for name, content in [('costume.json', rows), ('costume-zh.json', translated), ('meta-zh.json', meta)]:
        (FOLDER / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')
    verify()


def verify():
    original = json.loads((FOLDER / 'costume.json').read_text())
    meta = json.loads((FOLDER / 'meta-zh.json').read_text())
    # Reuse the source path/ID validation without evaluating upstream JavaScript.
    rows = extract('const D=' + json.dumps(original) + ';')
    expected = convert(rows, meta['upstream'])
    actual = json.loads((FOLDER / 'costume-zh.json').read_text())
    if actual != expected or meta['total'] != len(actual):
        raise ValueError('动画服装中文索引不完整或与原站记录不一致')
    if meta['categories'] != dict(Counter(row['分类'] for row in actual)) or meta['source'] != SOURCE:
        raise ValueError('动画服装来源或分类计数不一致')
    print(f'动画服装库校验通过：{len(actual)} 套 / {len(meta["categories"])} 类；仅保存索引，不镜像图片。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['sync', 'verify'])
    parser.add_argument('--html', type=Path, help='读取已保存的原站 HTML，仅提取 JSON 元数据')
    args = parser.parse_args()
    if args.command == 'verify':
        verify()
    else:
        if args.html:
            html = args.html.read_text()
        else:
            with urlopen(Request(SOURCE, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
                html = response.read().decode('utf-8')
        sync(html)
