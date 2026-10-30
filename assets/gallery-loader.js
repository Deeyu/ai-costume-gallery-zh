'use strict';

class GalleryLoader {
  constructor({sentinel, hasMore, loadMore, preloadUrls}) {
    this.sentinel = sentinel;
    this.hasMore = hasMore;
    this.loadMore = loadMore;
    this.preloadUrls = preloadUrls;
    this.frame = null;
    this.pending = [];
    this.active = new Set();
    this.recent = new Set();
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(() => this.schedule(), {rootMargin: '1600px 0px'});
      this.observer.observe(sentinel);
    }
    window.addEventListener('scroll', () => this.schedule(), {passive: true});
    window.addEventListener('resize', () => this.schedule());
    document.addEventListener('close', () => this.schedule(), true);
  }

  reset() {
    // Keep at most the four in-flight requests when a filter changes.
    this.pending = [];
  }

  update() {
    const more = this.hasMore();
    this.sentinel.hidden = !more;
    this.sentinel.textContent = more ? '向下滚动，自动加载更多…' : '';
    if (more) this.schedule();
  }

  schedule() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.sentinel.hidden || !this.hasMore() || document.querySelector('dialog[open]')) return;
      const distance = this.sentinel.getBoundingClientRect().top - window.innerHeight;
      if (distance <= 1600) this.preload(this.preloadUrls());
      if (distance <= 600) this.loadMore();
    });
  }

  preload(urls) {
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    const queued = new Set(this.pending);
    for (const url of urls.slice(0, 12)) {
      if (!url || this.recent.has(url) || queued.has(url)) continue;
      this.pending.push(url);
      queued.add(url);
    }
    this.pump();
  }

  pump() {
    while (this.active.size < 4 && this.pending.length) {
      const url = this.pending.shift();
      const image = new Image();
      this.active.add(image);
      this.recent.add(url);
      if (this.recent.size > 96) this.recent.delete(this.recent.values().next().value);
      image.decoding = 'async';
      image.fetchPriority = 'low';
      const complete = () => {
        image.onload = image.onerror = null;
        this.active.delete(image);
        this.pump();
      };
      image.onload = image.onerror = complete;
      image.src = url;
    }
  }
}
