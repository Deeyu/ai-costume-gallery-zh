'use strict';

const POSE_ANGLES = ['正面', '斜侧', '侧面', '俯视', '仰视'];

function filterPoses(rows, {system = '', category = '', angle = '', query = ''} = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => (!system || row.体系 === system)
    && (!category || row.分类 === category) && (!angle || row.角度 === angle)
    && words.every((word) => row.检索.includes(word)));
}

function groupPoses(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.组ID)) groups.set(row.组ID, []);
    groups.get(row.组ID).push(row);
  }
  return [...groups.values()].map((views) => views.slice().sort(
    (a, b) => POSE_ANGLES.indexOf(a.角度) - POSE_ANGLES.indexOf(b.角度)));
}
