/**
 * readingSession.js — Mide el tiempo de lectura activo de una sesión.
 * Se pausa automáticamente cuando la pestaña/app pierde foco o se oculta,
 * para no inflar las estadísticas con tiempo en que el usuario no está
 * realmente mirando el libro. Un solo tracker compartido por los tres lectores.
 */

import DB from '../database/db.js';

let bookId = null;
let resumedAt = null;
let accumulatedMs = 0;
let visibilityHandler = null;

function now() {
  return Date.now();
}

function pause() {
  if (resumedAt == null) return;
  accumulatedMs += now() - resumedAt;
  resumedAt = null;
}

function resume() {
  if (resumedAt != null) return;
  resumedAt = now();
}

function handleVisibilityChange() {
  if (document.hidden) pause();
  else resume();
}

/** Inicia (o reinicia) el conteo de tiempo para un libro. */
export function startSession(id) {
  // Si había una sesión abierta de otro libro, se descarta sin persistir
  // (no debería pasar en el flujo normal: siempre se cierra antes de abrir otra).
  bookId = id;
  accumulatedMs = 0;
  resumedAt = now();

  if (!visibilityHandler) {
    visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);
    // Intento best-effort de no perder la sesión si cierran la pestaña/app.
    window.addEventListener('pagehide', () => { stopSession(); });
  }
}

/**
 * Cierra la sesión activa y guarda el tiempo transcurrido en el historial
 * (solo si superó un mínimo de 4 segundos, para no ensuciar las estadísticas
 * con aperturas accidentales).
 * @returns {Promise<number>} milisegundos registrados
 */
export async function stopSession() {
  if (!bookId) return 0;
  pause();
  const durationMs = accumulatedMs;
  const sessionBookId = bookId;

  bookId = null;
  accumulatedMs = 0;

  if (durationMs >= 4000) {
    await DB.put(DB.STORES.HISTORY, {
      id: 'hs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      bookId: sessionBookId,
      date: Date.now(),
      type: 'session',
      durationMs,
    });
  }

  return durationMs;
}

export default { startSession, stopSession };
