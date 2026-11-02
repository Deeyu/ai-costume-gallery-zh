'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const {randomUUID} = require('node:crypto');
const code = readFileSync(join(__dirname, '../assets/site.js'), 'utf8');
const pure = {};
runInNewContext(code, pure);

test('热度是复制加下载之和，零数据及并列项保留原顺序；分组按真实视角合计', () => {
  const rows = [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'd'}];
  const values = {b: {copies: 2, downloads: 1}, c: {copies: 1, downloads: 2}};
  assert.deepEqual(Array.from(pure.popularGalleryItems(rows, values), row => row.id), ['b', 'c', 'a', 'd']);
  const groups = [[rows[0], rows[1]], [rows[2], rows[3]]];
  assert.deepEqual(Array.from(pure.popularGalleryItems(groups, {b: {copies: 1}, d: {downloads: 3}}), group => group[0].id), ['c', 'a']);
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c', 'd']);
  assert.equal(pure.galleryPopularity(rows, {a: {copies: -2, downloads: '99'}}).copies, 0);
});

async function client({dnt = false, failure = false, local = false} = {}) {
  const nodes = new Map(), storage = new Map(), requests = [], badges = [], dispatched = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent: '', dataset: {}, disabled: true, events: {}, attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, handler) { this.events[k] = handler; }, closest() { return this; }});
    return nodes.get(id);
  };
  const document = {body: {dataset: {gallery: 'anime'}}, getElementById: node,
    querySelector: () => node('stars'), querySelectorAll: () => badges, createElement: () => node('badge' + badges.length),
    dispatchEvent: event => dispatched.push(event.type)};
  const api = {document, console, Event, crypto: {randomUUID},
    GALLERY_SITE_CONFIG: {statsEndpoint: 'https://stats.example', origin: 'https://deeyu.github.io', basePath: '/ai-costume-gallery-zh/'},
    location: {origin: local ? 'http://127.0.0.1:8000' : 'https://deeyu.github.io', pathname: '/ai-costume-gallery-zh/anime/'},
    navigator: {doNotTrack: dnt ? '1' : '0'},
    localStorage: {getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)},
    sessionStorage: {getItem: () => null, setItem() {}},
    fetch: async (url, options = {}) => {
      requests.push({url, options});
      if (failure) throw new Error('offline');
      if (url.includes('/stars')) return {ok: true, json: async () => ({stars: 123})};
      if (url.includes('/stats?')) return {ok: true, json: async () => ({visits: {pageviews: 9, visitors: 3}, images: {O001: {copies: 2, downloads: 1}}})};
      const event = JSON.parse(options.body);
      return {ok: true, json: async () => event.type === 'visit' ? {visits: {pageviews: 10, visitors: 4}} : {copies: 3, downloads: 1}};
    }};
  runInNewContext(code.replace("if (typeof document !== 'undefined') initGallerySite();", ''), api);
  await api.initGallerySite();
  await Promise.resolve();
  return {api, node, requests, badges, dispatched};
}

test('Star 数、累计访问与访客真实返回后展示；热门按共享数据排序并更新徽标', async () => {
  const ui = await client();
  assert.equal(ui.node('stars').textContent, '123');
  assert.match(ui.node('site-visits').textContent, /累计访问 10 次 · 访客 4/);
  assert.equal(ui.node('sort-popular').disabled, false);
  assert.equal(ui.node('popularity-note').textContent, '');
  ui.node('sort-popular').events.click();
  assert.equal(ui.dispatched[0], 'gallery-sort-change');
  assert.equal(ui.api.galleryStats.sort([{id: 'O002'}, {id: 'O001'}])[0].id, 'O001');
  const card = {append: node => ui.badges.push(node)};
  ui.api.galleryStats.decorate(card, ['O001']);
  assert.equal(ui.badges[0].textContent, '热门 3');
  await ui.api.galleryStats.record('copy', 'O001');
  assert.equal(ui.badges[0].textContent, '热门 4');
  const events = ui.requests.filter(item => item.options.method === 'POST').map(item => JSON.parse(item.options.body));
  assert.equal(events.filter(event => event.type === 'visit').length, 1);
  assert.equal(events[1].image_id, 'O001');
  assert.notEqual(events[0].event_id, events[1].event_id);
});

test('DNT 或本地预览不上报访问或操作；服务失败不显示假零数据', async () => {
  for (const options of [{dnt: true}, {local: true}]) {
    const ui = await client(options);
    await ui.api.galleryStats.record('copy', 'O001');
    assert.ok(ui.requests.every(item => item.options.method !== 'POST'));
  }
  const ui = await client({failure: true});
  assert.equal(ui.node('sort-popular').disabled, true);
  assert.match(ui.node('popularity-note').textContent, /热度暂不可用/);
  assert.equal(ui.node('stars').textContent, '—');
  assert.match(ui.node('site-visits').textContent, /暂不可用/);
  await assert.doesNotReject(ui.api.galleryStats.record('copy', 'O001'));
});
