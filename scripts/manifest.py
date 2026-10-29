"""Record verified local assets for integrity checks."""
import json
from translate import ROOT

def main():
    from download import valid
    rows = json.loads((ROOT / 'data/costume.json').read_text())
    paths = []
    for row in rows:
        for key in ['サムネ', '画像', '原寸']:
            p = ROOT / row[key]
            if p.exists() and valid(p.read_bytes(), p.suffix):
                paths.append(row[key])
    (ROOT / 'data/local-assets.json').write_text(json.dumps(sorted(paths), indent=2) + '\n')
    print(f'本地素材 {len(paths)}/{len(rows)*3}；缺失 {len(rows)*3-len(paths)} 张。')

if __name__ == '__main__':
    main()
