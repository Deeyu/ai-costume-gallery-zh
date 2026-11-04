import catalog from '../catalog.json' with {type: 'json'};
import {PORTRAIT_RANKING_CRON, readPortraitRanking, syncPortraitRanking} from './portrait-ranking.js';

const allowedIds = Object.fromEntries(Object.entries(catalog).map(([key, ids]) => [key, new Set(ids)]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGES = new Set(['costume', 'costume-anime', 'portrait', 'pose', 'depth', 'anime', 'examples']);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers}});
}

function cors(request, env) {
  if (request.method === 'GET') return {'Access-Control-Allow-Origin': '*'};
  return request.headers.get('Origin') === env.ALLOWED_ORIGIN
    ? {'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Vary': 'Origin'} : {};
}

export function validateEvent(body) {
  if (!body || !UUID.test(body.event_id) || !UUID.test(body.visitor_id)) return false;
  if (body.type === 'visit') return PAGES.has(body.page);
  return body.type === 'image' && ['copy', 'download'].includes(body.action)
    && Object.hasOwn(allowedIds, body.gallery) && allowedIds[body.gallery].has(body.image_id);
}

async function visitorHash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ai-reference-gallery-v1:' + value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function totals(db) {
  const {results} = await db.prepare('SELECT name,value FROM totals').all();
  return Object.fromEntries(results.map(row => [row.name, row.value]));
}

async function getStats(gallery, db) {
  if (!Object.hasOwn(allowedIds, gallery)) return json({error: 'unknown_gallery'}, 400);
  const [{results}, visits] = await Promise.all([
    db.prepare('SELECT image_id,copies,downloads FROM image_stats WHERE gallery=?').bind(gallery).all(), totals(db)
  ]);
  const images = Object.fromEntries(results.map(row => [row.image_id, {copies: row.copies, downloads: row.downloads}]));
  return json({visits, images, updated_at: new Date().toISOString()}, 200, {'Cache-Control': 'public,max-age=30'});
}

async function record(request, db) {
  const text = await request.text();
  if (text.length > 2048) return json({error: 'payload_too_large'}, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({error: 'invalid_json'}, 400); }
  if (!validateEvent(body)) return json({error: 'invalid_event'}, 400);
  const hash = await visitorHash(body.visitor_id), now = Math.floor(Date.now() / 1000);
  const table = body.type === 'visit' ? 'visit_events' : 'action_events';
  // Limit each anonymous browser without storing IP addresses or user-agent strings.
  const recent = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE visitor_hash=? AND created_at>?`).bind(hash, now - 60).first();
  if (recent.count >= 30) return json({error: 'rate_limited'}, 429, {'Retry-After': '60'});
  if (body.type === 'visit') {
    await db.prepare('INSERT OR IGNORE INTO visit_events(event_id,visitor_hash,page,created_at) VALUES(?,?,?,?)')
      .bind(body.event_id, hash, body.page, now).run();
    return json({visits: await totals(db)});
  }
  await db.prepare('INSERT OR IGNORE INTO action_events(event_id,visitor_hash,gallery,image_id,action,created_at) VALUES(?,?,?,?,?,?)')
    .bind(body.event_id, hash, body.gallery, body.image_id, body.action, now).run();
  const count = await db.prepare('SELECT copies,downloads FROM image_stats WHERE gallery=? AND image_id=?').bind(body.gallery, body.image_id).first();
  return json({image_id: body.image_id, ...count});
}

async function stars(request) {
  const cache = globalThis.caches?.default;
  const key = new Request(new URL('/stars', request.url));
  const cached = await cache?.match(key);
  if (cached) return cached;
  const response = await fetch('https://api.github.com/repos/Deeyu/ai-costume-gallery-zh', {
    headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'AI-Reference-Gallery-Stats'}
  });
  if (!response.ok) return json({error: 'github_unavailable'}, 502);
  const repo = await response.json();
  if (!Number.isSafeInteger(repo.stargazers_count) || repo.stargazers_count < 0) return json({error: 'invalid_github_response'}, 502);
  const result = json({stars: repo.stargazers_count, updated_at: new Date().toISOString()}, 200, {'Cache-Control': 'public,max-age=900'});
  if (cache) await cache.put(key, result.clone());
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), headers = cors(request, env);
    if (request.method === 'OPTIONS') {
      if (!headers['Access-Control-Allow-Origin']) return json({error: 'origin_not_allowed'}, 403);
      return new Response(null, {status: 204, headers: {...headers, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}});
    }
    let response;
    try {
      if (request.method === 'GET' && url.pathname === '/health') response = json({ok: true});
      else if (request.method === 'GET' && url.pathname === '/stars') response = await stars(request);
      else if (request.method === 'GET' && url.pathname === '/stats') response = await getStats(url.searchParams.get('gallery'), env.DB);
      else if (request.method === 'GET' && url.pathname === '/portrait-ranking') {
        const snapshot = await readPortraitRanking(env.DB);
        response = snapshot ? json(snapshot, 200, {'Cache-Control': 'public,max-age=300'})
          : json({error: 'ranking_unavailable'}, 503);
      }
      else if (request.method === 'POST' && url.pathname === '/events') {
        if (!headers['Access-Control-Allow-Origin']) return json({error: 'origin_not_allowed'}, 403);
        response = await record(request, env.DB);
      } else response = json({error: 'not_found'}, 404);
    } catch { response = json({error: 'service_unavailable'}, 503); }
    const result = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    result.headers.set('X-Content-Type-Options', 'nosniff');
    return result;
  },
  async scheduled(event, env) {
    if (event.cron === PORTRAIT_RANKING_CRON) {
      await syncPortraitRanking(env.DB);
      return;
    }
    const before = Math.floor(Date.now() / 1000) - 172800;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM visit_events WHERE created_at<?').bind(before),
      env.DB.prepare('DELETE FROM action_events WHERE created_at<?').bind(before)
    ]);
  }
};
