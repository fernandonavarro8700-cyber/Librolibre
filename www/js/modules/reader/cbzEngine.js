/**
 * cbzEngine.js — Extracción de páginas de un cómic CBZ (ZIP) usando JSZip
 * (cargado como global `window.JSZip` vía <script> clásico en index.html).
 * Las páginas se extraen de forma perezosa: solo cuando se piden.
 */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;

function mimeFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  return map[ext] || 'application/octet-stream';
}

function isJunkPath(name) {
  return name.startsWith('__MACOSX/') || name.split('/').pop().startsWith('.');
}

/**
 * Abre un CBZ y devuelve un "proveedor de páginas" común a CBZ/CBR:
 * { count, names, getPageBlob(index) }
 */
export async function loadCbzPages(source) {
  const data = source instanceof Blob ? await source.arrayBuffer() : source;
  const zip = await window.JSZip.loadAsync(data);

  const names = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && IMAGE_EXT.test(name) && !isJunkPath(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const cache = new Map();

  return {
    count: names.length,
    names,
    async getPageBlob(index) {
      if (cache.has(index)) return cache.get(index);
      const name = names[index];
      const rawBlob = await zip.file(name).async('blob');
      const blob = new Blob([rawBlob], { type: mimeFor(name) });
      cache.set(index, blob);
      return blob;
    },
  };
}

export default { loadCbzPages };
