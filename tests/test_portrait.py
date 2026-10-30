from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from portrait import DATA, SOURCE, extract, metadata, translate, translate_ranking, validate


class PortraitTests(unittest.TestCase):
    def setUp(self):
        self.rows = json.loads((DATA / 'portrait.json').read_text(encoding='utf-8'))

    def test_complete_translation_and_counts(self):
        self.assertEqual(len(self.rows), 1499)
        self.assertEqual(Counter(row['section'] for row in self.rows), {'face': 893, 'styling': 606})
        translated = translate(self.rows)
        self.assertEqual(translated, json.loads((DATA / 'portrait-zh.json').read_text(encoding='utf-8')))
        self.assertEqual(len({row['style'] for row in self.rows if row['style']}), 50)
        self.assertIn('空气刘海', translated[1]['发型'])
        self.assertIn('シースルーバング', translated[1]['检索'])
        self.assertTrue(all(row['原图'].startswith(SOURCE) for row in translated))
        self.assertEqual(translated[0]['发型'], '')

    def test_extracts_json_but_rejects_executable_source(self):
        source = 'window.GALLERY_IMAGES = ' + json.dumps(self.rows[:1]) + ';'
        self.assertEqual(extract(source, 'GALLERY_IMAGES'), self.rows[:1])
        for malicious in ['window.GALLERY_IMAGES = runCode();', source + 'stealData();']:
            with self.assertRaises(ValueError):
                extract(malicious, 'GALLERY_IMAGES')

    def test_rejects_traversal_duplicates_and_untranslated_styles(self):
        for key, value in [('full', '../secret.png'), ('style', '未知の髪型')]:
            row = dict(self.rows[0], **{key: value})
            with self.assertRaises(ValueError):
                validate([row])
        with self.assertRaises(ValueError):
            validate([self.rows[0], self.rows[0]])

    def test_ranking_and_metadata_match_snapshot(self):
        ranking = json.loads((DATA / 'ranking.json').read_text(encoding='utf-8'))
        self.assertEqual(translate_ranking(ranking, self.rows), json.loads((DATA / 'ranking-zh.json').read_text(encoding='utf-8')))
        bad = deepcopy(ranking)
        bad['top']['総合'][0] = 'unknown'
        with self.assertRaises(ValueError):
            translate_ranking(bad, self.rows)
        meta = json.loads((DATA / 'meta-zh.json').read_text(encoding='utf-8'))
        self.assertEqual(meta, metadata(self.rows, meta['snapshot']))


if __name__ == '__main__':
    unittest.main()
