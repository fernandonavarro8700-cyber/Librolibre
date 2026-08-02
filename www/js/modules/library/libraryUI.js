/**
 * libraryUI.js — Construcción de elementos DOM para libros (grid, lista, continuar leyendo).
 * Separado de libraryData.js: aquí solo se pinta, no se decide qué mostrar.
 */

import { icon } from '../components/icons.js';
import LibraryData from './libraryData.js';
import { showToast } from '../components/toast.js';

const STATUS_LABEL = { unread: 'No iniciado', reading: 'Leyendo', done: 'Terminado' };

function coverInnerHTML(book) {
  if (book.cover) {
    return `<img src="${book.cover}" alt="Portada de ${escapeHTML(book.title)}" loading="lazy">`;
  }
  const [a, b] = book.coverGradient || ['#5D2EFF', '#24153E'];
  return `<div class="cover-fallback" style="--cover-a:${a};--cover-b:${b}">${escapeHTML(book.title)}</div>`;
}

function escapeHTML(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function statusDotClass(status) {
  if (status === 'reading') return 'status-dot--reading';
  if (status === 'done') return 'status-dot--done';
  return 'status-dot--new';
}

/** Crea una tarjeta de libro para la vista en cuadrícula. */
export function createBookCard(book, { onOpen, onToggleFavorite } = {}) {
  const el = document.createElement('article');
  el.className = 'book-card';
  el.dataset.bookId = book.id;

  el.innerHTML = `
    <div class="book-card__cover">
      ${coverInnerHTML(book)}
      <button class="book-card__favorite ${book.favorite ? 'is-fav' : ''}" aria-label="Favorito" data-tooltip="Favorito">
        ${icon('favorite')}
      </button>
      <span class="book-card__format">${escapeHTML(book.format)}</span>
      ${book.progressPercent > 0 ? `
        <div class="book-card__progress">
          <div class="book-card__progress-fill" style="width:${book.progressPercent}%"></div>
        </div>` : ''}
    </div>
    <div class="book-card__title">${escapeHTML(book.title)}</div>
    <div class="book-card__author">${escapeHTML(book.author)}</div>
    <div class="book-card__meta">
      <span class="status-dot ${statusDotClass(book.status)}"></span>
      <span>${STATUS_LABEL[book.status] || ''}</span>
    </div>
  `;

  el.querySelector('.book-card__favorite').addEventListener('click', async (e) => {
    e.stopPropagation();
    const updated = await LibraryData.toggleFavorite(book.id);
    if (updated) {
      e.currentTarget.classList.toggle('is-fav', updated.favorite);
      showToast(updated.favorite ? 'Agregado a favoritos' : 'Quitado de favoritos', 'success', 1600);
      onToggleFavorite && onToggleFavorite(updated);
    }
  });

  el.addEventListener('click', () => onOpen && onOpen(book));

  return el;
}

/** Crea una fila de libro para la vista en lista. */
export function createBookRow(book, { onOpen } = {}) {
  const el = document.createElement('div');
  el.className = 'book-row';
  el.dataset.bookId = book.id;

  el.innerHTML = `
    <div class="book-row__cover">${coverInnerHTML(book)}</div>
    <div class="book-row__info">
      <div class="book-row__title">${escapeHTML(book.title)}</div>
      <div class="book-row__sub">${escapeHTML(book.author)} · ${STATUS_LABEL[book.status] || ''}</div>
    </div>
    <div class="book-row__progress">
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${book.progressPercent || 0}%"></div></div>
    </div>
    <div class="book-row__percent">${book.progressPercent || 0}%</div>
    <span class="book-row__format-badge">${escapeHTML(book.format)}</span>
  `;

  el.addEventListener('click', () => onOpen && onOpen(book));
  return el;
}

/** Crea una tarjeta compacta para la tira "Continuar leyendo" del inicio. */
export function createContinueCard(book, { onOpen } = {}) {
  const el = document.createElement('div');
  el.className = 'continue-card';
  el.dataset.bookId = book.id;
  el.innerHTML = `
    <div class="continue-card__cover">${coverInnerHTML(book)}</div>
    <div class="continue-card__body">
      <div class="continue-card__title">${escapeHTML(book.title)}</div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${book.progressPercent || 0}%"></div></div>
      <div class="continue-card__page">${book.progressPercent || 0}% leído</div>
    </div>
  `;
  el.addEventListener('click', () => onOpen && onOpen(book));
  return el;
}

/** Renderiza una colección de libros dentro de un contenedor, en modo 'grid' o 'list'. */
export function renderBookCollection(container, books, mode, handlers) {
  container.innerHTML = '';

  if (books.length === 0) {
    container.appendChild(buildEmptyState());
    return;
  }

  container.className = mode === 'list' ? 'book-list' : 'book-grid';
  const factory = mode === 'list' ? createBookRow : createBookCard;
  const frag = document.createDocumentFragment();
  books.forEach((book) => frag.appendChild(factory(book, handlers)));
  container.appendChild(frag);
}

function buildEmptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <div class="empty-state__icon">${icon('book')}</div>
    <h3>Sin resultados</h3>
    <p>No encontramos libros que coincidan con tu búsqueda o filtros actuales.</p>
  `;
  return el;
}

export default { createBookCard, createBookRow, createContinueCard, renderBookCollection };
