'use strict';

async function clipboardPng(blob) {
  if (blob.type === 'image/png') return blob;
  if (!['image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('图片格式不受支持');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('图片解码失败'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法转换图片');
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(
      (png) => png ? resolve(png) : reject(new Error('PNG 转换失败')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

async function copyGalleryImage(url) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('当前浏览器不支持复制图片');
  }
  const png = fetch(url, {credentials: 'omit'}).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return clipboardPng(await response.blob());
  });
  // Clipboard permission can be rejected before the image request finishes.
  png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
}
