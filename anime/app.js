'use strict';
const $ = (id) => document.getElementById(id);
const PAGE = 48;
let records = [], filtered = [], meta, mode = 'outfit', category = '', shown = 0, loader;
let viewList = [], current = 0, variant, lineart = false, selection = {}, favorites = new Set();
try { const saved = JSON.parse(localStorage.getItem('anime-favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => typeof id === 'string')); } catch {}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function imageFor(row, index = 12) {
  const img = element('img');
  img.alt = `${row.名称} · ${row.id}`; img.width = 300; img.height = row.模式 === 'hair' ? 300 : 450;
  img.loading = index < 12 ? 'eager' : 'lazy'; img.decoding = 'async';
  if (index === 0) img.fetchPriority = 'high';
  img.src = row.缩略图;
  img.addEventListener('error', () => { img.alt = `${row.名称} 图片加载失败，可打开原图重试`; });
  return img;
}

async function copyText(text, button, done = '已复制') {
  try { await navigator.clipboard.writeText(text); button.textContent = done; }
  catch { button.textContent = '复制失败，请手动复制'; }
}

function choose(row) {
  const key = animeSlot(row);
  selection[key] = row;
  if (key === 'style') delete selection.color;
  renderBuilder();
  $('selection-note').textContent = `已加入${ANIME_SLOTS[key]}：${row.名称}`;
}

function renderFilters() {
  $('sections').replaceChildren(...Object.entries(ANIME_MODES).map(([key, label]) => {
    const button = element('button', label);
    button.append(element('span', meta.sections[key].toLocaleString()));
    button.setAttribute('aria-pressed', String(mode === key));
    button.addEventListener('click', () => { mode = key; category = ''; applyFilters(); });
    return button;
  }));
  $('categories').replaceChildren(...['', ...Object.keys(meta.categories[mode])].map((value) => {
    const button = element('button', value || '全部分类');
    button.append(element('span', (value ? meta.categories[mode][value] : meta.sections[mode]).toLocaleString()));
    button.setAttribute('aria-pressed', String(category === value));
    button.addEventListener('click', () => { category = value; applyFilters(); });
    return button;
  }));
  $('section-note').textContent = {outfit: '440 套公开服装；编号保留原样，未公开编号不补造。英文标签仅描述衣装，不包含示范人物的脸与发型。',
    hair: '122 个基础条目，含 46 种发型的五色预览，共 306 张彩图。点击发型卡片可切换颜色；眼睛颜色和形状可分别加入组合。',
    pose: '281 个公开姿势，每项均有彩图和线稿。点击卡片切换；侧面姿势保留独立编号，不与原有姿势库混计。'}[mode];
}

function applyFilters() {
  if (!loader) return;
  loader.reset();
  filtered = filterAnime(records, {mode, category, query: $('q').value, favoritesOnly: $('favorites').getAttribute('aria-pressed') === 'true', favorites});
  shown = 0; $('grid').replaceChildren(); renderFilters();
  $('section-title').textContent = [ANIME_MODES[mode], category].filter(Boolean).join(' · ');
  $('empty').hidden = filtered.length > 0;
  appendPage();
}

function appendPage() {
  const start = shown;
  const cards = filtered.slice(start, start + PAGE).map((row, index) => {
    const card = element('article', undefined, 'card' + (mode === 'hair' ? ' hair-card' : ''));
    const preview = element('button', undefined, 'card-preview');
    preview.setAttribute('aria-label', `查看 ${row.id} ${row.名称}`);
    preview.append(imageFor(row, start + index));
    preview.addEventListener('click', () => { viewList = filtered.slice(); current = start + index; variant = null; lineart = false; showDetail(); $('viewer').showModal(); });
    const info = element('div', undefined, 'card-info');
    const heading = element('div', undefined, 'card-heading');
    heading.append(element('h3', row.名称), element('span', row.id, 'card-cat'));
    const actions = element('div', undefined, 'card-actions');
    const copy = element('button', '复制标签'); copy.addEventListener('click', () => copyText(animeTags(row), copy));
    const add = element('button', '加入组合'); add.addEventListener('click', () => choose(row));
    const favorite = element('button', favorites.has(row.id) ? '★' : '☆');
    favorite.setAttribute('aria-label', `收藏 ${row.id}`); favorite.setAttribute('aria-pressed', String(favorites.has(row.id)));
    favorite.addEventListener('click', () => {
      if (favorites.has(row.id)) favorites.delete(row.id); else favorites.add(row.id);
      try { localStorage.setItem('anime-favorites', JSON.stringify([...favorites])); } catch {}
      if ($('favorites').getAttribute('aria-pressed') === 'true') applyFilters();
      else { favorite.textContent = favorites.has(row.id) ? '★' : '☆'; favorite.setAttribute('aria-pressed', String(favorites.has(row.id))); }
    });
    actions.append(copy, add, favorite); info.append(heading, element('p', animeTags(row)), actions); card.append(preview, info);
    return card;
  });
  $('grid').append(...cards); shown += cards.length;
  $('status').textContent = `共 ${filtered.length.toLocaleString()} 项 · 已显示 ${shown.toLocaleString()} 项`;
  loader.update();
}

function detailRow() { return variant || viewList[current]; }

function showDetail() {
  const row = detailRow();
  $('detail-title').textContent = row.名称;
  $('detail-cat').textContent = `${row.类型} · ${row.分类} · ${row.id}`;
  $('original-name').textContent = row.原始名称;
  $('tags').textContent = animeTags(row);
  $('position').textContent = `${current + 1} / ${viewList.length}`;
  $('image-status').textContent = '正在加载原站图片…';
  $('large').onload = () => { $('image-status').textContent = ''; };
  $('large').onerror = () => { $('image-status').textContent = '图片暂时无法加载，请检查原站连接或打开原图重试。'; };
  const src = lineart && row.线稿 ? row.线稿 : row.原图;
  $('large').src = src; $('large').alt = `${row.名称} · ${lineart && row.线稿 ? '线稿' : '彩图'}`;
  $('open-original').href = src;
  $('open-original').textContent = lineart && row.线稿 ? '打开原站线稿 PNG' : '打开原站彩图 JPG';
  $('copy').textContent = '复制标签'; $('copy-id').textContent = '复制 ID';
  $('add-selection').textContent = '加入组合';
  $('variants').replaceChildren();
  if (animeSlot(row) === 'style') {
    for (const item of animeFamily(records, row)) {
      const button = element('button', ANIME_COLORS[item.发色]);
      button.setAttribute('aria-pressed', String(row.id === item.id));
      button.addEventListener('click', () => { variant = item; showDetail(); });
      $('variants').append(button);
    }
  }
  $('views').hidden = !row.线稿;
  for (const key of ['color-view', 'line-view']) $(key).setAttribute('aria-pressed', String((key === 'line-view') === lineart));
  $('prev').disabled = current === 0; $('next').disabled = current === viewList.length - 1;
}

function renderBuilder() {
  $('slots').replaceChildren(...Object.entries(ANIME_SLOTS).map(([key, label]) => {
    const slot = element('div', undefined, 'selection-slot');
    slot.append(element('strong', label));
    const row = selection[key];
    slot.append(element('span', row ? row.名称 : '未选择'));
    if (row) {
      const remove = element('button', '移除'); remove.setAttribute('aria-label', `移除${label}`);
      remove.addEventListener('click', () => { delete selection[key]; renderBuilder(); }); slot.append(remove);
    }
    return slot;
  }));
  $('open-builder').textContent = `查看组合（${Object.keys(selection).length} 项）`;
  updatePrompt();
}

const QUALITY = {illustrious: ['masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest', 'lowres, worst quality, low quality, bad anatomy, bad hands, text, watermark'],
  anima: ['masterpiece, best quality, score_7, safe', 'worst quality, low quality, score_1, score_2, score_3, bad anatomy, bad hands, text, watermark'],
  novelai: ['best quality, amazing quality, very aesthetic, absurdres', 'lowres, bad quality, worst quality, watermark, extra digits, artistic error'],
  pony: ['score_9, score_8_up, score_7_up, masterpiece, best quality', 'score_1, score_2, score_3, lowres, bad anatomy, bad hands, text, watermark'], none: ['', '']};
function updatePrompt() {
  const preset = QUALITY[$('quality').value] || QUALITY.none;
  $('prompt').value = composeAnime(selection, {quality: preset[0], expression: $('expression').value, camera: $('camera').value, background: $('background').value, extra: $('extra').value, multiline: $('multiline').checked});
  $('negative').value = preset[1]; $('copy-prompt').textContent = '复制提示词'; $('copy-negative').textContent = '复制负面提示词';
}

$('q').addEventListener('input', applyFilters);
$('reset').addEventListener('click', () => { category = ''; $('q').value = ''; $('favorites').setAttribute('aria-pressed', 'false'); applyFilters(); });
$('favorites').addEventListener('click', () => { $('favorites').setAttribute('aria-pressed', String($('favorites').getAttribute('aria-pressed') !== 'true')); applyFilters(); });
$('close').addEventListener('click', () => $('viewer').close());
$('open-builder').addEventListener('click', () => $('builder').showModal());
$('help').addEventListener('click', () => $('guide').showModal());
$('follow').addEventListener('click', () => $('wechat').showModal());
for (const [id, delta] of [['prev', -1], ['next', 1]]) $(id).addEventListener('click', () => {
  if (current + delta < 0 || current + delta >= viewList.length) return;
  current += delta; variant = null; showDetail();
});
$('copy').addEventListener('click', () => copyText(animeTags(detailRow()), $('copy')));
$('copy-id').addEventListener('click', () => copyText(detailRow().id, $('copy-id')));
$('add-selection').addEventListener('click', () => { choose(detailRow()); $('add-selection').textContent = '已加入组合'; });
for (const [id, value] of [['color-view', false], ['line-view', true]]) $(id).addEventListener('click', () => { lineart = value; showDetail(); });
for (const id of ['quality', 'expression', 'camera', 'background', 'extra', 'multiline']) $(id).addEventListener('input', updatePrompt);
$('copy-prompt').addEventListener('click', () => copyText($('prompt').value, $('copy-prompt')));
$('copy-negative').addEventListener('click', () => copyText($('negative').value, $('copy-negative')));
$('clear-selection').addEventListener('click', () => { selection = {}; renderBuilder(); $('selection-note').textContent = '组合已清空'; });
$('random-selection').addEventListener('click', () => {
  selection = {};
  for (const slot of Object.keys(ANIME_SLOTS)) {
    const list = records.filter((row) => !row.父级 && animeSlot(row) === slot);
    if (list.length) selection[slot] = list[Math.floor(Math.random() * list.length)];
  }
  renderBuilder(); $('selection-note').textContent = '已随机选择，可继续逐项替换';
});
document.addEventListener('keydown', (event) => {
  if ($('viewer').open) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); $('prev').click(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); $('next').click(); }
  } else if (event.key === '/' && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); $('q').focus();
  }
});
for (const dialog of [$('viewer'), $('builder'), $('guide'), $('wechat')]) dialog.addEventListener('click', (event) => {
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
    [records, meta] = await Promise.all([loadJson('data/anime-zh.json'), loadJson('data/meta.json')]);
    if (!Array.isArray(records) || records.length !== meta.total) throw new Error('二次元索引格式不正确');
    loader = new GalleryLoader({sentinel: $('load-sentinel'), hasMore: () => shown < filtered.length, loadMore: appendPage,
      preloadUrls: () => filtered.slice(shown, shown + 12).map((row) => row.缩略图)});
    $('total').textContent = `${meta.cards.toLocaleString()} 条目 · ${meta.total.toLocaleString()} 张彩图（含发色变体）· ${meta.lineart} 张线稿`;
    renderBuilder(); applyFilters();
  } catch (error) {
    $('status').textContent = '索引加载失败，请刷新重试；本地预览请使用 HTTP 服务。';
    console.error('二次元库数据加载失败', error);
  }
}
init();
