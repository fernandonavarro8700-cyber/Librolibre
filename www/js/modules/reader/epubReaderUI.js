/**
 * epubReaderUI.js — Pantalla del lector EPUB. Reutiliza el shell visual
 * (.reader-screen/.reader-toolbar/.reader-panel) del lector PDF pero con
 * su propia instancia y controles (tipografía, TOC) en vez de zoom/rotación.
 */

import { EpubReaderEngine } from './epubReader.js';
import Bookmarks from './bookmarks.js';
import { renderNotesPanel } from './notesPanel.js';
import { startSession, stopSession } from './readingSession.js';
import Settings from '../settings/settings.js';
import LibraryData from '../library/libraryData.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

let rootEl = null;
let engine = null;
let currentBook = null;
let activePanelTab = 'toc';
let progressSaveTimer = null;

const FONT_OPTIONS = [
  { id: 'inter', label: 'Predeterminada' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monoespaciada' },
  { id: 'dyslexic', label: 'Alta legibilidad' },
];

function ensureRoot() {
  if (rootEl) return rootEl;

  rootEl = document.createElement('section');
  rootEl.className = 'reader-screen';
  rootEl.innerHTML = `
    <div class="reader-toolbar">
      <button class="btn btn--icon" data-action="close" aria-label="Cerrar lector">${icon('chevronLeft')}</button>
      <div class="reader-toolbar__title"></div>
      <div class="reader-toolbar__group">
        <button class="btn btn--icon" data-action="prev" data-tooltip="Página anterior">${icon('chevronLeft')}</button>
        <button class="btn btn--icon" data-action="next" data-tooltip="Página siguiente">${icon('chevronRight')}</button>
        <button class="btn btn--icon" data-action="fullscreen" data-tooltip="Pantalla completa">${icon('fullscreen')}</button>
        <button class="btn btn--icon" data-action="bookmark" data-tooltip="Agregar marcador">${icon('bookmarkAdd')}</button>
        <button class="btn btn--icon" data-action="panel" data-tooltip="Tipografía / Índice / Buscar / Marcadores">${icon('panel')}</button>
      </div>
      <div class="reader-toolbar__page-indicator">
        <span class="epub-chapter-label"></span>
        <span class="epub-percent">0%</span>
      </div>
    </div>

    <div class="reader-progress-track"><div class="reader-progress-track__fill" style="width:0%"></div></div>

    <div class="reader-body">
      <div class="epub-viewer">
        <div class="epub-nav-zone epub-nav-zone--prev" data-action="prev"></div>
        <div class="epub-nav-zone epub-nav-zone--next" data-action="next"></div>
      </div>

      <aside class="reader-panel">
        <div class="reader-panel__tabs">
          <button class="reader-panel__tab is-active" data-tab="toc">Índice</button>
          <button class="reader-panel__tab" data-tab="font">Fuente</button>
          <button class="reader-panel__tab" data-tab="search">Buscar</button>
          <button class="reader-panel__tab" data-tab="bookmarks">Marcadores</button>
          <button class="reader-panel__tab" data-tab="notes">Notas</button>
        </div>

        <div class="reader-panel__content is-active" data-panel="toc">
          <div class="epub-toc-list"></div>
        </div>

        <div class="reader-panel__content" data-panel="font">
          <div class="font-control-group">
            <span class="font-control-group__label">Tipografía</span>
            <div class="chip-row" id="epubFontChips"></div>
          </div>
          <div class="font-control-group">
            <span class="font-control-group__label">Tamaño de texto</span>
            <div class="stepper">
              <button data-action="fontSizeDown">−</button>
              <span class="stepper__value" id="epubFontSizeValue">100%</span>
              <button data-action="fontSizeUp">+</button>
            </div>
          </div>
          <div class="font-control-group">
            <span class="font-control-group__label">Interlineado</span>
            <div class="stepper">
              <button data-action="lineHeightDown">−</button>
              <span class="stepper__value" id="epubLineHeightValue">1.5</span>
              <button data-action="lineHeightUp">+</button>
            </div>
          </div>
          <div class="font-control-group">
            <span class="font-control-group__label">Márgenes</span>
            <div class="stepper">
              <button data-action="marginDown">−</button>
              <span class="stepper__value" id="epubMarginValue">24px</span>
              <button data-action="marginUp">+</button>
            </div>
          </div>
          <div class="font-control-group">
            <span class="font-control-group__label">Alineación</span>
            <div class="chip-row" id="epubAlignChips">
              <button class="chip is-active" data-align="left">Izquierda</button>
              <button class="chip" data-align="justify">Justificado</button>
            </div>
          </div>
        </div>

        <div class="reader-panel__content" data-panel="search">
          <div class="reader-search-box">
            ${icon('search')}
            <input type="search" placeholder="Buscar texto en el libro…" class="epub-search-input">
          </div>
          <div class="epub-search-results"></div>
        </div>

        <div class="reader-panel__content" data-panel="bookmarks">
          <div class="epub-bookmark-list"></div>
        </div>

        <div class="reader-panel__content" data-panel="notes">
          <div class="reader-notes-container"></div>
        </div>
      </aside>
    </div>
  `;

  document.body.appendChild(rootEl);
  buildFontChips();
  wireToolbar();
  return rootEl;
}

function buildFontChips() {
  const wrap = rootEl.querySelector('#epubFontChips');
  wrap.innerHTML = FONT_OPTIONS.map(
    (f, i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-font="${f.id}">${f.label}</button>`
  ).join('');
}

function wireToolbar() {
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeReader);
  rootEl.querySelectorAll('[data-action="prev"]').forEach((el) => el.addEventListener('click', () => engine && engine.prev()));
  rootEl.querySelectorAll('[data-action="next"]').forEach((el) => el.addEventListener('click', () => engine && engine.next()));
  rootEl.querySelector('[data-action="fullscreen"]').addEventListener('click', toggleFullscreen);

  rootEl.querySelector('[data-action="bookmark"]').addEventListener('click', async () => {
    if (!engine || !currentBook || !engine.currentCfi) return;
    const cfi = engine.currentCfi;
    const existing = await Bookmarks.existsForPage(currentBook.id, cfi);
    if (existing) {
      await Bookmarks.remove(existing.id);
      showToast('Marcador eliminado', 'default', 1600);
    } else {
      await Bookmarks.add(currentBook.id, cfi, rootEl.querySelector('.epub-chapter-label').textContent);
      showToast('Página marcada', 'success', 1600);
    }
    if (activePanelTab === 'bookmarks') renderBookmarksPanel();
  });

  rootEl.querySelector('[data-action="panel"]').addEventListener('click', () => {
    rootEl.querySelector('.reader-panel').classList.toggle('open');
  });

  rootEl.querySelectorAll('.reader-panel__tab').forEach((tab) => {
    tab.addEventListener('click', () => switchPanelTab(tab.dataset.tab));
  });

  // Tipografía
  rootEl.querySelector('#epubFontChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-font]');
    if (!chip || !engine) return;
    rootEl.querySelectorAll('#epubFontChips .chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    engine.setFontFamily(chip.dataset.font);
  });

  rootEl.querySelector('[data-action="fontSizeUp"]').addEventListener('click', () => bumpFontSize(10));
  rootEl.querySelector('[data-action="fontSizeDown"]').addEventListener('click', () => bumpFontSize(-10));
  rootEl.querySelector('[data-action="lineHeightUp"]').addEventListener('click', () => bumpLineHeight(0.1));
  rootEl.querySelector('[data-action="lineHeightDown"]').addEventListener('click', () => bumpLineHeight(-0.1));
  rootEl.querySelector('[data-action="marginUp"]').addEventListener('click', () => bumpMargin(8));
  rootEl.querySelector('[data-action="marginDown"]').addEventListener('click', () => bumpMargin(-8));

  rootEl.querySelector('#epubAlignChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-align]');
    if (!chip || !engine) return;
    rootEl.querySelectorAll('#epubAlignChips .chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    engine.setAlign(chip.dataset.align);
  });

  // Búsqueda
  const searchInput = rootEl.querySelector('.epub-search-input');
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => runSearch(searchInput.value), 400);
  });

  // Navegación por teclado
  document.addEventListener('keydown', handleKeydown);

  document.addEventListener('fullscreenchange', () => {
    const btn = rootEl.querySelector('[data-action="fullscreen"]');
    btn.classList.toggle('is-active', !!document.fullscreenElement);
  });
}

function handleKeydown(e) {
  if (!rootEl || !rootEl.classList.contains('active') || !engine) return;
  if (e.key === 'ArrowRight') engine.next();
  if (e.key === 'ArrowLeft') engine.prev();
}

function bumpFontSize(delta) {
  if (!engine) return;
  engine.setFontSize(engine.prefs.fontSize + delta);
  rootEl.querySelector('#epubFontSizeValue').textContent = `${engine.prefs.fontSize}%`;
}

function bumpLineHeight(delta) {
  if (!engine) return;
  const value = Math.max(1.1, Math.min(2.4, Math.round((engine.prefs.lineHeight + delta) * 10) / 10));
  engine.setLineHeight(value);
  rootEl.querySelector('#epubLineHeightValue').textContent = value.toFixed(1);
}

function bumpMargin(delta) {
  if (!engine) return;
  const value = Math.max(0, Math.min(80, engine.prefs.margin + delta));
  engine.setMargin(value);
  rootEl.querySelector('#epubMarginValue').textContent = `${value}px`;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    rootEl.requestFullscreen().catch(() => {
      showToast('Pantalla completa no disponible en este dispositivo', 'default', 2200);
    });
  }
}

function switchPanelTab(tabName) {
  activePanelTab = tabName;
  rootEl.querySelectorAll('.reader-panel__tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tabName));
  rootEl.querySelectorAll('.reader-panel__content').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tabName));
  if (tabName === 'bookmarks') renderBookmarksPanel();
  if (tabName === 'notes') renderNotesTab();
}

function renderNotesTab() {
  renderNotesPanel(rootEl.querySelector('.reader-notes-container'), {
    bookId: currentBook.id,
    getCurrentPage: () => engine.currentCfi,
    getCurrentLabel: () => rootEl.querySelector('.epub-chapter-label').textContent,
    goToPage: (cfi) => engine.goToCfi(cfi),
  });
}

function renderToc() {
  const list = rootEl.querySelector('.epub-toc-list');
  list.innerHTML = '';
  engine.toc.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'toc-item';
    btn.dataset.href = item.href;
    btn.style.paddingLeft = `${12 + item.depth * 14}px`;
    btn.textContent = item.label;
    btn.addEventListener('click', () => engine.goToHref(item.href));
    list.appendChild(btn);
  });
}

async function renderBookmarksPanel() {
  const list = rootEl.querySelector('.epub-bookmark-list');
  const bookmarks = await Bookmarks.listForBook(currentBook.id);

  if (bookmarks.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('bookmarkAdd')}</div><h3>Sin marcadores</h3><p>Usa el ícono de marcador en la barra superior para guardar esta página.</p></div>`;
    return;
  }

  list.innerHTML = '';
  // Los marcadores EPUB guardan un CFI en vez de un número de página.
  const sorted = [...bookmarks].sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
  sorted.forEach((bm) => {
    const row = document.createElement('div');
    row.className = 'bookmark-row';
    row.innerHTML = `
      <div class="bookmark-row__page">${icon('bookmarkAdd')}</div>
      <div class="bookmark-row__comment">${escapeHTML(bm.comment || 'Marcador')}</div>
      <button class="bookmark-row__remove" aria-label="Eliminar marcador">${icon('close')}</button>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-row__remove')) return;
      engine.goToCfi(bm.page);
    });
    row.querySelector('.bookmark-row__remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      await Bookmarks.remove(bm.id);
      renderBookmarksPanel();
    });
    list.appendChild(row);
  });
}

async function runSearch(query) {
  const resultsEl = rootEl.querySelector('.epub-search-results');
  if (!query.trim()) { resultsEl.innerHTML = ''; return; }

  resultsEl.innerHTML = `<div class="skeleton" style="height:16px;margin-bottom:8px"></div><div class="skeleton" style="height:16px;width:70%"></div>`;
  const results = await engine.search(query);

  if (results.length === 0) {
    resultsEl.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--fs-xs)">Sin resultados para "${escapeHTML(query)}".</p>`;
    return;
  }

  resultsEl.innerHTML = '';
  results.slice(0, 80).forEach((r) => {
    const el = document.createElement('div');
    el.className = 'search-result';
    const highlighted = escapeHTML(r.snippet).replace(
      new RegExp(escapeRegExp(escapeHTML(query)), 'ig'),
      (m) => `<mark>${m}</mark>`
    );
    el.innerHTML = highlighted;
    el.addEventListener('click', () => engine.goToCfi(r.cfi));
    resultsEl.appendChild(el);
  });
}

function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHTML(str = '') { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function updateLocationIndicator({ cfi, percentage, chapterLabel, href }) {
  rootEl.querySelector('.epub-chapter-label').textContent = chapterLabel || '';
  const percent = percentage != null ? Math.round(percentage * 100) : null;
  rootEl.querySelector('.epub-percent').textContent = percent != null ? `${percent}%` : '…';
  rootEl.querySelector('.reader-progress-track__fill').style.width = `${percent || 0}%`;

  const cleanHref = (href || '').split('#')[0];
  rootEl.querySelectorAll('.toc-item').forEach((el) => {
    el.classList.toggle('is-current', (el.dataset.href || '').split('#')[0] === cleanHref);
  });

  scheduleProgressSave(cfi, percent);
}

function scheduleProgressSave(cfi, percent) {
  clearTimeout(progressSaveTimer);
  progressSaveTimer = setTimeout(() => {
    if (!currentBook) return;
    LibraryData.updateProgress(currentBook.id, percent || 0, cfi);
  }, 700);
}

/**
 * Abre el lector EPUB para un libro dado.
 * @param {Object} book
 */
export async function openEpubReader(book) {
  const el = ensureRoot();
  currentBook = book;
  el.querySelector('.reader-toolbar__title').textContent = book.title;
  el.classList.add('active');

  const blob = await LibraryData.getFileBlob(book.id);
  if (!blob) {
    showToast('No se encontró el archivo original de este libro', 'error', 3000);
    closeReader();
    return;
  }

  const viewerEl = el.querySelector('.epub-viewer');
  Array.from(viewerEl.querySelectorAll('.epub-render-area')).forEach((n) => n.remove());
  const renderArea = document.createElement('div');
  renderArea.className = 'epub-render-area';
  renderArea.style.cssText = 'position:absolute;inset:0;';
  viewerEl.insertBefore(renderArea, viewerEl.firstChild);

  if (engine) engine.destroy();
  engine = new EpubReaderEngine({
    viewerEl: renderArea,
    onLocationChange: updateLocationIndicator,
    onReady: () => renderToc(),
    onLocationsProgress: () => {},
  });

  try {
    await engine.load(blob, {
      initialCfi: typeof book.progressPage === 'string' ? book.progressPage : null,
      prefs: { theme: Settings.current.theme },
    });
  } catch (err) {
    console.error(err);
    showToast('No se pudo abrir el EPUB', 'error', 3000);
    closeReader();
    return;
  }

  switchPanelTab('toc');
  el.querySelector('.reader-panel').classList.remove('open');
  startSession(book.id);
}

export function closeReader() {
  if (!rootEl) return;
  rootEl.classList.remove('active');
  if (document.fullscreenElement) document.exitFullscreen();
  stopSession();
  if (engine) { engine.destroy(); engine = null; }
  currentBook = null;
}

export default { openEpubReader, closeReader };
