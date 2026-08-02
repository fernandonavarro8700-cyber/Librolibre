/**
 * bookmarks.js — Marcadores de página con comentario opcional.
 * Reutilizable por los lectores PDF, EPUB, CBZ y CBR.
 */

import DB from '../database/db.js';

function uid() {
  return 'bm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export const Bookmarks = {
  async listForBook(bookId) {
    const rows = await DB.getAllByIndex(DB.STORES.BOOKMARKS, 'bookId', bookId);
    return rows.sort((a, b) => {
      if (typeof a.page === 'number' && typeof b.page === 'number') return a.page - b.page;
      return a.dateAdded - b.dateAdded;
    });
  },

  async add(bookId, page, comment = '') {
    const bookmark = { id: uid(), bookId, page, comment, dateAdded: Date.now() };
    await DB.put(DB.STORES.BOOKMARKS, bookmark);
    return bookmark;
  },

  async update(id, changes) {
    const existing = await DB.get(DB.STORES.BOOKMARKS, id);
    if (!existing) return null;
    const updated = { ...existing, ...changes };
    await DB.put(DB.STORES.BOOKMARKS, updated);
    return updated;
  },

  async remove(id) {
    await DB.delete(DB.STORES.BOOKMARKS, id);
    return true;
  },

  async existsForPage(bookId, page) {
    const list = await this.listForBook(bookId);
    return list.find((b) => b.page === page) || null;
  },
};

export default Bookmarks;
