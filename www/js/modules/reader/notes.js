/**
 * notes.js — Notas de usuario asociadas a un libro y una página/posición.
 * Reutilizable por los lectores PDF, EPUB, CBZ y CBR.
 */

import DB from '../database/db.js';

export const NOTE_COLORS = ['#B88CFF', '#3EE38B', '#FFC24B', '#FF5D7A', '#5EC8FF'];

function uid() {
  return 'nt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export const Notes = {
  async listForBook(bookId) {
    const rows = await DB.getAllByIndex(DB.STORES.NOTES, 'bookId', bookId);
    return rows.sort((a, b) => b.dateUpdated - a.dateUpdated);
  },

  async get(id) {
    return DB.get(DB.STORES.NOTES, id);
  },

  async add(bookId, { title = '', content = '', page = null, color = NOTE_COLORS[0] } = {}) {
    const now = Date.now();
    const note = { id: uid(), bookId, title, content, page, color, dateAdded: now, dateUpdated: now };
    await DB.put(DB.STORES.NOTES, note);
    return note;
  },

  async update(id, changes) {
    const existing = await DB.get(DB.STORES.NOTES, id);
    if (!existing) return null;
    const updated = { ...existing, ...changes, dateUpdated: Date.now() };
    await DB.put(DB.STORES.NOTES, updated);
    return updated;
  },

  async remove(id) {
    await DB.delete(DB.STORES.NOTES, id);
    return true;
  },

  async countForBook(bookId) {
    const rows = await DB.getAllByIndex(DB.STORES.NOTES, 'bookId', bookId);
    return rows.length;
  },
};

export default Notes;
