import argparse
from collections import Counter
import json
from translate import ROOT, translate
from download import valid

def verify(assets=False):
    original = json.loads((ROOT / 'data/costume.json').read_text())
    chinese = json.loads((ROOT / 'data/costume-zh.json').read_text())
    assert chinese == translate(original), '中文数据与词典不一致，请运行 translate.py'
    assert len({r['id'] for r in chinese}) == len(chinese), '重复 ID'
    meta = json.loads((ROOT / 'data/meta-zh.json').read_text())
    assert meta['total'] == len(chinese)
    assert meta['categories'] == dict(Counter(r['分类'] for r in chinese))
    manifest = json.loads((ROOT / 'data/local-assets.json').read_text())
    expected_paths = {r[k] for r in chinese for k in ['缩略图', '预览图', '原图']}
    assert len(manifest) == len(set(manifest)), '素材清单含重复路径'
    for entry in manifest:
        assert entry in expected_paths, '素材清单含未知路径'
        path = ROOT / entry
        assert path.exists() and valid(path.read_bytes(), path.suffix), f'清单内素材无效：{entry}'
    missing = []
    if assets:
        for row in chinese:
            for key in ['缩略图', '预览图', '原图']:
                path = ROOT / row[key]
                if not path.exists() or not valid(path.read_bytes(), path.suffix):
                    missing.append(str(path.relative_to(ROOT)))
        if missing:
            raise ValueError(f'{len(missing)} 个素材缺失或无效，例如：{missing[:5]}')
    print(f'校验通过：{len(chinese)} 条记录，{len(meta["categories"])} 个分类' + ('，全部图片完整' if assets else '（未检查图片）'))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', action='store_true')
    verify(parser.parse_args().assets)
