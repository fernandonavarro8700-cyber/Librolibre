/**
 * notesPanel.js — Renderiza el panel de "Notas" dentro de cualquier lector
 * (PDF, EPUB, CBZ/CBR) y maneja alta/edición/borrado vía el modal genérico.
 * Un solo módulo compartido para no repetir esta lógica en cada readerUI.
 */

import Notes, { NOTE_COLORS } from './notes.js';
import { openModal, closeModal } from '../components/modal.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/toast.js';

function escapeHTML(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPageLabel(page, currentLabel) {
  if (page == null) return '';
  if (typeof page === 'number') return `Página ${page}`;
  return currentLabel || 'Posición guardada';
}

/**
 * @param {HTMLElement} containerEl - donde se pinta el panel completo (lista + botón agregar)
 * @param {Object} ctx
 * @param {string} ctx.bookId
 * @param {() => (number|string|null)} ctx.getCurrentPage - página/CFI actual del lector
 * @param {() => string} ctx.getCurrentLabel - etiqueta legible de la posición actual (capítulo, etc.)
 * @param {(page:number|string) => void} ctx.goToPage - navega el lector a esa página/CFI
 */
export async function renderNotesPanel(containerEl, ctx) {
  containerEl.innerHTML = '';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--ghost note-add-btn';
  addBtn.innerHTML = `${icon('plus')} <span>Nueva nota en esta página</span>`;
  addBtn.addEventListener('click', () => openNoteEditor(containerEl, ctx, null));
  containerEl.appendChild(addBtn);

  const list = document.createElement('div');
  list.className = 'note-list';
  containerEl.appendChild(list);

  const notes = await Notes.listForBook(ctx.bookId);

  if (notes.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('plus')}</div><h3>Sin notas</h3><p>Agrega la primera nota con el botón de arriba.</p></div>`;
    return;
  }

  notes.forEach((note) => {
    const row = document.createElement('div');
    row.className = 'note-row';
    row.style.setProperty('--note-color', note.color || NOTE_COLORS[0]);
    row.innerHTML = `
      <div class="note-row__bar"></div>
      <div class="note-row__body">
        <div class="note-row__head">
          <span class="note-row__title">${escapeHTML(note.title) || 'Sin título'}</span>
          <span class="note-row__page">${escapeHTML(formatPageLabel(note.page, ctx.getCurrentLabel ? ctx.getCurrentLabel() : ''))}</span>
        </div>
        ${note.content ? `<p class="note-row__content">${escapeHTML(note.content)}</p>` : ''}
      </div>
      <div class="note-row__actions">
        <button class="btn btn--icon btn--sm" data-action="edit" aria-label="Editar nota">${icon('edit')}</button>
        <button class="btn btn--icon btn--sm" data-action="delete" aria-label="Eliminar nota">${icon('close')}</button>
      </div>
    `;

    row.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteEditor(containerEl, ctx, note);
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await Notes.remove(note.id);
      showToast('Nota eliminada', 'default', 1600);
      renderNotesPanel(containerEl, ctx);
    });

    row.addEventListener('click', () => {
      if (note.page != null && ctx.goToPage) ctx.goToPage(note.page);
    });

    list.appendChild(row);
  });
}

function openNoteEditor(containerEl, ctx, existingNote) {
  const isEdit = !!existingNote;
  let selectedColor = existingNote ? existingNote.color : NOTE_COLORS[0];

  const swatches = NOTE_COLORS.map(
    (c) => `<button type="button" class="note-swatch ${c === selectedColor ? 'is-active' : ''}" data-color="${c}" style="--swatch:${c}"></button>`
  ).join('');

  const bodyHTML = `
    <div class="field">
      <label for="noteTitleInput">Título</label>
      <input type="text" id="noteTitleInput" placeholder="Título de la nota" value="${existingNote ? escapeHTML(existingNote.title) : ''}">
    </div>
    <div class="field">
      <label for="noteContentInput">Contenido</label>
      <textarea id="noteContentInput" placeholder="Escribe tu nota…">${existingNote ? escapeHTML(existingNote.content) : ''}</textarea>
    </div>
    <div class="field">
      <label>Color</label>
      <div class="note-swatch-row" id="noteSwatchRow">${swatches}</div>
    </div>
  `;

  const overlay = openModal({
    title: isEdit ? 'Editar nota' : 'Nueva nota',
    bodyHTML,
    actions: [
      {
        label: 'Cancelar',
        variant: 'ghost',
        onClick: closeModal,
      },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear nota',
        variant: 'primary',
        onClick: async () => {
          const title = overlay.querySelector('#noteTitleInput').value.trim();
          const content = overlay.querySelector('#noteContentInput').value.trim();

          if (isEdit) {
            await Notes.update(existingNote.id, { title, content, color: selectedColor });
            showToast('Nota actualizada', 'success', 1600);
          } else {
            await Notes.add(ctx.bookId, {
              title,
              content,
              color: selectedColor,
              page: ctx.getCurrentPage ? ctx.getCurrentPage() : null,
            });
            showToast('Nota guardada', 'success', 1600);
          }

          closeModal();
          renderNotesPanel(containerEl, ctx);
        },
      },
    ],
  });

  overlay.querySelector('#noteSwatchRow').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    selectedColor = btn.dataset.color;
    overlay.querySelectorAll('.note-swatch').forEach((s) => s.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
}

export default { renderNotesPanel };
