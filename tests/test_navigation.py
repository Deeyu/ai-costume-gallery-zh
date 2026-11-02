from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html', 'portrait/index.html', 'pose/index.html', 'depth/index.html', 'anime/index.html']
LABELS = ['服装库', '脸型库', '姿势库', '深度库', '二次元库']
SOURCES = ['https://ai-costume-gallery.pages.dev/', 'https://ai-portrait-gallery.pages.dev/',
           'https://ai-pose-gallery.pages.dev/', 'https://ai-pose-depth-gallery.pages.dev/', 'https://charadb-2fi.pages.dev/']
NOTICE = '图库包含成人向姿势参考（部分分类名称涉及性行为术语），仅供艺术创作、动作参考与前端技术学习使用。请勿用于违法用途。未成年人请勿访问。'


class PageLinks(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.in_nav = self.in_footer = self.in_notice = False
        self.links, self.sources, self.notice = [], [], []
        self.version_links = []
        self.scripts, self.ids = [], []
        self.anchor = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'nav' and attrs.get('aria-label') == '图库':
            self.in_nav = True
        if tag == 'footer':
            self.in_footer = True
        if tag == 'aside' and attrs.get('aria-labelledby') == 'content-notice-title':
            self.in_notice = True
        if tag == 'a':
            if 'source-version' in attrs.get('class', '').split():
                self.version_links.append(attrs)
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
    def test_costume_animation_is_an_internal_edition_with_five_top_level_links(self):
        page = ROOT / 'costume-anime/index.html'
        html = page.read_text()
        parsed = PageLinks(html)
        self.assertEqual([link['text'] for link in parsed.links], LABELS)
        current = [link for link in parsed.links if link.get('aria-current') == 'page']
        self.assertEqual([link['text'] for link in current], ['服装库'])
        self.assertEqual((page.parent / current[0]['href']).resolve(), ROOT)
        self.assertEqual(parsed.version_links[0]['href'], 'https://ai-costume-anime-gallery.pages.dev/')
        self.assertEqual(parsed.version_links[0]['target'], '_blank')
        self.assertIn('version-realistic', parsed.ids)
        self.assertIn('version-anime', parsed.ids)
        self.assertIn('data-gallery="costume-anime"', html)
        self.assertIn('data-costume-version="anime"', html)
        self.assertIn('id="version-anime" href="./" aria-current="page"', html)
        for name in ['index.html', 'costume-anime/index.html']:
            text = (ROOT / name).read_text()
            self.assertLess(text.index('class="edition-switch"'), text.index('id="categories"'))

    def test_shared_metrics_and_star_entry_are_available_on_all_pages(self):
        for name in PAGES + ['examples/index.html']:
            with self.subTest(page=name):
                page = ROOT / name
                html = page.read_text()
                parsed = PageLinks(html)
                files = [(page.parent / src.split('?', 1)[0]).resolve() for src in parsed.scripts]
                self.assertLess(files.index(ROOT / 'assets/site-config.js'), files.index(ROOT / 'assets/site.js'))
                self.assertIn('site-visits', parsed.ids)
                self.assertIn('data-star-count', html)
                github = html.split('class="github-link"', 1)[1].split('</a>', 1)[0]
                self.assertIn('target="_blank"', github)
                self.assertIn('rel="noopener noreferrer"', github)
                self.assertIn('好用就点亮一颗星', github)
                if name in PAGES:
                    self.assertIn('sort-popular', parsed.ids)
                    self.assertIn('sort-default', parsed.ids)

    def test_every_gallery_loads_the_shared_scroll_loader_before_the_app(self):
        for name in PAGES:
            with self.subTest(page=name):
                page = ROOT / name
                parsed = PageLinks(page.read_text())
                files = [(page.parent / src.split('?', 1)[0]).resolve() for src in parsed.scripts]
                loader = ROOT / 'assets/gallery-loader.js'
                app = page.parent / ('assets/app.js' if name == 'index.html' else 'app.js')
                self.assertLess(files.index(loader), files.index(app))
                self.assertIn('load-sentinel', parsed.ids)
                self.assertNotIn('more', parsed.ids)
                for file in files:
                    self.assertTrue(file.is_file())

    def test_notice_is_at_the_bottom_of_each_gallery_and_example(self):
        for name in PAGES + ['examples/index.html']:
            html = (ROOT / name).read_text()
            self.assertEqual(html.count('class="content-notice"'), 1)
            self.assertLess(html.index('<footer'), html.index('class="content-notice"'))
            self.assertLess(html.index('class="content-notice"'), html.index('</footer>'))
            self.assertGreater(html.index('class="content-notice"'), html.index('</main>'))

    def test_three_modals_copy_images_instead_of_ids_and_anime_has_no_builder(self):
        for name in ['index.html', 'portrait/index.html', 'anime/index.html']:
            page = ROOT / name
            html = page.read_text()
            parsed = PageLinks(html)
            self.assertIn('copy-image', parsed.ids)
            self.assertIn('copy-status', parsed.ids)
            self.assertNotIn('复制 ID', html)
            files = [(page.parent / src.split('?', 1)[0]).resolve() for src in parsed.scripts]
            self.assertLess(files.index(ROOT / 'assets/image-clipboard.js'), files.index(page.parent / ('assets/app.js' if name == 'index.html' else 'app.js')))
        anime = (ROOT / 'anime/index.html').read_text()
        for removed in ['id="builder"', 'id="open-builder"', 'id="add-selection"', '加入组合']:
            self.assertNotIn(removed, anime)

    def test_japanese_source_opens_the_corresponding_original_in_a_new_tab(self):
        for name, source in zip(PAGES, SOURCES):
            with self.subTest(page=name):
                parsed = PageLinks((ROOT / name).read_text())
                self.assertEqual(len(parsed.version_links), 1)
                link = parsed.version_links[0]
                self.assertEqual(link['href'], source)
                self.assertEqual(link['target'], '_blank')
                self.assertIn('noopener', link['rel'].split())
                self.assertEqual(link['hreflang'], 'ja')

    def test_every_gallery_links_to_all_five_and_marks_current_page(self):
        destinations = [ROOT, ROOT / 'portrait', ROOT / 'pose', ROOT / 'depth', ROOT / 'anime']
        for index, name in enumerate(PAGES):
            with self.subTest(page=name):
                page = ROOT / name
                parsed = PageLinks(page.read_text())
                self.assertEqual([link['text'] for link in parsed.links], LABELS)
                self.assertEqual([(page.parent / link['href']).resolve() for link in parsed.links], destinations)
                current = [link for link in parsed.links if link.get('aria-current') == 'page']
                self.assertEqual([link['text'] for link in current], [LABELS[index]])

    def test_source_links_are_in_footer_and_notice_is_complete(self):
        for name in PAGES:
            with self.subTest(page=name):
                parsed = PageLinks((ROOT / name).read_text())
                for source in SOURCES:
                    self.assertIn(source, parsed.sources)
                for author in ['https://x.com/giaaibusi', 'https://x.com/agi_aibusi', 'https://x.com/taki_auto']:
                    self.assertIn(author, parsed.sources)
                self.assertTrue(all(not link['href'].startswith('https://') for link in parsed.links))
                self.assertIn(NOTICE, ''.join(parsed.notice))


if __name__ == '__main__':
    unittest.main()
