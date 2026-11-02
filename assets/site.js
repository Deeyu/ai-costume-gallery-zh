'use strict';

function galleryPopularity(items, images) {
  return items.reduce((total, item) => {
    const row = images[item.id] || {};
    total.copies += Number.isSafeInteger(row.copies) && row.copies > 0 ? row.copies : 0;
    total.downloads += Number.isSafeInteger(row.downloads) && row.downloads > 0 ? row.downloads : 0;
    return total;
  }, {copies: 0, downloads: 0});
}

function popularGalleryItems(items, images) {
  return items.map((item, index) => {
    const count = galleryPopularity(Array.isArray(item) ? item : [item], images);
    return {item, index, score: count.copies + count.downloads};
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.item);
}

async function initGallerySite() {
  const config = globalThis.GALLERY_SITE_CONFIG || {}, endpoint = (config.statsEndpoint || '').replace(/\/$/, '');
  const gallery = document.body.dataset.gallery;
  const number = value => value.toLocaleString('zh-CN');
  let images = {}, popular = false;
  const canReport = endpoint && location.origin === config.origin && location.pathname.startsWith(config.basePath)
    && navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true;
  let visitorId;
  if (canReport) {
    try { visitorId = localStorage.getItem('gallery-visitor-id'); } catch {}
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) {
      visitorId = crypto.randomUUID();
      try { localStorage.setItem('gallery-visitor-id', visitorId); } catch {}
    }
  }

  async function read(path) {
    const response = await fetch(endpoint + path, {credentials: 'omit'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function visits(value) {
    const node = document.getElementById('site-visits');
    if (!node || !Number.isSafeInteger(value?.pageviews) || !Number.isSafeInteger(value?.visitors)) return;
    node.textContent = `累计访问 ${number(value.pageviews)} 次 · 访客 ${number(value.visitors)}（估算）`;
  }

  function badge(node, ids) {
    const count = galleryPopularity(ids.map(id => ({id})), images), total = count.copies + count.downloads;
    node.textContent = `热门 ${number(total)}`;
    node.title = `复制图片 ${number(count.copies)} 次 · 发起下载 ${number(count.downloads)} 次`;
    node.hidden = total === 0;
  }

  function refreshBadges() {
    for (const node of document.querySelectorAll('[data-popularity-ids]')) {
      badge(node, JSON.parse(node.dataset.popularityIds));
    }
  }

  async function send(body) {
    const response = await fetch(endpoint + '/events', {method: 'POST', credentials: 'omit', keepalive: true,
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...body, event_id: crypto.randomUUID(), visitor_id: visitorId})});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  globalThis.galleryStats = {
    sort(items) { return popular ? popularGalleryItems(items, images) : items; },
    decorate(card, ids) {
      const node = document.createElement('span'); node.className = 'popularity-badge';
      node.dataset.popularityIds = JSON.stringify(ids); badge(node, ids); card.append(node);
    },
    async record(action, id) {
      if (!canReport) return;
      try {
        const value = await send({type: 'image', gallery, image_id: id, action});
        if (Number.isSafeInteger(value.copies) && Number.isSafeInteger(value.downloads)) {
          images[id] = {copies: value.copies, downloads: value.downloads}; refreshBadges();
        }
      } catch { /* Metrics must not interrupt copying or saving an image. */ }
    }
  };

  const defaults = document.getElementById('sort-default'), hottest = document.getElementById('sort-popular');
  for (const [node, value] of [[defaults, false], [hottest, true]]) node?.addEventListener('click', () => {
    popular = value;
    defaults.setAttribute('aria-pressed', String(!popular)); hottest.setAttribute('aria-pressed', String(popular));
    document.dispatchEvent(new Event('gallery-sort-change'));
  });

  async function starCount() {
    const node = document.querySelector('[data-star-count]');
    if (!node) return;
    const update = value => {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid_star_count');
      node.textContent = number(value);
      node.closest('a').title = `${number(value)} 颗 Star · 喜欢这个图库？去 GitHub 点亮一颗星，支持持续更新（新标签页打开）`;
    };
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem('gallery-stars') || 'null'); } catch {}
    if (saved && Date.now() - saved.time < 900000) { try { update(saved.count); return; } catch {} }
    try {
      let count;
      try {
        if (!endpoint) throw new Error('no_proxy');
        count = (await read('/stars')).stars;
      } catch {
        const response = await fetch('https://api.github.com/repos/Deeyu/ai-costume-gallery-zh', {credentials: 'omit'});
        if (!response.ok) throw new Error('github_unavailable');
        count = (await response.json()).stargazers_count;
      }
      update(count);
      try { sessionStorage.setItem('gallery-stars', JSON.stringify({count, time: Date.now()})); } catch {}
    } catch { node.textContent = '—'; node.closest('a').title = '暂时无法获取 Star 数，点击前往 GitHub 查看'; }
  }
  starCount();

  if (!endpoint) {
    const note = document.getElementById('popularity-note'); if (note) note.textContent = '热度统计尚未接通';
    const visit = document.getElementById('site-visits'); if (visit) visit.textContent = '访问统计尚未接通';
    return;
  }
  try {
    const value = await read('/stats?gallery=' + encodeURIComponent(gallery === 'examples' ? 'costume' : gallery));
    images = value.images || {}; visits(value.visits); refreshBadges();
    if (hottest) hottest.disabled = false;
    const note = document.getElementById('popularity-note'); if (note) note.textContent = '';
  } catch {
    const note = document.getElementById('popularity-note'); if (note) note.textContent = '热度暂不可用，稍后刷新重试';
    const visit = document.getElementById('site-visits'); if (visit) visit.textContent = '访问统计暂不可用';
  }
  if (canReport) {
    try { visits((await send({type: 'visit', page: gallery})).visits); } catch {}
  }
}

if (typeof document !== 'undefined') initGallerySite();
