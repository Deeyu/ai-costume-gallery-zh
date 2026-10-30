'use strict';
const $ = (id) => document.getElementById(id);
const PAGE = 60;
const MODES = {face: '正面脸图', styling: '造型参考'};
const NOTES = {face: '正面、简洁背景的脸部参考，适合五官与脸型设定。', styling: '展示发型质感、服装与整体氛围，人物朝向可能不同。'};
const HAIRS = ['短发', '中发', '中长发', '长发'];
let records = [], filtered = [], ranking = {}, meta, mode = 'face', hair = '', shown = 0;
let viewList = [], current = 0, rankCategory = '全部';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function imageFor(row, className) {
  const image = element('img', undefined, className);
  image.src = row.缩略图;
  image.alt = `AI 虚构人物 · ${row.发长} · ${row.发型 || row.类型} · ${row.id}`;
  image.width = row.缩略图宽度; image.height = row.缩略图高度;
  image.loading = 'lazy'; image.decoding = 'async';
  image.addEventListener('error', () => { image.alt = `${row.id} 图片加载失败，请检查与原站的连接`; });
  return image;
}

function renderFilters() {
  $('sections').replaceChildren(...Object.entries(MODES).map(([key, label]) => {
    const button = element('button', label);
    button.append(element('span', meta.sections[key].toLocaleString()));
    button.setAttribute('aria-pressed', String(mode === key));
    button.addEventListener('click', () => { mode = key; applyFilters(); });
    return button;
  }));
  const counts = meta.hairs[mode];
  $('categories').replaceChildren(...['', ...HAIRS].map((value) => {
    const button = element('button', value || '全部发长');
    button.append(element('span', (value ? counts[value] : meta.sections[mode]).toLocaleString()));
    button.setAttribute('aria-pressed', String(hair === value));
    button.addEventListener('click', () => { hair = value; applyFilters(); });
    return button;
  }));
  $('section-note').textContent = NOTES[mode];
}

function applyFilters() {
  filtered = filterPortraits(records, {mode, hair, query: $('q').value});
  shown = 0;
  $('grid').replaceChildren();
  renderFilters();
  $('section-title').textContent = [MODES[mode], hair].filter(Boolean).join(' · ');
  $('empty').hidden = filtered.length > 0;
  appendPage();
}

function appendPage() {
  const start = shown;
  const cards = filtered.slice(start, start + PAGE).map((row, index) => {
    const button = element('button', undefined, 'card');
    button.setAttribute('aria-label', `查看 ${row.id} ${row.类型}`);
    const info = element('div', undefined, 'card-info');
    const heading = element('div', undefined, 'card-heading');
    heading.append(element('h3', row.id), element('span', row.发长, 'card-cat'));
    info.append(heading, element('p', row.发型 || '原站未标注细分发型'));
    button.append(imageFor(row), info);
    button.addEventListener('click', () => openViewer(filtered, start + index));
    return button;
  });
  $('grid').append(...cards);
  shown += cards.length;
  $('status').textContent = `共 ${filtered.length.toLocaleString()} 张 · 已显示 ${shown.toLocaleString()} 张`;
  $('more').hidden = shown >= filtered.length;
  $('more').textContent = `加载更多（剩余 ${filtered.length - shown} 张）`;
}

function openViewer(list, index) {
  viewList = list.slice(); current = index;
  showDetail(); $('viewer').showModal();
}

function showDetail() {
  const row = viewList[current];
  $('detail-title').textContent = row.id;
  $('detail-cat').textContent = `${row.类型} · ${row.发长}`;
  $('detail-style').textContent = row.发型 || '原站未标注细分发型';
  $('position').textContent = `${current + 1} / ${viewList.length}`;
  $('dimensions').textContent = `PNG 原图 ${row.宽度} × ${row.高度} · ${(row.原图字节 / 1024**2).toFixed(1)} MiB`;
  $('original-style').textContent = [row.原始发长, row.原始发型].filter(Boolean).join(' · ');
  $('image-status').textContent = '正在加载预览图…';
  $('large').onload = () => { $('image-status').textContent = ''; };
  $('large').onerror = () => { $('image-status').textContent = '预览图加载失败，可尝试打开原图。'; };
  $('large').src = row.缩略图;
  $('large').alt = `AI 虚构人物 · ${row.发型 || row.发长} · ${row.id}`;
  $('download').href = row.原图;
  $('download').download = `ai-${row.模式}-${row.id}.png`;
  if ($('download').getAttribute('aria-disabled') !== 'true') $('download').textContent = '下载 PNG 原图';
  $('open-original').href = row.原图;
  $('copy').textContent = '复制 ID';
  $('prev').disabled = current === 0;
  $('next').disabled = current === viewList.length - 1;
}

function renderRanking() {
  $('rank-categories').replaceChildren(...Object.keys(ranking).map((label) => {
    const button = element('button', label);
    button.setAttribute('aria-pressed', String(label === rankCategory));
    button.addEventListener('click', () => { rankCategory = label; renderRanking(); });
    return button;
  }));
  const list = rankedPortraits(records, ranking[rankCategory]);
  $('rank-grid').replaceChildren(...list.map((row, index) => {
    const button = element('button', undefined, 'rank-card');
    button.setAttribute('aria-label', `排行第 ${index + 1} 名，查看 ${row.id}`);
    button.append(imageFor(row), element('span', index + 1));
    button.addEventListener('click', () => openViewer(list, index));
    return button;
  }));
  $('ranking-note').textContent = `原站排行快照 · ${meta.snapshot}`;
  $('ranking').hidden = false;
}

function renderFeatured() {
  $('featured').replaceChildren(...HAIRS.map((label) => {
    const row = records.find((item) => item.模式 === 'face' && item.发长 === label);
    const button = element('button');
    button.setAttribute('aria-label', `浏览${label}正面脸图`);
    button.append(imageFor(row), element('span', label));
    button.addEventListener('click', () => {
      mode = 'face'; hair = label; $('q').value = ''; applyFilters();
      $('library').scrollIntoView({block: 'start'});
    });
    return button;
  }));
}

$('q').addEventListener('input', applyFilters);
$('reset').addEventListener('click', () => { hair = ''; $('q').value = ''; applyFilters(); });
$('more').addEventListener('click', appendPage);
$('close').addEventListener('click', () => $('viewer').close());
$('help').addEventListener('click', () => $('guide').showModal());
$('follow').addEventListener('click', () => $('wechat').showModal());
$('prev').addEventListener('click', () => { if (current > 0) { current--; showDetail(); } });
$('next').addEventListener('click', () => { if (current < viewList.length - 1) { current++; showDetail(); } });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(viewList[current].id); $('copy').textContent = '已复制'; }
  catch { $('copy').textContent = '复制失败，请手动复制上方 ID'; }
});
$('download').addEventListener('click', async (event) => {
  event.preventDefault();
  const link = event.currentTarget;
  if (link.getAttribute('aria-disabled') === 'true') return;
  const href = link.href, filename = link.download;
  link.setAttribute('aria-disabled', 'true'); link.textContent = '正在下载…';
  let label = '下载 PNG 原图';
  try {
    const response = await fetch(href, {credentials: 'omit'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const save = element('a');
    save.href = url; save.download = filename; save.hidden = true;
    document.body.append(save); save.click(); save.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    label = '下载失败，请点“打开原图”';
  } finally {
    link.removeAttribute('aria-disabled'); link.textContent = label;
  }
});
document.addEventListener('keydown', (event) => {
  if ($('viewer').open) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); $('prev').click(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); $('next').click(); }
  } else if (event.key === '/' && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault(); $('q').focus();
  }
});
for (const dialog of [$('viewer'), $('guide'), $('wechat')]) dialog.addEventListener('click', (event) => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    [records, meta, ranking] = await Promise.all([
      loadJson('data/portrait-zh.json'), loadJson('data/meta-zh.json'), loadJson('data/ranking-zh.json')
    ]);
    if (!Array.isArray(records) || !records.length || !ranking.全部) throw new Error('数据格式不正确');
    $('total').textContent = `${meta.sections.face.toLocaleString()} 张正面脸图 / ${meta.sections.styling.toLocaleString()} 张造型参考`;
    renderFeatured(); renderRanking(); applyFilters();
  } catch (error) {
    $('status').textContent = '数据加载失败，请刷新重试；本地预览请先启动 HTTP 服务。';
    $('total').textContent = '暂时无法读取图库';
    console.error('脸库数据加载失败', error);
  }
}
init();
