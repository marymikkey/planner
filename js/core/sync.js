// Optional cloud sync through a Supabase project (plain REST, no SDK, no third-party scripts).
//
// Design
//  - One generic table `records(user_id, store, id, updated_at, deleted, payload, server_at)`.
//    Each local record becomes one row; the whole record is AES-GCM encrypted on this device with a
//    key derived from the user's passphrase (PBKDF2). The server only ever sees ciphertext plus
//    {store, id, updated_at, deleted}.
//  - Conflict rule: last write wins per record, by the client's `updatedAt`.
//  - Deletes are tombstones (deleted=true) so they propagate.
//  - Pull is incremental via `server_at` (set by a DB trigger, so device clocks don't matter for it).
//  - Local changes are queued in an outbox (localStorage) and pushed shortly after each edit; the
//    app stays fully usable offline and catches up on reconnect / focus / every minute.
//  - Settings: only SYNC_SETTING_KEYS travel (theme, language, ... stay per device).
// Everything is inert until the user connects an account in Settings.

import * as store from './store.js';
import { STORE_NAMES } from './models.js';

const CFG_KEY = 'planner-sync';
const OUTBOX_KEY = 'planner-sync-outbox';
const CANARY = 'planner-ok';
const PAGE = 500;

export const SETUP_SQL = `create table if not exists public.records (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null,
  id text not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  payload text,
  server_at timestamptz not null default now(),
  primary key (user_id, store, id)
);
create index if not exists records_pull on public.records (user_id, server_at);
alter table public.records enable row level security;
create policy "own select" on public.records for select using (auth.uid() = user_id);
create policy "own insert" on public.records for insert with check (auth.uid() = user_id);
create policy "own update" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.records for delete using (auth.uid() = user_id);
create or replace function public.touch_server_at() returns trigger language plpgsql as $$
begin new.server_at = now(); return new; end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_server_at();`;

// ---- tiny helpers --------------------------------------------------------------
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
const exportKey = async (k) => b64(new Uint8Array(await crypto.subtle.exportKey('raw', k)));
const importKey = (s) => crypto.subtle.importKey('raw', unb64(s), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64(out);
}
async function decrypt(key, data) {
  const raw = unb64(data);
  return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12)));
}

// ---- state ---------------------------------------------------------------------
let cfg = readJSON(CFG_KEY);
let outbox = new Map((readJSON(OUTBOX_KEY) || []).map((o) => [`${o.store}/${o.id}`, o]));
let cryptoKey = null;
let timer = null, pollTimer = null, running = false, again = false, started = false;

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* storage blocked */ } };
const saveOutbox = () => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()])); } catch { /* storage blocked */ } };

export const status = { state: cfg ? 'idle' : 'off', message: '', lastSync: cfg?.lastSync || null };
const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
function setStatus(state, message = '') {
  status.state = state; status.message = message; status.lastSync = cfg?.lastSync || null;
  listeners.forEach((f) => f(status));
}

export const isConnected = () => !!cfg;
export const account = () => (cfg ? { email: cfg.email, url: cfg.url } : null);
export const pendingCount = () => outbox.size;

// ---- REST ----------------------------------------------------------------------
function errText(text, code) {
  try { const j = JSON.parse(text); return j.msg || j.message || j.error_description || j.error || `HTTP ${code}`; } catch { return `HTTP ${code}`; }
}

async function raw(url, anonKey, path, { method = 'GET', body, headers = {}, token } = {}) {
  const res = await fetch(url + path, {
    method, body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  });
  const text = await res.text();
  if (!res.ok) { const e = new Error(errText(text, res.status)); e.status = res.status; throw e; }
  return text ? JSON.parse(text) : null;
}

async function refreshSession() {
  const s = await raw(cfg.url, cfg.anonKey, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: cfg.refresh } });
  applySession(s);
}
function applySession(s) {
  cfg.access = s.access_token; cfg.refresh = s.refresh_token;
  cfg.expiresAt = Date.now() + (s.expires_in || 3600) * 1000;
  if (s.user?.id) cfg.userId = s.user.id;
  saveCfg();
}
async function api(path, opts = {}) {
  if (cfg.expiresAt - Date.now() < 60000) await refreshSession();
  return raw(cfg.url, cfg.anonKey, path, { ...opts, token: cfg.access });
}

// ---- connect / disconnect --------------------------------------------------------
export const makeConnectionCode = () => (cfg ? btoa(JSON.stringify({ u: cfg.url, k: cfg.anonKey })) : '');
export function parseConnectionCode(code) {
  try { const j = JSON.parse(atob(code.trim())); return { url: j.u, anonKey: j.k }; } catch { return null; }
}

export async function connect({ url, anonKey, email, password, passphrase, signup }) {
  url = (url || '').trim().replace(/\/+$/, '');
  anonKey = (anonKey || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error('Адрес проекта должен выглядеть как https://xxxx.supabase.co');
  if (!anonKey || !email || !password || !passphrase) throw new Error('Заполните все поля.');

  const path = signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
  const session = await raw(url, anonKey, path, { method: 'POST', body: { email: email.trim(), password } });
  if (!session?.access_token) throw new Error('Аккаунт создан. Подтвердите почту по ссылке из письма, затем нажмите «Войти».');

  const next = { url, anonKey, email: email.trim() };
  const prev = cfg;
  cfg = next;
  applySession(session);
  try {
    // Shared salt + canary live in a plaintext meta row so every device derives the same key.
    const rows = await api('/rest/v1/records?select=payload&store=eq._meta&id=eq.key');
    let key;
    if (rows.length) {
      const meta = JSON.parse(rows[0].payload);
      key = await deriveKey(passphrase, unb64(meta.salt));
      try { if ((await decrypt(key, meta.canary)) !== CANARY) throw new Error(); } catch { throw new Error('Неверная парольная фраза для этого аккаунта.'); }
    } else {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      key = await deriveKey(passphrase, salt);
      const meta = { salt: b64(salt), canary: await encrypt(key, CANARY) };
      await api('/rest/v1/records?on_conflict=user_id,store,id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: [{ user_id: cfg.userId, store: '_meta', id: 'key', updated_at: new Date().toISOString(), deleted: false, payload: JSON.stringify(meta) }],
      });
    }
    cfg.keyB64 = await exportKey(key);
    cryptoKey = await importKey(cfg.keyB64);
  } catch (e) {
    cfg = prev; cryptoKey = null;
    throw e;
  }
  cfg.cursor = null;
  saveCfg();
  markAllDirty(); // first connect: merge both directions
  startSync();
  await syncNow();
}

export function disconnect() {
  cfg = null; cryptoKey = null; outbox = new Map();
  try { localStorage.removeItem(CFG_KEY); localStorage.removeItem(OUTBOX_KEY); } catch { /* ignore */ }
  clearTimeout(timer); clearInterval(pollTimer); pollTimer = null;
  setStatus('off');
}

function markAllDirty() {
  const now = new Date().toISOString();
  for (const n of STORE_NAMES) for (const r of store.list(n)) outbox.set(`${n}/${r.id}`, { store: n, id: r.id, deleted: false, updatedAt: r.updatedAt || now });
  // Only a device whose settings were actually edited may push them; a fresh install must not
  // overwrite the account's settings with defaults.
  const mod = store.getSettings().syncMod;
  if (mod) outbox.set('settings/main', { store: 'settings', id: 'main', deleted: false, updatedAt: mod });
  saveOutbox();
}

// ---- pull / push ------------------------------------------------------------------
async function ensureKey() {
  if (!cryptoKey) cryptoKey = await importKey(cfg.keyB64);
  return cryptoKey;
}

async function applyRow(r) {
  const t = Date.parse(r.updated_at);
  const queued = outbox.get(`${r.store}/${r.id}`);
  if (queued && Date.parse(queued.updatedAt) >= t) return; // our pending change is newer
  if (r.store === 'settings') {
    if (r.deleted || !r.payload) return;
    const mine = store.getSettings().syncMod ? Date.parse(store.getSettings().syncMod) : 0;
    if (t > mine) store.applyRemoteSettings(JSON.parse(await decrypt(cryptoKey, r.payload)), new Date(t).toISOString());
    return;
  }
  if (!STORE_NAMES.includes(r.store)) return;
  const local = store.get(r.store, r.id);
  if (local && Date.parse(local.updatedAt) >= t) return;
  if (r.deleted) { if (local) store.applyRemote(r.store, r.id, null); return; }
  store.applyRemote(r.store, r.id, JSON.parse(await decrypt(cryptoKey, r.payload)), new Date(t).toISOString());
}

async function pull() {
  let cursor = cfg.cursor || '1970-01-01T00:00:00Z';
  for (;;) {
    const rows = await api(`/rest/v1/records?select=store,id,updated_at,deleted,payload,server_at&store=neq._meta&server_at=gte.${encodeURIComponent(cursor)}&order=server_at.asc&limit=${PAGE}`);
    for (const r of rows) await applyRow(r);
    if (!rows.length) break;
    const last = rows[rows.length - 1].server_at;
    const moved = last !== cursor;
    cursor = last;
    if (rows.length < PAGE || !moved) break;
  }
  cfg.cursor = cursor;
  saveCfg();
}

async function push() {
  const items = [...outbox.values()];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const rows = await Promise.all(chunk.map(async (o) => {
      let deleted = o.deleted, payload = null, updated_at = o.updatedAt;
      if (!deleted) {
        const rec = o.store === 'settings' ? store.syncableSettings() : store.get(o.store, o.id);
        if (!rec) deleted = true;
        else {
          payload = await encrypt(cryptoKey, JSON.stringify(rec));
          updated_at = o.store === 'settings' ? (store.getSettings().syncMod || o.updatedAt) : (rec.updatedAt || o.updatedAt);
        }
      }
      return { user_id: cfg.userId, store: o.store, id: o.id, updated_at, deleted, payload };
    }));
    await api('/rest/v1/records?on_conflict=user_id,store,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows });
    for (const o of chunk) {
      const k = `${o.store}/${o.id}`;
      if (outbox.get(k)?.updatedAt === o.updatedAt) outbox.delete(k);
    }
    saveOutbox();
  }
}

export async function syncNow() {
  if (!cfg) return;
  if (running) { again = true; return; }
  running = true;
  setStatus('syncing');
  try {
    await ensureKey();
    await pull();
    await push();
    cfg.lastSync = Date.now();
    saveCfg();
    setStatus('idle');
  } catch (e) {
    console.warn('Sync failed:', e);
    if (!navigator.onLine || e instanceof TypeError) setStatus('offline');
    else if (e.status === 400 || e.status === 401 || e.status === 403) setStatus('error', 'Нужно войти заново: отключите синхронизацию и подключитесь снова.');
    else setStatus('error', e.message);
  } finally {
    running = false;
    if (again) { again = false; schedule(800); }
  }
}

function schedule(ms) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }

// Wire into the store once (idempotent); the hooks do nothing while disconnected.
function installHooks() {
  if (started) return;
  started = true;
  store.onMutation((name, id, deleted, at) => {
    if (!cfg) return;
    outbox.set(`${name}/${id}`, { store: name, id, deleted, updatedAt: at });
    saveOutbox();
    schedule(2500);
  });
  document.addEventListener('visibilitychange', () => { if (cfg && !document.hidden) syncNow(); });
  window.addEventListener('online', () => syncNow());
}

export function startSync() {
  installHooks();
  if (!cfg) return;
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  syncNow();
}

// Called once at boot.
export const initSync = startSync;
