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
  assert.equal(catalog.filterPoses(rows, {system: '全身单人・性感系'}).length, 399);
  assert.equal(catalog.filterPoses(rows, {system: '上半身单人'}).length, 400);
  assert.equal(catalog.filterPoses(rows, {system: '双人缠绵'}).length, 275);
  assert.equal(catalog.filterPoses(rows, {system: '全身单人・标准系', category: '坐姿', angle: '正面'}).length, 14);
  assert.equal(catalog.filterPoses(rows, {system: '上半身单人', category: '坐姿'}).length, 0);
});

test('中文与日文多词搜索，ID 忽略大小写', () => {
  assert.equal(catalog.filterPoses(rows, {query: '单膝 仰け反り座り 正面'}).length, 1);
  assert.equal(catalog.filterPoses(rows, {query: rows[0].id.toUpperCase()})[0].id, rows[0].id);
  assert.equal(catalog.filterPoses(rows, {query: '不存在的姿势'}).length, 0);
});

test('同编号的不同体系不合并，组内视角固定排序', () => {
  const groups = catalog.groupPoses(rows);
  assert.equal(groups.length, 288);
  assert.equal(groups.filter(group => group.length === 5).length, 287);
  const incomplete = groups.find(group => group[0].组ID === 'full_sexy_P018');
  assert.deepEqual(Array.from(incomplete, row => row.角度), ['正面', '斜侧', '侧面', '俯视']);
  assert.deepEqual(Array.from(groups[0], row => row.角度), ['正面', '斜侧', '侧面', '俯视', '仰视']);
  assert.equal(catalog.groupPoses(catalog.filterPoses(rows, {query: 'P001'})).length, 4);
  const filtered = catalog.groupPoses(catalog.filterPoses(rows, {angle: '侧面'}));
  assert.equal(filtered.length, 288);
  assert.ok(filtered.every(group => group.length === 1 && group[0].角度 === '侧面'));
});

test('全部体系保留完整姿势，视角筛选保留组内真实的其他视角', () => {
  const all = catalog.browsePoses(rows, {});
  assert.equal(all.filtered.length, 1439);
  assert.equal(all.groups.length, 288);
  const side = catalog.browsePoses(rows, {system: '全身单人・标准系', angle: '侧面'});
  assert.equal(side.filtered.length, 73);
  assert.equal(side.groups.length, 73);
  assert.ok(side.groups.every(views => views.length === 5));
  const missing = catalog.browsePoses(rows, {query: 'full_sexy_P018'});
  assert.equal(missing.groups[0].length, 4);
});

test('动作选项按当前体系统计，并以组 ID 避免多视角重复计数', () => {
  const categories = catalog.poseCategories(rows);
  assert.equal(categories.length, 26);
  assert.equal(categories.reduce((sum, item) => sum + item.groups, 0), 288);
  const standard = catalog.poseCategories(rows, '全身单人・标准系');
  assert.equal(standard.reduce((sum, item) => sum + item.groups, 0), 73);
  assert.equal(standard.find(item => item.name === '坐姿').groups, 14);
});

test('复制 PNG 在点击期间提交剪贴板请求，并处理源站失败', async () => {
  let resolveResponse, requested, clipboard;
  const copy = {};
  runInNewContext(readFileSync(join(__dirname, '../pose/catalog.js'), 'utf8'), Object.assign(copy, {
    navigator: {clipboard: {write(items) { clipboard = items; return Promise.all(items.map(item => item.data['image/png'])); }}},
    ClipboardItem: class { constructor(data) { this.data = data; } },
    fetch(url) { requested = url; return new Promise(resolve => { resolveResponse = resolve; }); }
  }));
  const success = copy.copyPoseImage({原图: 'https://example.com/pose.png'});
  assert.equal(requested, 'https://example.com/pose.png');
  assert.equal(clipboard.length, 1);
  const png = {type: 'image/png'};
  resolveResponse({ok: true, blob: async () => png});
  await success;
  assert.equal(await clipboard[0].data['image/png'], png);
  const failure = copy.copyPoseImage({原图: 'https://example.com/missing.png'});
  resolveResponse({ok: false, status: 404});
  await assert.rejects(failure, /HTTP 404/);
});
