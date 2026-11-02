from collections import Counter
import copy
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import costume_anime
from sync import extract

ROOT = Path(__file__).resolve().parents[1]


class CostumeAnimeTests(unittest.TestCase):
    def setUp(self):
        self.rows = json.loads((costume_anime.FOLDER / 'costume.json').read_text())
        self.meta = json.loads((costume_anime.FOLDER / 'meta-zh.json').read_text())

    def test_complete_public_snapshot_and_remote_only_images(self):
        costume_anime.verify()
        self.assertEqual(len(self.rows), 1320)
        self.assertEqual(Counter(row['カテゴリ'] for row in self.rows),
                         {'春': 197, '夏': 237, '秋': 230, '冬': 232,
                          'ランジェリー': 197, 'パーティ': 36, '水着': 52, 'セクシー': 139})
        translated = costume_anime.convert(self.rows, self.meta['upstream'])
        for row in translated:
            self.assertIn(row['分类'], costume_anime.CATEGORIES.values())
            for key in ['缩略图', '预览图', '原图']:
                self.assertTrue(row[key].startswith(costume_anime.SOURCE))
        for folder in ['thumbs', 'img', 'png']:
            self.assertFalse((ROOT / 'costume-anime' / folder).exists())

    def test_keeps_the_actual_animation_tags_and_number_gaps(self):
        realistic = {row['id']: row for row in json.loads((ROOT / 'data/costume.json').read_text())}
        changed = [row for row in self.rows if row['キーワード'] != realistic[row['id']]['キーワード']]
        self.assertEqual(len(changed), 46)
        translated = {row['id']: row for row in costume_anime.convert(self.rows, self.meta['upstream'])}
        for row in changed:
            self.assertEqual(translated[row['id']]['英文关键词'], row['キーワード'])
        self.assertNotIn('SPR-0012', translated)

    def test_rejects_mismatched_counts_categories_duplicates_and_unsafe_paths(self):
        wrong = copy.deepcopy(self.meta['upstream'])
        wrong['total'] += 1
        with self.assertRaises(ValueError):
            costume_anime.convert(self.rows, wrong)
        wrong = copy.deepcopy(self.meta['upstream'])
        wrong['cats'][0] = 'unknown'
        with self.assertRaises(ValueError):
            costume_anime.convert(self.rows, wrong)
        for rows in [[self.rows[0], self.rows[0]], [{**self.rows[0], '原寸': '../secret.png'}]]:
            with self.assertRaises(ValueError):
                extract('const D=' + json.dumps(rows) + ';')

    def test_sync_extracts_json_without_executing_page_scripts(self):
        with TemporaryDirectory() as directory, patch.object(costume_anime, 'FOLDER', Path(directory)):
            upstream = {**self.meta['upstream'], 'total': 1, 'counts': {'春': 1}}
            costume_anime.sync('const META=' + json.dumps(upstream) + ';\nconst D=' + json.dumps(self.rows[:1]) + ';')
            costume_anime.verify()
            self.assertEqual(sorted(path.name for path in Path(directory).iterdir()),
                             ['costume-zh.json', 'costume.json', 'meta-zh.json'])
            with self.assertRaises(ValueError):
                costume_anime.sync('const D=(()=>{throw new Error("must not execute")})();')


if __name__ == '__main__':
    unittest.main()
