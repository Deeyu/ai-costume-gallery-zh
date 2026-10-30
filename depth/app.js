'use strict';

const $ = (id) => document.getElementById(id);
const state = {system: '', category: '', angle: '', query: '', grouped: true};
let rows = [], meta, filtered = [], groups = [], viewerGroups = [], groupIndex = 0, angleIndex = 0;
let imageVersion = 0, downloading = false;
let items = [], shown = 0, loader;

function button(text, handler) {
  const element = document.createElement('button');
  element.textContent = text;
  element.addEventListener('click', handler);
  return element;
}

function renderSystems() {
  $('systems').replaceChildren();
  for (const [name, info] of Object.entries(meta.systems)) {
    const element = button(name, () => {
      state.system = name; state.category = '';
      renderSystems(); renderCategories(); render();
    });
    element.setAttribute('aria-pressed', String(state.system === name));
    const small = document.createElement('small');
    small.textContent = `${info.groups} 组 · ${info.images} 张`;
    element.append(small); $('systems').append(element);
  }
}

function renderCategories() {
  $('category').replaceChildren(new Option('全部动作', ''));
  for (const name of meta.systems[state.system].categories) {
    $('category').append(new Option(name, name));
  }
  $('category').value = state.category;
}

function render() {
  if (!loader) return;
  filtered = filterPoses(rows, state);
  groups = groupPoses(filtered);
  $('section-title').textContent = state.category || state.system;
  $('grouped').setAttribute('aria-pressed', String(state.grouped));
  $('single').setAttribute('aria-pressed', String(!state.grouped));
  items = state.grouped ? groups : filtered.map((row) => [row]);
  loader.reset(); shown = 0;
  $('grid').replaceChildren();
  $('empty').hidden = items.length > 0;
  appendPage();
}

function appendPage() {
  const start = shown, batch = items.slice(start, start + 24);
  $('grid').append(...batch.map((views, index) => card(views, start + index)));
  shown += batch.length;
  $('status').textContent = `${groups.length} 组 · ${filtered.length} 张 · ${state.grouped ? '按姿势分组' : '逐张查看'} · 已显示 ${shown} ${state.grouped ? '组' : '张'}`;
  loader.update();
}

function card(views, index) {
  let selected = views[0];
  const article = document.createElement('article'); article.className = 'card pose-card';
  const open = button('', () => openViewer(selected)); open.className = 'card-open';
  const img = document.createElement('img');
  img.loading = index < 12 ? 'eager' : 'lazy'; img.decoding = 'async';
  if (index === 0) img.fetchPriority = 'high';
  img.width = 300; img.height = 400;
  img.src = selected.缩略图; img.alt = `${selected.姿势名称} · ${selected.角度}`;
  const info = document.createElement('div'); info.className = 'card-info';
  const title = document.createElement('h3'); title.textContent = selected.姿势名称;
  const detail = document.createElement('p'); detail.className = 'card-meta';
  detail.textContent = `${selected.姿势编号} · ${selected.分类} · ${selected.角度}`;
  info.append(title, detail); open.append(img, info); article.append(open);
  if (views.length > 1) {
    const choices = document.createElement('div'); choices.className = 'card-angles';
    for (const row of views) {
      const choice = button(row.角度, () => {
        selected = row; img.src = row.缩略图; img.alt = `${row.姿势名称} · ${row.角度}`;
        detail.textContent = `${row.姿势编号} · ${row.分类} · ${row.角度}`;
        for (const child of choices.children) child.setAttribute('aria-pressed', String(child === choice));
      });
      choice.setAttribute('aria-label', `${row.姿势编号} ${row.角度}`);
      choice.setAttribute('aria-pressed', String(row === selected)); choices.append(choice);
    }
    article.append(choices);
  }
  return article;
}

function openViewer(row) {
  viewerGroups = groups;
  groupIndex = viewerGroups.findIndex((views) => views[0].组ID === row.组ID);
  angleIndex = viewerGroups[groupIndex].findIndex((view) => view.id === row.id);
  showView(); $('viewer').showModal();
}

function current() { return viewerGroups[groupIndex][angleIndex]; }

function showView() {
  const row = current(), views = viewerGroups[groupIndex], version = ++imageVersion;
  $('large').src = row.缩略图; $('large').alt = `${row.姿势名称} · ${row.角度}`;
  $('image-status').textContent = '正在加载 PNG 原图…';
  const original = new Image();
  original.onload = () => {
    if (version !== imageVersion) return;
    $('large').src = row.原图; $('image-status').textContent = '';
  };
  original.onerror = () => {
    if (version === imageVersion) $('image-status').textContent = '原图加载失败，可尝试打开原图。';
  };
  original.src = row.原图;
  $('detail-cat').textContent = `${row.体系} / ${row.分类}`;
  $('detail-title').textContent = row.姿势名称;
  $('position').textContent = `第 ${groupIndex + 1} / ${viewerGroups.length} 组 · ${row.姿势编号} · ${row.角度}（${angleIndex + 1}/${views.length}）`;
  $('original').textContent = `${row.原始姿势名称} / ${row.原始分类} / ${row.原始角度}\n${row.id}`;
  $('angles').replaceChildren(...views.map((view, index) => {
    const choice = button(view.角度, () => { angleIndex = index; showView(); });
    choice.setAttribute('aria-pressed', String(index === angleIndex)); return choice;
  }));
  $('download').href = row.原图; $('download').download = `${row.id}_depth.png`;
  $('open-original').href = row.原图; $('copy').textContent = '复制 ID';
  $('prev-angle').disabled = angleIndex === 0;
  $('next-angle').disabled = angleIndex === views.length - 1;
  $('prev-pose').disabled = groupIndex === 0;
  $('next-pose').disabled = groupIndex === viewerGroups.length - 1;
}

function moveAngle(delta) {
  const next = angleIndex + delta;
  if (next >= 0 && next < viewerGroups[groupIndex].length) { angleIndex = next; showView(); }
}

function movePose(delta) {
  const next = groupIndex + delta;
  if (next < 0 || next >= viewerGroups.length) return;
  const angle = current().角度; groupIndex = next;
  angleIndex = Math.max(0, viewerGroups[next].findIndex((row) => row.角度 === angle));
  showView();
}

async function download(event) {
  event.preventDefault();
  if (downloading) return;
  const row = current(); downloading = true; $('download').textContent = '正在下载…';
  try {
    const response = await fetch(row.原图);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('原站未返回图片');
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${row.id}_depth.png`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    $('image-status').textContent = '下载失败，请点击“打开原图”后保存。';
  } finally { downloading = false; $('download').textContent = '下载深度图 PNG'; }
}

for (const id of ['category', 'angle']) $(id).addEventListener('change', (event) => {
  state[id] = event.target.value; render();
});
$('q').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('reset').addEventListener('click', () => {
  state.category = ''; state.angle = ''; state.query = '';
  $('category').value = ''; $('angle').value = ''; $('q').value = ''; render();
});
for (const id of ['grouped', 'single']) $(id).addEventListener('click', () => {
  state.grouped = id === 'grouped'; render();
});
$('close').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('close', () => { imageVersion++; });
$('help').addEventListener('click', () => $('guide').showModal());
$('follow').addEventListener('click', () => $('wechat').showModal());
for (const id of ['viewer', 'guide', 'wechat']) $(id).addEventListener('click', (event) => {
  if (event.target !== $(id)) return;
  const rect = $(id).getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close();
});
$('prev-angle').addEventListener('click', () => moveAngle(-1));
$('next-angle').addEventListener('click', () => moveAngle(1));
$('prev-pose').addEventListener('click', () => movePose(-1));
$('next-pose').addEventListener('click', () => movePose(1));
$('download').addEventListener('click', download);
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(current().id); $('copy').textContent = '已复制'; }
  catch { $('copy').textContent = '复制失败，请从日文说明中选取 ID'; }
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !document.querySelector('dialog[open]') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) {
    event.preventDefault(); $('q').focus(); return;
  }
  if (!$('viewer').open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const actions = {ArrowLeft: () => moveAngle(-1), ArrowRight: () => moveAngle(1), ArrowUp: () => movePose(-1), ArrowDown: () => movePose(1)};
  if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
});

async function load() {
  try {
    const responses = await Promise.all(['data/depth-zh.json', 'data/meta.json'].map((url) => fetch(url)));
    for (const response of responses) if (!response.ok) throw new Error(`HTTP ${response.status}`);
    [rows, meta] = await Promise.all(responses.map((response) => response.json()));
    state.system = Object.keys(meta.systems)[0];
    loader = new GalleryLoader({sentinel: $('load-sentinel'), hasMore: () => shown < items.length,
      loadMore: appendPage, preloadUrls: () => items.slice(shown, shown + 12).map((views) => views[0].缩略图)});
    $('total').textContent = `完整索引 · ${meta.groups} 组 · ${meta.total.toLocaleString('zh-CN')} 张 · 中文词条来自 Anhao`;
    const missing = Object.entries(meta.missing_views).map(([group, angles]) => `${group} 缺少${angles.join('、')}图`);
    $('source-note').textContent = `深度图 · 白色越近，黑色越远 · ${meta.groups} 组、${meta.total.toLocaleString('zh-CN')} 张。图片由原站提供。${missing.length ? `上游数据：${missing.join('；')}，按实际视角显示。` : ''}`;
    for (const angle of POSE_ANGLES) $('angle').append(new Option(angle, angle));
    renderSystems(); renderCategories(); render();
  } catch (error) {
    $('total').textContent = '深度图索引加载失败。';
    $('status').textContent = '请刷新重试，或通过 HTTP 服务打开本页面。';
    console.error('深度图索引加载失败', error);
  }
}
load();
