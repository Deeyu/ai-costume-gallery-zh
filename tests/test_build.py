import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build import package_site


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in ['data', 'thumbs', 'img', 'png']:
            (self.root / name).mkdir()
        self.row = {'id': 'SPR-0001', '缩略图': 'thumbs/SPR-0001.webp',
                    '预览图': 'img/SPR-0001.webp', '原图': 'png/SPR-0001.png'}
        (self.root / 'data/costume-zh.json').write_text(json.dumps([self.row]), encoding='utf-8')
        for key in ['缩略图', '预览图', '原图']:
            (self.root / self.row[key]).write_bytes(b'fixture')
        (self.root / 'index.html').write_text('fixture', encoding='utf-8')
        (self.root / 'THIRD_PARTY_NOTICES.md').write_text('attribution', encoding='utf-8')

    def test_full_build_keeps_local_originals(self):
        package_site(self.root)
        dist = self.root / 'dist'
        self.assertTrue((dist / self.row['原图']).is_file())
        self.assertEqual(json.loads((dist / 'data/costume-zh.json').read_text()), [self.row])
        self.assertTrue((dist / 'THIRD_PARTY_NOTICES.md').is_file())

    def test_pages_build_removes_old_pngs_and_uses_selected_repository_and_commit(self):
        package_site(self.root)
        package_site(self.root, github_pages=True, repository='fork/gallery', ref='abc123')
        dist = self.root / 'dist'
        self.assertFalse((dist / 'png').exists())
        published = json.loads((dist / 'data/costume-zh.json').read_text())[0]
        self.assertEqual(published['原图'], 'https://raw.githubusercontent.com/fork/gallery/abc123/png/SPR-0001.png')
        for key in ['缩略图', '预览图']:
            self.assertTrue((dist / published[key]).is_file())
        self.assertTrue((dist / '.nojekyll').exists())
        self.assertEqual(json.loads((self.root / 'data/costume-zh.json').read_text()), [self.row])

    def test_pages_build_includes_portrait_index_without_rewriting_remote_images(self):
        portrait = self.root / 'portrait'
        (portrait / 'data').mkdir(parents=True)
        (portrait / 'index.html').write_text('portrait fixture', encoding='utf-8')
        rows = [{'id': 'f71f980dde3', '原图': 'https://ai-portrait-gallery.pages.dev/img/full/f71f980dde3.png'}]
        (portrait / 'data/portrait-zh.json').write_text(json.dumps(rows), encoding='utf-8')
        package_site(self.root, github_pages=True)
        published = self.root / 'dist/portrait'
        self.assertTrue((published / 'index.html').is_file())
        self.assertEqual(json.loads((published / 'data/portrait-zh.json').read_text()), rows)


if __name__ == '__main__':
    unittest.main()
