'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const script = readFileSync(join(__dirname, '../assets/image-clipboard.js'), 'utf8');

function clipboard({mime = 'image/png', decodeFails = false, conversionFails = false, denied = false} = {}) {
  let respond, requested, item, written, canvas, revoked;
  const blob = {type: mime}, converted = {type: 'image/png', converted: true};
  const api = {
    navigator: {clipboard: {write(items) {
      item = items[0];
      if (denied) return Promise.reject(new Error('permission denied'));
      return item.data['image/png'].then(value => { written = value; });
    }}},
    ClipboardItem: class { constructor(data) { this.data = data; } },
    fetch(url, options) { requested = {url, options}; return new Promise(resolve => { respond = resolve; }); },
    URL: {createObjectURL() { return 'blob:test'; }, revokeObjectURL(url) { revoked = url; }},
    Image: class { constructor() { this.naturalWidth = 900; this.naturalHeight = 1200; }
      set src(_value) { Promise.resolve().then(() => decodeFails ? this.onerror() : this.onload()); } },
    document: {createElement() { canvas = {getContext: () => ({drawImage() {}}), toBlob: callback => callback(conversionFails ? null : converted)}; return canvas; }}
  };
  runInNewContext(script, api);
  return {api, blob, converted, requested: () => requested, item: () => item, written: () => written,
    canvas: () => canvas, revoked: () => revoked, respond: value => respond(value || {ok: true, blob: async () => blob})};
}

test('点击时立即提交剪贴板请求，PNG 原图不重编码且不携带凭据', async () => {
  const copy = clipboard();
  const pending = copy.api.copyGalleryImage('https://example.com/full.png');
  assert.ok(copy.item());
  assert.equal(copy.requested().options.credentials, 'omit');
  copy.respond(); await pending;
  assert.equal(copy.written(), copy.blob);
  assert.equal(copy.canvas(), undefined);
});

test('JPG 与 WebP 转为原尺寸 PNG，完成后释放临时 URL', async () => {
  for (const mime of ['image/jpeg', 'image/webp']) {
    const copy = clipboard({mime});
    const pending = copy.api.copyGalleryImage('https://example.com/full.jpg');
    copy.respond(); await pending;
    assert.equal(copy.written(), copy.converted);
    assert.equal(copy.canvas().width, 900); assert.equal(copy.canvas().height, 1200);
    assert.equal(copy.revoked(), 'blob:test');
  }
});

test('请求、格式、解码和转换失败均返回错误，转换失败也释放 URL', async () => {
  for (const [options, response, message] of [
    [{}, {ok: false, status: 403}, /HTTP 403/],
    [{mime: 'text/html'}, null, /格式不受支持/],
    [{mime: 'image/jpeg', decodeFails: true}, null, /解码失败/],
    [{mime: 'image/jpeg', conversionFails: true}, null, /PNG 转换失败/]
  ]) {
    const copy = clipboard(options), pending = copy.api.copyGalleryImage('https://example.com/image');
    copy.respond(response); await assert.rejects(pending, message);
    if (options.mime === 'image/jpeg') assert.equal(copy.revoked(), 'blob:test');
  }
});

test('不支持图片剪贴板时不请求原图；拒绝权限时正确返回失败', async () => {
  const unsupported = clipboard();
  delete unsupported.api.ClipboardItem;
  await assert.rejects(unsupported.api.copyGalleryImage('image.png'), /不支持复制图片/);
  assert.equal(unsupported.requested(), undefined);
  const denied = clipboard({denied: true});
  const pending = denied.api.copyGalleryImage('image.png');
  await assert.rejects(pending, /permission denied/);
  denied.respond({ok: false, status: 404});
});
