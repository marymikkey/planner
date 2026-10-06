// Personal: one top-level area with optional subcategories (editable in Settings).
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, relativeDay, fmtMin } from '../core/dates.js';
import { compareTasks } from '../core/queries.js';
import { Card, PageHead, Btn, TaskRow, Empty, InlineAdd, openEntity } from '../ui/components.js';
import { openEventForm } from '../ui/forms.js';
import { openQuickAdd } from '../ui/quickadd.js';
import { addDays } from '../core/dates.js';
import { occursOn } from '../core/recurrence.js';

const AREA = 'Personal';
const ui = { cat: 'All' };

export function render(root, params, { rerender }) {
  const s = store.getSettings();
  const today = todayISO();
  const cats = ['All', ...s.personalCategories];
  const all = store.list('tasks').filter((t) => t.area === AREA);
  const open = all.filter((t) => t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
  const shown = ui.cat === 'All' ? open : open.filter((t) => (t.subcategory || 'Other') === ui.cat);
  const done = all.filter((t) => t.status === 'Done').sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || '')).slice(0, 8);

  const upcoming = [];
  for (const e of store.list('events').filter((x) => x.area === AREA)) {
    for (let i = 0; i < 60; i++) {
      const d = addDays(today, i);
      if (occursOn(e.recurrence, e.date, d) && !(e.exceptions || []).includes(d)) { upcoming.push({ e, d }); break; }
    }
  }
  upcoming.sort((a, b) => a.d.localeCompare(b.d));

  const chips = h('div', { class: 'chips scroll-x', role: 'group', 'aria-label': 'Category filter' }, cats.map((c) => {
    const n = c === 'All' ? open.length : open.filter((t) => (t.subcategory || 'Other') === c).length;
    return h('button', { class: `chip${ui.cat === c ? ' on' : ''}`, type: 'button', 'aria-pressed': String(ui.cat === c), onClick: () => { ui.cat = c; rerender(); } }, `${c}${n ? ` · ${n}` : ''}`);
  }));

  root.append(PageHead('Personal', { sub: 'Social, appointments, errands, admin.', actions: [Btn('Appointment', () => openEventForm({ area: AREA }), { ic: 'plus' })] }), chips);
  root.append(h('div', { class: 'two-col' },
    h('div', { class: 'stack' },
      Card(ui.cat === 'All' ? 'Tasks' : ui.cat, { sub: `${shown.length} open` },
        InlineAdd({ placeholder: `Add ${ui.cat === 'All' ? 'a personal task' : `to ${ui.cat}`}…`, refocusKey: 'pers-add', defaults: () => ({ area: AREA, subcategory: ui.cat === 'All' ? null : ui.cat }) }),
        shown.length ? h('div', { class: 'task-list' }, shown.map((t) => TaskRow(t, { showArea: false, showDate: true, today }))) : Empty('Nothing here.'),
        done.length ? h('details', { class: 'done-box' }, h('summary', null, 'Recently done'), h('div', { class: 'task-list' }, done.map((t) => TaskRow(t, { showArea: false, drag: false })))) : null)),
    h('div', { class: 'stack' },
      Card('Upcoming appointments & plans', null, upcoming.length ? h('ul', { class: 'plain-list' }, upcoming.map(({ e, d }) => h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openEntity({ kind: 'event', ref: e }), onKeydown: (k) => { if (k.key === 'Enter') openEntity({ kind: 'event', ref: e }); } },
        h('strong', null, e.title), h('span', { class: 'muted small' }, `${relativeDay(d)} · ${fmtMin(e.startMin)}`)))) : Empty('Nothing on the calendar.')))));
  if (window.__refocus === 'pers-add') { window.__refocus = null; root.querySelector('[data-refocus="pers-add"]')?.focus(); }
}
