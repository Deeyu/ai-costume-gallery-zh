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
      showModal() { this.open = true; }, close() { this.open = false; this.events.close?.(); },
      getBoundingClientRect() { return {left: 100, right: 400, top: 100, bottom: 400}; },
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
  test(`${folder}：两个成人向标签有标识，每次进入均须确认，退出不提醒`, async () => {
    const ui = await loadBrowser(folder);
    const system = name => ui.node('systems').children.find(button => button.dataset.value === name);
    const badges = ui.node('systems').children.filter(button => button.children.some(child => child.className === 'adult-badge'));
    assert.equal(badges.length, 2);
    for (const [name, count] of [['全身单人・性感系', /80 组 · 399 张/], ['双人缠绵', /55 组 · 275 张/]]) {
      const before = ui.node('status').textContent, url = ui.url();
      system(name).events.click();
      assert.equal(ui.node('adult-warning').open, true);
      assert.equal(ui.node('status').textContent, before);
      assert.equal(ui.url(), url);
      ui.node('adult-confirm').events.click();
      assert.equal(ui.node('adult-warning').open, false);
      assert.match(ui.node('status').textContent, count);
      system(name).events.click();
      assert.equal(ui.node('adult-warning').open, false);
      assert.match(ui.node('status').textContent, count);
      system('全身单人・标准系').events.click();
      assert.match(ui.node('status').textContent, /73 组 · 365 张/);
      system(name).events.click();
      assert.equal(ui.node('adult-warning').open, true);
      ui.node('adult-cancel').events.click();
    }
  });

  test(`${folder}：取消、关闭、Esc 原生关闭和遮罩都保留原筛选`, async () => {
    const ui = await loadBrowser(folder, '?system=' + encodeURIComponent('全身单人・标准系') + '&category=' + encodeURIComponent('坐姿'));
    const before = ui.node('status').textContent, url = ui.url(), card = ui.node('grid').children[0];
    for (const cancel of [
      () => ui.node('adult-cancel').events.click(),
      () => ui.node('adult-close').events.click(),
      () => ui.node('adult-warning').close(),
      () => ui.node('adult-warning').events.click({target: ui.node('adult-warning'), clientX: 0, clientY: 0})
    ]) {
      ui.node('systems').children.find(button => button.dataset.value === '双人缠绵').events.click();
      cancel();
      assert.equal(ui.node('adult-warning').open, false);
      assert.equal(ui.node('status').textContent, before);
      assert.equal(ui.url(), url);
      assert.equal(ui.node('grid').children[0], card);
      ui.node('adult-confirm').events.click();
      assert.equal(ui.node('status').textContent, before);
    }
  });

  test(`${folder}：成人向直达链接先显示标准系，确认后恢复完整筛选`, async () => {
    for (const name of ['全身单人・性感系', '双人缠绵']) {
      const ui = await loadBrowser(folder, '?system=' + encodeURIComponent(name) + '&angle=' + encodeURIComponent('侧面') + '&view=single');
      assert.equal(ui.node('adult-warning').open, true);
      assert.match(ui.node('status').textContent, /73 组 · 365 张/);
      assert.ok(ui.node('grid').children.every(card => card.children[0].children[0].src.includes('full_single_')));
      assert.ok(!ui.url().includes(encodeURIComponent(name)));
      ui.node('adult-confirm').events.click();
      assert.match(ui.node('status').textContent, name === '双人缠绵' ? /55 组 · 55 张/ : /80 组 · 80 张/);
      assert.match(ui.node('status').textContent, /逐张查看/);
      assert.ok(ui.url().includes(encodeURIComponent(name)));
      assert.ok(ui.node('grid').children.every(card => card.children[0].children[0].src.includes('_side.')));
    }
  });

  test(`${folder}：人物固定单选并默认标准系，动作可取消，URL 可恢复，空结果可重置`, async () => {
    const ui = await loadBrowser(folder);
    assert.match(ui.node('status').textContent, /73 组 · 365 张/);
    assert.equal(ui.node('systems').children.length, 4);
    assert.ok(ui.node('systems').children.every(button => button.dataset.value));
    assert.ok(!ui.node('total').textContent.includes('中文词条来自 Anhao'));
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
    assert.match(ui.node('status').textContent, /73 组 · 365 张/);
    ui.node('q').events.input({target: {value: 'no-such-pose'}});
    assert.equal(ui.node('grid').children.length, 0);
    assert.equal(ui.node('empty').hidden, false);
    ui.node('reset').events.click();
    assert.match(ui.node('status').textContent, /73 组 · 365 张/);
  });

  test(`${folder}：四个体系的全部动作始终按原顺序显示，点击与取消不会重排`, async () => {
    const ui = await loadBrowser(folder);
    for (const name of ['全身单人・标准系', '全身单人・性感系', '上半身单人', '双人缠绵']) {
      ui.node('systems').children.find(button => button.dataset.value === name).events.click();
      if (ui.node('adult-warning').open) ui.node('adult-confirm').events.click();
      const order = () => ui.node('category-options').children.map(button => button.dataset.value);
      const before = order();
      const rows = JSON.parse(readFileSync(join(__dirname, '..', folder, 'data', folder + '-zh.json'), 'utf8'));
      const expected = ['', ...new Set(rows.filter(row => row.体系 === name).map(row => row.分类))];
      assert.deepEqual(before, expected);
      const last = before.at(-1);
      ui.node('category-options').children.find(button => button.dataset.value === last).events.click();
      assert.deepEqual(order(), before);
      assert.equal(ui.node('category-options').children.find(button => button.getAttribute('aria-pressed') === 'true').dataset.value, last);
      ui.node('category-options').children.find(button => button.dataset.value === last).events.click();
      assert.deepEqual(order(), before);
    }
  });

  test(`${folder}：筛选视角后保留缩略图切换，分组／单图及已知缺图正确`, async () => {
    const ui = await loadBrowser(folder);
    const selectSexy = () => {
      ui.node('systems').children.find(button => button.dataset.value === '全身单人・性感系').events.click();
      ui.node('adult-confirm').events.click();
    };
    selectSexy();
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
    selectSexy();
    ui.node('q').events.input({target: {value: 'full_sexy_P018'}});
    ui.node('single').events.click();
    assert.equal(ui.node('grid').children.length, 4);
  });
}
