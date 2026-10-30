'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = {};
runInNewContext(readFileSync(join(__dirname, '../portrait/catalog.js'), 'utf8'), catalog);
const rows = JSON.parse(readFileSync(join(__dirname, '../portrait/data/portrait-zh.json'), 'utf8'));

test('正面图与造型参考按模式独立筛选', () => {
  assert.equal(catalog.filterPortraits(rows).length, 893);
  assert.equal(catalog.filterPortraits(rows, {mode: 'styling'}).length, 606);
  assert.equal(catalog.filterPortraits(rows, {mode: 'face', hair: '长发'}).length, 77);
  assert.equal(catalog.filterPortraits(rows, {mode: 'styling', hair: '长发'}).length, 59);
});

test('中文与日文关键词可组合，ID 搜索忽略大小写', () => {
  const matched = catalog.filterPortraits(rows, {mode: 'face', hair: '短发', query: '空气刘海 シースルーバング'});
  assert.ok(matched.length > 0);
  assert.ok(matched.every(row => row.发型.includes('空气刘海') && row.原始发型.includes('シースルーバング')));
  const byId = catalog.filterPortraits(rows, {query: rows[0].id.toUpperCase()});
  assert.deepEqual(Array.from(byId, row => row.id), [rows[0].id]);
  assert.equal(catalog.filterPortraits(rows, {query: '不存在的发型关键词'}).length, 0);
});

test('排行保留原站顺序并排除失效 ID', () => {
  const ids = [rows[4].id, 'missing', rows[0].id];
  assert.deepEqual(Array.from(catalog.rankedPortraits(rows, ids), row => row.id), [rows[4].id, rows[0].id]);
});
