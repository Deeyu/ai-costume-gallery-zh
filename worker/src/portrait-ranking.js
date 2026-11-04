import portraits from '../../portrait/data/portrait.json' with {type: 'json'};

export const PORTRAIT_RANKING_CRON = '17 1 * * *';
const ENDPOINT = 'https://ai-portrait-gallery.pages.dev/api/ranking';
const labels = {'総合': '全部', 'ショート': '短发', 'ミディアム': '中发', 'セミロング': '中长发', 'ロング': '长发'};
const hairById = new Map(portraits.map(({id, hair}) => [id, hair]));

function translate(payload) {
  const {cats, top} = payload || {};
  const categories = Object.keys(labels);
  if (!Array.isArray(cats) || cats.length !== categories.length ||
      !top || Object.keys(top).length !== categories.length ||
      categories.some(category => !cats.includes(category) || !Object.hasOwn(top, category))) {
    throw new Error('原站排行分类不完整');
  }
  return Object.fromEntries(categories.map(category => {
    const ids = top[category];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length ||
        ids.some(id => !hairById.has(id) || (category !== '総合' && hairById.get(id) !== category))) {
      throw new Error('原站排行图片编号或发长分类无效');
    }
    return [labels[category], ids];
  }));
}

export async function syncPortraitRanking(db) {
  const response = await fetch(ENDPOINT, {
    headers: {'Cache-Control': 'no-cache'},
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`原站排行 HTTP ${response.status}`);
  const ranking = translate(await response.json());
  await db.prepare(`INSERT INTO portrait_ranking (id, ranking, synced_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ranking=excluded.ranking, synced_at=excluded.synced_at`)
    .bind(JSON.stringify(ranking), new Date().toISOString()).run();
}

export async function readPortraitRanking(db) {
  const row = await db.prepare('SELECT ranking, synced_at FROM portrait_ranking WHERE id=1').first();
  return row && {ranking: JSON.parse(row.ranking), synced_at: row.synced_at, endpoint: ENDPOINT};
}
