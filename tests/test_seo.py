from html.parser import HTMLParser
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from seo import BASE, CATALOGS, ROOT, info, outputs


class HeadAndCards(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.meta, self.links, self.images = {}, {}, []
        self.h1_count = 0
        self.scripts = []
        self.previews = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.meta[attrs.get('name', attrs.get('property'))] = attrs.get('content')
        elif tag == 'link':
            self.links.setdefault(attrs.get('rel'), []).append(attrs)
        elif tag == 'h1':
            self.h1_count += 1
        elif tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        elif tag == 'a' and 'static-preview' in attrs.get('class', '').split():
            self.previews += 1
        elif tag == 'img':
            self.images.append(attrs)


class SeoTests(unittest.TestCase):
    def test_script_and_stylesheet_versions_match_the_deployed_file_contents(self):
        for catalog in CATALOGS:
            with self.subTest(gallery=catalog['key']):
                folder = ROOT / catalog['path']
                parsed = HeadAndCards((folder / 'index.html').read_text())
                assets = parsed.scripts + [link['href'] for link in parsed.links['stylesheet']]
                for url in assets:
                    name, version = url.split('?v=')
                    self.assertEqual(version, sha256((folder / name).read_bytes()).hexdigest()[:12])

    def test_generated_files_are_current_and_idempotent(self):
        for name, expected in outputs().items():
            with self.subTest(file=name):
                self.assertEqual((ROOT / name).read_text(), expected)

    def test_unique_canonical_social_metadata_and_real_static_previews(self):
        descriptions = set()
        for catalog in CATALOGS:
            with self.subTest(gallery=catalog['key']):
                data = info(catalog, ROOT)
                html = (ROOT / catalog['path'] / 'index.html').read_text()
                parsed = HeadAndCards(html)
                self.assertEqual(parsed.h1_count, 1)
                self.assertEqual([link['href'] for link in parsed.links['canonical']], [data['url']])
                self.assertEqual(parsed.meta['og:url'], data['url'])
                self.assertEqual(parsed.meta['description'], parsed.meta['og:description'])
                self.assertEqual(parsed.meta['twitter:image'], parsed.meta['og:image'])
                self.assertEqual(parsed.meta['og:image:width'], '1200')
                self.assertNotIn('noindex', parsed.meta['robots'])
                descriptions.add(parsed.meta['description'])
                self.assertEqual(parsed.previews, 12)
                self.assertIn('id="catalog-guide"', html)
                self.assertIn('常见问题', html)
                self.assertIn(data['snapshot'], html)
                for image in parsed.images:
                    self.assertIn('alt', image)
                if catalog['key'] in ['pose', 'depth']:
                    self.assertEqual(parsed.meta['rating'], 'adult')
                else:
                    self.assertNotIn('rating', parsed.meta)
        self.assertEqual(len(descriptions), 4)

    def test_schema_counts_attribution_and_json_distribution_match_catalog(self):
        for catalog in CATALOGS:
            with self.subTest(gallery=catalog['key']):
                data = info(catalog, ROOT)
                html = (ROOT / catalog['path'] / 'index.html').read_text()
                encoded = html.split('<script type="application/ld+json">')[1].split('</script>')[0]
                graph = json.loads(encoded)['@graph']
                dataset = next(node for node in graph if node['@type'] == 'Dataset')
                self.assertEqual(dataset['variableMeasured'][0]['value'], data['total'])
                self.assertEqual(dataset['dateModified'], data['snapshot'])
                self.assertEqual(dataset['distribution']['contentUrl'], BASE + catalog['data'])
                self.assertEqual(dataset['isBasedOn'], catalog['source'])
                self.assertNotIn('license', dataset)
                self.assertIn('THIRD_PARTY_NOTICES.md', dataset['usageInfo'])
                if data['groups']:
                    self.assertEqual(dataset['variableMeasured'][1]['value'], data['groups'])

    def test_sitemap_and_text_resources_cover_the_galleries_and_media_example(self):
        tree = ET.fromstring((ROOT / 'sitemap.xml').read_text())
        urls = [node.text for node in tree.findall('.//{*}loc')]
        self.assertEqual(urls, [BASE + catalog['path'] for catalog in CATALOGS] + [BASE + 'examples/'])
        self.assertIn(BASE + 'examples/', (ROOT / 'llms.txt').read_text())
        llms = (ROOT / 'llms.txt').read_text()
        for catalog in CATALOGS:
            self.assertIn(BASE + catalog['path'] + 'catalog.md', llms)
            text = (ROOT / catalog['path'] / 'catalog.md').read_text()
            self.assertIn(info(catalog, ROOT)['count'], text)
            self.assertIn(catalog['source'], text)
            self.assertIn('未成年人请勿访问', text)

    def test_social_images_are_real_pngs_of_the_declared_size(self):
        for catalog in CATALOGS:
            content = (ROOT / f'assets/og-{catalog["key"]}.png').read_bytes()
            self.assertEqual(content[:8], b'\x89PNG\r\n\x1a\n')
            self.assertEqual(struct.unpack('>II', content[16:24]), (1200, 630))

    def test_chinese_use_cases_and_aliases_are_visible_and_machine_readable(self):
        for catalog in CATALOGS:
            with self.subTest(gallery=catalog['key']):
                html = (ROOT / catalog['path'] / 'index.html').read_text()
                text = (ROOT / catalog['path'] / 'catalog.md').read_text()
                graph = json.loads(html.split('<script type="application/ld+json">')[1].split('</script>')[0])['@graph']
                gallery = next(node for node in graph if node['@type'] == 'ImageGallery')
                self.assertEqual(gallery['alternateName'], catalog['aliases'])
                overview = html.split('<!-- seo:overview:start -->')[1].split('<!-- seo:overview:end -->')[0]
                for alias in gallery['alternateName']:
                    self.assertIn(alias, overview)
                    self.assertIn(alias, text)
                self.assertIn(catalog['scenario'], overview)
                self.assertIn(catalog['scenario'], text)
                prefix = '../' if catalog['path'] else ''
                self.assertIn(f'href="{prefix}guide.md"', overview)
                self.assertIn('https://x.com/ai_bange/status/2115651909948477678', overview)
        self.assertIn(BASE + 'guide.md', (ROOT / 'llms.txt').read_text())
