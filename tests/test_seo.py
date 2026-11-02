from html.parser import HTMLParser
from hashlib import sha256
import json
from pathlib import Path
import re
import struct
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from seo import BASE, CATALOGS, CONTENT_UPDATED, ROOT, info, outputs


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
        self.assertEqual(len(descriptions), len(CATALOGS))

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
        expected = [BASE + catalog['path'] for catalog in CATALOGS] + [BASE + 'examples/']
        expected += [BASE + 'directory/' + catalog['key'] + '/' for catalog in CATALOGS] + [BASE + 'directory/']
        self.assertEqual(urls, expected)
        self.assertEqual([node.text for node in tree.findall('.//{*}lastmod')], [CONTENT_UPDATED] * len(expected))
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

    def test_complete_directories_cover_every_record_and_keep_source_terms(self):
        total = 0
        for catalog in CATALOGS:
            with self.subTest(gallery=catalog['key']):
                data = info(catalog, ROOT)
                rows = json.loads((ROOT / catalog['data']).read_text())
                html = (ROOT / data['directory'] / 'index.html').read_text()
                parsed = HeadAndCards(html)
                ids = re.findall(r'data-record-id="([^"]+)"', html)
                self.assertCountEqual(ids, [row['id'] for row in rows])
                self.assertEqual(len(ids), len(set(ids)))
                self.assertEqual(parsed.h1_count, 1)
                self.assertEqual(parsed.links['canonical'][0]['href'], BASE + data['directory'])
                self.assertEqual(parsed.scripts, [])
                self.assertTrue(all(not image['src'].startswith('http') for image in parsed.images))
                self.assertIn(catalog['source'], html)
                self.assertIn('未成年人请勿访问', html)
                for row in [rows[0], rows[-1]]:
                    term = row.get('原始姿势名称', row.get('原始名称', row.get('英文关键词', row.get('原始发长'))))
                    self.assertIn(term.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), html)
                if catalog['key'] in ['pose', 'depth']:
                    self.assertEqual(parsed.meta['rating'], 'adult')
                total += len(ids)
        self.assertEqual(total, 8131)

    def test_combined_reference_preserves_snapshot_sources_and_separate_licenses(self):
        combined = (ROOT / 'llms-full.txt').read_text()
        short = (ROOT / 'llms.txt').read_text()
        self.assertIn(BASE + 'llms-full.txt', short)
        for catalog in CATALOGS:
            data = info(catalog, ROOT)
            self.assertIn(data['count'], combined)
            self.assertIn(data['snapshot'], combined)
            self.assertIn(catalog['source'], combined)
            self.assertIn(BASE + data['directory'], short)
            graph = json.loads((ROOT / catalog['path'] / 'index.html').read_text().split('<script type="application/ld+json">')[1].split('</script>')[0])['@graph']
            licensed = [node for node in graph if 'license' in node]
            self.assertEqual([node['@type'] for node in licensed], ['SoftwareSourceCode'])
            gallery = next(node for node in graph if node['@type'] == 'ImageGallery')
            self.assertEqual(gallery['dateModified'], CONTENT_UPDATED)
        self.assertIn('不代表原作者的官方版本或背书', short)

    def test_example_social_metadata_and_video_match_real_local_media(self):
        html = (ROOT / 'examples/index.html').read_text()
        parsed = HeadAndCards(html)
        self.assertEqual(parsed.h1_count, 1)
        self.assertEqual(parsed.links['canonical'][0]['href'], BASE + 'examples/')
        self.assertEqual(parsed.meta['description'], parsed.meta['og:description'])
        self.assertEqual(parsed.meta['description'], parsed.meta['twitter:description'])
        self.assertEqual(parsed.meta['og:image'], parsed.meta['twitter:image'])
        graph = json.loads(html.split('<script type="application/ld+json">')[1].split('</script>')[0])['@graph']
        video = next(node for node in graph if node['@type'] == 'VideoObject')
        for field in ['contentUrl', 'thumbnailUrl']:
            self.assertTrue((ROOT / video[field].removeprefix(BASE)).is_file())
        self.assertEqual(video['duration'], 'PT5.178S')
        self.assertLessEqual(video['uploadDate'][:10], CONTENT_UPDATED)
        image = (ROOT / parsed.meta['og:image'].removeprefix(BASE)).read_bytes()
        self.assertEqual(struct.unpack('>II', image[16:24]), (int(parsed.meta['og:image:width']), int(parsed.meta['og:image:height'])))
        self.assertIn('案例原帖', parsed.meta['description'])
