"""Extract only JSON constants from the public page; never execute page scripts."""
import argparse
import json
import re
from pathlib import Path
from urllib.request import urlopen
from translate import ROOT, main as translate

SOURCE = 'https://ai-costume-gallery.pages.dev/'

def extract(html):
    match = re.search(r'const\s+D\s*=\s*(\[.*?\]);', html, re.S)
    if not match:
        raise ValueError('原站数据结构已变化，未找到 D 数组。')
    rows = json.loads(match[1])
    if not rows or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('源数据为空或含重复 ID。')
    for r in rows:
        if not re.fullmatch(r'[A-Z]+-\d{4}', r['id']):
            raise ValueError('非法服装 ID')
        for key, folder, suffix in [('サムネ', 'thumbs', 'webp'), ('画像', 'img', 'webp'), ('原寸', 'png', 'png')]:
            if r[key] != f'{folder}/{r["id"]}.{suffix}':
                raise ValueError('图片路径不符合原站约定。')
    return rows

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', type=Path, help='也可使用浏览器另存的 HTML')
    args = parser.parse_args()
    if args.html:
        html = args.html.read_text()
    else:
        with urlopen(SOURCE, timeout=30) as response:
            html = response.read().decode('utf-8')
    rows = extract(html)
    # Validate translation coverage before replacing the existing snapshot.
    from translate import translate as translate_rows
    translate_rows(rows)
    (ROOT / 'data/costume.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    translate()
