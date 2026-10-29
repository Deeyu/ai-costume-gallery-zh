"""Package only website files; --offline requires a complete local mirror."""
import argparse
import shutil
from translate import ROOT
from verify import verify

parser = argparse.ArgumentParser()
parser.add_argument('--offline', action='store_true')
verify(assets=parser.parse_args().offline)
from manifest import main as update_manifest
update_manifest()
dist = ROOT / 'dist'
dist.mkdir(exist_ok=True)
for name in ['index.html', '_headers', 'assets', 'data', 'thumbs', 'img', 'png']:
    source = ROOT / name
    if not source.exists():
        continue
    if source.is_dir():
        shutil.copytree(source, dist / name, dirs_exist_ok=True)
    else:
        shutil.copy2(source, dist / name)
print('站点已生成到 dist/')
