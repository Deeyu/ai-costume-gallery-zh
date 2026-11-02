'use strict';

const ANIME_MODES = {outfit: '服装', hair: '发型与眼睛', pose: '姿势'};
const ANIME_COLORS = {brown: '棕发', black: '黑发', blonde: '金发', pink: '粉发', silver: '银发'};

function animeSlot(row) {
  if (row.模式 !== 'hair') return row.模式;
  if (row.子类型 === 'style_color') return 'style';
  if (row.子类型 === 'eye') return row.分类 === '眼睛颜色' ? 'eyeColor' : 'eyeShape';
  return row.子类型;
}

function animeFamily(rows, row) {
  const parent = row.父级 || row.id;
  return rows.filter((item) => item.id === parent || item.父级 === parent);
}

function animeTags(row) {
  return animeSlot(row) === 'style' ? `${row.标签}, ${row.发色 || 'brown'} hair` : row.标签;
}

function filterAnime(rows, {mode = 'outfit', category = '', query = '', favoritesOnly = false, favorites = new Set()} = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (row) => words.every((word) => row.检索.includes(word))
    && (!favoritesOnly || favorites.has(row.id));
  const families = new Map();
  for (const row of rows) if (row.父级) {
    if (!families.has(row.父级)) families.set(row.父级, []);
    families.get(row.父级).push(row);
  }
  return rows.filter((row) => !row.父级 && row.模式 === mode && (!category || row.分类 === category))
    .map((row) => matches(row) ? row : (families.get(row.id) || []).find(matches)).filter(Boolean);
}
