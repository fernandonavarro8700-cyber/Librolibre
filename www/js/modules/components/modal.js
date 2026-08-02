/**
 * modal.js — Modal genérico y reutilizable.
 * Uso: openModal({ title, bodyHTML, actions: [{label, variant, onClick}] })
 */

let overlayEl = null;

function ensureOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay hidden';
  overlayEl.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h3 class="modal__title"></h3>
        <button class="modal__close" aria-label="Cerrar">${window.Icons ? window.Icons.close : '✕'}</button>
      </div>
      <div class="modal__body"></div>
      <div class="modal__actions"></div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeModal();
  });
  overlayEl.querySelector('.modal__close').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlayEl.classList.contains('hidden')) closeModal();
  });

  return overlayEl;
}

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.bodyHTML
 * @param {Array<{label:string, variant?:'primary'|'ghost', onClick:Function}>} opts.actions
 */
export function openModal({ title = '', bodyHTML = '', actions = [] }) {
  const overlay = ensureOverlay();
  overlay.querySelector('.modal__title').textContent = title;
  overlay.querySelector('.modal__body').innerHTML = bodyHTML;

  const actionsEl = overlay.querySelector('.modal__actions');
  actionsEl.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.className = `btn btn--${action.variant || 'ghost'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick && action.onClick());
    actionsEl.appendChild(btn);
  });

  overlay.classList.remove('hidden');
  return overlay;
}

export function closeModal() {
  if (overlayEl) overlayEl.classList.add('hidden');
}

window.openModal = openModal;
window.closeModal = closeModal;

export default { openModal, closeModal };
