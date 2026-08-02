/**
 * cbrEngine.js — Extracción de páginas de un cómic CBR (RAR) usando el bundle
 * puro-JS local (window.UnrarLite, ver js/vendor/unrarjs/). A diferencia del
 * CBZ, esta librería descomprime el archivo completo de una sola vez (no
 * soporta extracción perezosa por entrada) — ver README para el detalle.
 * Soporta RAR 2.0/2.9 (la inmensa mayoría de .cbr existentes); no soporta RAR5.
 */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;

function mimeFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  return map[ext] || 'application/octet-stream';
}

/**
 * Abre un CBR y devuelve el mismo tipo de "proveedor de páginas" que cbzEngine:
 * { count, names, getPageBlob(index) }
 */
export async function loadCbrPages(source) {
  const data = source instanceof Blob ? await source.arrayBuffer() : source;

  if (!window.UnrarLite) {
    throw new Error('El módulo de descompresión RAR no se cargó correctamente.');
  }

  const localFiles = window.UnrarLite(data);

  const pages = localFiles
    .filter((f) => f.isValid && f.fileData && IMAGE_EXT.test(f.filename))
    .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));

  if (pages.length === 0) {
    throw new Error('No se encontraron imágenes válidas dentro del CBR (o usa compresión RAR5, no soportada).');
  }

  const names = pages.map((p) => p.filename);
  const cache = new Map();

  return {
    count: pages.length,
    names,
    async getPageBlob(index) {
      if (cache.has(index)) return cache.get(index);
      const page = pages[index];
      const blob = new Blob([page.fileData], { type: mimeFor(page.filename) });
      cache.set(index, blob);
      return blob;
    },
  };
}

export default { loadCbrPages };
