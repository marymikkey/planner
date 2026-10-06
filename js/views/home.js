// Home: one-off chores (tasks) + routines with gentle weekly completion.
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO } from '../core/dates.js';
import { compareTasks, routineWeek } from '../core/queries.js';
import { Card, PageHead, Btn, TaskRow, Empty, RoutineRow, InlineAdd, Progress } from '../ui/components.js';
import { openRoutineForm } from '../ui/forms.js';

const AREA = 'Home';

export function render(root) {
  const today = todayISO();
  const routines = store.list('routines').filter((r) => r.area === AREA && !r.archived);
  let done = 0, expected = 0;
  for (const r of routines) { const w = routineWeek(r, today); done += Math.min(w.done, w.expected || w.done); expected += w.expected; }
  const open = store.list('tasks').filter((t) => t.area === AREA && t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
  const finished = store.list('tasks').filter((t) => t.area === AREA && t.status === 'Done').sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || '')).slice(0, 8);

  root.append(PageHead('Home', {
    sub: 'Household routines and one-time chores.',
    actions: Btn('New routine', () => openRoutineForm({ area: AREA }), { ic: 'plus' }),
  }));
  root.append(h('div', { class: 'two-col' },
    h('div', { class: 'stack' },
      Card('Routines this week', { sub: expected ? `${done} of ${expected} done so far — whatever fits is enough.` : 'Add a routine to get started.' },
        expected ? Progress(Math.min(100, (done / expected) * 100), { label: 'Weekly routine completion' }) : null,
        routines.length ? h('div', { class: 'routine-list' }, routines.map((r) => RoutineRow(r, today))) : Empty('No routines yet. Try “Vacuum”, “Change bed linen”…')),
    ),
    h('div', { class: 'stack' },
      Card('Chores', { sub: `${open.length} open` },
        InlineAdd({ placeholder: 'Add a chore…', refocusKey: 'home-add', defaults: () => ({ area: AREA }) }),
        open.length ? h('div', { class: 'task-list' }, open.map((t) => TaskRow(t, { showArea: false, showDate: true, today }))) : Empty('No open chores.'),
        finished.length ? h('details', { class: 'done-box' }, h('summary', null, 'Recently done'), h('div', { class: 'task-list' }, finished.map((t) => TaskRow(t, { showArea: false, drag: false })))) : null))));
  if (window.__refocus === 'home-add') { window.__refocus = null; root.querySelector('[data-refocus="home-add"]')?.focus(); }
}
