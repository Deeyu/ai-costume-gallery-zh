'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

async function loadBrowser() {
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
  let copied, loader;
  const context = {document, console,
    localStorage: {getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); }},
    navigator: {clipboard: {writeText: async (text) => { copied = text; }}},
    GalleryLoader: class { constructor(options) { loader = options; } reset() {} update() {} },
    fetch: async url => ({ok: true, json: async () => JSON.parse(readFileSync(join(__dirname, '../anime', url), 'utf8'))})};
  runInNewContext(readFileSync(join(__dirname, '../anime/catalog.js'), 'utf8'), context);
  await runInNewContext(readFileSync(join(__dirname, '../anime/app.js'), 'utf8'), context);
  return {node: document.getElementById, copied: () => copied, loader: () => loader};
}

test('三类切换完整计数，滚动追加保留旧卡片，收藏存储被禁用时仍能使用', async () => {
  const ui = await loadBrowser(), find = (id, text) => ui.node(id).children.find(item => item.textContent === text);
  assert.match(ui.node('total').textContent, /843 条目 · 1,027 张彩图/);
  assert.match(ui.node('status').textContent, /440 项 · 已显示 48 项/);
  const first = ui.node('grid').children[0];
  ui.loader().loadMore();
  assert.equal(ui.node('grid').children[0], first);
  assert.equal(ui.node('grid').children.length, 96);
  const favorite = first.children[1].children[2].children[2];
  favorite.events.click();
  ui.node('favorites').events.click();
  assert.match(ui.node('status').textContent, /共 1 项/);
  ui.node('reset').events.click();
  find('sections', '发型与眼睛122').events.click();
  assert.match(ui.node('status').textContent, /共 122 项/);
  find('sections', '姿势281').events.click();
  assert.match(ui.node('status').textContent, /共 281 项/);
});

test('发色预览、复制和组合使用同一颜色，姿势切换保持线稿版本', async () => {
  const ui = await loadBrowser(), find = (id, text) => ui.node(id).children.find(item => item.textContent === text);
  find('sections', '发型与眼睛122').events.click();
  ui.node('grid').children[0].children[0].events.click();
  assert.equal(ui.node('variants').children.length, 5);
  find('variants', '银发').events.click();
  assert.ok(ui.node('large').src.endsWith('/H001-silver.jpg'));
  await ui.node('copy').events.click();
  assert.equal(ui.copied(), 'long hair, silver hair');
  ui.node('add-selection').events.click();
  assert.ok(ui.node('prompt').value.includes('silver hair'));
  assert.match(ui.node('open-builder').textContent, /1 项/);
  ui.node('open-builder').events.click();
  assert.equal(ui.node('builder').open, true);
  ui.node('builder').close();
  ui.node('close').events.click();
  find('sections', '姿势281').events.click();
  ui.node('grid').children[0].children[0].events.click();
  ui.node('line-view').events.click();
  assert.ok(ui.node('large').src.endsWith('/line/P001.png'));
  ui.node('next').events.click();
  assert.ok(ui.node('large').src.endsWith('/line/P001-s.png'));
  assert.equal(ui.node('open-original').href, ui.node('large').src);
});
