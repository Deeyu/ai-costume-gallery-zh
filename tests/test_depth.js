'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = {};
runInNewContext(readFileSync(join(__dirname, '../pose/catalog.js'), 'utf8'), catalog);
const rows = JSON.parse(readFileSync(join(__dirname, '../depth/data/depth-zh.json'), 'utf8'));

test('深度图完整分组，已知缺图按四视角显示', () => {
  const groups = catalog.groupPoses(rows);
  assert.equal(rows.length, 1439);
  assert.equal(groups.length, 288);
  assert.equal(groups.filter(group => group.length === 5).length, 287);
  const missing = groups.find(group => group[0].组ID === 'full_sexy_P018');
  assert.equal(missing.length, 4);
  assert.ok(missing.every(row => row.角度 !== '仰视'));
});

test('中文、日文和 ID 搜索配合体系、视角筛选', () => {
  assert.equal(catalog.filterPoses(rows, {system: '全身单人・标准系', category: '坐姿', angle: '正面'}).length, 14);
  assert.equal(catalog.filterPoses(rows, {query: rows[0].id.toUpperCase()})[0].id, rows[0].id);
  assert.equal(catalog.filterPoses(rows, {query: '单膝 仰け反り座り 正面'}).length, 1);
  assert.equal(catalog.filterPoses(rows, {query: '不存在的姿势'}).length, 0);
  const groups = catalog.groupPoses(catalog.filterPoses(rows, {angle: '侧面'}));
  assert.equal(groups.length, 288);
  assert.ok(groups.every(group => group.length === 1));
});

test('预览与下载指向深度原站，同编号的不同体系仍独立', () => {
  for (const row of rows) {
    assert.equal(row.原图, `https://ai-pose-depth-gallery.pages.dev/img/${row.id}.png`);
    assert.equal(row.缩略图, `https://ai-pose-depth-gallery.pages.dev/thumbs/${row.id}.jpg`);
  }
  assert.equal(catalog.groupPoses(catalog.filterPoses(rows, {query: 'P001'})).length, 4);
});
