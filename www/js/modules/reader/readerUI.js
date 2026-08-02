/**
 * readerUI.js — Construye y controla la pantalla del lector.
 * Conecta PdfReaderEngine (renderizado) con Bookmarks y LibraryData (persistencia).
 * Pensado para que los futuros lectores EPUB/CBZ/CBR reutilicen el mismo shell
 * (.reader-screen / .reader-toolbar / .reader-panel) con su propio engine.
 */

import { PdfReaderEngine } from './pdfReader.js';
import Bookmarks from './bookmarks.js';
import { renderNotesPanel } from './notesPanel.js';
import { startSession, stopSession } from './readingSession.js';
import LibraryData from '../library/libraryData.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

let rootEl = null;
let engine = null;
let currentBook = null;
let activePanelTab = 'thumbs';
let progressSaveTimer = null;

/** Construye el shell del lector una sola vez y lo agrega al DOM. */
function ensureRoot() {
  if (rootEl) return rootEl;

  rootEl = document.createElement('section');
  rootEl.className = 'reader-screen';
  rootEl.innerHTML = `
    <div class="reader-toolbar">
      <button class="btn btn--icon" data-action="close" aria-label="Cerrar lector">${icon('chevronLeft')}</button>
      <div class="reader-toolbar__title"></div>
      <div class="reader-toolbar__group">
        <button class="btn btn--icon" data-action="zoomOut" data-tooltip="Alejar">${icon('zoomOut')}</button>
        <button class="btn btn--icon" data-action="zoomIn" data-tooltip="Acercar">${icon('zoomIn')}</button>
        <button class="btn btn--icon" data-action="rotate" data-tooltip="Rotar">${icon('rotate')}</button>
        <button class="btn btn--icon" data-action="scrollMode" data-tooltip="Modo de desplazamiento">${icon('layout')}</button>
        <button class="btn btn--icon" data-action="fullscreen" data-tooltip="Pantalla completa">${icon('fullscreen')}</button>
        <button class="btn btn--icon" data-action="bookmark" data-tooltip="Agregar marcador">${icon('bookmarkAdd')}</button>
        <button class="btn btn--icon" data-action="panel" data-tooltip="Miniaturas / Buscar / Marcadores">${icon('panel')}</button>
      </div>
      <div class="reader-toolbar__page-indicator">
        <span class="current-page">1</span> / <span class="total-pages">1</span>
      </div>
    </div>

    <div class="reader-body">
      <div class="pdf-viewer"></div>

      <aside class="reader-panel">
        <div class="reader-panel__tabs">
          <button class="reader-panel__tab is-active" data-tab="thumbs">Miniaturas</button>
          <button class="reader-panel__tab" data-tab="search">Buscar</button>
          <button class="reader-panel__tab" data-tab="bookmarks">Marcadores</button>
          <button class="reader-panel__tab" data-tab="notes">Notas</button>
        </div>
        <div class="reader-panel__content is-active" data-panel="thumbs">
          <div class="pdf-thumb-grid"></div>
        </div>
        <div class="reader-panel__content" data-panel="search">
          <div class="reader-search-box">
            ${icon('search')}
            <input type="search" placeholder="Buscar texto en el documento…" class="reader-search-input">
          </div>
          <div class="reader-search-results"></div>
        </div>
        <div class="reader-panel__content" data-panel="bookmarks">
          <div class="reader-bookmark-list"></div>
        </div>
        <div class="reader-panel__content" data-panel="notes">
          <div class="reader-notes-container"></div>
        </div>
      </aside>
    </div>
  `;

  document.body.appendChild(rootEl);
  wireToolbar();
  return rootEl;
}

function wireToolbar() {
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeReader);
  rootEl.querySelector('[data-action="zoomIn"]').addEventListener('click', () => engine && engine.zoomIn());
  rootEl.querySelector('[data-action="zoomOut"]').addEventListener('click', () => engine && engine.zoomOut());
  rootEl.querySelector('[data-action="rotate"]').addEventListener('click', () => engine && engine.rotate());

  rootEl.querySelector('[data-action="scrollMode"]').addEventListener('click', () => {
    if (!engine) return;
    const next = engine.scrollMode === 'vertical' ? 'horizontal' : 'vertical';
    engine.setScrollMode(next);
    showToast(next === 'vertical' ? 'Desplazamiento vertical' : 'Desplazamiento horizontal (por página)', 'default', 1600);
  });

  rootEl.querySelector('[data-action="fullscreen"]').addEventListener('click', toggleFullscreen);

  rootEl.querySelector('[data-action="bookmark"]').addEventListener('click', async () => {
    if (!engine || !currentBook) return;
    const page = engine.currentPage;
    const existing = await Bookmarks.existsForPage(currentBook.id, page);
    if (existing) {
      await Bookmarks.remove(existing.id);
      showToast('Marcador eliminado', 'default', 1600);
    } else {
      await Bookmarks.add(currentBook.id, page);
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

  const searchInput = rootEl.querySelector('.reader-search-input');
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => runSearch(searchInput.value), 350);
  });

  // Doble toque / doble clic para alternar zoom rápido
  rootEl.querySelector('.pdf-viewer').addEventListener('dblclick', (e) => {
    if (e.target.closest('canvas')) engine && engine.toggleDoubleTapZoom();
  });

  document.addEventListener('fullscreenchange', () => {
    const btn = rootEl.querySelector('[data-action="fullscreen"]');
    btn.classList.toggle('is-active', !!document.fullscreenElement);
  });
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
    getCurrentPage: () => engine.currentPage,
    getCurrentLabel: () => `Página ${engine.currentPage}`,
    goToPage: (page) => engine.goToPage(page),
  });
}

async function renderBookmarksPanel() {
  const list = rootEl.querySelector('.reader-bookmark-list');
  const bookmarks = await Bookmarks.listForBook(currentBook.id);

  if (bookmarks.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('bookmarkAdd')}</div><h3>Sin marcadores</h3><p>Usa el ícono de marcador en la barra superior para guardar esta página.</p></div>`;
    return;
  }

  list.innerHTML = '';
  bookmarks.forEach((bm) => {
    const row = document.createElement('div');
    row.className = 'bookmark-row';
    row.innerHTML = `
      <div class="bookmark-row__page">${bm.page}</div>
      <div class="bookmark-row__comment">${bm.comment ? escapeHTML(bm.comment) : 'Página ' + bm.page}</div>
      <button class="bookmark-row__remove" aria-label="Eliminar marcador">${icon('close')}</button>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-row__remove')) return;
      engine.goToPage(bm.page);
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
  const resultsEl = rootEl.querySelector('.reader-search-results');
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
    el.innerHTML = `<span class="search-result__page">Página ${r.page}</span>${highlighted}`;
    el.addEventListener('click', () => engine.goToPage(r.page));
    resultsEl.appendChild(el);
  });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHTML(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updatePageIndicator(page, total) {
  rootEl.querySelector('.current-page').textContent = page;
  rootEl.querySelector('.total-pages').textContent = total;

  rootEl.querySelectorAll('.pdf-thumb').forEach((t) => {
    t.classList.toggle('is-current', Number(t.dataset.page) === page);
  });

  scheduleProgressSave(page, total);
}

function scheduleProgressSave(page, total) {
  clearTimeout(progressSaveTimer);
  progressSaveTimer = setTimeout(() => {
    if (!currentBook) return;
    const percent = total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;
    LibraryData.updateProgress(currentBook.id, percent, page);
  }, 700);
}

/**
 * Abre el lector PDF para un libro dado.
 * @param {Object} book - registro del libro (de LibraryData)
 */
export async function openPdfReader(book) {
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

  const viewerEl = el.querySelector('.pdf-viewer');
  viewerEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('book')}</div><h3>Cargando…</h3><p>Preparando "${escapeHTML(book.title)}"</p></div>`;

  if (engine) engine.destroy();
  engine = new PdfReaderEngine({
    viewerEl,
    onPageChange: updatePageIndicator,
    onReady: (numPages) => {
      el.querySelector('.total-pages').textContent = numPages;
      engine.renderThumbnails(el.querySelector('.pdf-thumb-grid'), (n) => engine.goToPage(n));
    },
  });

  try {
    await engine.load(blob, { initialPage: book.progressPage > 0 ? book.progressPage : 1 });
  } catch (err) {
    console.error(err);
    showToast('No se pudo abrir el PDF', 'error', 3000);
    closeReader();
    return;
  }

  startSession(book.id);
  switchPanelTab('thumbs');
  el.querySelector('.reader-panel').classList.remove('open');
}

export function closeReader() {
  if (!rootEl) return;
  rootEl.classList.remove('active');
  if (document.fullscreenElement) document.exitFullscreen();
  stopSession();
  if (engine) { engine.destroy(); engine = null; }
  currentBook = null;
}

export default { openPdfReader, closeReader };
