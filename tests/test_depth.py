from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from depth import DATA, ROOT, SOURCE, extract, metadata, prepare


class DepthTests(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads((DATA / 'depth.json').read_text())
        self.chinese = json.loads((DATA / 'upstream-zh.json').read_text())

    def test_complete_index_uses_depth_images_and_preserves_translation(self):
        raw, chinese, rows = prepare(self.raw, self.chinese, self.raw)
        self.assertEqual(len(rows), 1439)
        self.assertEqual(len({row['组ID'] for row in rows}), 288)
        self.assertEqual(rows, json.loads((DATA / 'depth-zh.json').read_text()))
        self.assertEqual(raw, self.raw)
        self.assertEqual(chinese, self.chinese)
        for row in rows:
            self.assertEqual(row['原图'], f'{SOURCE}img/{row["id"]}.png')
            self.assertEqual(row['缩略图'], f'{SOURCE}thumbs/{row["id"]}.jpg')

    def test_changed_source_terms_do_not_silently_reuse_translation(self):
        raw = deepcopy(self.raw)
        raw[0]['ポーズ名'] = 'changed'
        with self.assertRaises(ValueError):
            prepare(raw, self.chinese, self.raw)
        with self.assertRaises(ValueError):
            prepare(self.raw + self.raw[:1], self.chinese, self.raw)

    def test_extracts_json_only_and_rejects_javascript_expressions(self):
        self.assertEqual(extract('<script>\nconst D=[{"id":"demo"}];\n</script>'), [{'id': 'demo'}])
        for html in ['<script>const D=execute();</script>',
                     '<script>const D=[{"id":"demo"}].map(execute);</script>',
                     '<script>const D=[];</script>',
                     '<div>const D=[{"id":"demo"}];</div>']:
            with self.assertRaises(ValueError):
                extract(html)

    def test_metadata_actual_views_and_attribution(self):
        rows = prepare(self.raw, self.chinese, self.raw)[2]
        meta = json.loads((DATA / 'meta.json').read_text())
        self.assertEqual(meta, metadata(rows, meta['snapshot'], meta['upstream_commit'], meta['source_html_sha256']))
        self.assertEqual(meta['missing_views'], {'full_sexy_P018': ['仰视']})
        self.assertEqual(meta['near'], 'white')
        self.assertIn('Copyright (c) 2026 Anhao', (ROOT / 'depth/UPSTREAM_LICENSE').read_text())


if __name__ == '__main__':
    unittest.main()
