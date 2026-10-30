'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadUI() {
  const nodes = new Map(), documentEvents = {};
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      open: false, focused: false, events: {},
      addEventListener(type, listener) { this.events[type] = listener; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { this.focused = true; },
      getBoundingClientRect() { return {left: 100, right: 400, top: 100, bottom: 500}; }
    });
    return nodes.get(id);
  }
  const document = {
    getElementById: node,
    activeElement: {tagName: 'BODY'},
    addEventListener(type, listener) { documentEvents[type] = listener; }
  };
  runInNewContext(readFileSync(join(__dirname, '../assets/app.js'), 'utf8'), {
    document, fetch: () => new Promise(() => {})
  });
  return {node, documentEvents};
}

test('公众号入口打开二维码弹窗', () => {
  const {node} = loadUI();
  node('follow').events.click();
  assert.equal(node('wechat').open, true);
});

test('二维码弹窗打开时搜索快捷键不会抢走焦点', () => {
  const {node, documentEvents} = loadUI();
  node('follow').events.click();
  const event = {key: '/', preventDefault() {}};
  documentEvents.keydown(event);
  assert.equal(node('q').focused, false);
  node('wechat').close();
  documentEvents.keydown(event);
  assert.equal(node('q').focused, true);
});

test('点击弹窗内部保留弹窗，点击遮罩关闭', () => {
  const {node} = loadUI();
  node('follow').events.click();
  const dialog = node('wechat');
  dialog.events.click({target: dialog, clientX: 200, clientY: 200});
  assert.equal(dialog.open, true);
  dialog.events.click({target: dialog, clientX: 50, clientY: 50});
  assert.equal(dialog.open, false);
});
