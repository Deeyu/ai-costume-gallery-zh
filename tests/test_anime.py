import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from anime import DATA, SOURCE, extract, metadata, translate, validate, verify


class AnimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads((DATA / 'anime.json').read_text())

    def test_complete_public_snapshot_and_counts(self):
        verify()
        meta = metadata(self.rows, '2026-11-02')
        self.assertEqual(meta['sections'], {'hair': 122, 'outfit': 440, 'pose': 281})
        self.assertEqual(meta['images'], {'hair': 306, 'outfit': 440, 'pose': 281})
        self.assertEqual((meta['cards'], meta['total'], meta['lineart'], meta['image_files']), (843, 1027, 281, 1308))
        self.assertEqual(len(meta['categories']['outfit']), 15)
        self.assertEqual(len(meta['categories']['pose']), 8)

    def test_all_names_translated_and_original_tags_preserved(self):
        chinese = translate(self.rows)
        self.assertEqual({row['id'] for row in chinese}, {row['id'] for row in self.rows})
        for source, row in zip(self.rows, chinese):
            self.assertEqual(row['原始名称'], source['jp'])
            self.assertEqual(row['标签'], source['tags'])
            self.assertTrue(row['名称'])
            self.assertEqual(row['缩略图'], SOURCE + 'thumb/' + row['id'] + '.webp')
            self.assertEqual(row['原图'], SOURCE + 'img/' + row['id'] + '.jpg')
            self.assertEqual(bool(row['线稿']), row['模式'] == 'pose')

    def test_all_46_styles_have_five_colors(self):
        styles = [row for row in self.rows if row.get('sub') == 'style']
        self.assertEqual(len(styles), 46)
        for style in styles:
            variants = [row['id'] for row in self.rows if row.get('parent') == style['id']]
            self.assertEqual(set(variants), {style['id'] + '-' + color for color in ['black', 'blonde', 'pink', 'silver']})

    def test_preserves_number_gaps_without_fabricating_private_entries(self):
        ids = {row['id'] for row in self.rows if row['set'] == 'outfit'}
        self.assertEqual(ids, {f'O{n:03}' for n in [*range(1, 341), *range(396, 496)]})
        self.assertTrue(all(row['tier'] == 'public' for row in self.rows))

    def test_extract_only_accepts_json_assignment_not_executable_code(self):
        data = {'tier': 'public', 'built': '2026-11-02', 'counts': {'outfit': 1}, 'items': [self.rows[306]]}
        # Pick by type rather than relying on the snapshot's row order.
        data['items'] = [next(row for row in self.rows if row['set'] == 'outfit')]
        text = 'window.DB=' + json.dumps(data) + ';'
        self.assertEqual(extract(text), data)
        for unsafe in [text + 'alert(1);', 'window.DB=(()=>1)();', text.replace('"public"', '"private"')]:
            with self.assertRaises(ValueError):
                extract(unsafe)

    def test_rejects_duplicates_traversal_private_rows_and_unknown_names(self):
        with self.assertRaises(ValueError):
            validate(self.rows + [self.rows[0]])
        for key, value in [('id', '../O001'), ('tier', 'private'), ('cat', '新增未翻译分类')]:
            row = dict(self.rows[0], **{key: value})
            with self.assertRaises(ValueError):
                validate([row])
        row = dict(self.rows[0], jp='新增未翻译名称')
        with self.assertRaises(ValueError):
            translate([row])

    def test_rejects_orphan_variants_and_wrong_source_counts(self):
        variant = next(row for row in self.rows if row.get('parent'))
        with self.assertRaises(ValueError):
            validate([variant])
        data = {'tier': 'public', 'built': '2026-11-02', 'counts': {'hair': 2}, 'items': [self.rows[0]]}
        with self.assertRaises(ValueError):
            extract('window.DB=' + json.dumps(data) + ';')


if __name__ == '__main__':
    unittest.main()
