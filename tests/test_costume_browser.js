'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

async function loadBrowser({animation = true, query = '', copyFails = false} = {}) {
  const nodes = new Map(), recorded = [];
  const location = new URL('https://deeyu.github.io/ai-costume-gallery-zh/' + (animation ? 'costume-anime/' : '') + query);
  const element = tag => ({tagName: tag.toUpperCase(), children: [], events: {}, attrs: {}, value: '', textContent: '',
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    addEventListener(key, value) { this.events[key] = value; },
    setAttribute(key, value) { this.attrs[key] = value; }, getAttribute(key) { return this.attrs[key]; },
    showModal() { this.open = true; }, close() { this.open = false; }});
  const node = id => { if (!nodes.has(id)) nodes.set(id, element('div')); return nodes.get(id); };
  node('version-realistic').attrs.href = animation ? '../' : './';
  node('version-anime').attrs.href = animation ? './' : 'costume-anime/';
  const folder = animation ? 'costume-anime' : '.';
  const rows = JSON.parse(readFileSync(join(__dirname, '..', folder, 'data/costume-zh.json')));
  let loader;
  const context = {document: {getElementById: node, createElement: element, addEventListener() {},
      body: {dataset: {costumeVersion: animation ? 'anime' : 'realistic', costumeIndex: 'data/costume-zh.json'}}},
    location, URL, URLSearchParams, console,
    history: {replaceState(_state, _title, url) { location.href = new URL(url, location).href; }},
    GalleryLoader: class { constructor(options) { loader = options; } reset() {} update() {} },
    galleryStats: {sort: rows => rows, decorate() {}, record: (action, id) => recorded.push({action, id})},
    copyGalleryImage: async () => { if (copyFails) throw new Error('denied'); },
    fetch: async () => ({ok: true, json: async () => rows})};
  await runInNewContext(readFileSync(join(__dirname, '../assets/app.js'), 'utf8'), context);
  return {node, recorded, location, loader: () => loader};
}

test('写实与动画分别显示完整实际计数，切换链接保留分类与多词检索', async () => {
  for (const [animation, count] of [[true, '1,320'], [false, '1,407']]) {
    const ui = await loadBrowser({animation, query: '?category=春装&q=蕾丝%20蓝色'});
    assert.match(ui.node('total').textContent, new RegExp(count));
    assert.match(ui.node('section-title').textContent, /春装/);
    assert.equal(ui.node('q').value, '蕾丝 蓝色');
    for (const id of ['version-realistic', 'version-anime']) {
      const link = new URL(ui.node(id).href);
      assert.equal(link.searchParams.get('category'), '春装');
      assert.equal(link.searchParams.get('q'), '蕾丝 蓝色');
    }
    ui.node('reset').events.click();
    assert.equal(new URL(ui.node('version-anime').href).search, '');
  }
});

test('动画卡片、预览、PNG 与复制使用动画源站，滚动追加保留旧卡片', async () => {
  const ui = await loadBrowser();
  const first = ui.node('grid').children[0];
  ui.loader().loadMore();
  assert.equal(ui.node('grid').children.length, 120);
  assert.equal(ui.node('grid').children[0], first);
  first.events.click();
  assert.match(ui.node('large').src, /^https:\/\/ai-costume-anime-gallery.pages.dev\/img\/SPR-0001.webp$/);
  assert.equal(ui.node('download').href, 'https://ai-costume-anime-gallery.pages.dev/png/SPR-0001.png');
  assert.match(ui.node('detail-cat').textContent, /动画版/);
  await ui.node('copy-image').events.click();
  assert.deepEqual(ui.recorded, [{action: 'copy', id: 'SPR-0001'}]);
});

test('无效分类回退全部，空结果保留搜索，复制失败不上报热度', async () => {
  const ui = await loadBrowser({query: '?category=不存在&q=no-such-costume', copyFails: true});
  assert.match(ui.node('status').textContent, /共 0 套/);
  assert.equal(ui.node('empty').hidden, false);
  assert.equal(new URL(ui.node('version-realistic').href).searchParams.get('category'), null);
  assert.equal(new URL(ui.node('version-realistic').href).searchParams.get('q'), 'no-such-costume');
  ui.node('reset').events.click();
  ui.node('grid').children[0].events.click();
  await ui.node('copy-image').events.click();
  assert.match(ui.node('copy-status').textContent, /复制失败/);
  assert.equal(ui.recorded.length, 0);
});
