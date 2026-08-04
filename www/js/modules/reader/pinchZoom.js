/**
 * pinchZoom.js — Gesto de pellizco (pinch-to-zoom) reutilizable por los
 * visores de PDF y de cómics (CBZ/CBR).
 *
 * Estrategia: mientras los dos dedos se mueven, solo se aplica un
 * `transform: scale()` en CSS (barato, sin re-renderizar nada). Recién al
 * soltar los dedos se llama a `setZoom()` una vez, que hace el re-render
 * real y nítido al nuevo nivel de zoom. Así el gesto se siente fluido aunque
 * el motor de renderizado (PDF.js / canvas de cómic) sea relativamente lento.
 *
 * @param {HTMLElement} el - contenedor sobre el que se aplica el transform visual
 * @param {Object} opts
 * @param {() => number} opts.getZoom
 * @param {(zoom:number) => void|Promise<void>} opts.setZoom
 * @param {number} opts.min
 * @param {number} opts.max
 * @returns {() => void} función para desconectar los listeners
 */
export function enablePinchZoom(el, { getZoom, setZoom, min, max }) {
  let pinching = false;
  let startDist = 0;
  let startZoom = 1;
  let liveScale = 1;

  function distance(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function midpoint(touches) {
    const [a, b] = touches;
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function onTouchStart(e) {
    if (e.touches.length !== 2) return;
    pinching = true;
    startDist = distance(e.touches);
    startZoom = getZoom();
    liveScale = 1;

    const rect = el.getBoundingClientRect();
    const mid = midpoint(e.touches);
    el.style.transformOrigin = `${mid.x - rect.left}px ${mid.y - rect.top}px`;
    el.style.transition = 'none';
    el.style.willChange = 'transform';
  }

  function onTouchMove(e) {
    if (!pinching || e.touches.length !== 2) return;
    e.preventDefault();

    const targetZoom = Math.max(min, Math.min(max, startZoom * (distance(e.touches) / startDist)));
    liveScale = targetZoom / startZoom;
    el.style.transform = `scale(${liveScale})`;
  }

  function endPinch() {
    if (!pinching) return;
    pinching = false;

    const finalZoom = Math.max(min, Math.min(max, startZoom * liveScale));
    el.style.transform = '';
    el.style.willChange = '';

    if (Math.abs(finalZoom - getZoom()) > 0.01) {
      setZoom(finalZoom);
    }
  }

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', endPinch, { passive: true });
  el.addEventListener('touchcancel', endPinch, { passive: true });

  return function disable() {
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', endPinch);
    el.removeEventListener('touchcancel', endPinch);
  };
}

export default { enablePinchZoom };
