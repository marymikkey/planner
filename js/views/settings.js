// Settings: appearance, planner range, units, customisation, and data management.
import { h, toast, icon } from '../ui/dom.js';
import { fmtDate } from '../core/dates.js';
import * as store from '../core/store.js';
import { AREAS, AREA_META, CURRENCIES } from '../core/models.js';
import { fmtMin } from '../core/dates.js';
import { exportJSON, importJSON, exportCSV, CSV_DATASETS } from '../core/io.js';
import { loadDemoData } from '../core/demo.js';
import { Card, PageHead, Btn, Empty } from '../ui/components.js';
import * as C from '../ui/controls.js';
import { confirmDialog } from '../ui/modal.js';
import { openMetricForm } from '../ui/forms.js';
import { applyTheme } from '../theme.js';
import { persistent } from '../core/db.js';
import * as sync from '../core/sync.js';

function tagEditor(values, onChange, placeholder) {
  const wrap = h('div', { class: 'chips' });
  const build = () => {
    wrap.replaceChildren(...values.map((v, i) => h('span', { class: 'chip removable' }, v,
      h('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${v}`, onClick: () => { values.splice(i, 1); onChange([...values]); build(); } }, '×'))),
    h('input', { class: 'chip-input', placeholder, 'aria-label': placeholder, onKeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v && !values.includes(v)) { values.push(v); onChange([...values]); build(); wrap.querySelector('input').focus(); } }
    } }));
  };
  build();
  return wrap;
}

export function render(root, params, { rerender }) {
  const renderAgain = rerender;
  const s = store.getSettings();
  root.append(PageHead('Settings', { sub: 'Everything stays on this device.' }));

  // Appearance
  const theme = C.segmented([{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }], s.theme, { label: 'Theme', onChange: (v) => { store.updateSettings({ theme: v }); applyTheme(v); } });
  const language = C.segmented([{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }], s.language || 'ru', { label: 'Language', onChange: (v) => store.updateSettings({ language: v }) });
  const appearance = Card('Appearance', null, C.field('Theme', theme), C.field('Language', language));

  // Planner
  const start = C.timeInput(s.dayStartMin % 1440);
  const end = C.timeInput(s.dayEndMin % 1440);
  const saveRange = () => {
    const a = start.get() ?? 360;
    let b = end.get() ?? 60;
    if (b <= a) b += 1440;
    store.updateSettings({ dayStartMin: a, dayEndMin: b });
  };
  start.input.addEventListener('change', saveRange); end.input.addEventListener('change', saveRange);
  const weekStart = C.select([{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }, { value: '6', label: 'Saturday' }], String(s.weekStart));
  weekStart.onChange(() => store.updateSettings({ weekStart: Number(weekStart.get()) }));
  const planner = Card('Planner', { sub: 'The timeline expands automatically if something falls outside this range.' },
    h('div', { class: 'row3' }, C.field('Day starts', start), C.field('Day ends', end, { hint: 'An earlier time than the start means after midnight.' }), C.field('Week starts', weekStart)),
    Btn('Reset to 05:00 → 01:00', () => store.updateSettings({ dayStartMin: 300, dayEndMin: 1500 }), { kind: 'small' }));

  // Meals
  const macros = C.checkbox('Enable calories & macros', s.macros);
  macros.input.addEventListener('change', () => store.updateSettings({ macros: macros.get() }));
  const meals = Card('Meals', null, macros.el, h('p', { class: 'muted small' }, 'Off by default. When on, meals get optional calories, protein, fat and carbs fields.'));

  // Finance
  const currency = C.select(Object.entries(CURRENCIES).map(([code, sym]) => ({ value: code, label: `${code} (${sym})` })), s.currency);
  currency.onChange(() => store.updateSettings({ currency: currency.get() }));
  const finance = Card('Finance', null, C.field('Currency', currency), h('p', { class: 'muted small' }, 'Categories and limits are managed on the Finance page.'));

  // Customisation
  const colors = h('div', { class: 'color-grid' }, AREAS.map((a) => {
    const val = s.areaColors?.[a] || AREA_META[a].color;
    const input = h('input', { type: 'color', value: val, 'aria-label': `${a} colour`, onChange: (e) => store.updateSettings({ areaColors: { ...store.getSettings().areaColors, [a]: e.target.value } }) });
    return h('label', { class: 'color-item' }, input, h('span', null, a));
  }));
  const custom = Card('Customisation', null,
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Area colours'), colors,
      Btn('Reset colours', () => store.updateSettings({ areaColors: {} }), { kind: 'small' })),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Personal subcategories'), tagEditor([...s.personalCategories], (v) => store.updateSettings({ personalCategories: v }), 'Add subcategory + Enter')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Meal tags'), tagEditor([...s.mealTags], (v) => store.updateSettings({ mealTags: v }), 'Add tag + Enter')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Finance categories'), h('a', { class: 'btn small', href: '#/finance' }, 'Manage on Finance page')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Custom health metrics'),
      store.list('customMetrics').filter((m) => !m.archived).length
        ? h('div', { class: 'chips' }, store.list('customMetrics').filter((m) => !m.archived).map((m) => h('button', { class: 'chip', type: 'button', onClick: () => openMetricForm(m) }, m.name)))
        : h('p', { class: 'muted small' }, 'None yet.'),
      Btn('Add metric', () => openMetricForm({}), { kind: 'small', ic: 'plus' })));


  // Sync (optional, end-to-end encrypted through the user's own Supabase project)
  const syncCard = (() => {
    const st = sync.status;
    const stateText = { off: '', idle: 'Synced', syncing: 'Syncing…', offline: 'Offline — will retry', error: st.message || 'Sync error' }[st.state];
    if (sync.isConnected()) {
      const acc = sync.account();
      const last = st.lastSync ? new Date(st.lastSync).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';
      return Card('Sync', { sub: `Account: ${acc.email}` },
        h('p', { class: st.state === 'error' ? 'notice' : 'muted' }, `${stateText} · Last sync: ${last}${sync.pendingCount() ? ` · waiting to send: ${sync.pendingCount()}` : ''}`),
        h('div', { class: 'btn-row' },
          Btn('Sync now', () => sync.syncNow(), { kind: 'primary' }),
          Btn('Copy connection code', async () => { try { await navigator.clipboard.writeText(sync.makeConnectionCode()); toast('Code copied'); } catch { toast('Could not copy'); } }),
          Btn('Disconnect', async () => { if (await confirmDialog('Sync stops on this device. Your data stays here and in the cloud.', { confirmLabel: 'Disconnect', title: 'Disconnect sync', danger: false })) sync.disconnect(); renderAgain(); }, { kind: 'danger-text' })),
        h('p', { class: 'muted small' }, 'Data is encrypted on this device with your passphrase before it is uploaded. If you forget the passphrase, the cloud copy cannot be recovered.'));
    }
    const f = {
      code: C.textInput('', { placeholder: 'Paste the code from your other device (optional)' }),
      url: C.textInput('', { placeholder: 'https://xxxx.supabase.co' }),
      key: C.textInput('', { placeholder: 'anon / publishable key' }),
      email: C.textInput('', { type: 'email', placeholder: 'email' }),
      pass: C.textInput('', { type: 'password', placeholder: 'Account password' }),
      phrase: C.textInput('', { type: 'password', placeholder: 'Encryption passphrase' }),
    };
    f.email.input.setAttribute('autocomplete', 'email'); f.pass.input.setAttribute('autocomplete', 'current-password');
    f.code.input.addEventListener('input', () => { const p = sync.parseConnectionCode(f.code.get()); if (p) { f.url.set(p.url); f.key.set(p.anonKey); } });
    const go = async (signup) => {
      try {
        await sync.connect({ url: f.url.get(), anonKey: f.key.get(), email: f.email.get(), password: f.pass.input.value, passphrase: f.phrase.input.value, signup });
        toast('Sync connected'); renderAgain();
      } catch (e) { toast(e.message || String(e), { ms: 7000 }); }
    };
    return Card('Sync', { sub: 'Keep your phone and laptop in step. Optional and off by default.' },
      h('p', { class: 'muted small' }, 'Uses your own free Supabase project (see docs/SYNC_SETUP.md). Everything is encrypted on your device before upload.'),
      C.field('Connection code', f.code),
      h('div', { class: 'row2' }, C.field('Project URL', f.url), C.field('Anon key', f.key)),
      h('div', { class: 'row2' }, C.field('Email', f.email), C.field('Account password', f.pass)),
      C.field('Encryption passphrase', f.phrase, { hint: 'Use the same passphrase on every device. It never leaves this device.' }),
      h('div', { class: 'btn-row' }, Btn('Sign in & connect', () => go(false), { kind: 'primary' }), Btn('Create account & connect', () => go(true))),
      h('details', { class: 'more' }, h('summary', null, 'SQL for the Supabase project'),
        h('pre', { class: 'code', 'data-no-i18n': '' }, sync.SETUP_SQL),
        Btn('Copy SQL', async () => { try { await navigator.clipboard.writeText(sync.SETUP_SQL); toast('SQL copied'); } catch { toast('Could not copy'); } }, { kind: 'small' })));
  })();

  // Data
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!(await confirmDialog('Importing replaces everything currently stored on this device with the contents of the file. Export a backup first if unsure.', { confirmLabel: 'Replace my data', title: 'Import data', danger: true }))) return;
    try { await importJSON(f); toast('Import complete'); } catch (err) { toast(`Import failed: ${err.message}`); }
  } });
  const csvKey = C.select(Object.entries(CSV_DATASETS).map(([k, d]) => ({ value: k, label: d.label })), 'tasks');
  const data = Card('Data', { sub: persistent ? (sync.isConnected() ? 'Stored in this browser (IndexedDB) and, encrypted, in your own cloud project.' : 'Stored in this browser (IndexedDB). Nothing is sent anywhere.') : 'Storage is unavailable in this browser mode, so data will not persist after closing. Export regularly.' },
    s.demo ? h('p', { class: 'notice' }, 'You are viewing synthetic demo data.') : null,
    h('div', { class: 'btn-row' }, Btn('Export JSON', exportJSON, { ic: 'arrow' }), Btn('Import JSON…', () => fileInput.click()), fileInput),
    h('div', { class: 'row2 align-end' }, C.field('CSV dataset', csvKey), Btn('Export CSV', () => exportCSV(csvKey.get()))),
    h('hr'),
    h('div', { class: 'btn-row' },
      Btn('Load demo data', async () => {
        if (sync.isConnected()) { toast('Disconnect sync first: demo data would be uploaded to your cloud.', { ms: 6000 }); return; }
        if (!(await confirmDialog('This replaces your local data with fictional demo content. Export a backup first if you have real data.', { confirmLabel: 'Load demo', title: 'Load demo data', danger: false }))) return;
        await loadDemoData(); toast('Demo data loaded');
      }),
      Btn('Reset all data', async () => {
        if (!(await confirmDialog(sync.isConnected() ? 'Sync is on: this deletes your data on this device AND in the cloud (all devices). Consider exporting a backup first.' : 'This permanently deletes everything stored on this device (tasks, health, finance, settings). Consider exporting a backup first.', { confirmLabel: 'Delete everything', title: 'Reset all data' }))) return;
        await store.resetAll(); toast('All local data cleared');
      }, { kind: 'danger-text' })));

  const about = Card('About & privacy', null, h('p', { class: 'muted' }, 'This app runs entirely in your browser. There is no analytics and no server of ours. Your data stays on this device unless you export it or turn on optional sync, which uploads only encrypted data to your own Supabase project. It works offline once loaded and can be installed from the Share / browser menu.'));

  root.append(h('div', { class: 'stack' }, appearance, planner, meals, finance, custom, syncCard, data, about));
}
