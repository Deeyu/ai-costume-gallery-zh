import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sync import extract
from translate import ROOT, translate
from download import valid

class DataTests(unittest.TestCase):
    def setUp(self):
        self.rows = json.loads((ROOT / 'data/costume.json').read_text())

    def test_complete_snapshot_and_translation(self):
        self.assertEqual(len(self.rows), 1407)
        chinese = translate(self.rows)
        self.assertEqual(chinese, json.loads((ROOT / 'data/costume-zh.json').read_text()))
        self.assertIn('牛仔布', chinese[0]['关键词'])
        self.assertIn('ivory', chinese[0]['检索'])
        self.assertIn('象牙白', chinese[0]['检索'])

    def test_extraction_and_path_validation(self):
        html = '<script>const D=' + json.dumps(self.rows[:1]) + ';</script>'
        self.assertEqual(extract(html), self.rows[:1])
        bad = dict(self.rows[0], サムネ='../secret')
        with self.assertRaises(ValueError):
            extract('const D=' + json.dumps([bad]) + ';')

    def test_never_execute_source(self):
        with self.assertRaises(ValueError):
            extract('const D=runCode();')

    def test_reject_error_response_and_truncated_webp(self):
        self.assertFalse(valid(b'<html>error</html>', '.png'))
        self.assertFalse(valid(b'RIFF\xff\xff\xff\xffWEBPbroken', '.webp'))

if __name__ == '__main__':
    unittest.main()
