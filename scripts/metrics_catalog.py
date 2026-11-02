"""Generate the server's allowed image IDs from the five checked-in catalogs."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGS = {'costume': 'data/costume-zh.json', 'costume-anime': 'costume-anime/data/costume-zh.json', 'portrait': 'portrait/data/portrait-zh.json',
            'pose': 'pose/data/pose-zh.json', 'depth': 'depth/data/depth-zh.json', 'anime': 'anime/data/anime-zh.json'}


def generate(check=False):
    content = json.dumps({key: [row['id'] for row in json.loads((ROOT / path).read_text())]
                          for key, path in CATALOGS.items()}, ensure_ascii=False, separators=(',', ':')) + '\n'
    path = ROOT / 'worker/catalog.json'
    if check:
        if path.read_text() != content:
            raise ValueError('统计服务的图片 ID 清单需要更新')
    else:
        path.write_text(content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
