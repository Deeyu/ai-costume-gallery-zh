'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

async function loadBrowser(folder, search = '') {
  const nodes = new Map();
  const document = {activeElement: {tagName: 'BODY'}, addEventListener() {}, querySelector: () => null};
  function createElement(tag) {
    const attrs = {}, classes = new Set();
    return {tagName: tag.toUpperCase(), children: [], events: {}, dataset: {}, value: '', hidden: false, text: '',
      set textContent(value) { this.text = value; },
      get textContent() { return this.text + this.children.map(child => child.textContent).join(''); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; this.text = ''; },
      addEventListener(name, handler) { this.events[name] = handler; },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) { return attrs[name]; },
      focus() { document.activeElement = this; },
      showModal() { this.open = true; }, close() { this.open = false; },
      classList: {toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); }}
    };
  }
  document.createElement = createElement;
  document.getElementById = (id) => {
    if (!nodes.has(id)) nodes.set(id, createElement('div'));
    return nodes.get(id);
  };
  let savedURL;
  const context = {
    document, URLSearchParams, location: {pathname: `/${folder}/`, search, hash: ''},
    history: {replaceState(_state, _title, url) { savedURL = url; }},
    Image: class {},
    GalleryLoader: class { reset() {} update() {} },
    fetch: async (url) => ({ok: true, json: async () => JSON.parse(readFileSync(join(__dirname, '..', folder, url), 'utf8'))}),
    console
  };
  runInNewContext(readFileSync(join(__dirname, '../pose/catalog.js'), 'utf8'), context);
  await runInNewContext(readFileSync(join(__dirname, '..', folder, 'app.js'), 'utf8'), context);
  return {node: document.getElementById, url: () => savedURL};
}

for (const folder of ['pose', 'depth']) {
  test(`${folder}：全部／体系／动作可取消筛选，URL 可恢复，空结果可重置`, async () => {
    const ui = await loadBrowser(folder);
    assert.match(ui.node('status').textContent, /288 组 · 1439 张/);
    const system = () => ui.node('systems').children.find(button => button.dataset.value === '全身单人・标准系');
    system().events.click();
    assert.match(ui.node('status').textContent, /73 组 · 365 张/);
    const sitting = () => ui.node('category-options').children.find(button => button.textContent === '坐姿');
    sitting().events.click();
    assert.match(ui.node('status').textContent, /14 组 · 70 张/);
    const restored = await loadBrowser(folder, ui.url().slice(ui.url().indexOf('?')));
    assert.match(restored.node('status').textContent, /14 组 · 70 张/);
    sitting().events.click();
    assert.match(ui.node('status').textContent, /73 组 · 365 张/);
    system().events.click();
    assert.match(ui.node('status').textContent, /288 组 · 1439 张/);
    ui.node('q').events.input({target: {value: 'no-such-pose'}});
    assert.equal(ui.node('grid').children.length, 0);
    assert.equal(ui.node('empty').hidden, false);
    ui.node('reset').events.click();
    assert.match(ui.node('status').textContent, /288 组 · 1439 张/);
  });

  test(`${folder}：筛选视角后保留缩略图切换，分组／单图及已知缺图正确`, async () => {
    const ui = await loadBrowser(folder);
    ui.node('q').events.input({target: {value: 'full_sexy_P018'}});
    const side = ui.node('angle-options').children.find(button => button.dataset.value === '侧面');
    side.events.click();
    assert.match(ui.node('status').textContent, /1 组 · 1 张/);
    const card = ui.node('grid').children[0];
    assert.equal(card.children[1].children.length, 4);
    assert.match(card.children[0].children[0].src, /_side\./);
    card.children[0].events.click();
    assert.equal(ui.node('angles').children.length, 4);
    assert.match(ui.node('position').textContent, /侧面/);
    ui.node('viewer-stage').events.touchstart({touches: [{clientX: 200, clientY: 200}]});
    ui.node('viewer-stage').events.touchend({changedTouches: [{clientX: 110, clientY: 210}]});
    assert.match(ui.node('position').textContent, /俯视/);
    ui.node('viewer-stage').events.touchstart({touches: [{clientX: 200, clientY: 200}]});
    ui.node('viewer-stage').events.touchend({changedTouches: [{clientX: 210, clientY: 100}]});
    assert.match(ui.node('position').textContent, /俯视/);
    ui.node('single').events.click();
    assert.equal(ui.node('grid').children.length, 1);
    ui.node('reset').events.click();
    ui.node('q').events.input({target: {value: 'full_sexy_P018'}});
    ui.node('single').events.click();
    assert.equal(ui.node('grid').children.length, 4);
  });
}
