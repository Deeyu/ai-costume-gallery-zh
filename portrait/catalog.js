'use strict';

function filterPortraits(rows, {mode = 'face', hair = '', query = ''} = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => row.模式 === mode && (!hair || row.发长 === hair)
    && words.every((word) => row.检索.includes(word)));
}

function rankedPortraits(rows, ids) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
