// In-memory cache + write-through persistence.
//
// Why a cache? It keeps all view code synchronous and simple (list('tasks') is just
// an array) while IndexedDB remains the source of truth across sessions.
// Every mutation goes through put/remove here, which is also the single place a
// sync adapter (Supabase etc.) would hook in: subscribe to mutations, push records
// with their updatedAt, and call applyRemote() for incoming rows.

import * as db from './db.js';
import {
  STORE_NAMES, DEFAULT_SETTINGS, DEFAULT_FINANCE_CATEGORIES, DEFAULT_ROADMAP_GROUPS,
  SCHEMA_VERSION, uid,
} from './models.js';

const data = Object.fromEntries(STORE_NAMES.map((n) => [n, new Map()]));
let settings = { ...DEFAULT_SETTINGS };
const subs = new Set();
const errorHandlers = new Set();
let queued = false;

export const onError = (fn) => errorHandlers.add(fn);
const fail = (err) => { console.error(err); errorHandlers.forEach((f) => f(err)); };

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// Coalesce bursts of writes (e.g. importing 200 rows) into one UI refresh.
function emit() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; subs.forEach((f) => f()); });
}

export async function init() {
  const loaded = await db.loadAll();
  for (const n of STORE_NAMES) data[n] = new Map((loaded[n] || []).map((r) => [r.id, r]));
  const s = (loaded.settings || []).find((r) => r.id === 'main');
  settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
  // Migration: the untouched old default day (06:00 -> 01:00) becomes 05:00 -> 01:00.
  if (s && s.dayStartMin === 360 && s.dayEndMin === 1500) settings.dayStartMin = 300;
  if (!settings.seeded) await seedDefaults();
}

async function seedDefaults() {
  const now = new Date().toISOString();
  if (!data.financeCategories.size) {
    DEFAULT_FINANCE_CATEGORIES.forEach((name, i) => {
      const r = { id: uid('cat'), name, limit: null, archived: false, order: i, createdAt: now, updatedAt: now };
      data.financeCategories.set(r.id, r);
    });
  }
  if (!data.roadmapGroups.size) {
    DEFAULT_ROADMAP_GROUPS.forEach((name, i) => {
      const r = { id: uid('grp'), name, order: i, createdAt: now, updatedAt: now };
      data.roadmapGroups.set(r.id, r);
    });
  }
  settings.seeded = true;
  await db.replaceAll(snapshotForDb());
}

function snapshotForDb() {
  const out = { settings: [{ id: 'main', ...settings }] };
  for (const n of STORE_NAMES) out[n] = [...data[n].values()];
  return out;
}

// ---- reads -----------------------------------------------------------------
export const list = (name) => [...data[name].values()];
export const get = (name, id) => data[name].get(id);
export const getSettings = () => settings;

// ---- writes ----------------------------------------------------------------
export function put(name, rec) {
  const now = new Date().toISOString();
  const row = { ...rec, id: rec.id || uid(name.slice(0, 3)), createdAt: rec.createdAt || now, updatedAt: now };
  data[name].set(row.id, row);
  db.put(name, row).catch(fail);
  emit();
  return row;
}

export function putMany(name, recs) {
  const now = new Date().toISOString();
  const rows = recs.map((rec) => ({ ...rec, id: rec.id || uid(name.slice(0, 3)), createdAt: rec.createdAt || now, updatedAt: now }));
  rows.forEach((r) => data[name].set(r.id, r));
  db.putMany(name, rows).catch(fail);
  emit();
  return rows;
}

export function remove(name, id) {
  data[name].delete(id);
  db.remove(name, id).catch(fail);
  emit();
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  db.put('settings', { id: 'main', ...settings }).catch(fail);
  emit();
}

// ---- bulk ops: export / import / reset -------------------------------------
export function exportAll() {
  const out = { app: 'planner-local', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings, data: {} };
  for (const n of STORE_NAMES) out.data[n] = list(n);
  return out;
}

export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('File is not a valid export.');
  if (obj.app !== 'planner-local') throw new Error('This file was not exported from this app.');
  if (!obj.data || typeof obj.data !== 'object') throw new Error('Export file has no data section.');
  if (typeof obj.schema === 'number' && obj.schema > SCHEMA_VERSION) throw new Error('Export was made by a newer version of the app.');
  for (const n of STORE_NAMES) {
    if (obj.data[n] !== undefined && !Array.isArray(obj.data[n])) throw new Error(`Invalid data for "${n}".`);
  }
  return true;
}

export async function replaceAll(payload) {
  for (const n of STORE_NAMES) {
    const rows = (payload.data?.[n] || []).filter((r) => r && typeof r === 'object' && r.id);
    data[n] = new Map(rows.map((r) => [r.id, r]));
  }
  settings = { ...DEFAULT_SETTINGS, ...(payload.settings || {}), seeded: true };
  await db.replaceAll(snapshotForDb());
  emit();
}

export async function resetAll() {
  for (const n of STORE_NAMES) data[n] = new Map();
  settings = { ...DEFAULT_SETTINGS, theme: settings.theme };
  await seedDefaults();
  emit();
}
