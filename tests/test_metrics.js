'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {randomUUID} = require('node:crypto');
const service = import('../worker/src/index.js');

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(join(__dirname, '../worker/schema.sql'), 'utf8'));
  sqlite.exec(readFileSync(join(__dirname, '../worker/migrations/portrait-ranking.sql'), 'utf8'));
  t.after(() => sqlite.close());
  return {sqlite, prepare(sql) {
    let args = [];
    const statement = sqlite.prepare(sql);
    return {bind(...values) { args = values; return this; },
      async all() { return {results: statement.all(...args)}; },
      async first() { return statement.get(...args) || null; },
      async run() { return statement.run(...args); }};
  }, async batch(statements) { for (const statement of statements) await statement.run(); }};
}

test('每日 Cron 拉取原站并写入可跨域读取的排行；无效响应保留上一份', async t => {
  const db = database(t), {default: worker} = await service;
  const env = {DB: db};
  const request = new Request('https://stats.example/portrait-ranking');
  const raw = JSON.parse(readFileSync(join(__dirname, '../portrait/data/ranking.json'), 'utf8'));
  const translated = JSON.parse(readFileSync(join(__dirname, '../portrait/data/ranking-zh.json'), 'utf8'));
  const event = {cron: '17 1 * * *'};
  const upstream = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://ai-portrait-gallery.pages.dev/api/ranking');
    return Response.json(raw);
  });
  assert.equal((await worker.fetch(request, env)).status, 503);
  await worker.scheduled(event, env);
  assert.equal(upstream.mock.callCount(), 1);
  const response = await worker.fetch(request, env);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const snapshot = await response.json();
  assert.deepEqual(snapshot.ranking, translated);
  assert.ok(Number.isFinite(Date.parse(snapshot.synced_at)));
  raw.top['ショート'][0] = raw.top['ロング'][0];
  await assert.rejects(worker.scheduled(event, env), /发长分类无效/);
  assert.deepEqual(await (await worker.fetch(request, env)).json(), snapshot);
});
function visit(visitor = randomUUID(), id = randomUUID()) { return {type: 'visit', page: 'anime', visitor_id: visitor, event_id: id}; }
function action(overrides = {}) { return {...visit(), type: 'image', gallery: 'anime', image_id: 'O001', action: 'copy', ...overrides}; }
async function post(db, body, origin = 'https://deeyu.github.io') {
  const {default: worker} = await service;
  return worker.fetch(new Request('https://stats.example/events', {method: 'POST', headers: {Origin: origin}, body: JSON.stringify(body)}), {DB: db, ALLOWED_ORIGIN: 'https://deeyu.github.io'});
}
async function stats(db, gallery = 'anime') {
  const {default: worker} = await service;
  return worker.fetch(new Request('https://stats.example/stats?gallery=' + gallery, {headers: {Origin: 'http://127.0.0.1:8000'}}), {DB: db});
}

test('数据库真实执行：重复上报不重复计数，同一浏览器跨库访问只计一个访客', async t => {
  const db = database(t), first = visit();
  assert.equal((await post(db, first)).status, 200);
  await post(db, first);
  await post(db, {...visit(first.visitor_id), page: 'pose'});
  await post(db, visit());
  const data = await (await stats(db)).json();
  assert.deepEqual(data.visits, {pageviews: 3, visitors: 2});
  const stored = db.sqlite.prepare('SELECT * FROM visitors LIMIT 1').get();
  assert.equal(stored.visitor_hash.length, 64);
  assert.ok(!JSON.stringify(stored).includes(first.visitor_id));
});

test('复制与下载分别累计；重复事件不增量，图库间编号不串库', async t => {
  const db = database(t), copied = action();
  await post(db, copied); await post(db, copied);
  await post(db, action({action: 'download'}));
  await post(db, action({gallery: 'pose', image_id: 'full_single_P001_front'}));
  const data = await (await stats(db)).json();
  assert.deepEqual(data.images.O001, {copies: 1, downloads: 1});
  assert.equal(Object.keys(data.images).length, 1);
  assert.deepEqual((await (await stats(db, 'pose')).json()).images.full_single_P001_front, {copies: 1, downloads: 0});
});

test('拒绝跨站写入、未知图片、未知图库、错误类型和伪造参数', async t => {
  const db = database(t);
  assert.equal((await post(db, action(), 'https://evil.example')).status, 403);
  for (const bad of [action({image_id: 'O999'}), action({gallery: '__proto__'}), action({action: 'view'}), action({visitor_id: 'bad'}), {...visit(), page: 'elsewhere'}]) {
    assert.equal((await post(db, bad)).status, 400);
  }
  assert.deepEqual((await (await stats(db)).json()).visits, {pageviews: 0, visitors: 0});
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM action_events').get().n, 0);
});

test('服装写实与动画版同编号分别统计，动画版不存在的编号不能写入', async t => {
  const db = database(t);
  assert.equal((await post(db, {...visit(), page: 'costume-anime'})).status, 200);
  await post(db, action({gallery: 'costume', image_id: 'SPR-0001'}));
  await post(db, action({gallery: 'costume-anime', image_id: 'SPR-0001', action: 'download'}));
  assert.deepEqual((await (await stats(db, 'costume')).json()).images['SPR-0001'], {copies: 1, downloads: 0});
  assert.deepEqual((await (await stats(db, 'costume-anime')).json()).images['SPR-0001'], {copies: 0, downloads: 1});
  assert.equal((await post(db, action({gallery: 'costume-anime', image_id: 'SPR-0012'}))).status, 400);
});

test('公开聚合数据允许跨域读取，写入预检只允许本站来源', async t => {
  const db = database(t), {default: worker} = await service;
  assert.equal((await stats(db)).headers.get('Access-Control-Allow-Origin'), '*');
  const env = {DB: db, ALLOWED_ORIGIN: 'https://deeyu.github.io'};
  for (const [origin, status] of [['https://deeyu.github.io', 204], ['https://evil.example', 403]]) {
    const response = await worker.fetch(new Request('https://stats.example/events', {method: 'OPTIONS', headers: {Origin: origin}}), env);
    assert.equal(response.status, status);
  }
  assert.equal((await stats(db, 'unknown')).status, 400);
});

test('每分钟匿名浏览器限流，超限操作不影响已有计数', async t => {
  const db = database(t), visitor = randomUUID();
  for (let i = 0; i < 30; i++) assert.equal((await post(db, action({visitor_id: visitor}))).status, 200);
  assert.equal((await post(db, action({visitor_id: visitor}))).status, 429);
  assert.equal((await (await stats(db)).json()).images.O001.copies, 30);
});

test('清理过期明细后保留累计访问与热度，同一访客再次访问不变成新人', async t => {
  const db = database(t), visitor = randomUUID(), {default: worker} = await service;
  await post(db, visit(visitor)); await post(db, action());
  db.sqlite.exec('UPDATE visit_events SET created_at=0; UPDATE action_events SET created_at=0;');
  await worker.scheduled({}, {DB: db});
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM visit_events').get().n, 0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM action_events').get().n, 0);
  await post(db, visit(visitor));
  const data = await (await stats(db)).json();
  assert.deepEqual(data.visits, {pageviews: 2, visitors: 1});
  assert.equal(data.images.O001.copies, 1);
});

test('服务失败不泄露内部错误，过大上报不会写入数据库', async t => {
  const db = database(t), {default: worker} = await service;
  const failure = await stats({prepare() { throw new Error('private database details'); }});
  assert.equal(failure.status, 503);
  assert.equal((await failure.json()).error, 'service_unavailable');
  const large = await post(db, {...action(), extra: 'x'.repeat(3000)});
  assert.equal(large.status, 413);
  const malformed = await worker.fetch(new Request('https://stats.example/events', {method: 'POST', headers: {Origin: 'https://deeyu.github.io'}, body: '{bad'}), {DB: db, ALLOWED_ORIGIN: 'https://deeyu.github.io'});
  assert.equal(malformed.status, 400);
});
