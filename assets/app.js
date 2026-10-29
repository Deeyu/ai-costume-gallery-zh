'use strict';
const $ = (id) => document.getElementById(id);
let records = [], filtered = [], category = '', shown = 0, current = 0;
const PAGE = 60;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderCategories() {
  const counts = new Map([['', records.length]]);
  records.forEach((r) => counts.set(r.分类, (counts.get(r.分类) || 0) + 1));
  $('categories').replaceChildren(...[...counts].map(([name, count]) => {
    const button = element('button', name || '全部');
    button.append(element('span', count.toLocaleString()));
    button.setAttribute('aria-pressed', String(category === name));
    button.addEventListener('click', () => { category = name; applyFilters(); });
    return button;
  }));
}
function applyFilters() {
  const words = $('q').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  filtered = records.filter((r) => (!category || r.分类 === category) && words.every((w) => r.检索.includes(w)));
  shown = 0;
  $('grid').replaceChildren();
  renderCategories();
  $('section-title').textContent = category || '全部服装';
  $('empty').hidden = filtered.length > 0;
  appendPage();
}
function appendPage() {
  const start = shown;
  const cards = filtered.slice(start, start + PAGE).map((r, i) => {
    const button = element('button', undefined, 'card');
    button.setAttribute('aria-label', `查看 ${r.id} ${r.分类}`);
    const img = element('img');
    img.src = r.缩略图; img.alt = `${r.分类} ${r.关键词.join('、')} ${r.id}`;
    img.loading = 'lazy'; img.decoding = 'async'; img.width = 300; img.height = 450;
    img.addEventListener('error', () => { img.alt = `${r.id} 图片加载失败，请检查网络或本地素材`; });
    const info = element('div', undefined, 'card-info');
    const heading = element('div', undefined, 'card-heading');
    heading.append(element('h3', r.id), element('span', r.分类, 'card-cat'));
    info.append(heading, element('p', r.关键词.join(' · ')));
    button.append(img, info);
    button.addEventListener('click', () => { current = start + i; showDetail(); $('viewer').showModal(); });
    return button;
  });
  $('grid').append(...cards); shown += cards.length;
  $('status').textContent = `共 ${filtered.length.toLocaleString()} 套 · 已显示 ${shown.toLocaleString()} 套`;
  $('more').hidden = shown >= filtered.length;
  $('more').textContent = `加载更多（剩余 ${filtered.length - shown} 套）`;
}
function showDetail() {
  const r = filtered[current];
  $('detail-title').textContent = r.id;
  $('detail-cat').textContent = r.分类;
  $('position').textContent = `${current + 1} / ${filtered.length}`;
  $('tags').textContent = r.关键词.join(' · ');
  $('english').textContent = r.英文关键词;
  $('image-status').textContent = '正在加载预览图…';
  $('large').onload = () => { $('image-status').textContent = ''; };
  $('large').onerror = () => { $('image-status').textContent = '预览图加载失败，可尝试打开原图。'; };
  $('large').src = r.预览图;
  $('large').alt = `${r.id} ${r.关键词.join('、')}`;
  $('download').href = r.原图; $('download').download = `${r.id}.png`;
  $('open-original').href = r.原图;
  $('prev').disabled = current === 0; $('next').disabled = current === filtered.length - 1;
  $('copy').textContent = '复制 ID';
}
$('q').addEventListener('input', applyFilters);
$('reset').addEventListener('click', () => { category = ''; $('q').value = ''; applyFilters(); });
$('more').addEventListener('click', appendPage);
$('close').addEventListener('click', () => $('viewer').close());
$('help').addEventListener('click', () => $('guide').showModal());
$('prev').addEventListener('click', () => { if (current > 0) { current--; showDetail(); } });
$('next').addEventListener('click', () => { if (current < filtered.length - 1) { current++; showDetail(); } });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(filtered[current].id); $('copy').textContent = '已复制'; }
  catch { $('copy').textContent = '复制失败，请手动复制上方 ID'; }
});
document.addEventListener('keydown', (e) => {
  if ($('viewer').open) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); $('prev').click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); $('next').click(); }
  } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('guide').open) {
    e.preventDefault(); $('q').focus();
  }
});
for (const dialog of [$('viewer'), $('guide')]) dialog.addEventListener('click', (e) => {
  const box = dialog.getBoundingClientRect();
  if (e.target === dialog && (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom)) dialog.close();
});
async function init() {
  try {
    const response = await fetch('data/costume-zh.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    records = await response.json();
    if (!Array.isArray(records) || !records.length) throw new Error('数据为空');
    $('total').textContent = `${records.length.toLocaleString()} 套 / 8 个分类`;
    applyFilters();
  } catch (error) {
    $('status').textContent = '数据加载失败，请刷新重试。若在本地使用，请先启动 HTTP 服务。';
    $('total').textContent = '暂时无法读取';
    console.error('服装数据加载失败', error);
  }
}
init();
