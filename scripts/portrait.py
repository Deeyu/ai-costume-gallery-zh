"""Extract and translate the portrait index without executing or mirroring source code/images."""
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
DATA = ROOT / 'portrait/data'
SOURCE = 'https://ai-portrait-gallery.pages.dev/'
TWEET = 'https://x.com/agi_aibusi/status/2113187345814204557'
SECTIONS = {'face': '正面脸图', 'styling': '造型参考'}
HAIRS = {'ショート': '短发', 'ミディアム': '中发', 'セミロング': '中长发', 'ロング': '长发'}
STYLES = {
    '2wayバングのワンカールミディアムボブ': '两用刘海内扣中发波波头',
    '2wayバングの韓国レイヤー': '两用刘海韩式层次发',
    'くびれショート（襟足長め・シースルーバング）': '收束感短发（后颈发尾较长·空气刘海）',
    'くびれセミロング（透明感カラー）': '收束感中长发（通透发色）',
    'くびれボブ（インナーカラー）': '收束感波波头（内层挑染）',
    'くるくるハードパーマミディアム': '密集小卷中发',
    'たっぷりレイヤー（ラベンダーグレージュ）': '丰富层次发（薰衣草灰米色）',
    'ぱっつん前髪のミディアムストレート': '齐刘海中发直发',
    'ウェットヘアの前髪長めショートボブ': '湿发感长刘海短波波头',
    'ショートウルフ（ミニウルフ）': '短狼尾（迷你狼尾）',
    'シースルーぱっつん前髪のシャギーレイヤー': '轻薄齐刘海碎层次发',
    'スパイラルパーマショートボブ（黒髪）': '螺旋卷短波波头（黑发）',
    'スパイラルパーマ韓国風セミロング': '韩式螺旋卷中长发',
    'セミロングウルフ（チェリーレッド）': '中长狼尾（樱桃红）',
    'セミロングストレート（前髪あり・暗髪）': '中长直发（有刘海·深发色）',
    'セミロングニュアンスパーマ': '自然微卷中长发',
    'セミロング顔まわりレイヤー（ミルクティーベージュ）': '中长修颜层次发（奶茶米色）',
    'セミロング黒髪ツヤレイヤー': '中长黑亮层次发',
    'ハイトーンミルクティーグレージュミディアム': '浅色奶茶灰米色中发',
    'ハイトーンミルクティーショートボブ': '浅色奶茶短波波头',
    'ハイライト入り丸みショート': '挑染圆弧短发',
    'ハイレイヤー×裾カラー（ブロンド）': '高层次发尾染（金发）',
    'ハッシュカット（グレージュ）': '韩式轻狼尾层次剪（灰米色）',
    'ハッシュカット（韓国ヘア）': '韩式轻狼尾层次剪',
    'バタフライカット（ヘーゼルカラー）': '蝴蝶层次剪（榛子色）',
    'バタフライカット（ミントベージュ・シースルーバング）': '蝴蝶层次剪（薄荷米色·空气刘海）',
    'バーガンディのシースルーレイヤー': '酒红轻透层次发',
    'マッシュショート（前髪長め）': '蘑菇短发（长刘海）',
    'ミディアムウルフパーマ': '中发狼尾烫',
    'ミディアムニュアンスパーマ（コテ巻き風）': '自然微卷中发（卷发棒造型感）',
    'ミディアムレイヤー内巻きワンカール（まろベージュ）': '中发层次内扣（柔和米色）',
    'ミニボブパーマ（くせ毛風）': '迷你波波头烫（自然卷感）',
    'ミニボブ（オン眉ぱっつん前髪）': '迷你波波头（眉上齐刘海）',
    'レイヤーショートボブ（顔まわりレイヤー）': '层次短波波头（修颜层次）',
    'ロブレイヤー（ミントベージュ）': '长波波头层次剪（薄荷米色）',
    'ロングウルフ（クラゲヘア）': '长狼尾（水母头）',
    'ワンカールレイヤーと後れ毛（ショコラブラウン）': '内扣层次与碎发（巧克力棕）',
    '丸みショートボブ（シースルーバング・ダークブラウン）': '圆弧短波波头（空气刘海·深棕色）',
    '内巻きワンカールボブ（ラベンダーアッシュ）': '内扣波波头（薰衣草灰色）',
    '切りっぱなしストレートボブ（前髪なし）': '齐切直发波波头（无刘海）',
    '切りっぱなし外ハネミディアムボブ': '齐切外翘中发波波头',
    '前下がりひし形ショートボブ（黒髪）': '前长后短菱形短波波头（黑发）',
    '前下がりミディアムボブ（マロンベージュ）': '前长后短中发波波头（栗子米色）',
    '外ハネボブ（暗髪）': '外翘波波头（深发色）',
    '斜めバングのエアリーカール': '斜刘海空气感卷发',
    '耳掛けハンサムショート（前髪なし）': '耳后别发利落短发（无刘海）',
    '艶さらストレートミディアムボブ（前髪なし）': '柔亮直发中发波波头（无刘海）',
    '重めミディアムレイヤー（バレイヤージュ）': '厚重感中发层次剪（巴黎画染）',
    '鎖骨丈ミディアムレイヤーボブ（アッシュグレージュ）': '锁骨层次波波头（冷灰米色）',
    '韓国風タッセルボブ（サイドバング）': '韩式齐切波波头（侧刘海）',
}


def extract(source, variable):
    match = re.fullmatch(r'\s*window\.' + re.escape(variable) + r'\s*=\s*([\s\S]+?)\s*;\s*', source)
    if not match:
        raise ValueError(f'未找到安全的 JSON 赋值：{variable}')
    return json.loads(match[1])


def validate(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError('脸型库数据为空或格式错误')
    ids = set()
    for row in rows:
        identifier = row['id']
        if not re.fullmatch(r'f[0-9a-f]{10}', identifier) or identifier in ids:
            raise ValueError('脸型库 ID 非法或重复')
        ids.add(identifier)
        if row['section'] not in SECTIONS or row['hair'] not in HAIRS:
            raise ValueError('出现未翻译的模式或发长')
        if row['style'] and row['style'] not in STYLES:
            raise ValueError(f'出现未翻译的发型：{row["style"]}')
        for key, folder, suffix in [('full', 'full', 'png'), ('thumb', 'thumb', 'webp')]:
            if row[key] != f'img/{folder}/{identifier}.{suffix}':
                raise ValueError('图片路径不符合原站约定')
        for key in ['w', 'h', 'thumb_w', 'thumb_h', 'bytes']:
            if type(row[key]) is not int or row[key] <= 0:
                raise ValueError(f'图片尺寸或大小非法：{key}')


def translate(rows):
    validate(rows)
    result = []
    for row in rows:
        hair, style = HAIRS[row['hair']], STYLES.get(row['style'], '')
        result.append({
            'id': row['id'], '模式': row['section'], '类型': SECTIONS[row['section']],
            '发长': hair, '发型': style, '原始发长': row['hair'], '原始发型': row['style'],
            '缩略图': SOURCE + row['thumb'], '原图': SOURCE + row['full'],
            '宽度': row['w'], '高度': row['h'], '原图字节': row['bytes'],
            '缩略图宽度': row['thumb_w'], '缩略图高度': row['thumb_h'],
            '检索': ' '.join([row['id'], row['section'], SECTIONS[row['section']], hair,
                           style, row['hair'], row['style']]).lower(),
        })
    return result


def translate_ranking(ranking, rows):
    by_id = {row['id']: row for row in rows}
    labels = {'総合': '全部', **HAIRS}
    result = {}
    for category in ranking['cats']:
        if category not in labels:
            raise ValueError('排行中出现未翻译分类')
        ids = ranking['top'][category]
        if len(ids) != len(set(ids)) or any(identifier not in by_id for identifier in ids):
            raise ValueError('排行中存在重复或未知图片 ID')
        result[labels[category]] = ids
    if not result:
        raise ValueError('排行为空')
    return result


def metadata(rows, snapshot):
    return {'total': len(rows), 'snapshot': snapshot, 'source': SOURCE, 'tweet': TWEET,
            'sections': dict(Counter(row['section'] for row in rows)),
            'hairs': {section: {label: sum(row['section'] == section and row['hair'] == hair for row in rows)
                                for hair, label in HAIRS.items()} for section in SECTIONS},
            'styles': len({row['style'] for row in rows if row['style']})}


def fetch_text(path):
    request = Request(SOURCE + path, headers={'User-Agent': 'Mozilla/5.0', 'Referer': SOURCE})
    with urlopen(request, timeout=45) as response:
        return response.read().decode('utf-8')


def write_snapshot(images_source, ranking_source):
    rows = extract(images_source, 'GALLERY_IMAGES')
    chinese = translate(rows)
    ranking = extract(ranking_source, 'GALLERY_RANKING')
    chinese_ranking = translate_ranking(ranking, rows)
    files = {'portrait.json': rows, 'portrait-zh.json': chinese, 'ranking.json': ranking,
             'ranking-zh.json': chinese_ranking, 'meta-zh.json': metadata(rows, date.today().isoformat())}
    DATA.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (DATA / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (DATA / 'translations.csv').open('w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file, lineterminator='\n')
        writer.writerow(['原文', '中文'])
        writer.writerows([*SECTIONS.items(), *HAIRS.items(), *sorted(STYLES.items())])
    print(f'已整理 {len(rows)} 张参考图、{len(STYLES)} 种细分发型；图片仍由原站提供。')


def verify():
    load = lambda name: json.loads((DATA / name).read_text(encoding='utf-8'))
    rows = load('portrait.json')
    if load('portrait-zh.json') != translate(rows):
        raise ValueError('脸型库中文数据与原始数据或词典不一致')
    if load('ranking-zh.json') != translate_ranking(load('ranking.json'), rows):
        raise ValueError('脸型库排行不一致')
    meta = load('meta-zh.json')
    if meta != metadata(rows, meta['snapshot']):
        raise ValueError('脸型库计数或来源不一致')
    print(f'脸型库校验通过：{len(rows)} 张参考图，所有分类及发型均有中文译文。')


def check_images(limit):
    rows = json.loads((DATA / 'portrait-zh.json').read_text(encoding='utf-8'))
    samples = {}
    for row in rows:
        samples.setdefault((row['模式'], row['发长']), row)
    urls = [row[key] for row in list(samples.values())[:limit] for key in ['缩略图', '原图']]
    def check(url):
        request = Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(request, timeout=30) as response:
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError('远程图片类型错误')
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, urls))
    print(f'远程图片抽查通过：{len(urls)} 个地址；未下载或镜像图片。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sync = sub.add_parser('sync')
    sync.add_argument('--images-js', type=Path)
    sync.add_argument('--ranking-js', type=Path)
    sub.add_parser('verify')
    check = sub.add_parser('check-images')
    check.add_argument('--limit', type=int, default=8, choices=range(1, 9))
    args = parser.parse_args()
    if args.command == 'sync':
        write_snapshot(args.images_js.read_text(encoding='utf-8') if args.images_js else fetch_text('data/images.js'),
                       args.ranking_js.read_text(encoding='utf-8') if args.ranking_js else fetch_text('data/ranking.js'))
    elif args.command == 'verify':
        verify()
    else:
        check_images(args.limit)
