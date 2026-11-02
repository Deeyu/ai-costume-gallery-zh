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

test('眼睛颜色与形状分别组合，保留英文标签且去重', () => {
  assert.equal(api.animeSlot(row('H095')), 'eyeColor');
  assert.equal(api.animeSlot(row('H114')), 'eyeShape');
  const text = api.composeAnime({style: row('H001-black'), eyeColor: row('H095'), eyeShape: row('H114'), outfit: row('O041')}, {extra: 'black hair, soft light'});
  assert.ok(text.includes('black hair'));
  assert.ok(text.includes('brown eyes'));
  assert.ok(text.includes('heart-shaped pupils'));
  assert.equal(text.split(', ').filter(tag => tag === 'black hair').length, 1);
});

test('单独选择发色会覆盖发型默认色，双人动作不叠加 solo', () => {
  assert.equal(api.animeTags(row('H001-black')), 'long hair, black hair');
  assert.equal(api.animeTags(row('H001')), 'long hair, brown hair');
  const text = api.composeAnime({style: row('H001-black'), color: row('H052'), pose: row('P140')});
  assert.ok(text.includes('blonde hair'));
  assert.ok(!text.includes('black hair'));
  assert.ok(text.startsWith('2girls'));
  assert.ok(!text.includes('solo'));
});

test('姿势已定义景别时跳过冲突景别，可输出多行', () => {
  const text = api.composeAnime({pose: row('P090')}, {camera: 'full body', background: 'white background', multiline: true});
  assert.ok(!text.includes('full body'));
  assert.ok(text.includes('white background'));
  assert.ok(text.includes(',\n'));
});
