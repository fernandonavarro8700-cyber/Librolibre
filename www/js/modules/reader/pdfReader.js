/**
 * pdfReader.js — Motor de renderizado del lector PDF sobre PDF.js.
 * No conoce el DOM de la toolbar (eso vive en readerUI.js): solo administra
 * el documento, el viewport de páginas y expone una API de control.
 */

import { loadPdfDocument } from './pdfEngine.js';
import { enablePinchZoom } from './pinchZoom.js';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const MAX_RENDERED_PAGES = 12; // límite de canvases "vivos" en modo vertical para cuidar memoria

export class PdfReaderEngine {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.viewerEl - contenedor donde se pintan las páginas
   * @param {(page:number, total:number)=>void} opts.onPageChange
   * @param {(total:number)=>void} opts.onReady
   */
  constructor({ viewerEl, onPageChange, onReady }) {
    this.viewerEl = viewerEl;
    this.onPageChange = onPageChange || (() => {});
    this.onReady = onReady || (() => {});

    this.pdfDoc = null;
    this.numPages = 0;
    this.currentPage = 1;
    this.zoom = 1;
    this.rotation = 0;
    this.scrollMode = 'vertical'; // 'vertical' | 'horizontal'

    this.pageWrappers = new Map(); // pageNum -> { el, canvas, rendered, viewport }
    this.renderedOrder = []; // LRU de páginas renderizadas (modo vertical)
    this.observer = null;
    this._pageChangeTimer = null;

    this._disablePinch = enablePinchZoom(this.viewerEl, {
      getZoom: () => this.zoom,
      setZoom: (z) => this.setZoom(z),
      min: MIN_ZOOM,
      max: MAX_ZOOM,
    });
  }

  async load(blob, { initialPage = 1, zoom = null, rotation = 0, scrollMode = 'vertical' } = {}) {
    this.pdfDoc = await loadPdfDocument(blob);
    this.numPages = this.pdfDoc.numPages;
    this.rotation = normalizeRotation(rotation);
    this.scrollMode = scrollMode;
    this.currentPage = clamp(initialPage, 1, this.numPages);

    const initialZoom = zoom != null ? zoom : await this._computeFitWidthZoom();
    this.zoom = clamp(initialZoom, MIN_ZOOM, MAX_ZOOM);
    this.fitWidthZoom = this.zoom;

    await this._buildLayout();
    this.onReady(this.numPages);
    this.goToPage(this.currentPage, { smooth: false });
  }

  /**
   * Calcula el zoom para que la página ocupe el ancho disponible del visor.
   * Sin esto, PDFs con tamaño de página estándar (carta/A4, ~612pt de ancho
   * a escala 1) quedan más anchos que la pantalla y el texto se corta a la
   * derecha, en vez de arrancar ya ajustado como cualquier lector de PDF.
   */
  async _computeFitWidthZoom() {
    try {
      const page = await this.pdfDoc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1, rotation: this.rotation });
      const styles = window.getComputedStyle(this.viewerEl);
      const paddingX = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
      const available = this.viewerEl.clientWidth - paddingX;
      if (!available || !baseViewport.width) return 1;
      return available / baseViewport.width;
    } catch (err) {
      return 1;
    }
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    if (this._disablePinch) this._disablePinch();
    this.viewerEl.innerHTML = '';
    this.pageWrappers.clear();
    this.renderedOrder = [];
  }

  /* ---------------------------------------------------------- LAYOUT --- */

  async _buildLayout() {
    if (this.observer) this.observer.disconnect();
    this.viewerEl.innerHTML = '';
    this.pageWrappers.clear();
    this.renderedOrder = [];

    this.viewerEl.classList.toggle('pdf-viewer--vertical', this.scrollMode === 'vertical');
    this.viewerEl.classList.toggle('pdf-viewer--horizontal', this.scrollMode === 'horizontal');

    if (this.scrollMode === 'vertical') {
      await this._buildVerticalLayout();
    } else {
      await this._buildHorizontalLayout();
    }
  }

  async _buildVerticalLayout() {
    const frag = document.createDocumentFragment();

    for (let n = 1; n <= this.numPages; n++) {
      const page = await this.pdfDoc.getPage(n);
      const viewport = page.getViewport({ scale: this.zoom, rotation: this.rotation });

      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page';
      wrapper.dataset.page = String(n);
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;

      const canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
      frag.appendChild(wrapper);

      this.pageWrappers.set(n, { el: wrapper, canvas, rendered: false, viewport });
    }

    this.viewerEl.appendChild(frag);

    this.observer = new IntersectionObserver((entries) => this._handleIntersect(entries), {
      root: this.viewerEl,
      rootMargin: '1600px 0px',
      threshold: 0.01,
    });
    this.pageWrappers.forEach(({ el }) => this.observer.observe(el));

    // Observador aparte, más estricto, para saber qué página está "activa" y reportarla
    this._activeObserver = new IntersectionObserver((entries) => this._handleActivePage(entries), {
      root: this.viewerEl,
      threshold: [0.5],
    });
    this.pageWrappers.forEach(({ el }) => this._activeObserver.observe(el));
  }

  async _buildHorizontalLayout() {
    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: this.zoom, rotation: this.rotation });

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page pdf-page--single';
    wrapper.dataset.page = String(this.currentPage);
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    this.viewerEl.appendChild(wrapper);

    this.pageWrappers.set(this.currentPage, { el: wrapper, canvas, rendered: false, viewport });
    await this._renderPage(this.currentPage);
  }

  _handleIntersect(entries) {
    entries.forEach((entry) => {
      const pageNum = Number(entry.target.dataset.page);
      if (entry.isIntersecting) {
        this._renderPage(pageNum);
      }
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

  async _renderPage(pageNum) {
    const entry = this.pageWrappers.get(pageNum);
    if (!entry || entry.rendered) return;

    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.zoom, rotation: this.rotation });
    const canvas = entry.canvas;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    entry.rendered = true;
    entry.viewport = viewport;

    this.renderedOrder.push(pageNum);
    this._evictIfNeeded();
  }

  _evictIfNeeded() {
    if (this.scrollMode !== 'vertical') return;
    while (this.renderedOrder.length > MAX_RENDERED_PAGES) {
      const oldest = this.renderedOrder.shift();
      // No liberar la página actual ni las 3 vecinas a cada lado: con el
      // rootMargin generoso del observer, esas páginas suelen estar recién
      // renderizadas o a punto de entrar en pantalla — desalojarlas creaba
      // huecos negros visibles durante el scroll rápido.
      if (Math.abs(oldest - this.currentPage) <= 3) {
        this.renderedOrder.push(oldest); // re-encolar, todavía es "reciente"
        if (this.renderedOrder.length <= MAX_RENDERED_PAGES) break;
        continue;
      }
      const entry = this.pageWrappers.get(oldest);
      if (entry && entry.rendered) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        entry.rendered = false;
      }
    }
  }

  /* -------------------------------------------------------- NAVEGACIÓN - */

  goToPage(pageNum, { smooth = true } = {}) {
    pageNum = clamp(pageNum, 1, this.numPages);
    this.currentPage = pageNum;

    if (this.scrollMode === 'vertical') {
      const entry = this.pageWrappers.get(pageNum);
      if (entry) {
        entry.el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        this._renderPage(pageNum);
      }
    } else {
      this._buildHorizontalLayout();
    }

    this.onPageChange(this.currentPage, this.numPages);
  }

  nextPage() { this.goToPage(this.currentPage + 1); }
  prevPage() { this.goToPage(this.currentPage - 1); }

  /* -------------------------------------------------------------- ZOOM - */

  async setZoom(zoom) {
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    await this._buildLayout();
    this.goToPage(this.currentPage, { smooth: false });
    return this.zoom;
  }

  zoomIn() { return this.setZoom(this.zoom + 0.25); }
  zoomOut() { return this.setZoom(this.zoom - 0.25); }

  /** Zoom por doble toque: alterna entre ajuste normal (1x) y acercado (2.2x). */
  toggleDoubleTapZoom() {
    const base = this.fitWidthZoom || 1;
    return this.setZoom(this.zoom > base * 1.3 ? base : base * 2.2);
  }

  /* ---------------------------------------------------------- ROTACIÓN - */

  async rotate() {
    this.rotation = normalizeRotation(this.rotation + 90);
    await this._buildLayout();
    this.goToPage(this.currentPage, { smooth: false });
    return this.rotation;
  }

  /* --------------------------------------------------------- MODO SCROLL */

  async setScrollMode(mode) {
    if (mode === this.scrollMode) return;
    this.scrollMode = mode;
    await this._buildLayout();
    this.goToPage(this.currentPage, { smooth: false });
  }

  /* -------------------------------------------------------------- BUSCAR */

  /**
   * Busca un texto en todo el documento.
   * @returns {Promise<Array<{page:number, snippet:string}>>}
   */
  async search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results = [];
    for (let n = 1; n <= this.numPages; n++) {
      const page = await this.pdfDoc.getPage(n);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      const lower = text.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1) {
        const start = Math.max(0, idx - 28);
        const end = Math.min(text.length, idx + q.length + 28);
        const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
        results.push({ page: n, snippet });
        idx = lower.indexOf(q, idx + q.length);
        if (results.length >= 200) return results; // límite de seguridad
      }
    }
    return results;
  }

  /* ---------------------------------------------------------- MINIATURAS */

  /**
   * Renderiza miniaturas de todas las páginas dentro de un contenedor.
   * Se generan de forma perezosa mientras entran en vista (IntersectionObserver).
   */
  renderThumbnails(containerEl, onSelectPage) {
    containerEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    const placeholders = [];

    for (let n = 1; n <= this.numPages; n++) {
      const btn = document.createElement('button');
      btn.className = 'pdf-thumb';
      btn.dataset.page = String(n);
      btn.innerHTML = `<canvas></canvas><span class="pdf-thumb__num">${n}</span>`;
      btn.addEventListener('click', () => onSelectPage && onSelectPage(n));
      frag.appendChild(btn);
      placeholders.push(btn);
    }
    containerEl.appendChild(frag);

    const thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const btn = entry.target;
        const n = Number(btn.dataset.page);
        thumbObserver.unobserve(btn);
        this._renderThumbnail(n, btn.querySelector('canvas'));
      });
    }, { root: containerEl, rootMargin: '400px 0px' });

    placeholders.forEach((btn) => thumbObserver.observe(btn));
    this._thumbObserver = thumbObserver;
  }

  async _renderThumbnail(pageNum, canvas) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const scale = 120 / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeRotation(deg) {
  return ((deg % 360) + 360) % 360;
}

export default PdfReaderEngine;
