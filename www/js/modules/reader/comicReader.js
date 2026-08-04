/**
 * comicReader.js — Motor común para CBZ y CBR. Recibe un "proveedor de páginas"
 * ({ count, names, getPageBlob(index) }) de cbzEngine.js o cbrEngine.js y se
 * encarga del layout (vertical/horizontal/doble página), zoom y lazy loading
 * de las imágenes vía IntersectionObserver — igual de cuidadoso con la memoria
 * que el lector PDF.
 */

import { enablePinchZoom } from './pinchZoom.js';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export class ComicReaderEngine {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.viewerEl
   * @param {(page:number, total:number)=>void} opts.onPageChange
   * @param {(total:number)=>void} opts.onReady
   */
  constructor({ viewerEl, onPageChange, onReady }) {
    this.viewerEl = viewerEl;
    this.onPageChange = onPageChange || (() => {});
    this.onReady = onReady || (() => {});

    this.provider = null;
    this.numPages = 0;
    this.currentPage = 1;
    this.zoom = 1;
    this.scrollMode = 'vertical'; // 'vertical' | 'horizontal'
    this.doublePage = false;

    this.pageEls = new Map(); // pageNum -> { wrapper, img, loaded }
    this.observer = null;
    this._activeObserver = null;
    this._pageChangeTimer = null;
    this._objectUrls = [];

    this._disablePinch = enablePinchZoom(this.viewerEl, {
      getZoom: () => this.zoom,
      setZoom: (z) => this.setZoom(z),
      min: MIN_ZOOM,
      max: MAX_ZOOM,
    });
  }

  async load(provider, { initialPage = 1, zoom = 1, scrollMode = 'vertical', doublePage = false } = {}) {
    this.provider = provider;
    this.numPages = provider.count;
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.scrollMode = scrollMode;
    this.doublePage = doublePage;
    this.currentPage = clamp(initialPage, 1, this.numPages);

    await this._buildLayout();
    this.onReady(this.numPages);
    this.goToPage(this.currentPage, { smooth: false });
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    if (this._activeObserver) this._activeObserver.disconnect();
    if (this._disablePinch) this._disablePinch();
    this._objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this._objectUrls = [];
    this.viewerEl.innerHTML = '';
    this.pageEls.clear();
  }

  /* ---------------------------------------------------------- LAYOUT --- */

  async _buildLayout() {
    if (this.observer) this.observer.disconnect();
    if (this._activeObserver) this._activeObserver.disconnect();
    this.viewerEl.innerHTML = '';
    this.pageEls.clear();

    this.viewerEl.classList.toggle('comic-viewer--vertical', this.scrollMode === 'vertical');
    this.viewerEl.classList.toggle('comic-viewer--horizontal', this.scrollMode === 'horizontal');
    this.viewerEl.classList.toggle('comic-viewer--double', this.doublePage);

    if (this.scrollMode === 'vertical') {
      this._buildVerticalLayout();
    } else {
      await this._buildHorizontalLayout();
    }
  }

  _buildVerticalLayout() {
    const frag = document.createDocumentFragment();

    for (let n = 1; n <= this.numPages; n++) {
      const wrapper = this._createPageWrapper(n);
      frag.appendChild(wrapper.el);
      this.pageEls.set(n, wrapper);
    }
    this.viewerEl.appendChild(frag);

    this.observer = new IntersectionObserver((entries) => this._handleIntersect(entries), {
      root: this.viewerEl,
      rootMargin: '1000px 0px',
      threshold: 0.01,
    });
    this.pageEls.forEach(({ el }) => this.observer.observe(el));

    this._activeObserver = new IntersectionObserver((entries) => this._handleActivePage(entries), {
      root: this.viewerEl,
      threshold: [0.5],
    });
    this.pageEls.forEach(({ el }) => this._activeObserver.observe(el));
  }

  async _buildHorizontalLayout() {
    const spread = document.createElement('div');
    spread.className = 'comic-spread';

    const pagesToShow = this.doublePage && this.currentPage < this.numPages
      ? [this.currentPage, this.currentPage + 1]
      : [this.currentPage];

    for (const n of pagesToShow) {
      const wrapper = this._createPageWrapper(n);
      wrapper.el.classList.add('comic-page--single');
      spread.appendChild(wrapper.el);
      this.pageEls.set(n, wrapper);
    }

    this.viewerEl.appendChild(spread);
    await Promise.all(pagesToShow.map((n) => this._loadPage(n)));
  }

  _createPageWrapper(n) {
    const el = document.createElement('div');
    el.className = 'comic-page';
    el.dataset.page = String(n);
    el.style.setProperty('--comic-zoom', this.zoom);

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = `Página ${n}`;
    el.appendChild(img);

    return { el, img, loaded: false };
  }

  _handleIntersect(entries) {
    entries.forEach((entry) => {
      const pageNum = Number(entry.target.dataset.page);
      if (entry.isIntersecting) this._loadPage(pageNum);
    });
  }

  _handleActivePage(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const pageNum = Number(entry.target.dataset.page);
        this._setCurrentPage(pageNum);
      }
    });
  }

  _setCurrentPage(pageNum) {
    if (pageNum === this.currentPage) return;
    this.currentPage = pageNum;
    clearTimeout(this._pageChangeTimer);
    this._pageChangeTimer = setTimeout(() => {
      this.onPageChange(this.currentPage, this.numPages);
    }, 260);
  }

  async _loadPage(pageNum) {
    const entry = this.pageEls.get(pageNum);
    if (!entry || entry.loaded) return;
    entry.loaded = true; // marca antes de esperar para no disparar dos veces

    const blob = await this.provider.getPageBlob(pageNum - 1);
    const url = URL.createObjectURL(blob);
    this._objectUrls.push(url);
    entry.img.src = url;
  }

  /* -------------------------------------------------------- NAVEGACIÓN - */

  goToPage(pageNum, { smooth = true } = {}) {
    pageNum = clamp(pageNum, 1, this.numPages);
    this.currentPage = pageNum;

    if (this.scrollMode === 'vertical') {
      const entry = this.pageEls.get(pageNum);
      if (entry) {
        entry.el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        this._loadPage(pageNum);
      }
    } else {
      this._buildHorizontalLayout();
    }

    this.onPageChange(this.currentPage, this.numPages);
  }

  nextPage() {
    const step = this.scrollMode === 'horizontal' && this.doublePage ? 2 : 1;
    this.goToPage(this.currentPage + step);
  }

  prevPage() {
    const step = this.scrollMode === 'horizontal' && this.doublePage ? 2 : 1;
    this.goToPage(this.currentPage - step);
  }

  /* -------------------------------------------------------------- ZOOM - */

  setZoom(zoom) {
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.pageEls.forEach(({ el }) => el.style.setProperty('--comic-zoom', this.zoom));
    return this.zoom;
  }

  zoomIn() { return this.setZoom(this.zoom + 0.25); }
  zoomOut() { return this.setZoom(this.zoom - 0.25); }

  toggleDoubleTapZoom() {
    return this.setZoom(this.zoom > 1.4 ? 1 : 2);
  }

  /* --------------------------------------------------------- MODOS UI --- */

  async setScrollMode(mode) {
    if (mode === this.scrollMode) return;
    this.scrollMode = mode;
    await this._buildLayout();
    this.goToPage(this.currentPage, { smooth: false });
  }

  async setDoublePage(on) {
    this.doublePage = on;
    if (this.scrollMode === 'horizontal') {
      await this._buildLayout();
      this.goToPage(this.currentPage, { smooth: false });
    }
  }

  /* ---------------------------------------------------------- MINIATURAS */

  renderThumbnails(containerEl, onSelectPage) {
    containerEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    const placeholders = [];

    for (let n = 1; n <= this.numPages; n++) {
      const btn = document.createElement('button');
      btn.className = 'pdf-thumb';
      btn.dataset.page = String(n);
      btn.innerHTML = `<img loading="lazy" alt="Página ${n}"><span class="pdf-thumb__num">${n}</span>`;
      btn.addEventListener('click', () => onSelectPage && onSelectPage(n));
      frag.appendChild(btn);
      placeholders.push(btn);
    }
    containerEl.appendChild(frag);

    const thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        const btn = entry.target;
        const n = Number(btn.dataset.page);
        thumbObserver.unobserve(btn);
        const blob = await this.provider.getPageBlob(n - 1);
        const url = URL.createObjectURL(blob);
        this._objectUrls.push(url);
        btn.querySelector('img').src = url;
      });
    }, { root: containerEl, rootMargin: '400px 0px' });

    placeholders.forEach((btn) => thumbObserver.observe(btn));
    this._thumbObserver = thumbObserver;
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export default ComicReaderEngine;
