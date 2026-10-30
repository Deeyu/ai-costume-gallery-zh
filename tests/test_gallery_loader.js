'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function setup(connection = {}, observe = true) {
  const events = {}, frames = [], images = [];
  let top = 5000, remaining = 100, loaded = 0, dialogOpen = false;
  let urls = Array.from({length: 20}, (_, i) => `thumb-${i}.webp`);
  const sentinel = {hidden: true, getBoundingClientRect: () => ({top})};
  const window = {innerHeight: 800, addEventListener: (name, callback) => { events[name] = callback; }};
  const Observer = class { constructor(callback) { events.intersection = callback; } observe() {} };
  if (observe) window.IntersectionObserver = Observer;
  const document = {
    querySelector: () => dialogOpen,
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  const context = {
    window, document, navigator: {connection}, IntersectionObserver: Observer,
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    Image: class { constructor() { images.push(this); } }
  };
  const Loader = runInNewContext(readFileSync(join(__dirname, '../assets/gallery-loader.js'), 'utf8') + '\nGalleryLoader;', context);
  const loader = new Loader({sentinel, hasMore: () => remaining > 0, preloadUrls: () => urls,
    loadMore: () => { loaded++; remaining--; top += 2000; loader.update(); }});
  return {loader, sentinel, events, images, connection, frames,
    flush() { const pending = frames.splice(0); pending.forEach((callback) => callback()); },
    setTop(value) { top = value; }, setRemaining(value) { remaining = value; },
    setDialog(value) { dialogOpen = value; }, setUrls(value) { urls = value; },
    get loaded() { return loaded; }};
}

test('临近列表底部自动追加，重复滚动事件合并为一帧', () => {
  const ui = setup();
  ui.loader.update(); ui.flush();
  assert.equal(ui.loaded, 0);
  ui.setTop(1300);
  ui.events.scroll(); ui.events.scroll(); ui.events.intersection();
  assert.equal(ui.frames.length, 1);
  ui.flush();
  assert.equal(ui.loaded, 1);
  ui.flush();
  assert.equal(ui.loaded, 1);
  ui.setTop(1000); ui.events.scroll(); ui.flush();
  assert.equal(ui.loaded, 2);
});

test('预加载只取接下来 12 张缩略图，并发不超过 4，完成后释放', () => {
  const ui = setup();
  ui.setTop(2000); ui.loader.update(); ui.flush();
  assert.equal(ui.loaded, 0);
  assert.equal(ui.images.length, 4);
  assert.equal(ui.loader.active.size, 4);
  ui.loader.preload(Array.from({length: 20}, (_, i) => `thumb-${i}.webp`));
  for (let i = 0; i < 12; i++) {
    const image = ui.images[i];
    assert.ok(image);
    assert.equal(image.src, `thumb-${i}.webp`);
    assert.equal(image.decoding, 'async');
    assert.equal(image.fetchPriority, 'low');
    (i % 2 ? image.onerror : image.onload)();
    assert.ok(ui.loader.active.size <= 4);
  }
  assert.equal(ui.images.length, 12);
  assert.equal(ui.loader.active.size, 0);
});

test('筛选重置后丢弃旧预加载队列，后续请求来自新结果', () => {
  const ui = setup();
  ui.setTop(2000); ui.loader.update(); ui.flush();
  ui.loader.reset();
  ui.setUrls(['new-filter.webp']);
  ui.loader.update(); ui.flush();
  ui.images[0].onload();
  assert.equal(ui.images[4].src, 'new-filter.webp');
  for (const image of ui.images.slice(1, 4)) image.onload();
  assert.equal(ui.images.length, 5);
});

test('省流量与慢速网络跳过预加载，自动追加仍可使用', () => {
  for (const connection of [{saveData: true}, {effectiveType: '2g'}, {effectiveType: 'slow-2g'}]) {
    const ui = setup(connection);
    ui.setTop(1000); ui.loader.update(); ui.flush();
    assert.equal(ui.loaded, 1);
    assert.equal(ui.images.length, 0);
  }
});

test('弹窗期间暂停追加，关闭后继续；无结果和末页停止加载', () => {
  const ui = setup();
  ui.setTop(1000); ui.setDialog(true); ui.loader.update(); ui.flush();
  assert.equal(ui.loaded, 0);
  assert.equal(ui.images.length, 0);
  ui.setDialog(false); ui.events.close(); ui.flush();
  assert.equal(ui.loaded, 1);
  ui.setRemaining(0); ui.loader.update(); ui.setTop(0); ui.events.scroll(); ui.flush();
  assert.equal(ui.loaded, 1);
  assert.equal(ui.sentinel.hidden, true);
});

test('不支持 IntersectionObserver 时仍通过滚动自动追加', () => {
  const ui = setup({}, false);
  ui.loader.update(); ui.flush();
  ui.setTop(1000); ui.events.scroll(); ui.flush();
  assert.equal(ui.loaded, 1);
});
