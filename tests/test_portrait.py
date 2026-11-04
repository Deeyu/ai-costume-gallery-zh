from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from portrait import DATA, SOURCE, extract, fetch_text, metadata, published_ranking_is_current, refresh_ranking, translate, translate_ranking, validate


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

    def test_ranking_requires_complete_categories_nonempty_unique_known_ids_and_correct_hair(self):
        ranking = json.loads((DATA / 'ranking.json').read_text())
        cases = []
        bad = deepcopy(ranking); bad['cats'].pop(); cases.append(bad)
        bad = deepcopy(ranking); bad['cats'][0] = bad['cats'][1]; cases.append(bad)
        bad = deepcopy(ranking); bad['top']['総合'] = []; cases.append(bad)
        bad = deepcopy(ranking); bad['top']['総合'] = ['unknown']; cases.append(bad)
        bad = deepcopy(ranking); bad['top']['総合'] *= 2; cases.append(bad)
        bad = deepcopy(ranking); bad['top']['ショート'] = ranking['top']['ロング']; cases.append(bad)
        for value in [None, {}, *cases]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                translate_ranking(value, self.rows)

    def test_ranking_refresh_keeps_index_snapshot_and_records_real_api_sync_time(self):
        with TemporaryDirectory() as folder:
            data = Path(folder)
            for name in ['portrait.json', 'portrait-zh.json', 'meta-zh.json']:
                (data / name).write_bytes((DATA / name).read_bytes())
            before = {path.name: path.read_bytes() for path in data.iterdir()}
            ranking = json.loads((DATA / 'ranking.json').read_text())
            ranking['top']['総合'].reverse()
            refresh_ranking(ranking, data=data, synced_at='2026-11-02T01:17:00+00:00')
            for name, content in before.items():
                self.assertEqual((data / name).read_bytes(), content)
            self.assertEqual(json.loads((data / 'ranking-zh.json').read_text())['全部'], ranking['top']['総合'])
            meta = json.loads((data / 'ranking-meta.json').read_text())
            self.assertEqual(meta['endpoint'], SOURCE + 'api/ranking')
            self.assertEqual(meta['synced_at'], '2026-11-02T01:17:00+00:00')
            self.assertEqual(len(meta['sha256']), 64)

    def test_failed_network_or_invalid_ranking_preserves_previous_files(self):
        with TemporaryDirectory() as folder:
            data = Path(folder)
            for name in ['portrait.json', 'ranking.json', 'ranking-zh.json', 'ranking-meta.json']:
                (data / name).write_bytes((DATA / name).read_bytes())
            before = {path.name: path.read_bytes() for path in data.iterdir()}
            with patch('portrait.fetch_text', side_effect=URLError('unavailable')), self.assertRaises(URLError):
                refresh_ranking(data=data)
            with patch('portrait.fetch_text', return_value='not JSON'), self.assertRaises(ValueError):
                refresh_ranking(data=data)
            bad = json.loads((DATA / 'ranking.json').read_text())
            bad['top']['総合'] = ['unknown']
            with self.assertRaises(ValueError):
                refresh_ranking(bad, data=data)
            self.assertEqual({path.name: path.read_bytes() for path in data.iterdir()}, before)

    def test_scheduled_retry_skips_only_a_live_api_snapshot_published_today_in_beijing(self):
        now = datetime(2026, 11, 4, 3, 6, tzinfo=timezone.utc)
        meta = {'endpoint': SOURCE + 'api/ranking', 'synced_at': '2026-11-03T18:00:00+00:00'}
        response = MagicMock()
        for value, expected in [
            (meta, True),
            (dict(meta, synced_at='2026-11-03T15:59:59+00:00'), False),
            (dict(meta, synced_at='2026-11-04T04:00:00+00:00'), False),
            (dict(meta, synced_at='2026-11-04T02:00:00'), False),
            (dict(meta, endpoint=SOURCE + 'data/ranking.js'), False),
            (None, False),
        ]:
            with self.subTest(value=value), patch('portrait.urlopen', return_value=response):
                response.__enter__.return_value.read.return_value = json.dumps(value).encode()
                self.assertEqual(published_ranking_is_current(now), expected)
        with patch('portrait.urlopen', side_effect=URLError('Pages unavailable')):
            self.assertFalse(published_ranking_is_current(now))

    def test_source_network_errors_retry_but_are_not_replaced_with_stale_snapshots(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok":true}'
        with patch('portrait.urlopen', side_effect=[URLError('temporary'), response]) as request, patch('portrait.sleep'):
            self.assertEqual(fetch_text('api/ranking'), '{"ok":true}')
            self.assertEqual(request.call_count, 2)
            self.assertTrue(all(call.args[0].full_url == SOURCE + 'api/ranking' for call in request.call_args_list))
        with patch('portrait.urlopen', side_effect=URLError('unavailable')) as request, patch('portrait.sleep'), self.assertRaises(URLError):
            fetch_text('api/ranking')
        self.assertEqual(request.call_count, 3)


if __name__ == '__main__':
    unittest.main()
