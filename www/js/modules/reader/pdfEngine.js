/**
 * pdfEngine.js — Configuración única de PDF.js para toda la app.
 * Se usa tanto para generar portadas al importar como para el lector real.
 * Todo se sirve localmente (assets/vendor/pdfjs) para funcionar 100% offline.
 */

import * as pdfjsLib from '../../../assets/vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../../assets/vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url
).href;

const CMAP_URL = new URL('../../../assets/vendor/pdfjs/cmaps/', import.meta.url).href;
const FONT_URL = new URL('../../../assets/vendor/pdfjs/standard_fonts/', import.meta.url).href;

let warmWorker = null;

/**
 * Arranca el Web Worker de PDF.js por adelantado (sin abrir ningún documento
 * todavía), para que el primer PDF que el usuario abra no pague el costo de
 * inicializar el worker en ese momento. Se llama una vez, al arrancar la app.
 */
export function warmupPdfWorker() {
  if (warmWorker) return warmWorker;
  warmWorker = new pdfjsLib.PDFWorker({ name: 'librolibre-warmup' });
  return warmWorker;
}

/**
 * Abre un documento PDF a partir de un Blob/File o ArrayBuffer.
 * @returns {Promise<import('pdfjs-dist').PDFDocumentProxy>}
 */
export async function loadPdfDocument(source) {
  const data = source instanceof Blob ? await source.arrayBuffer() : source;
  const task = pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: FONT_URL,
    // Reutiliza el worker precalentado si ya está listo; si el documento
    // llega antes de que termine de iniciar, PDF.js espera a que lo esté.
    worker: warmWorker || undefined,
  });
  const doc = await task.promise;
  // Cada documento necesita su propio worker "vivo" a partir de acá; se
  // vuelve a precalentar uno nuevo para la próxima apertura.
  warmWorker = null;
  warmupPdfWorker();
  return doc;
}

/**
 * Renderiza una página a un canvas nuevo (fuera de pantalla) y devuelve un dataURL JPEG,
 * útil para generar la portada del libro en el momento de importarlo.
 */
export async function renderPageToDataURL(pdfDoc, pageNumber = 1, maxWidth = 360) {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.82);
}

export { pdfjsLib };
export default { loadPdfDocument, renderPageToDataURL, pdfjsLib };
