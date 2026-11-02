'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const rows = JSON.parse(readFileSync(join(__dirname, '../anime/data/anime-zh.json'), 'utf8'));
const api = {};
runInNewContext(readFileSync(join(__dirname, '../anime/catalog.js'), 'utf8'), api);
const row = id => rows.find(item => item.id === id);

test('公开索引三个模式完整可达，发色变体归入对应卡片', () => {
  assert.equal(api.filterAnime(rows).length, 440);
  assert.equal(api.filterAnime(rows, {mode: 'hair'}).length, 122);
  assert.equal(api.filterAnime(rows, {mode: 'pose'}).length, 281);
  assert.equal(api.animeFamily(rows, row('H001-black')).length, 5);
  assert.equal(api.filterAnime(rows, {mode: 'hair', category: '发型'}).length, 46);
});

test('中文、日文、英文和 ID 多词检索，保留原始顺序', () => {
  for (const query of ['藏蓝 水手服', 'セーラー服 紺', 'serafuku O001']) {
    assert.equal(api.filterAnime(rows, {query})[0].id, 'O001');
  }
  assert.equal(api.filterAnime(rows, {mode: 'hair', query: 'H001 银发'})[0].id, 'H001-silver');
  assert.equal(api.filterAnime(rows, {mode: 'outfit', query: '不存在的衣服'}).length, 0);
});

test('仅收藏的发色变体仍可检索且不会重复显示基础卡片', () => {
  const found = api.filterAnime(rows, {mode: 'hair', favoritesOnly: true, favorites: new Set(['H001-black', 'H001-silver'])});
  assert.equal(found.length, 1);
  assert.ok(['H001-black', 'H001-silver'].includes(found[0].id));
});

test('发型标签保留当前预览色，服装与姿势标签保持原样', () => {
  assert.equal(api.animeTags(row('H001-black')), 'long hair, black hair');
  assert.equal(api.animeTags(row('H001')), 'long hair, brown hair');
  assert.equal(api.animeTags(row('O041')), row('O041').标签);
  assert.equal(api.animeTags(row('P001')), row('P001').标签);
});
