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
  SCHEMA_VERSION, SYNC_SETTING_KEYS, uid,
} from './models.js';

const data = Object.fromEntries(STORE_NAMES.map((n) => [n, new Map()]));
let settings = { ...DEFAULT_SETTINGS };
const subs = new Set();
const errorHandlers = new Set();
const mutationHooks = new Set();
const EPOCH = '1970-01-01T00:00:00.000Z'; // seeded defaults lose every conflict against a real edit
let queued = false;

export const onError = (fn) => errorHandlers.add(fn);
const fail = (err) => { console.error(err); errorHandlers.forEach((f) => f(err)); };

// Called after every local mutation: (store, id, deleted, updatedAtISO). The sync engine uses it
// to build its outbox; applyRemote*() below deliberately does NOT fire it.
export const onMutation = (fn) => mutationHooks.add(fn);
const notify = (name, id, deleted, at) => mutationHooks.forEach((f) => f(name, id, deleted, at));

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
  else await normalizeSeedIds();
}

// Seed ids are deterministic so two devices that both seed defaults end up with the SAME rows.
export const seedCategoryId = (i) => `cat_seed_${i}`;
export const seedGroupId = (i) => `grp_seed_${i}`;

async function seedDefaults() {
  if (!data.financeCategories.size) {
    DEFAULT_FINANCE_CATEGORIES.forEach((name, i) => {
      const r = { id: seedCategoryId(i), name, limit: null, archived: false, order: i, createdAt: EPOCH, updatedAt: EPOCH };
      data.financeCategories.set(r.id, r);
    });
  }
  if (!data.roadmapGroups.size) {
    DEFAULT_ROADMAP_GROUPS.forEach((name, i) => {
      const r = { id: seedGroupId(i), name, order: i, createdAt: EPOCH, updatedAt: EPOCH };
      data.roadmapGroups.set(r.id, r);
    });
  }
  settings.seeded = true;
  settings.seedIdsV2 = true;
  await db.replaceAll(snapshotForDb());
}

// One-time migration for data created before ids were deterministic: rename default rows to
// their canonical ids and repoint references, so syncing doesn't create duplicate categories.
async function normalizeSeedIds() {
  if (settings.seedIdsV2) return;
  const remap = (storeName, names, idFn, refs) => {
    names.forEach((name, i) => {
      const target = idFn(i);
      const row = [...data[storeName].values()].find((r) => r.name === name && r.id !== target);
      if (!row || data[storeName].has(target)) return;
      data[storeName].delete(row.id);
      data[storeName].set(target, { ...row, id: target });
      for (const [refStore, field] of refs) for (const r of data[refStore].values()) if (r[field] === row.id) r[field] = target;
    });
  };
  remap('financeCategories', DEFAULT_FINANCE_CATEGORIES, seedCategoryId, [['transactions', 'categoryId'], ['recurringTransactions', 'categoryId']]);
  remap('roadmapGroups', DEFAULT_ROADMAP_GROUPS, seedGroupId, [['roadmapTopics', 'groupId']]);
  settings.seedIdsV2 = true;
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
  notify(name, row.id, false, now);
  emit();
  return row;
}

export function putMany(name, recs) {
  const now = new Date().toISOString();
  const rows = recs.map((rec) => ({ ...rec, id: rec.id || uid(name.slice(0, 3)), createdAt: rec.createdAt || now, updatedAt: now }));
  rows.forEach((r) => data[name].set(r.id, r));
  db.putMany(name, rows).catch(fail);
  rows.forEach((r) => notify(name, r.id, false, now));
  emit();
  return rows;
}

export function remove(name, id) {
  data[name].delete(id);
  db.remove(name, id).catch(fail);
  notify(name, id, true, new Date().toISOString());
  emit();
}

export function updateSettings(patch) {
  const syncs = Object.keys(patch).some((k) => SYNC_SETTING_KEYS.includes(k));
  const now = new Date().toISOString();
  settings = { ...settings, ...patch, ...(syncs ? { syncMod: now } : {}) };
  db.put('settings', { id: 'main', ...settings }).catch(fail);
  if (syncs) notify('settings', 'main', false, now);
  emit();
}

// ---- remote application (sync engine only): silent w.r.t. the outbox -------------
export function applyRemote(name, id, rec, updatedAt) {
  if (rec) {
    const row = { ...rec, id, updatedAt };
    data[name].set(id, row);
    db.put(name, row).catch(fail);
  } else {
    data[name].delete(id);
    db.remove(name, id).catch(fail);
  }
  emit();
}

export function applyRemoteSettings(subset, modISO) {
  settings = { ...settings, ...subset, syncMod: modISO };
  db.put('settings', { id: 'main', ...settings }).catch(fail);
  emit();
}

export const syncableSettings = () => Object.fromEntries(SYNC_SETTING_KEYS.map((k) => [k, settings[k]]));

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

// Snapshot of every record key, so bulk replacements can tell the sync engine what vanished.
const keysOf = () => STORE_NAMES.flatMap((n) => [...data[n].keys()].map((id) => [n, id]));
function notifyReplaced(before) {
  const now = new Date().toISOString();
  const after = new Set(keysOf().map(([n, id]) => `${n}/${id}`));
  for (const [n, id] of before) if (!after.has(`${n}/${id}`)) notify(n, id, true, now);
  for (const n of STORE_NAMES) for (const r of data[n].values()) notify(n, r.id, false, r.updatedAt || now);
  notify('settings', 'main', false, now);
}

export async function replaceAll(payload) {
  const before = keysOf();
  for (const n of STORE_NAMES) {
    const rows = (payload.data?.[n] || []).filter((r) => r && typeof r === 'object' && r.id);
    data[n] = new Map(rows.map((r) => [r.id, r]));
  }
  settings = { ...DEFAULT_SETTINGS, ...(payload.settings || {}), seeded: true, seedIdsV2: false };
  await normalizeSeedIds();
  await db.replaceAll(snapshotForDb());
  notifyReplaced(before);
  emit();
}

export async function resetAll() {
  const before = keysOf();
  for (const n of STORE_NAMES) data[n] = new Map();
  settings = { ...DEFAULT_SETTINGS, theme: settings.theme, language: settings.language };
  await seedDefaults();
  notifyReplaced(before);
  emit();
}
