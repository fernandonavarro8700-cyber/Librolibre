/**
 * toast.js — Sistema de notificaciones flotantes no bloqueantes.
 */

let stackEl = null;

function ensureStack() {
  if (!stackEl) {
    stackEl = document.createElement('div');
    stackEl.className = 'toast-stack';
    stackEl.setAttribute('role', 'status');
    stackEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(stackEl);
  }
  return stackEl;
}

/**
 * Muestra un toast temporal.
 * @param {string} message
 * @param {'default'|'success'|'error'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'default', duration = 3000) {
  const stack = ensureStack();
  const toast = document.createElement('div');
  toast.className = `toast ${type !== 'default' ? 'toast--' + type : ''}`;
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

window.showToast = showToast;
export default showToast;
