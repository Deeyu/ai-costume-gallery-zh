'use strict';

function portraitRankingNote(meta) {
  const timestamp = meta && new Date(meta.synced_at);
  if (!timestamp || !Number.isFinite(timestamp.getTime())) return '同步时间暂不可用';
  const formatted = new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).format(timestamp);
  const kind = meta.endpoint === 'https://ai-portrait-gallery.pages.dev/api/ranking' ? '最近同步' : '原站快照';
  return `${kind} · 同步于 ${formatted}（北京时间）`;
}

function isNewerPortraitRanking(snapshot, fallback) {
  const synced = Date.parse(snapshot?.synced_at);
  const previous = Date.parse(fallback?.synced_at);
  return Number.isFinite(synced) && (!Number.isFinite(previous) || synced > previous) &&
    ['全部', '短发', '中发', '中长发', '长发'].every(label => Array.isArray(snapshot.ranking?.[label]) && snapshot.ranking[label].length);
}

function filterPortraits(rows, {mode = 'face', hair = '', query = ''} = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => row.模式 === mode && (!hair || row.发长 === hair)
    && words.every((word) => row.检索.includes(word)));
}

function rankedPortraits(rows, ids) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
