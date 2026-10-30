'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = {};
runInNewContext(readFileSync(join(__dirname, '../pose/catalog.js'), 'utf8'), catalog);
const rows = JSON.parse(readFileSync(join(__dirname, '../pose/data/pose-zh.json'), 'utf8'));

test('体系、动作与视角共同限制结果', () => {
  assert.equal(catalog.filterPoses(rows, {system: '全身单人・标准系'}).length, 365);
  assert.equal(catalog.filterPoses(rows, {system: '上半身单人'}).length, 125);
  assert.equal(catalog.filterPoses(rows, {category: '坐姿', angle: '正面'}).length, 14);
  assert.equal(catalog.filterPoses(rows, {system: '上半身单人', category: '坐姿'}).length, 0);
});

test('中文与日文多词搜索，ID 忽略大小写', () => {
  assert.equal(catalog.filterPoses(rows, {query: '单膝 仰け反り座り 正面'}).length, 1);
  assert.equal(catalog.filterPoses(rows, {query: rows[0].id.toUpperCase()})[0].id, rows[0].id);
  assert.equal(catalog.filterPoses(rows, {query: '不存在的姿势'}).length, 0);
});

test('同编号的不同体系不合并，组内视角固定排序', () => {
  const groups = catalog.groupPoses(rows);
  assert.equal(groups.length, 98);
  assert.ok(groups.every(group => group.length === 5));
  assert.deepEqual(Array.from(groups[0], row => row.角度), ['正面', '斜侧', '侧面', '俯视', '仰视']);
  assert.equal(catalog.groupPoses(catalog.filterPoses(rows, {query: 'P001'})).length, 2);
  const filtered = catalog.groupPoses(catalog.filterPoses(rows, {angle: '侧面'}));
  assert.equal(filtered.length, 98);
  assert.ok(filtered.every(group => group.length === 1 && group[0].角度 === '侧面'));
});
