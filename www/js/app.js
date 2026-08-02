/**
 * app.js — Bootstrap de la aplicación.
 * Orquesta: navegación entre pantallas, biblioteca, importación de archivos,
 * configuración y estadísticas. Cada módulo real vive en js/modules/*.
 */

import DB from './modules/database/db.js';
import LibraryData from './modules/library/libraryData.js';
import { renderBookCollection, createBookCard } from './modules/library/libraryUI.js';
import Settings from './modules/settings/settings.js';
import { icon, Icons } from './modules/components/icons.js';
import { showToast } from './modules/components/toast.js';

const state = {
  view: 'grid', // grid | list
  query: '',
  category: 'all',
  status: 'all',
  sortBy: 'recent',
};

const SCREEN_TITLES = {
  home: 'Inicio',
  library: 'Biblioteca',
  recent: 'Recientes',
  favorites: 'Favoritos',
  categories: 'Categorías',
  collections: 'Colecciones',
  stats: 'Estadísticas',
  settings: 'Configuración',
  about: 'Acerca de',
};

/* ------------------------------------------------------------- ICONOS --- */
function paintIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (Icons[name]) el.innerHTML = Icons[name];
  });
}

/* ---------------------------------------------------------- NAVEGACIÓN -- */
function goToScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const screen = document.getElementById('screen-' + name);
  const navItem = document.querySelector(`.nav-item[data-screen="${name}"]`);
  if (screen) screen.classList.add('active');
  if (navItem) navItem.classList.add('active');

  document.getElementById('topbarTitle').textContent = SCREEN_TITLES[name] || '';

  // Cierra el sidebar en móvil tras navegar
  document.getElementById('sidebar').classList.remove('mobile-open');

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
    document.getElementById('sidebar').classList.toggle('mobile-open');
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
  showToast(`El lector de ${book.format} no está disponible para este formato`, 'default', 2600);
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
    ${kpiCard(stats.totalBooks, 'Libros en tu biblioteca')}
    ${kpiCard(stats.booksFinished, 'Terminados')}
    ${kpiCard(favorites.length, 'Favoritos')}
    ${kpiCard(stats.streak > 0 ? `${stats.streak} 🔥` : '0', 'Racha de días')}
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
      .map((c) => `<button class="chip ${c === state.category ? 'is-active' : ''}" data-category="${c}">${c === 'all' ? 'Todas' : escapeHTML(c)}</button>`)
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
  document.getElementById('libraryCount').textContent = `${all.length} ${all.length === 1 ? 'libro' : 'libros'}`;
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
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('category')}</div><h3>Sin categorías todavía</h3><p>Importa libros para empezar a organizarlos.</p></div>`;
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
    ${kpiCard(stats.totalBooks, 'Libros en tu biblioteca')}
    ${kpiCard(stats.booksFinished, 'Libros terminados')}
    ${kpiCard(formatDuration(stats.totalReadingMs), 'Tiempo total de lectura')}
    ${kpiCard(stats.streak > 0 ? `${stats.streak} 🔥` : '0', 'Racha de días seguidos')}
    ${kpiCard(formatDuration(stats.monthMs), 'Últimos 30 días')}
    ${kpiCard(stats.topFormat, 'Formato más utilizado')}
  `;

  renderWeekChart(stats.weekSeries);
  renderMostReadBook(stats.mostReadBook);
}

function renderWeekChart(weekSeries) {
  const el = document.getElementById('weekChart');
  if (!weekSeries || weekSeries.every((d) => d.minutes === 0)) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('clock')}</div><h3>Todavía sin datos</h3><p>Abrí un libro y leé un rato: esta semana se va a ir llenando sola.</p></div>`;
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
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('flame')}</div><h3>Todavía no hay favorito</h3><p>El libro en el que pasés más tiempo va a aparecer acá.</p></div>`;
    return;
  }
  el.innerHTML = `
    <div class="kpi-card" style="max-width:360px">
      <div class="kpi-card__value" style="font-size:var(--fs-lg)">${escapeHTML(mostReadBook.title)}</div>
      <div class="kpi-card__label">${formatDuration(mostReadBook.ms)} de lectura acumulada</div>
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
function setupImport() {
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        await LibraryData.importFromFile(file);
      } catch (err) {
        showToast(`No se pudo importar "${file.name}"`, 'error', 3000);
        console.error(err);
      }
    }

    showToast(`${files.length} ${files.length === 1 ? 'archivo importado' : 'archivos importados'}`, 'success');
    fileInput.value = '';

    const activeScreen = document.querySelector('.screen.active').id.replace('screen-', '');
    refreshScreen(activeScreen);
  });
}

/* ----------------------------------------------------------- SETTINGS --- */
function setupSettings() {
  document.querySelectorAll('#themeChips .chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('#themeChips .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      await Settings.set('theme', chip.dataset.theme);
    });
  });

  const animToggle = document.getElementById('animToggle');
  animToggle.addEventListener('click', async () => {
    const on = !animToggle.classList.contains('is-on');
    animToggle.classList.toggle('is-on', on);
    animToggle.setAttribute('aria-checked', String(on));
    await Settings.set('animations', on);
  });

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const data = await DB.exportUserData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'librolibre-export.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportación generada', 'success');
  });
}

function reflectSettingsInUI() {
  document.querySelectorAll('#themeChips .chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.theme === Settings.current.theme);
  });
  const animToggle = document.getElementById('animToggle');
  animToggle.classList.toggle('is-on', Settings.current.animations);
  animToggle.setAttribute('aria-checked', String(Settings.current.animations));
}

/* --------------------------------------------------------------- INIT --- */
async function init() {
  paintIcons();
  setupNavigation();
  setupLibraryToolbar();
  setupImport();
  setupSettings();

  await Settings.load();
  reflectSettingsInUI();

  await LibraryData.seedIfEmpty();

  goToScreen('home');
}

document.addEventListener('DOMContentLoaded', init);
