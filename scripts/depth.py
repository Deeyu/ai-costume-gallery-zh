"""Index the depth gallery without executing its scripts or downloading images."""
import argparse
from datetime import date
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re

from pose import ROOT, prepare as prepare_pose, metadata as pose_metadata, fetch_text

DATA = ROOT / 'depth/data'
SOURCE = 'https://ai-pose-depth-gallery.pages.dev/'


class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.current = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.active = not dict(attrs).get('src')
            self.current = []

    def handle_data(self, data):
        if self.active:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.active:
            self.scripts.append(''.join(self.current))
            self.active = False


def extract(html):
    parser = InlineScripts()
    parser.feed(html)
    candidates = []
    for script in parser.scripts:
        for match in re.finditer(r'^const D\s*=\s*', script, re.MULTILINE):
            payload = script[match.end():]
            rows, end = json.JSONDecoder().raw_decode(payload)
            if not payload[end:].lstrip().startswith(';') or not isinstance(rows, list) or not rows:
                raise ValueError('深度源数据必须是非空 JSON 数组')
            candidates.append(rows)
    if len(candidates) != 1:
        raise ValueError('未找到唯一的深度图库索引')
    return candidates[0]


def prepare(original, chinese, reference):
    # Match Japanese metadata as well as IDs before reusing the pinned translation.
    if {row['id']: row for row in original} != {row['id']: row for row in reference}:
        raise ValueError('深度图库与中文词条来源不一致，请先核对新增或修改的姿势')
    raw, translated, rows = prepare_pose(original, chinese)
    for row in rows:
        row['缩略图'] = f'{SOURCE}thumbs/{row["id"]}.jpg'
        row['原图'] = f'{SOURCE}img/{row["id"]}.png'
    return raw, translated, rows


def metadata(rows, snapshot, commit, html_hash):
    result = pose_metadata(rows, snapshot, commit, len(rows))
    result.update(source=SOURCE, scope='完整人体模型深度图索引，用于姿态与空间前后关系参考',
                  source_html_sha256=html_hash, format='depth', near='white')
    return result


def write_snapshot(html):
    load = lambda name: json.loads((ROOT / 'pose/data' / name).read_text(encoding='utf-8'))
    raw, translated, rows = prepare(extract(html), load('upstream-zh.json'), load('pose.json'))
    commit = load('meta.json')['upstream_commit']
    license_text = (ROOT / 'pose/UPSTREAM_LICENSE').read_text(encoding='utf-8')
    if not re.fullmatch(r'[0-9a-f]{40}', commit) or 'Copyright (c) 2026 Anhao' not in license_text:
        raise ValueError('缺少中文词条固定来源或许可')
    meta = metadata(rows, date.today().isoformat(), commit, hashlib.sha256(html.encode()).hexdigest())
    DATA.mkdir(parents=True, exist_ok=True)
    for name, value in {'depth.json': raw, 'upstream-zh.json': translated,
                        'depth-zh.json': rows, 'meta.json': meta}.items():
        (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'depth/UPSTREAM_LICENSE').write_text(license_text, encoding='utf-8')
    print(f'深度图库已整理：{meta["groups"]} 组 / {len(rows)} 张，图片引用深度原站。')


def verify():
    load = lambda name: json.loads((DATA / name).read_text(encoding='utf-8'))
    raw = load('depth.json')
    rows = prepare(raw, load('upstream-zh.json'), raw)[2]
    if rows != load('depth-zh.json'):
        raise ValueError('深度中文索引或图片来源不一致')
    meta = load('meta.json')
    if not re.fullmatch(r'[0-9a-f]{40}', meta['upstream_commit']):
        raise ValueError('中文词条来源提交非法')
    if not re.fullmatch(r'[0-9a-f]{64}', meta['source_html_sha256']):
        raise ValueError('原站快照指纹非法')
    if meta != metadata(rows, meta['snapshot'], meta['upstream_commit'], meta['source_html_sha256']):
        raise ValueError('深度图库计数或来源不一致')
    if 'Copyright (c) 2026 Anhao' not in (ROOT / 'depth/UPSTREAM_LICENSE').read_text(encoding='utf-8'):
        raise ValueError('缺少中文词条署名与许可')
    print(f'深度图库校验通过：{meta["groups"]} 组 / {len(rows)} 张。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sync = sub.add_parser('sync')
    sync.add_argument('--html', type=Path, help='使用已保存的原站页面，不发起网络请求')
    sub.add_parser('verify')
    args = parser.parse_args()
    if args.command == 'sync':
        write_snapshot(args.html.read_text(encoding='utf-8') if args.html else fetch_text(SOURCE))
    else:
        verify()
