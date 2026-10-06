// IndexedDB persistence layer. This file knows nothing about the UI or the domain:
// it only stores/loads plain records by store name. To add cloud sync later, put a
// second adapter with the same interface next to this one (see store.js).

import { STORE_NAMES } from './models.js';

const DB_NAME = 'planner-local';
const DB_VERSION = 1;
const ALL_STORES = [...STORE_NAMES, 'settings'];

export let persistent = true; // false if IndexedDB is unavailable (e.g. some private modes)
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ALL_STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another tab'));
  }).catch((err) => {
    persistent = false;
    console.warn('Persistence disabled:', err);
    return null;
  });
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export async function loadAll() {
  const db = await open();
  const out = {};
  for (const n of ALL_STORES) out[n] = [];
  if (!db) return out;
  const tx = db.transaction(ALL_STORES, 'readonly');
  await Promise.all(ALL_STORES.map(async (n) => { out[n] = await wrap(tx.objectStore(n).getAll()); }));
  return out;
}

export async function put(store, record) {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(record);
  await done(tx);
}

export async function putMany(store, records) {
  const db = await open();
  if (!db || !records.length) return;
  const tx = db.transaction(store, 'readwrite');
  for (const r of records) tx.objectStore(store).put(r);
  await done(tx);
}

export async function remove(store, id) {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await done(tx);
}

export async function clearAll() {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(ALL_STORES, 'readwrite');
  for (const n of ALL_STORES) tx.objectStore(n).clear();
  await done(tx);
}

// Atomically replace everything (used by import / demo / reset).
export async function replaceAll(data) {
  const db = await open();
  if (!db) return;
  const tx = db.transaction(ALL_STORES, 'readwrite');
  for (const n of ALL_STORES) {
    const os = tx.objectStore(n);
    os.clear();
    for (const r of data[n] || []) os.put(r);
  }
  await done(tx);
}
