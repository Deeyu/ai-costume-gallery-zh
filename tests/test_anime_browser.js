'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

async function loadBrowser({copyFails = false} = {}) {
  const nodes = new Map();
  const document = {activeElement: {tagName: 'BODY'}, addEventListener() {}, querySelector: () => null};
  function createElement(tag) {
    const attrs = {};
    return {tagName: tag.toUpperCase(), children: [], events: {}, value: '', hidden: false, text: '',
      set textContent(value) { this.text = value; },
      get textContent() { return this.text + this.children.map(child => child.textContent).join(''); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; this.text = ''; },
      addEventListener(name, handler) { this.events[name] = handler; },
      setAttribute(name, value) { attrs[name] = value; }, getAttribute(name) { return attrs[name]; },
      showModal() { this.open = true; }, close() { this.open = false; },
      getBoundingClientRect() { return {left: 100, right: 400, top: 100, bottom: 400}; }};
  }
  document.createElement = createElement;
  document.getElementById = (id) => {
    if (!nodes.has(id)) nodes.set(id, createElement('div'));
    return nodes.get(id);
  };
  let copied, imageSource, loader;
  const recorded = [], families = [];
  const context = {document, console, copyGalleryImage: async source => {
    if (copyFails) throw new Error('clipboard unavailable');
    imageSource = source;
  },
    galleryStats: {sort: items => items, decorate: (_card, ids) => families.push(ids), record: (action, id) => recorded.push({action, id})},
    localStorage: {getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); }},
    navigator: {clipboard: {writeText: async (text) => { copied = text; }}},
    GalleryLoader: class { constructor(options) { loader = options; } reset() {} update() {} },
    fetch: async url => ({ok: true, json: async () => JSON.parse(readFileSync(join(__dirname, '../anime', url), 'utf8'))})};
  runInNewContext(readFileSync(join(__dirname, '../anime/catalog.js'), 'utf8'), context);
  await runInNewContext(readFileSync(join(__dirname, '../anime/app.js'), 'utf8'), context);
  return {node: document.getElementById, copied: () => copied, imageSource: () => imageSource, loader: () => loader, recorded, families};
}

test('三类切换完整计数，滚动追加保留旧卡片，收藏存储被禁用时仍能使用', async () => {
  const ui = await loadBrowser(), find = (id, text) => ui.node(id).children.find(item => item.textContent === text);
  assert.match(ui.node('total').textContent, /843 条目 · 1,027 张彩图/);
  assert.match(ui.node('status').textContent, /440 项 · 已显示 48 项/);
  const first = ui.node('grid').children[0];
  ui.loader().loadMore();
  assert.equal(ui.node('grid').children[0], first);
  assert.equal(ui.node('grid').children.length, 96);
  const favorite = first.children[1].children[2].children[1];
  favorite.events.click();
  ui.node('favorites').events.click();
  assert.match(ui.node('status').textContent, /共 1 项/);
  ui.node('reset').events.click();
  find('sections', '发型与眼睛122').events.click();
  assert.match(ui.node('status').textContent, /共 122 项/);
  find('sections', '姿势281').events.click();
  assert.match(ui.node('status').textContent, /共 281 项/);
});

test('发色预览、标签和图片复制使用同一颜色，姿势切换保持线稿版本', async () => {
  const ui = await loadBrowser(), find = (id, text) => ui.node(id).children.find(item => item.textContent === text);
  find('sections', '发型与眼睛122').events.click();
  ui.node('grid').children[0].children[0].events.click();
  assert.equal(ui.node('variants').children.length, 5);
  find('variants', '银发').events.click();
  assert.ok(ui.node('large').src.endsWith('/H001-silver.jpg'));
  await ui.node('copy').events.click();
  assert.equal(ui.copied(), 'long hair, silver hair');
  await ui.node('copy-image').events.click();
  assert.ok(ui.imageSource().endsWith('/img/H001-silver.jpg'));
  assert.equal(ui.node('copy-status').textContent, '图片已复制');
  assert.deepEqual(ui.recorded, [{action: 'copy', id: 'H001-silver'}]);
  assert.ok(ui.families.some(ids => ids.length === 5 && ids.includes('H001-silver')));
  ui.node('close').events.click();
  find('sections', '姿势281').events.click();
  ui.node('grid').children[0].children[0].events.click();
  ui.node('line-view').events.click();
  assert.ok(ui.node('large').src.endsWith('/line/P001.png'));
  await ui.node('copy-image').events.click();
  assert.ok(ui.imageSource().endsWith('/line/P001.png'));
  assert.deepEqual(ui.recorded[1], {action: 'copy', id: 'P001'});
  ui.node('next').events.click();
  assert.ok(ui.node('large').src.endsWith('/line/P001-s.png'));
  assert.equal(ui.node('open-original').href, ui.node('large').src);
});

test('图片复制失败和仅复制标签不会累计图片热度', async () => {
  const ui = await loadBrowser({copyFails: true});
  ui.node('grid').children[0].children[0].events.click();
  await ui.node('copy').events.click();
  assert.equal(ui.recorded.length, 0);
  await ui.node('copy-image').events.click();
  assert.equal(ui.recorded.length, 0);
  assert.match(ui.node('copy-status').textContent, /复制失败/);
});
