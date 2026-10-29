"""Translate the source vocabulary without changing original records."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = dict(zip(['春', '夏', '秋', '冬', 'ランジェリー', 'パーティ', '水着', 'セクシー'],
                      ['春装', '夏装', '秋装', '冬装', '内衣', '派对', '泳装', '性感']))
WORDS = dict(pair.split(':') for pair in '''apron:围裙 bag:包 beanie:针织帽 beige:米色 belt:腰带 beret:贝雷帽 black:黑色 blouse:女式衬衫 blue:蓝色 boots:靴子 bra:文胸 briefs:内裤 brown:棕色 burgundy:酒红色 camisole:吊带背心 cardigan:开衫 chiffon:雪纺 choker:颈链 coat:大衣 corduroy:灯芯绒 corset:束身衣 cream:奶油色 denim:牛仔布 dress:连衣裙 floral:碎花 frill:荷叶边 fur:毛绒 gloves:手套 gold:金色 green:绿色 grey:灰色 hat:帽子 headband:发带 heels:高跟鞋 hoodie:连帽衫 ivory:象牙白 jacket:夹克 jeans:牛仔裤 khaki:卡其色 knit:针织 lace:蕾丝 lavender:淡紫色 leather:皮革 loafers:乐福鞋 maxi:长款 mesh:网纱 midi:中长款 mini:迷你 mint:薄荷色 muffler:围巾 navy:藏蓝色 necklace:项链 olive:橄榄绿 orange:橙色 pants:长裤 pink:粉色 pleated:百褶 polka-dot:波点 pumps:浅口高跟鞋 purple:紫色 red:红色 ribbon:缎带 robe:睡袍 sandals:凉鞋 satin:缎面 scarf:丝巾 shirt:衬衫 shorts:短裤 silver:银色 skirt:半身裙 sneakers:运动鞋 socks:短袜 stockings:长筒袜 suede:麂皮 sunglasses:太阳镜 sweater:毛衣 swimsuit:泳衣 tights:连裤袜 tote:托特包 tulle:薄纱 turtleneck:高领 velvet:天鹅绒 vest:马甲 white:白色 wool:羊毛 yellow:黄色'''.split())

def translate(rows):
    result = []
    for row in rows:
        tags = [WORDS[word] for word in row['キーワード'].split()]
        category = CATEGORIES[row['カテゴリ']]
        result.append(dict(id=row['id'], 分类=category, 关键词=tags,
                           英文关键词=row['キーワード'], 缩略图=row['サムネ'],
                           预览图=row['画像'], 原图=row['原寸'],
                           检索=' '.join([row['id'], category, row['カテゴリ'], *tags, row['キーワード']]).lower()))
    return result

def main():
    rows = json.loads((ROOT / 'data/costume.json').read_text())
    data = translate(rows)
    (ROOT / 'data/costume-zh.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    meta = {'total': len(data), 'categories': {c: sum(r['分类'] == c for r in data) for c in CATEGORIES.values()}}
    (ROOT / 'data/meta-zh.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    with (ROOT / 'data/translations.csv').open('w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['原文', '中文'])
        writer.writerows([*CATEGORIES.items(), *sorted(WORDS.items())])
    print(f'已翻译 {len(data)} 条记录、{len(WORDS)} 个关键词。')

if __name__ == '__main__':
    main()
