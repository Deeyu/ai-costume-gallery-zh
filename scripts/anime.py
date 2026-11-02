"""Maintain the complete public CharaDB index without executing upstream JavaScript."""
import argparse
from collections import Counter
import csv
from datetime import date
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'anime/data'
SOURCE = 'https://charadb-2fi.pages.dev/'
TWEET = 'https://x.com/taki_auto/status/2116818463125803239'
SETS = {'hair': '发型与眼睛', 'outfit': '服装', 'pose': '姿势'}
CATEGORIES = dict(zip(
    ['髪型', '前髪', '髪色', '髪飾り', '目の色', '瞳の形', '制服・学生', 'カジュアル(春夏)',
     'カジュアル(秋冬)', 'きれいめ・オフィス', 'ドレス・パーティ', '和服', '水着', 'スポーツ・部活',
     '職業・コスプレ', 'ファンタジー', '部屋着・パジャマ', 'イベント・季節', 'アイドル・ステージ',
     'ゴスロリ・地雷系', 'ミリタリー・SF', '立ち', '座り', '寝そべり', 'しゃがみ・膝立ち',
     '上半身・手の仕草', '動き', '日常の動作', '2人'],
    ['发型', '刘海', '发色', '发饰', '眼睛颜色', '眼睛形状', '制服与学生装', '春夏休闲',
     '秋冬休闲', '优雅通勤', '礼服与派对', '和服', '泳装', '运动与社团', '职业与角色扮演',
     '奇幻', '家居服与睡衣', '节庆与季节', '偶像与舞台', '哥特洛丽塔与地雷系', '军事与科幻',
     '站姿', '坐姿', '躺卧', '蹲姿与跪姿', '上半身与手势', '动态动作', '日常动作', '双人']))
COLORS = {'black': '黑发', 'blonde': '金发', 'pink': '粉发', 'silver': '银发'}


def extract(text):
    match = re.fullmatch(r'\s*window\.DB\s*=\s*([\s\S]+?)\s*;\s*', text)
    if not match:
        raise ValueError('未找到安全的 window.DB JSON 赋值')
    data = json.loads(match[1])
    if data.get('tier') != 'public':
        raise ValueError('只接入原站公开版本')
    validate(data['items'])
    counts = dict(Counter(row['set'] for row in data['items'] if not row.get('parent')))
    if counts != data['counts']:
        raise ValueError('原站条目计数与索引不一致')
    date.fromisoformat(data['built'])
    return data


def validate(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError('二次元公开索引为空')
    ids = set()
    for row in rows:
        identifier, section = row['id'], row['set']
        pattern = {'hair': r'H\d{3}(?:-black|-blonde|-pink|-silver)?', 'outfit': r'O\d{3}', 'pose': r'P\d{3}(?:-s)?'}.get(section)
        if not pattern or not re.fullmatch(pattern, identifier) or identifier in ids:
            raise ValueError('索引 ID 非法或重复')
        ids.add(identifier)
        if row.get('tier') != 'public' or row['cat'] not in CATEGORIES:
            raise ValueError('存在非公开数据或未翻译分类')
        if not isinstance(row['jp'], str) or not row['jp'] or not isinstance(row['tags'], str) or not row['tags']:
            raise ValueError('名称或提示词缺失')
        if row.get('parent'):
            if section != 'hair' or row.get('sub') != 'style_color' or identifier != row['parent'] + '-' + identifier.rsplit('-', 1)[-1] or identifier.rsplit('-', 1)[-1] not in COLORS:
                raise ValueError('发色变体格式错误')
        elif section == 'hair' and row.get('sub') not in ['style', 'bangs', 'color', 'acc', 'eye']:
            raise ValueError('未知发型子类型')
        if section == 'pose' and type(row.get('line')) is not bool:
            raise ValueError('姿势线稿标记缺失')
    by_id = {row['id']: row for row in rows}
    for row in rows:
        if row.get('parent') and (row['parent'] not in by_id or by_id[row['parent']].get('sub') != 'style'):
            raise ValueError('发色变体缺少原始发型')


def dictionary():
    with (DATA / 'translations.csv').open(encoding='utf-8', newline='') as file:
        return {row['原文']: row['中文'] for row in csv.DictReader(file)}


def translate(rows):
    validate(rows)
    names = dictionary()
    result = []
    for row in rows:
        if row['jp'] not in names or not names[row['jp']]:
            raise ValueError('未翻译名称：' + row['jp'])
        parent = row.get('parent', '')
        color = row['id'].rsplit('-', 1)[-1] if parent else ('brown' if row.get('sub') == 'style' else '')
        name = names[row['jp']]
        result.append({'id': row['id'], '模式': row['set'], '类型': SETS[row['set']],
                       '分类': CATEGORIES[row['cat']], '名称': name, '原始名称': row['jp'],
                       '原始分类': row['cat'], '标签': row['tags'], '子类型': row.get('sub', ''),
                       '父级': parent, '发色': color, '线稿': SOURCE + f'line/{row["id"]}.png' if row.get('line') else '',
                       '缩略图': SOURCE + f'thumb/{row["id"]}.webp', '原图': SOURCE + f'img/{row["id"]}.jpg',
                       '检索': ' '.join([row['id'], row['set'], SETS[row['set']], name, CATEGORIES[row['cat']], row['jp'], row['cat'], row['tags'], COLORS.get(color, '棕发' if color else '')]).lower()})
    return result


def metadata(rows, snapshot):
    base = [row for row in rows if not row.get('parent')]
    lines = sum(bool(row.get('line')) for row in rows)
    return {'total': len(rows), 'cards': len(base), 'lineart': lines, 'image_files': len(rows) + lines,
            'sections': dict(Counter(row['set'] for row in base)),
            'images': dict(Counter(row['set'] for row in rows)),
            'categories': {section: dict(Counter(CATEGORIES[row['cat']] for row in base if row['set'] == section)) for section in SETS},
            'source': SOURCE, 'tweet': TWEET, 'snapshot': snapshot}


def sync(text):
    source = extract(text)
    rows = source['items']
    files = {'anime.json': rows, 'anime-zh.json': translate(rows), 'meta.json': metadata(rows, source['built'])}
    for name, content in files.items():
        (DATA / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    verify()


def verify():
    rows = json.loads((DATA / 'anime.json').read_text(encoding='utf-8'))
    chinese = json.loads((DATA / 'anime-zh.json').read_text(encoding='utf-8'))
    meta = json.loads((DATA / 'meta.json').read_text(encoding='utf-8'))
    date.fromisoformat(meta['snapshot'])
    if chinese != translate(rows) or meta != metadata(rows, meta['snapshot']):
        raise ValueError('中文索引或计数与原始数据不一致')
    print(f'二次元库：{meta["cards"]} 条目 / {meta["total"]} 张彩图（含发色变体）/ {meta["lineart"]} 张线稿，校验通过')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['sync', 'verify'])
    parser.add_argument('--data-js', type=Path, help='已保存的原站公开 data.js')
    args = parser.parse_args()
    if args.command == 'verify':
        verify()
    elif args.data_js:
        sync(args.data_js.read_text(encoding='utf-8'))
    else:
        request = Request(SOURCE + 'data.js', headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(request, timeout=45) as response:
            sync(response.read().decode('utf-8'))


if __name__ == '__main__':
    main()
