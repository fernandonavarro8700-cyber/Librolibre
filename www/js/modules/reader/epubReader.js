/**
 * epubReader.js — Controla el Rendition de epub.js: paginación, tipografía,
 * navegación, TOC y progreso. No conoce el DOM de la toolbar (eso vive en
 * epubReaderUI.js): solo administra el documento y expone una API de control.
 */

import { loadEpubBook, searchEpub } from './epubEngine.js';

const FONT_STACKS = {
  inter: "'Inter', 'Segoe UI', Roboto, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', monospace",
  dyslexic: "'Comic Sans MS', 'Comic Sans', cursive, sans-serif",
};

export class EpubReaderEngine {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.viewerEl
   * @param {(loc:{cfi:string, percentage:number|null, chapterLabel:string})=>void} opts.onLocationChange
   * @param {(toc:Array)=>void} opts.onReady
   * @param {(percent:number)=>void} opts.onLocationsProgress - progreso de indexado en segundo plano
   */
  constructor({ viewerEl, onLocationChange, onReady, onLocationsProgress }) {
    this.viewerEl = viewerEl;
    this.onLocationChange = onLocationChange || (() => {});
    this.onReady = onReady || (() => {});
    this.onLocationsProgress = onLocationsProgress || (() => {});

    this.book = null;
    this.rendition = null;
    this.toc = [];
    this.currentCfi = null;
    this.currentHref = null;
    this.currentPercentage = null;
    this.locationsReady = false;

    this.prefs = {
      fontFamily: 'inter',
      fontSize: 100, // %
      lineHeight: 1.5,
      margin: 24, // px
      align: 'left', // left | justify
    };
  }

  async load(blob, { initialCfi = null, prefs = {} } = {}) {
    this.prefs = { ...this.prefs, ...prefs };
    this.book = await loadEpubBook(blob);

    this.rendition = this.book.renderTo(this.viewerEl, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'auto',
    });

    this._applyTheme();

    this.rendition.on('relocated', (location) => this._handleRelocated(location));

    const nav = await this.book.loaded.navigation;
    this.toc = flattenToc(nav.toc || []);

    await this.rendition.display(initialCfi || undefined);
    this.onReady(this.toc);

    // Indexado de ubicaciones para progreso preciso; corre en segundo plano.
    this._generateLocations();
  }

  destroy() {
    if (this.rendition) this.rendition.destroy();
    this.rendition = null;
    this.book = null;
  }

  async _generateLocations() {
    try {
      await this.book.locations.generate(1600);
      this.locationsReady = true;
      this.onLocationsProgress(100);
      if (this.currentCfi) {
        this.currentPercentage = this.book.locations.percentageFromCfi(this.currentCfi);
        this._emitLocation();
      }
    } catch (err) {
      // Si falla el indexado, la app sigue funcionando solo sin porcentaje exacto.
    }
  }

  _handleRelocated(location) {
    this.currentCfi = location.start.cfi;
    this.currentHref = location.start.href;
    this.currentPercentage = this.locationsReady
      ? this.book.locations.percentageFromCfi(this.currentCfi)
      : (location.start.percentage != null ? location.start.percentage : null);
    this._emitLocation();
  }

  _emitLocation() {
    const chapterLabel = findTocLabel(this.toc, this.currentHref) || '';
    this.onLocationChange({
      cfi: this.currentCfi,
      percentage: this.currentPercentage,
      chapterLabel,
      href: this.currentHref,
    });
  }

  /* -------------------------------------------------------- NAVEGACIÓN - */
  next() { return this.rendition.next(); }
  prev() { return this.rendition.prev(); }
  goToCfi(cfi) { return this.rendition.display(cfi); }
  goToHref(href) { return this.rendition.display(href); }

  /* -------------------------------------------------------------- TEMA - */
  _applyTheme() {
    this.rendition.themes.default({
      body: {
        'font-family': `${FONT_STACKS[this.prefs.fontFamily] || FONT_STACKS.inter} !important`,
        'line-height': `${this.prefs.lineHeight} !important`,
        'text-align': `${this.prefs.align} !important`,
        padding: `0 ${this.prefs.margin}px !important`,
      },
      p: { 'text-align': `${this.prefs.align} !important` },
    });
    this.rendition.themes.fontSize(`${this.prefs.fontSize}%`);
  }

  setFontFamily(name) {
    this.prefs.fontFamily = name;
    this._applyTheme();
  }

  setFontSize(percent) {
    this.prefs.fontSize = Math.max(70, Math.min(220, percent));
    this._applyTheme();
  }

  setLineHeight(value) {
    this.prefs.lineHeight = value;
    this._applyTheme();
  }

  setMargin(px) {
    this.prefs.margin = px;
    this._applyTheme();
  }

  setAlign(align) {
    this.prefs.align = align;
    this._applyTheme();
  }

  /* -------------------------------------------------------------- BUSCAR */
  search(query) {
    return searchEpub(this.book, query);
  }
}

function flattenToc(items, depth = 0) {
  const flat = [];
  items.forEach((item) => {
    flat.push({ label: item.label.trim(), href: item.href, depth });
    if (item.subitems && item.subitems.length) {
      flat.push(...flattenToc(item.subitems, depth + 1));
    }
  });
  return flat;
}

function findTocLabel(toc, href) {
  if (!href) return '';
  const clean = href.split('#')[0];
  const match = toc.find((t) => t.href.split('#')[0] === clean);
  return match ? match.label : '';
}

export default EpubReaderEngine;
