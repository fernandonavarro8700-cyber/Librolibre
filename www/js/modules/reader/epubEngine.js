/**
 * epubEngine.js — Wrapper delgado sobre epub.js (cargado como global `ePub` vía
 * <script> clásico en index.html, junto con JSZip). Aísla el resto de la app
 * de la API de la librería.
 */

/**
 * Abre un EPUB a partir de un Blob/File o ArrayBuffer.
 * @returns {Promise<Book>} instancia de epub.js ya con metadata cargada
 */
export async function loadEpubBook(source) {
  const data = source instanceof Blob ? await source.arrayBuffer() : source;
  const book = window.ePub(data);
  await book.ready;
  return book;
}

/** Extrae título, autor y portada (dataURL) de un EPUB recién importado. */
export async function extractEpubMetadata(book) {
  const metadata = await book.loaded.metadata;
  let cover = null;

  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) cover = await blobUrlToDataURL(coverUrl);
  } catch (err) {
    // Algunos EPUB no declaran portada; se usará el gradiente de respaldo.
  }

  const nav = await book.loaded.navigation;
  const spineLength = book.spine ? book.spine.length : (nav.toc ? nav.toc.length : 0);

  return {
    title: metadata.title || null,
    author: metadata.creator || null,
    chapters: spineLength,
    cover,
  };
}

async function blobUrlToDataURL(blobUrl) {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Busca un texto en todo el libro, capítulo por capítulo, devolviendo
 * fragmentos con un CFI exacto al que se puede saltar.
 * @returns {Promise<Array<{cfi:string, label:string, snippet:string}>>}
 */
export async function searchEpub(book, query) {
  const q = query.trim();
  if (!q) return [];
  const qLower = q.toLowerCase();
  const results = [];

  for (const item of book.spine.spineItems) {
    if (results.length >= 200) break;
    try {
      const section = item;
      await section.load(book.load.bind(book));
      const doc = section.document;
      const bodyText = doc.body ? doc.body.textContent : '';
      const lower = bodyText.toLowerCase();

      let searchIdx = lower.indexOf(qLower);
      while (searchIdx !== -1 && results.length < 200) {
        const range = findRangeForTextOffset(doc, searchIdx, q.length);
        if (range) {
          const start = Math.max(0, searchIdx - 26);
          const end = Math.min(bodyText.length, searchIdx + q.length + 26);
          const snippet = (start > 0 ? '…' : '') + bodyText.slice(start, end) + (end < bodyText.length ? '…' : '');
          try {
            const cfi = section.cfiFromRange(range);
            results.push({ cfi, label: section.href, snippet });
          } catch (err) {
            // Rango no serializable a CFI: se omite este match puntual.
          }
        }
        searchIdx = lower.indexOf(qLower, searchIdx + q.length);
      }

      section.unload();
    } catch (err) {
      // Capítulo no cargable (recurso faltante, etc.): se omite y se sigue.
    }
  }

  return results;
}

/** Recorre los nodos de texto del documento para construir un Range en el offset dado. */
function findRangeForTextOffset(doc, targetOffset, length) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  let node;
  let cumulative = 0;

  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent.length;
    if (cumulative + nodeLength > targetOffset) {
      const range = doc.createRange();
      const startOffset = targetOffset - cumulative;
      range.setStart(node, Math.max(0, Math.min(startOffset, nodeLength)));

      // Extiende el rango hasta cubir `length` caracteres, avanzando de nodo si hace falta.
      let remaining = length - (nodeLength - startOffset);
      let endNode = node;
      let endOffset = Math.min(startOffset + length, nodeLength);

      while (remaining > 0) {
        const next = walker.nextNode();
        if (!next) break;
        endNode = next;
        endOffset = Math.min(remaining, next.textContent.length);
        remaining -= next.textContent.length;
      }

      range.setEnd(endNode, Math.max(0, endOffset));
      return range;
    }
    cumulative += nodeLength;
  }
  return null;
}

export default { loadEpubBook, extractEpubMetadata, searchEpub };
