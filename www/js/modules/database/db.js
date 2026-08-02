/**
 * db.js — Capa de persistencia con IndexedDB.
 * Expone una API basada en Promesas para todos los módulos de la app.
 * Stores: books, bookmarks, notes, settings, history, categories, files.
 */

const DB_NAME = 'librolibre_db';
const DB_VERSION = 2;

const STORES = {
  BOOKS: 'books',
  BOOKMARKS: 'bookmarks',
  NOTES: 'notes',
  SETTINGS: 'settings',
  HISTORY: 'history',
  CATEGORIES: 'categories',
  FILES: 'files',
};

let dbInstance = null;

/**
 * Abre (o crea) la base de datos y define los object stores e índices.
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.BOOKS)) {
        const books = db.createObjectStore(STORES.BOOKS, { keyPath: 'id' });
        books.createIndex('title', 'title', { unique: false });
        books.createIndex('author', 'author', { unique: false });
        books.createIndex('format', 'format', { unique: false });
        books.createIndex('category', 'category', { unique: false });
        books.createIndex('status', 'status', { unique: false });
        books.createIndex('favorite', 'favorite', { unique: false });
        books.createIndex('dateAdded', 'dateAdded', { unique: false });
        books.createIndex('lastOpened', 'lastOpened', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
        const bookmarks = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
        bookmarks.createIndex('bookId', 'bookId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const notes = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        notes.createIndex('bookId', 'bookId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        const history = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
        history.createIndex('bookId', 'bookId', { unique: false });
        history.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.FILES)) {
        // keyPath 'bookId': un blob binario por libro (el archivo original importado)
        db.createObjectStore(STORES.FILES, { keyPath: 'bookId' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error('No se pudo abrir la base de datos: ' + event.target.error));
    };
  });
}

/**
 * Ejecuta una transacción de escritura/lectura genérica.
 */
function runTransaction(storeName, mode, executor) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;

      try {
        result = executor(store);
      } catch (err) {
        reject(err);
        return;
      }

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

/** Envuelve un IDBRequest en una Promesa. */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  STORES,

  /** Inserta o reemplaza un registro. */
  put(storeName, value) {
    return runTransaction(storeName, 'readwrite', (store) => {
      store.put(value);
      return value;
    });
  },

  /** Inserta o reemplaza varios registros en una sola transacción. */
  putMany(storeName, values) {
    return runTransaction(storeName, 'readwrite', (store) => {
      values.forEach((v) => store.put(v));
      return values;
    });
  },

  /** Obtiene un registro por clave. */
  async get(storeName, key) {
    const db = await openDatabase();
    const tx = db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).get(key));
  },

  /** Obtiene todos los registros de un store. */
  async getAll(storeName) {
    const db = await openDatabase();
    const tx = db.transaction(storeName, 'readonly');
    return requestToPromise(tx.objectStore(storeName).getAll());
  },

  /** Obtiene todos los registros que coinciden con un valor de índice. */
  async getAllByIndex(storeName, indexName, value) {
    const db = await openDatabase();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    return requestToPromise(index.getAll(value));
  },

  /** Elimina un registro por clave. */
  delete(storeName, key) {
    return runTransaction(storeName, 'readwrite', (store) => {
      store.delete(key);
      return true;
    });
  },

  /** Vacía completamente un store. */
  clear(storeName) {
    return runTransaction(storeName, 'readwrite', (store) => {
      store.clear();
      return true;
    });
  },

  /** Lee un valor de configuración (con valor por defecto). */
  async getSetting(key, defaultValue = null) {
    const row = await this.get(STORES.SETTINGS, key);
    return row ? row.value : defaultValue;
  },

  /** Guarda un valor de configuración. */
  setSetting(key, value) {
    return this.put(STORES.SETTINGS, { key, value });
  },

  /** Exporta notas, marcadores y configuración como objeto plano (para exportar a JSON). */
  async exportUserData() {
    const [notes, bookmarks, settings] = await Promise.all([
      this.getAll(STORES.NOTES),
      this.getAll(STORES.BOOKMARKS),
      this.getAll(STORES.SETTINGS),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      notes,
      bookmarks,
      settings,
    };
  },
};

// Exponer globalmente (arquitectura sin bundler / módulos ES6 vía <script type="module">)
window.DB = DB;

export default DB;
