/**
 * libraryData.js — Estado y lógica de datos de la biblioteca.
 * No toca el DOM: solo CRUD contra IndexedDB + helpers de filtro/orden.
 */

import DB from '../database/db.js';
import { loadPdfDocument, renderPageToDataURL } from '../reader/pdfEngine.js';
import { loadEpubBook, extractEpubMetadata } from '../reader/epubEngine.js';
import { loadCbzPages } from '../reader/cbzEngine.js';
import { loadCbrPages } from '../reader/cbrEngine.js';

/** Paleta de gradientes usados como portada de respaldo cuando el libro no tiene imagen. */
const FALLBACK_GRADIENTS = [
  ['#5D2EFF', '#24153E'],
  ['#B88CFF', '#1A1030'],
  ['#9165FF', '#12091F'],
  ['#7C4DFF', '#2A1854'],
];

function gradientFor(seed) {
  const idx = Math.abs(hashCode(seed)) % FALLBACK_GRADIENTS.length;
  return FALLBACK_GRADIENTS[idx];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function uid() {
  return 'bk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Clave local YYYY-MM-DD (no UTC) para agrupar sesiones por día del calendario del usuario. */
function dateKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
}

/** Devuelve las claves YYYY-MM-DD de los últimos n días (incluye hoy), de más viejo a más nuevo. */
function lastNDays(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dateKey(Date.now() - i * 86400000));
  }
  return keys;
}

/** Racha de días consecutivos con al menos una sesión, terminando hoy o ayer. */
function computeStreak(dayTotals) {
  let streak = 0;
  let cursor = Date.now();

  // Si hoy todavía no hay sesión, la racha puede seguir contando desde ayer
  // (para no "romper" la racha a las 00:01 si todavía no abriste un libro hoy).
  if (!dayTotals.has(dateKey(cursor))) {
    cursor -= 86400000;
  }

  while (dayTotals.has(dateKey(cursor))) {
    streak += 1;
    cursor -= 86400000;
  }

  return streak;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectFormat(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = { pdf: 'PDF', epub: 'EPUB', cbz: 'CBZ', cbr: 'CBR', txt: 'TXT', md: 'MD', html: 'HTML', htm: 'HTML' };
  return map[ext] || ext.toUpperCase();
}

export const LibraryData = {
  /** Devuelve todos los libros ordenados por fecha de apertura descendente. */
  async getAll() {
    const books = await DB.getAll(DB.STORES.BOOKS);
    return books.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  },

  async getById(id) {
    return DB.get(DB.STORES.BOOKS, id);
  },

  async getFavorites() {
    const all = await this.getAll();
    return all.filter((b) => b.favorite);
  },

  async getRecent(limit = 10) {
    const all = await this.getAll();
    return all
      .filter((b) => b.lastOpened)
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, limit);
  },

  async getInProgress(limit = 8) {
    const all = await this.getAll();
    return all
      .filter((b) => b.status === 'reading')
      .sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))
      .slice(0, limit);
  },

  async getCategories() {
    const all = await this.getAll();
    const set = new Set(all.map((b) => b.category).filter(Boolean));
    return Array.from(set);
  },

  /**
   * Crea una entrada de libro a partir de un objeto File importado por el usuario
   * y guarda el archivo original en el store FILES. Según el formato, además:
   * PDF cuenta páginas y renderiza la portada; EPUB extrae título/autor/portada;
   * CBZ/CBR cuentan páginas y usan la primera como portada.
   */
  async importFromFile(file) {
    const format = detectFormat(file.name);
    const title = file.name.replace(/\.[^/.]+$/, '');
    const [a, b] = gradientFor(title);

    const book = {
      id: uid(),
      title,
      author: 'Autor desconocido',
      format,
      pages: 0,
      progressPage: 0,
      progressPercent: 0,
      category: 'Sin categoría',
      favorite: false,
      status: 'unread', // 'unread' | 'reading' | 'done'
      cover: null,
      coverGradient: [a, b],
      fileName: file.name,
      fileSize: file.size,
      dateAdded: Date.now(),
      lastOpened: null,
    };

    await DB.put(DB.STORES.BOOKS, book);
    await DB.put(DB.STORES.FILES, { bookId: book.id, blob: file });

    if (format === 'PDF') {
      try {
        const pdfDoc = await loadPdfDocument(file);
        book.pages = pdfDoc.numPages;
        book.cover = await renderPageToDataURL(pdfDoc, 1);
        await DB.put(DB.STORES.BOOKS, book);
      } catch (err) {
        // El archivo se guarda igual aunque falle la portada/conteo de páginas.
        console.warn('No se pudo generar la portada del PDF:', err);
      }
    }

    if (format === 'EPUB') {
      try {
        const epubBook = await loadEpubBook(file);
        const meta = await extractEpubMetadata(epubBook);
        if (meta.title) book.title = meta.title;
        if (meta.author) book.author = meta.author;
        book.pages = meta.chapters || 0;
        if (meta.cover) book.cover = meta.cover;
        await DB.put(DB.STORES.BOOKS, book);
        epubBook.destroy();
      } catch (err) {
        console.warn('No se pudo leer la metadata del EPUB:', err);
      }
    }

    if (format === 'CBZ' || format === 'CBR') {
      try {
        const provider = format === 'CBR' ? await loadCbrPages(file) : await loadCbzPages(file);
        book.pages = provider.count;
        if (provider.count > 0) {
          const firstPageBlob = await provider.getPageBlob(0);
          book.cover = await blobToDataURL(firstPageBlob);
        }
        await DB.put(DB.STORES.BOOKS, book);
      } catch (err) {
        // El archivo se guarda igual aunque falle la portada/conteo de páginas
        // (por ejemplo, un CBR con compresión RAR5, no soportada).
        console.warn(`No se pudo generar la portada del ${format}:`, err);
      }
    }

    return book;
  },

  /** Devuelve el Blob/File original de un libro (para abrirlo en el lector). */
  async getFileBlob(id) {
    const row = await DB.get(DB.STORES.FILES, id);
    return row ? row.blob : null;
  },

  async toggleFavorite(id) {
    const book = await DB.get(DB.STORES.BOOKS, id);
    if (!book) return null;
    book.favorite = !book.favorite;
    await DB.put(DB.STORES.BOOKS, book);
    return book;
  },

  async updateProgress(id, progressPercent, progressPage) {
    const book = await DB.get(DB.STORES.BOOKS, id);
    if (!book) return null;
    book.progressPercent = progressPercent;
    if (progressPage != null) book.progressPage = progressPage;
    book.status = progressPercent >= 100 ? 'done' : progressPercent > 0 ? 'reading' : 'unread';
    book.lastOpened = Date.now();
    await DB.put(DB.STORES.BOOKS, book);

    await DB.put(DB.STORES.HISTORY, {
      id: 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      bookId: id,
      date: Date.now(),
      progressPercent,
    });
    return book;
  },

  async remove(id) {
    const [bookmarks, notes] = await Promise.all([
      DB.getAllByIndex(DB.STORES.BOOKMARKS, 'bookId', id),
      DB.getAllByIndex(DB.STORES.NOTES, 'bookId', id),
    ]);
    await Promise.all([
      DB.delete(DB.STORES.BOOKS, id),
      DB.delete(DB.STORES.FILES, id),
      ...bookmarks.map((b) => DB.delete(DB.STORES.BOOKMARKS, b.id)),
      ...notes.map((n) => DB.delete(DB.STORES.NOTES, n.id)),
    ]);
    return true;
  },

  /** Filtra y ordena una lista de libros ya cargada (operación en memoria). */
  filterAndSort(books, { query = '', category = 'all', status = 'all', sortBy = 'recent' } = {}) {
    let result = books;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }

    if (category !== 'all') {
      result = result.filter((b) => b.category === category);
    }

    if (status !== 'all') {
      result = result.filter((b) => b.status === status);
    }

    const sorters = {
      recent: (a, b) => (b.dateAdded || 0) - (a.dateAdded || 0),
      title: (a, b) => a.title.localeCompare(b.title),
      author: (a, b) => a.author.localeCompare(b.author),
      progress: (a, b) => (b.progressPercent || 0) - (a.progressPercent || 0),
    };

    return [...result].sort(sorters[sortBy] || sorters.recent);
  },

  /** Estadísticas agregadas para la pantalla de Estadísticas y el widget de inicio. */
  async getStats() {
    const [books, history] = await Promise.all([this.getAll(), DB.getAll(DB.STORES.HISTORY)]);
    const done = books.filter((b) => b.status === 'done').length;
    const formatCounts = {};
    books.forEach((b) => { formatCounts[b.format] = (formatCounts[b.format] || 0) + 1; });
    const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0];

    const sessions = history.filter((h) => h.type === 'session' && h.durationMs);
    const totalReadingMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);

    // Minutos acumulados por día (clave local YYYY-MM-DD) para racha y gráfico semanal.
    const dayTotals = new Map();
    sessions.forEach((s) => {
      const key = dateKey(s.date);
      dayTotals.set(key, (dayTotals.get(key) || 0) + s.durationMs);
    });

    const streak = computeStreak(dayTotals);
    const weekSeries = lastNDays(7).map((key) => ({
      key,
      label: dayLabel(key),
      minutes: Math.round((dayTotals.get(key) || 0) / 60000),
    }));

    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const monthMs = sessions
      .filter((s) => s.date >= thirtyDaysAgo)
      .reduce((sum, s) => sum + s.durationMs, 0);

    // Libro con más tiempo de lectura acumulado.
    const msByBook = new Map();
    sessions.forEach((s) => msByBook.set(s.bookId, (msByBook.get(s.bookId) || 0) + s.durationMs));
    let mostReadBook = null;
    if (msByBook.size > 0) {
      const [bookId, ms] = [...msByBook.entries()].sort((a, b) => b[1] - a[1])[0];
      const book = books.find((b) => b.id === bookId);
      if (book) mostReadBook = { title: book.title, ms };
    }

    return {
      totalBooks: books.length,
      booksFinished: done,
      totalEvents: history.length,
      topFormat: topFormat ? topFormat[0] : '—',
      totalReadingMs,
      streak,
      weekSeries,
      monthMs,
      mostReadBook,
    };
  },

  /** Siembra datos de demostración solo si la biblioteca está vacía (primer arranque). */
  async seedIfEmpty() {
    const existing = await DB.getAll(DB.STORES.BOOKS);
    if (existing.length > 0) return;

    const demo = [
      { title: 'Sombras del Vacío', author: 'M. Reyes', format: 'EPUB', category: 'Ciencia ficción', progressPercent: 62, status: 'reading' },
      { title: 'El Último Cartógrafo', author: 'I. Salas', format: 'PDF', category: 'Aventura', progressPercent: 100, status: 'done' },
      { title: 'Crónicas de Neón', author: 'D. Vega', format: 'CBZ', category: 'Cómic', progressPercent: 18, status: 'reading' },
      { title: 'Susurros de Papel', author: 'C. Marín', format: 'TXT', category: 'Poesía', progressPercent: 0, status: 'unread' },
      { title: 'Antología Nocturna', author: 'Varios', format: 'CBR', category: 'Cómic', progressPercent: 45, status: 'reading' },
      { title: 'La Casa sin Puertas', author: 'R. Duarte', format: 'EPUB', category: 'Misterio', progressPercent: 0, status: 'unread' },
    ];

    const now = Date.now();
    const rows = demo.map((d, i) => {
      const [a, b] = gradientFor(d.title);
      return {
        id: uid(),
        title: d.title,
        author: d.author,
        format: d.format,
        pages: 220 + i * 15,
        progressPage: Math.round((d.progressPercent / 100) * (220 + i * 15)),
        progressPercent: d.progressPercent,
        category: d.category,
        favorite: i % 3 === 0,
        status: d.status,
        cover: null,
        coverGradient: [a, b],
        fileName: d.title + '.' + d.format.toLowerCase(),
        fileSize: 0,
        dateAdded: now - i * 86400000,
        lastOpened: d.status !== 'unread' ? now - i * 3600000 : null,
      };
    });

    await DB.putMany(DB.STORES.BOOKS, rows);
  },
};

window.LibraryData = LibraryData;
export default LibraryData;
