/**
 * app.js — Bootstrap de la aplicación.
 * Orquesta: navegación entre pantallas, biblioteca, importación de archivos,
 * configuración y estadísticas. Cada módulo real vive en js/modules/*.
 */

import DB from './modules/database/db.js';
import LibraryData from './modules/library/libraryData.js';
import { renderBookCollection, createBookCard } from './modules/library/libraryUI.js';
import Settings, { FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP } from './modules/settings/settings.js';
import { warmupPdfWorker } from './modules/reader/pdfEngine.js';
import { t, setLanguage, applyTranslations, LANGUAGES } from './modules/i18n/i18n.js';
import { icon, Icons } from './modules/components/icons.js';
import { showToast } from './modules/components/toast.js';

const state = {
  view: 'grid', // grid | list
  query: '',
  category: 'all',
  status: 'all',
  sortBy: 'recent',
};

const SCREEN_TITLE_KEYS = {
  home: 'nav_home',
  library: 'nav_library',
  recent: 'nav_recent',
  favorites: 'nav_favorites',
  categories: 'nav_categories',
  collections: 'nav_collections',
  stats: 'nav_stats',
  settings: 'nav_settings',
  about: 'nav_about',
};

/* ------------------------------------------------------------- ICONOS --- */
function paintIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (Icons[name]) el.innerHTML = Icons[name];
  });
}

/* ---------------------------------------------------------- NAVEGACIÓN -- */
function setMobileSidebarOpen(open) {
  document.getElementById('sidebar').classList.toggle('mobile-open', open);
  document.getElementById('sidebarBackdrop').classList.toggle('active', open);
}

function goToScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const screen = document.getElementById('screen-' + name);
  const navItem = document.querySelector(`.nav-item[data-screen="${name}"]`);
  if (screen) screen.classList.add('active');
  if (navItem) navItem.classList.add('active');

  document.getElementById('topbarTitle').textContent = t(SCREEN_TITLE_KEYS[name] || '');

  // Cierra el sidebar en móvil tras navegar
  setMobileSidebarOpen(false);

  refreshScreen(name);
}

function setupNavigation() {
  document.getElementById('sidebarNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (btn) goToScreen(btn.dataset.screen);
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => goToScreen(el.dataset.goto));
  });

  document.getElementById('collapseBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    setMobileSidebarOpen(!sidebar.classList.contains('mobile-open'));
  });

  document.getElementById('sidebarBackdrop').addEventListener('click', () => {
    setMobileSidebarOpen(false);
  });
}

/* ------------------------------------------------------- ABRIR UN LIBRO - */
async function openBook(book) {
  if (book.format === 'PDF') {
    const { openPdfReader } = await import('./modules/reader/readerUI.js');
    openPdfReader(book);
    return;
  }
  if (book.format === 'EPUB') {
    const { openEpubReader } = await import('./modules/reader/epubReaderUI.js');
    openEpubReader(book);
    return;
  }
  if (book.format === 'CBZ' || book.format === 'CBR') {
    const { openComicReader } = await import('./modules/reader/comicReaderUI.js');
    openComicReader(book);
    return;
  }
  showToast(t('toast_format_unavailable', { format: book.format }), 'default', 2600);
}

/* ------------------------------------------------------------ PANTALLAS - */
async function refreshScreen(name) {
  if (name === 'home') return renderHome();
  if (name === 'library') return renderLibraryScreen();
  if (name === 'recent') return renderRecent();
  if (name === 'favorites') return renderFavorites();
  if (name === 'categories') return renderCategories();
  if (name === 'stats') return renderStats();
}

async function renderHome() {
  const [inProgress, favorites, all, stats] = await Promise.all([
    LibraryData.getInProgress(8),
    LibraryData.getFavorites(),
    LibraryData.getAll(),
    LibraryData.getStats(),
  ]);

  // Continuar leyendo
  const strip = document.getElementById('continueStrip');
  strip.innerHTML = '';
  document.getElementById('continueSection').style.display = inProgress.length ? '' : 'none';
  if (inProgress.length) {
    const { createContinueCard } = await import('./modules/library/libraryUI.js');
    inProgress.forEach((b) => strip.appendChild(createContinueCard(b, { onOpen: openBook })));
  }

  // KPIs rápidos
  const kpis = document.getElementById('homeKpis');
  kpis.innerHTML = `
    ${kpiCard(stats.totalBooks, t('kpi_total_books'))}
    ${kpiCard(stats.booksFinished, t('kpi_finished'))}
    ${kpiCard(favorites.length, t('kpi_favorites'))}
    ${kpiCard(stats.streak > 0 ? `${stats.streak} 🔥` : '0', t('kpi_streak'))}
  `;

  // Favoritos (preview)
  renderBookCollection(document.getElementById('homeFavorites'), favorites.slice(0, 6), 'grid', {
    onOpen: openBook,
  });

  // Biblioteca (preview)
  renderBookCollection(document.getElementById('homeLibraryPreview'), all.slice(0, 6), 'grid', {
    onOpen: openBook,
  });
}

function kpiCard(value, label) {
  return `<div class="kpi-card"><div class="kpi-card__value">${value}</div><div class="kpi-card__label">${label}</div></div>`;
}

async function renderLibraryScreen() {
  const all = await LibraryData.getAll();
  const categories = await LibraryData.getCategories();

  // Chips de categoría (una sola vez, se regeneran si cambian)
  const chipsEl = document.getElementById('categoryChips');
  const currentChips = Array.from(chipsEl.querySelectorAll('[data-category]')).map((c) => c.dataset.category);
  const needed = ['all', ...categories];
  if (currentChips.length !== needed.length) {
    chipsEl.innerHTML = needed
      .map((c) => `<button class="chip ${c === state.category ? 'is-active' : ''}" data-category="${c}">${c === 'all' ? t('category_all') : escapeHTML(c)}</button>`)
      .join('');
    chipsEl.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.category = chip.dataset.category;
        chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderLibraryList(all);
      });
    });
  }

  renderLibraryList(all);
  document.getElementById('libraryCount').textContent = t('library_count', { count: all.length });
}

function renderLibraryList(all) {
  const filtered = LibraryData.filterAndSort(all, state);
  renderBookCollection(document.getElementById('libraryContainer'), filtered, state.view, {
    onOpen: openBook,
  });
}

async function renderRecent() {
  const books = await LibraryData.getRecent(30);
  renderBookCollection(document.getElementById('recentContainer'), books, 'grid', { onOpen: openBook });
}

async function renderFavorites() {
  const books = await LibraryData.getFavorites();
  renderBookCollection(document.getElementById('favoritesContainer'), books, 'grid', { onOpen: openBook });
}

async function renderCategories() {
  const all = await LibraryData.getAll();
  const categories = await LibraryData.getCategories();
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';

  if (categories.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('category')}</div><h3>${t('categories_empty_title')}</h3><p>${t('categories_empty_desc')}</p></div>`;
    return;
  }

  categories.forEach((cat) => {
    const books = all.filter((b) => b.category === cat);
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `<div class="section__head"><h2>${escapeHTML(cat)}</h2></div>`;
    const grid = document.createElement('div');
    grid.className = 'book-grid';
    grid.style.setProperty('--cover-w', '140px');
    section.appendChild(grid);
    container.appendChild(section);
    renderBookCollection(grid, books, 'grid', { onOpen: openBook });
  });
}

async function renderStats() {
  const stats = await LibraryData.getStats();
  const kpis = document.getElementById('statsKpis');
  kpis.innerHTML = `
    ${kpiCard(stats.totalBooks, t('kpi_total_books'))}
    ${kpiCard(stats.booksFinished, t('kpi_finished_full'))}
    ${kpiCard(formatDuration(stats.totalReadingMs), t('kpi_total_time'))}
    ${kpiCard(stats.streak > 0 ? `${stats.streak} 🔥` : '0', t('kpi_streak_full'))}
    ${kpiCard(formatDuration(stats.monthMs), t('kpi_last_30_days'))}
    ${kpiCard(stats.topFormat, t('kpi_top_format'))}
  `;

  renderWeekChart(stats.weekSeries);
  renderMostReadBook(stats.mostReadBook);
}

function renderWeekChart(weekSeries) {
  const el = document.getElementById('weekChart');
  if (!weekSeries || weekSeries.every((d) => d.minutes === 0)) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('clock')}</div><h3>${t('week_empty_title')}</h3><p>${t('week_empty_desc')}</p></div>`;
    return;
  }

  const max = Math.max(...weekSeries.map((d) => d.minutes), 1);
  el.innerHTML = weekSeries
    .map((d) => {
      const heightPct = Math.max(4, Math.round((d.minutes / max) * 100));
      return `
        <div class="week-chart__col">
          <span class="week-chart__value">${d.minutes > 0 ? d.minutes + 'm' : ''}</span>
          <div class="week-chart__bar-track">
            <div class="week-chart__bar" style="height:${heightPct}%"></div>
          </div>
          <span class="week-chart__day">${escapeHTML(d.label)}</span>
        </div>
      `;
    })
    .join('');
}

function renderMostReadBook(mostReadBook) {
  const el = document.getElementById('mostReadBook');
  if (!mostReadBook) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('flame')}</div><h3>${t('most_read_empty_title')}</h3><p>${t('most_read_empty_desc')}</p></div>`;
    return;
  }
  el.innerHTML = `
    <div class="kpi-card" style="max-width:360px">
      <div class="kpi-card__value" style="font-size:var(--fs-lg)">${escapeHTML(mostReadBook.title)}</div>
      <div class="kpi-card__label">${formatDuration(mostReadBook.ms)} ${t('kpi_accumulated_reading')}</div>
    </div>
  `;
}

function formatDuration(ms) {
  if (!ms || ms < 60000) return '—';
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function escapeHTML(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------- BIBLIOTECA -- */
function setupLibraryToolbar() {
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    state.query = e.target.value;
    goToScreen('library');
  });

  document.getElementById('sortSelect').addEventListener('change', async (e) => {
    state.sortBy = e.target.value;
    renderLibraryList(await LibraryData.getAll());
  });

  document.getElementById('statusSelect').addEventListener('change', async (e) => {
    state.status = e.target.value;
    renderLibraryList(await LibraryData.getAll());
  });

  document.getElementById('coverSizeSlider').addEventListener('input', (e) => {
    document.getElementById('libraryContainer').style.setProperty('--cover-w', e.target.value + 'px');
  });

  document.querySelectorAll('.view-toggle [data-view]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.view = btn.dataset.view;
      document.querySelectorAll('.view-toggle [data-view]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderLibraryList(await LibraryData.getAll());
    });
  });
}

/* ------------------------------------------------------------ IMPORTAR -- */
const SUPPORTED_EXTENSIONS = ['pdf', 'epub', 'cbz', 'cbr', 'txt', 'md', 'html', 'htm'];

function setupImport() {
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const allFiles = Array.from(fileInput.files || []);
    if (allFiles.length === 0) return;

    const files = allFiles.filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });
    const skipped = allFiles.length - files.length;

    for (const file of files) {
      try {
        await LibraryData.importFromFile(file);
      } catch (err) {
        showToast(t('toast_import_error', { name: file.name }), 'error', 3000);
        console.error(err);
      }
    }

    if (files.length > 0) {
      showToast(t('toast_import_success', { count: files.length }), 'success');
    }
    if (skipped > 0) {
      showToast(t('toast_import_unsupported', { count: skipped }), 'error', 3600);
    }

    fileInput.value = '';

    const activeScreen = document.querySelector('.screen.active').id.replace('screen-', '');
    refreshScreen(activeScreen);
  });
}

/* ----------------------------------------------------------- SETTINGS --- */
function buildLanguageChips() {
  const wrap = document.getElementById('languageChips');
  wrap.innerHTML = LANGUAGES.map(
    (l) => `<button class="chip ${l.code === Settings.current.language ? 'is-active' : ''}" data-lang="${l.code}">${l.label}</button>`
  ).join('');

  wrap.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      await Settings.set('language', chip.dataset.lang);
      setLanguage(chip.dataset.lang);
      applyTranslations();
      const activeScreen = document.querySelector('.screen.active').id.replace('screen-', '');
      document.getElementById('topbarTitle').textContent = t(SCREEN_TITLE_KEYS[activeScreen] || '');
      refreshScreen(activeScreen);
    });
  });
}

function setupSettings() {
  document.querySelectorAll('#themeChips .chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('#themeChips .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      await Settings.set('theme', chip.dataset.theme);
    });
  });

  buildLanguageChips();

  document.getElementById('fontScaleUp').addEventListener('click', () => bumpFontScale(FONT_SCALE_STEP));
  document.getElementById('fontScaleDown').addEventListener('click', () => bumpFontScale(-FONT_SCALE_STEP));

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const data = await DB.exportUserData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'librolibre-export.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('toast_export_done'), 'success');
  });
}

function reflectSettingsInUI() {
  document.querySelectorAll('#themeChips .chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.theme === Settings.current.theme);
  });
  document.querySelectorAll('#languageChips .chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.lang === Settings.current.language);
  });
  document.getElementById('fontScaleValue').textContent = `${Settings.current.fontScale}%`;
}

async function bumpFontScale(delta) {
  const next = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, Settings.current.fontScale + delta));
  await Settings.set('fontScale', next);
  document.getElementById('fontScaleValue').textContent = `${next}%`;
}

/* --------------------------------------------------------------- INIT --- */
async function init() {
  try {
    paintIcons();
    setupNavigation();
    setupLibraryToolbar();
    setupImport();
    setupSettings();

    await Settings.load();
    setLanguage(Settings.current.language);
    applyTranslations();
    reflectSettingsInUI();

    await LibraryData.seedIfEmpty();

    warmupPdfWorker();

    goToScreen('home');
  } finally {
    hideBootSplash();
  }
}

function hideBootSplash() {
  const splash = document.getElementById('bootSplash');
  if (splash) splash.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
