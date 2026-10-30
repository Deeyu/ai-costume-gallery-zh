from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html', 'portrait/index.html', 'pose/index.html', 'depth/index.html']
LABELS = ['服装库', '脸库', '姿势库', '深度库']
SOURCES = ['https://ai-costume-gallery.pages.dev/', 'https://ai-portrait-gallery.pages.dev/',
           'https://ai-pose-gallery.pages.dev/', 'https://ai-pose-depth-gallery.pages.dev/']
NOTICE = '图库包含成人向姿势参考（部分分类名称涉及性行为术语），仅供艺术创作、动作参考与前端技术学习使用。请勿用于违法用途。未成年人请勿访问。'


class PageLinks(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.in_nav = self.in_footer = self.in_notice = False
        self.links, self.sources, self.notice = [], [], []
        self.anchor = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'nav' and attrs.get('aria-label') == '图库':
            self.in_nav = True
        if tag == 'footer':
            self.in_footer = True
        if tag == 'aside' and attrs.get('aria-labelledby') == 'content-notice-title':
            self.in_notice = True
        if tag == 'a':
            if self.in_nav:
                self.anchor = {**attrs, 'text': ''}
                self.links.append(self.anchor)
            if self.in_footer:
                self.sources.append(attrs.get('href'))

    def handle_endtag(self, tag):
        if tag == 'nav':
            self.in_nav = False
        if tag == 'footer':
            self.in_footer = False
        if tag == 'aside':
            self.in_notice = False
        if tag == 'a':
            self.anchor = None

    def handle_data(self, data):
        if self.anchor is not None:
            self.anchor['text'] += data
        if self.in_notice:
            self.notice.append(data)


class NavigationTests(unittest.TestCase):
    def test_every_gallery_links_to_all_four_and_marks_current_page(self):
        destinations = [ROOT, ROOT / 'portrait', ROOT / 'pose', ROOT / 'depth']
        for index, name in enumerate(PAGES):
            with self.subTest(page=name):
                page = ROOT / name
                parsed = PageLinks(page.read_text())
                self.assertEqual([link['text'] for link in parsed.links], LABELS)
                self.assertEqual([(page.parent / link['href']).resolve() for link in parsed.links], destinations)
                current = [link for link in parsed.links if link.get('aria-current') == 'page']
                self.assertEqual([link['text'] for link in current], [LABELS[index]])

    def test_source_links_are_in_footer_and_notice_is_complete(self):
        for name, source in zip(PAGES, SOURCES):
            with self.subTest(page=name):
                parsed = PageLinks((ROOT / name).read_text())
                self.assertIn(source, parsed.sources)
                self.assertTrue(all(not link['href'].startswith('https://') for link in parsed.links))
                self.assertIn(NOTICE, ''.join(parsed.notice))


if __name__ == '__main__':
    unittest.main()
