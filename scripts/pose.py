"""Import the regular pose-reference subset with upstream translation attribution."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import date
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'pose/data'
SOURCE = 'https://ai-pose-gallery.pages.dev/'
UPSTREAM = 'https://github.com/anhao/ai-pose-gallery-zh'
SYSTEMS = {
    '全身单人・标准系': {'坐姿', '站姿', '跪立', '侧坐・女孩坐', '趴卧', '蹲姿', '前倾', '后仰・挺背', '扭身'},
    '上半身单人': {'可爱系'},
}
ANGLES = ['正面', '斜侧', '侧面', '俯视', '仰视']
SUFFIXES = {'front': '正面', 'diag': '斜侧', 'side': '侧面', 'high': '俯视', 'low': '仰视'}


def prepare(original, chinese):
    if not isinstance(original, list) or not isinstance(chinese, list) or not original or not chinese:
        raise ValueError('姿势源数据为空或格式错误')
    by_id = {row['id']: row for row in original}
    if len(by_id) != len(original) or len({row['id'] for row in chinese}) != len(chinese):
        raise ValueError('源数据含重复 ID')
    selected, originals, normalized = [], [], []
    for row in chinese:
        if row['体系'] not in SYSTEMS or row['分类'] not in SYSTEMS[row['体系']]:
            continue
        match = re.fullmatch(r'(full_single|upper80v2)_(P\d{3})_(front|diag|side|high|low)', row['id'])
        if not match or row['姿势编号'] != match[2] or row['角度'] != SUFFIXES[match[3]]:
            raise ValueError('姿势 ID、编号或视角不一致')
        expected_system = '全身单人・标准系' if match[1] == 'full_single' else '上半身单人'
        if row['体系'] != expected_system:
            raise ValueError('姿势 ID 与体系不一致')
        raw = by_id.get(row['id'])
        if raw is None:
            raise ValueError('中文数据缺少对应的原始记录')
        for key, raw_key, folder, suffix in [('缩略图', 'サムネ', 'thumbs', 'jpg'), ('原图', '原寸', 'img', 'png')]:
            expected = f'{folder}/{row["id"]}.{suffix}'
            if row[key] != expected or raw[raw_key] != expected:
                raise ValueError('图片路径不符合原站约定')
        if not row['姿势名称'] or raw['ポーズ番号'] != row['姿势编号']:
            raise ValueError('姿势名称或原始编号不一致')
        selected.append(dict(row))
        originals.append(dict(raw))
        normalized.append({
            **{key: row[key] for key in ['id', '体系', '姿势编号', '分类', '姿势名称', '角度']},
            '组ID': row['id'].rsplit('_', 1)[0],
            '缩略图': SOURCE + row['缩略图'], '原图': SOURCE + row['原图'],
            '原始姿势名称': raw['ポーズ名'], '原始分类': raw['分類'], '原始角度': raw['アングル'],
            '检索': ' '.join([row['id'], row['体系'], row['姿势编号'], row['分类'], row['姿势名称'],
                           row['角度'], raw['ポーズ名'], raw['分類'], raw['アングル']]).lower(),
        })
    if not normalized:
        raise ValueError('没有符合常规参考范围的姿势记录')
    groups = {}
    for row in normalized:
        groups.setdefault(row['组ID'], []).append(row)
    for views in groups.values():
        if {row['角度'] for row in views} != set(ANGLES):
            raise ValueError('同组姿势缺少五个视角')
        if len({(row['体系'], row['分类'], row['姿势名称']) for row in views}) != 1:
            raise ValueError('同组姿势名称或分类不一致')
    return originals, selected, normalized


def metadata(rows, snapshot, commit, upstream_total):
    return {
        'total': len(rows), 'groups': len({row['组ID'] for row in rows}),
        'snapshot': snapshot, 'source': SOURCE, 'translation_source': UPSTREAM,
        'upstream_commit': commit, 'upstream_total': upstream_total,
        'scope': '标准全身与上半身常规动作参考', 'angles': ANGLES,
        'systems': {system: {
            'images': sum(row['体系'] == system for row in rows),
            'groups': len({row['组ID'] for row in rows if row['体系'] == system}),
            'categories': list(dict.fromkeys(row['分类'] for row in rows if row['体系'] == system)),
        } for system in SYSTEMS},
        'categories': dict(Counter(row['分类'] for row in rows)),
    }


def fetch_text(url):
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=45) as response:
        return response.read().decode('utf-8')


def write_snapshot(original, chinese, license_text, commit):
    if not re.fullmatch(r'[0-9a-f]{40}', commit) or 'Copyright (c) 2026 Anhao' not in license_text:
        raise ValueError('来源提交或参考项目许可不正确')
    raw, upstream_zh, rows = prepare(original, chinese)
    meta = metadata(rows, date.today().isoformat(), commit, len(chinese))
    files = {'pose.json': raw, 'upstream-zh.json': upstream_zh, 'pose-zh.json': rows, 'meta.json': meta}
    DATA.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (DATA / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'pose/UPSTREAM_LICENSE').write_text(license_text, encoding='utf-8')
    terms = set()
    for raw_row, zh_row in zip(raw, upstream_zh):
        for raw_key, key in [('系統', '体系'), ('分類', '分类'), ('ポーズ名', '姿势名称'), ('アングル', '角度')]:
            terms.add((key, raw_row[raw_key], zh_row[key]))
    with (DATA / 'translations.csv').open('w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file, lineterminator='\n')
        writer.writerow(['字段', '原文', '中文'])
        writer.writerows(sorted(terms))
    print(f'已整理 {meta["groups"]} 组 / {len(rows)} 张常规姿势参考，图片引用原站，译文注明 Anhao 来源。')


def verify():
    load = lambda name: json.loads((DATA / name).read_text(encoding='utf-8'))
    raw, chinese, rows = prepare(load('pose.json'), load('upstream-zh.json'))
    if rows != load('pose-zh.json'):
        raise ValueError('姿势中文索引与上游数据不一致')
    meta = load('meta.json')
    if not re.fullmatch(r'[0-9a-f]{40}', meta['upstream_commit']):
        raise ValueError('姿势来源提交非法')
    if meta != metadata(rows, meta['snapshot'], meta['upstream_commit'], meta['upstream_total']):
        raise ValueError('姿势计数或来源不一致')
    if 'Copyright (c) 2026 Anhao' not in (ROOT / 'pose/UPSTREAM_LICENSE').read_text(encoding='utf-8'):
        raise ValueError('缺少参考项目署名与许可')
    print(f'姿势库校验通过：{meta["groups"]} 组 / {len(rows)} 张，{len(meta["angles"])} 个视角。')


def check_images():
    rows = json.loads((DATA / 'pose-zh.json').read_text(encoding='utf-8'))
    samples = {}
    for row in rows:
        samples.setdefault((row['体系'], row['角度']), row)
    urls = [row[key] for row in samples.values() for key in ['缩略图', '原图']]
    def check(url):
        with urlopen(Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError('远程图片类型错误')
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, urls))
    print(f'姿势库远程图片抽查通过：{len(urls)} 个地址。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sync = sub.add_parser('sync')
    sync.add_argument('--original-json', type=Path)
    sync.add_argument('--chinese-json', type=Path)
    sync.add_argument('--license', type=Path)
    sync.add_argument('--commit')
    sub.add_parser('verify')
    sub.add_parser('check-images')
    args = parser.parse_args()
    if args.command == 'sync':
        commit = args.commit or json.loads(fetch_text('https://api.github.com/repos/anhao/ai-pose-gallery-zh/commits/main'))['sha']
        if not re.fullmatch(r'[0-9a-f]{40}', commit):
            raise ValueError('上游提交格式错误')
        base = f'https://raw.githubusercontent.com/anhao/ai-pose-gallery-zh/{commit}/'
        original = json.loads(args.original_json.read_text(encoding='utf-8') if args.original_json else fetch_text(base + 'data/pose.json'))
        chinese = json.loads(args.chinese_json.read_text(encoding='utf-8') if args.chinese_json else fetch_text(base + 'data/pose-zh.json'))
        license_text = args.license.read_text(encoding='utf-8') if args.license else fetch_text(base + 'LICENSE')
        write_snapshot(original, chinese, license_text, commit)
    elif args.command == 'verify':
        verify()
    else:
        check_images()
