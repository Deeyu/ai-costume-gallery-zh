"""Package only website files after verifying the complete local mirror."""
import shutil
from translate import ROOT
from verify import verify

verify(assets=True)
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
