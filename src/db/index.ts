import type { ChatThread, Simulation, SettingEntry } from './types';

export type { ChatThread, ChatMessage, Simulation, SettingEntry } from './types';

const DB_NAME = 'march_madness_ai';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // settings – key/value store keyed on "key"
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // chatThreads – keyed on "id", indexed by updatedAt for listing
      if (!db.objectStoreNames.contains('chatThreads')) {
        const threadStore = db.createObjectStore('chatThreads', { keyPath: 'id' });
        threadStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // simulations – keyed on "id", indexed by createdAt for listing
      if (!db.objectStoreNames.contains('simulations')) {
        const simStore = db.createObjectStore('simulations', { keyPath: 'id' });
        simStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB();
  // Reset the cached reference if the db is unexpectedly closed.
  dbInstance.onclose = () => {
    dbInstance = null;
  };
  return dbInstance;
}

/** Wrap a single IDBRequest in a Promise. */
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Wrap an entire transaction completion in a Promise. */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize / open the database. Safe to call multiple times – subsequent
 * calls return the cached connection.
 */
export async function initDB(): Promise<void> {
  await getDB();
}

// --- Settings --------------------------------------------------------------

export async function getSetting<T = any>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const tx = db.transaction('settings', 'readonly');
  const store = tx.objectStore('settings');
  const entry: SettingEntry | undefined = await req(store.get(key));
  return entry?.value as T | undefined;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('settings', 'readwrite');
  const store = tx.objectStore('settings');
  store.put({ key, value } satisfies SettingEntry);
  await txDone(tx);
}

// --- Chat Threads ----------------------------------------------------------

export async function getThread(id: string): Promise<ChatThread | undefined> {
  const db = await getDB();
  const tx = db.transaction('chatThreads', 'readonly');
  const store = tx.objectStore('chatThreads');
  return req(store.get(id));
}

export async function saveThread(thread: ChatThread): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chatThreads', 'readwrite');
  const store = tx.objectStore('chatThreads');
  store.put(thread);
  await txDone(tx);
}

export async function listThreads(): Promise<ChatThread[]> {
  const db = await getDB();
  const tx = db.transaction('chatThreads', 'readonly');
  const store = tx.objectStore('chatThreads');
  const index = store.index('updatedAt');

  // Walk the index in descending order so newest threads come first.
  return new Promise((resolve, reject) => {
    const results: ChatThread[] = [];
    const cursor = index.openCursor(null, 'prev');
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        results.push(c.value as ChatThread);
        c.continue();
      } else {
        resolve(results);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteThread(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('chatThreads', 'readwrite');
  const store = tx.objectStore('chatThreads');
  store.delete(id);
  await txDone(tx);
}

// --- Simulations -----------------------------------------------------------

export async function getSimulation(id: string): Promise<Simulation | undefined> {
  const db = await getDB();
  const tx = db.transaction('simulations', 'readonly');
  const store = tx.objectStore('simulations');
  return req(store.get(id));
}

export async function saveSimulation(sim: Simulation): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('simulations', 'readwrite');
  const store = tx.objectStore('simulations');
  store.put(sim);
  await txDone(tx);
}

export async function listSimulations(): Promise<Simulation[]> {
  const db = await getDB();
  const tx = db.transaction('simulations', 'readonly');
  const store = tx.objectStore('simulations');
  const index = store.index('createdAt');

  // Newest first.
  return new Promise((resolve, reject) => {
    const results: Simulation[] = [];
    const cursor = index.openCursor(null, 'prev');
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        results.push(c.value as Simulation);
        c.continue();
      } else {
        resolve(results);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

export async function deleteSimulation(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('simulations', 'readwrite');
  const store = tx.objectStore('simulations');
  store.delete(id);
  await txDone(tx);
}
