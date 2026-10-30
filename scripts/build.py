"""Build a full local site or a smaller GitHub Pages site."""
import argparse
import json
import os
from pathlib import Path
import shutil
from translate import ROOT
from verify import verify
from manifest import main as update_manifest


def package_site(root: Path, github_pages=False, repository='Deeyu/ai-costume-gallery-zh', ref='main'):
    dist = root / 'dist'
    # Rebuild from scratch so a previous full build cannot leave PNGs in Pages.
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    names = ['index.html', '_headers', 'assets', 'data', 'thumbs', 'img', 'portrait', 'pose', 'LICENSE', 'THIRD_PARTY_NOTICES.md']
    if not github_pages:
        names.append('png')
    for name in names:
        source = root / name
        if not source.exists():
            continue
        if source.is_dir():
            shutil.copytree(source, dist / name)
        else:
            shutil.copy2(source, dist / name)
    if github_pages:
        data_file = dist / 'data/costume-zh.json'
        rows = json.loads(data_file.read_text(encoding='utf-8'))
        for row in rows:
            row['原图'] = f'https://raw.githubusercontent.com/{repository}/{ref}/{row["原图"]}'
        data_file.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (dist / '.nojekyll').touch()
    size = sum(path.stat().st_size for path in dist.rglob('*') if path.is_file())
    if github_pages and size >= 1_000_000_000:
        raise ValueError('GitHub Pages 发布目录达到 1 GB，请先减少部署素材。')
    print(f'站点已生成到 dist/，{size / 1024**2:.1f} MiB')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--github-pages', action='store_true', help='不打包 PNG，改为从 GitHub 仓库下载原图')
    args = parser.parse_args()
    verify(assets=True)
    if (ROOT / 'portrait/data/portrait.json').exists():
        from portrait import verify as verify_portrait
        verify_portrait()
    if (ROOT / 'pose/data/pose.json').exists():
        from pose import verify as verify_pose
        verify_pose()
    update_manifest()
    package_site(ROOT, args.github_pages,
                 os.environ.get('GITHUB_REPOSITORY', 'Deeyu/ai-costume-gallery-zh'),
                 os.environ.get('GITHUB_SHA', 'main'))


if __name__ == '__main__':
    main()
