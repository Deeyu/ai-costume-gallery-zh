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

function poseCategories(rows, system = '') {
  const categories = new Map();
  for (const row of rows) {
    if (system && row.体系 !== system) continue;
    if (!categories.has(row.分类)) categories.set(row.分类, new Set());
    categories.get(row.分类).add(row.组ID);
  }
  return [...categories].map(([name, groups]) => ({name, groups: groups.size}));
}

function browsePoses(rows, state) {
  const filtered = filterPoses(rows, state);
  const matchingGroups = new Set(filtered.map((row) => row.组ID));
  // A view filter picks the initial preview; each matching pose keeps its real views.
  const groups = groupPoses(rows).filter((views) => matchingGroups.has(views[0].组ID));
  return {filtered, groups};
}

async function copyPoseImage(row) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('当前浏览器不支持复制图片');
  }
  const png = fetch(row.原图, {credentials: 'omit'}).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.type !== 'image/png') throw new Error('原站未返回 PNG 图片');
    return blob;
  });
  // Pass the promise while the click gesture is active (including Safari).
  await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
}
