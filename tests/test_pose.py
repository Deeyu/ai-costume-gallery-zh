from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pose import ANGLES, DATA, ROOT, metadata, prepare


class PoseTests(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads((DATA / 'pose.json').read_text(encoding='utf-8'))
        self.chinese = json.loads((DATA / 'upstream-zh.json').read_text(encoding='utf-8'))

    def test_selected_scope_translation_and_complete_views(self):
        raw, chinese, rows = prepare(self.raw, self.chinese)
        self.assertEqual(len(rows), 490)
        self.assertEqual(Counter(row['体系'] for row in rows), {'全身单人・标准系': 365, '上半身单人': 125})
        self.assertEqual(len({row['组ID'] for row in rows}), 98)
        self.assertEqual(Counter(row['角度'] for row in rows), dict.fromkeys(ANGLES, 98))
        self.assertEqual(rows, json.loads((DATA / 'pose-zh.json').read_text(encoding='utf-8')))
        self.assertEqual(raw, self.raw)
        self.assertEqual(chinese, self.chinese)

    def test_rejects_unsafe_paths_duplicates_and_incomplete_groups(self):
        changed = deepcopy(self.chinese)
        changed[0]['原图'] = '../outside.png'
        with self.assertRaises(ValueError):
            prepare(self.raw, changed)
        with self.assertRaises(ValueError):
            prepare(self.raw + self.raw[:1], self.chinese)
        with self.assertRaises(ValueError):
            prepare(self.raw, self.chinese[1:])

    def test_rejects_mismatched_views_systems_and_group_names(self):
        for key, value in [('角度', '侧面'), ('体系', '上半身单人'), ('姿势名称', '不同名称')]:
            changed = deepcopy(self.chinese)
            changed[0][key] = value
            if key == '体系':
                changed[0]['分类'] = '可爱系'
            with self.assertRaises(ValueError):
                prepare(self.raw, changed)

    def test_metadata_and_upstream_attribution(self):
        rows = prepare(self.raw, self.chinese)[2]
        meta = json.loads((DATA / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual(meta, metadata(rows, meta['snapshot'], meta['upstream_commit'], meta['upstream_total']))
        self.assertEqual(meta['translation_source'], 'https://github.com/anhao/ai-pose-gallery-zh')
        self.assertIn('Copyright (c) 2026 Anhao', (ROOT / 'pose/UPSTREAM_LICENSE').read_text(encoding='utf-8'))
        self.assertTrue(all(row['原图'].startswith('https://ai-pose-gallery.pages.dev/img/') for row in rows))


if __name__ == '__main__':
    unittest.main()
