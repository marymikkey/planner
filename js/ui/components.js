// Shared presentational building blocks used across views.
import { h, icon, toast } from './dom.js';
import { draggable } from './dnd.js';
import { actionSheet, confirmDialog, openSheet } from './modal.js';
import * as C from './controls.js';
import * as store from '../core/store.js';
import * as A from '../core/actions.js';
import { areaColor, makeTask as A_makeTask } from '../core/models.js';
import { isOverdue, effectiveDate, routineWeek, routineLogged } from '../core/queries.js';
import { todayISO, addDays, relativeDay, fmtDur, fmtMin, fmtDate } from '../core/dates.js';
import { describe } from '../core/recurrence.js';
import { openTaskForm, openRoutineForm, openEventForm } from './forms.js';

export const Card = (title, opts, ...children) => {
  const { actions, className = '', sub } = opts || {};
  return h('section', { class: `card ${className}` },
    title || actions ? h('header', { class: 'card-head' }, h('div', null, title ? h('h2', null, title) : null, sub ? h('p', { class: 'muted small' }, sub) : null), actions ? h('div', { class: 'card-actions' }, actions) : null) : null,
    ...children);
};

export const Empty = (text) => h('p', { class: 'empty' }, text);

export const Progress = (value, { color, label } = {}) =>
  h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label || 'Progress', style: color ? { '--area': color } : null },
    h('div', { class: 'progress-fill', style: { width: `${Math.max(0, Math.min(100, value))}%` } }));

export const AreaDot = (area) => h('i', { class: 'dot', style: { background: areaColor(area, store.getSettings()) }, title: area });

export const PageHead = (title, { sub, actions, back } = {}) =>
  h('header', { class: 'page-head' },
    back ? h('a', { class: 'back-link', href: back.href }, icon('chevL', 16), back.label) : null,
    h('div', { class: 'page-head-row' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null), actions ? h('div', { class: 'page-actions' }, actions) : null));

export const Btn = (label, onClick, { kind = '', ic } = {}) =>
  h('button', { class: `btn ${kind}`, type: 'button', onClick }, ic ? icon(ic, 16) : null, label);

export function pickDate(title, initial, onPick) {
  const input = C.dateInput(initial || todayISO());
  const dlg = openSheet({
    title, body: h('div', { class: 'form-body' }, C.field('Date', input)),
    footer: [h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => { if (input.get()) { onPick(input.get()); dlg.close(); } } }, 'Move here')],
  });
  dlg.sheet.classList.add('small');
}

// ---- Task row --------------------------------------------------------------
export function taskMenu(task) {
  const today = todayISO();
  const scheduled = task.scheduledDate && task.startMin != null;
  actionSheet(task.title, [
    { label: 'Edit', icon: 'edit', onClick: () => openTaskForm(task) },
    { label: 'Do today', icon: 'today', onClick: () => A.moveTaskToDay(task, today) },
    { label: 'Postpone to tomorrow', icon: 'arrow', onClick: () => { A.postponeTask(task, 1); toast('Moved to tomorrow'); } },
    { label: 'Reschedule to a date…', icon: 'planner', onClick: () => pickDate('Reschedule', effectiveDate(task), (d) => A.moveTaskToDay(task, d)) },
    scheduled ? { label: 'Remove time block', icon: 'clock', onClick: () => A.unscheduleTask(task) } : null,
    task.status !== 'Inbox' && task.status !== 'Done' ? { label: 'Move to Inbox', icon: 'inbox', onClick: () => store.put('tasks', { ...task, status: 'Inbox', dueDate: null, scheduledDate: null, startMin: null, endMin: null }) } : null,
    { label: 'Duplicate', icon: 'copy', onClick: () => { A.duplicateTask(task); toast('Duplicated'); } },
    task.status !== 'Skipped' ? { label: 'Skip', icon: 'x', onClick: () => A.setStatus(task, 'Skipped') } : { label: 'Restore', icon: 'repeat', onClick: () => A.setStatus(task, 'Planned') },
    { label: 'Delete', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog('Delete this task?')) { const copy = task; store.remove('tasks', task.id); toast('Task deleted', { action: 'Undo', onAction: () => store.put('tasks', copy) }); } } },
  ]);
}

export function TaskRow(task, { showArea = true, drag = true, today = todayISO(), showDate = false } = {}) {
  const color = areaColor(task.area, store.getSettings());
  const over = isOverdue(task, today);
  const done = task.status === 'Done';
  const proj = task.projectId ? store.get('projects', task.projectId)?.name : task.subjectId ? store.get('subjects', task.subjectId)?.name : task.subcategory;
  const ed = effectiveDate(task);
  const meta = [];
  if (showArea) meta.push(h('span', { class: 'meta-area' }, h('i', { class: 'dot' }), task.area));
  if (proj) meta.push(h('span', null, proj));
  if (over) meta.push(h('span', { class: 'meta-over' }, `Carried over · ${fmtDate(ed)}`));
  else if (ed && (showDate || ed !== today)) meta.push(h('span', null, relativeDay(ed, today)));
  if (task.scheduledDate && task.startMin != null) meta.push(h('span', { class: 'meta-time' }, icon('clock', 12), fmtMin(task.startMin)));
  else if (task.dueTime) meta.push(h('span', { class: 'meta-time' }, icon('clock', 12), `by ${task.dueTime}`));
  if (task.durationMin) meta.push(h('span', null, fmtDur(task.durationMin)));
  if (task.recurrence?.type && task.recurrence.type !== 'none') meta.push(h('span', { title: describe(task.recurrence) }, icon('repeat', 12)));
  if (task.status === 'In progress') meta.push(h('span', { class: 'meta-status' }, 'In progress'));
  if (task.status === 'Skipped') meta.push(h('span', { class: 'meta-status' }, 'Skipped'));

  const row = h('div', { class: `task-row pri-${task.priority}${done ? ' done' : ''}${over ? ' overdue' : ''}`, style: { '--area': color }, dataset: { id: task.id } },
    drag ? h('span', { class: 'grip', title: 'Drag to schedule', 'aria-hidden': 'true' }, icon('grip', 16)) : null,
    h('button', { class: `check${done ? ' on' : ''}`, type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': `${done ? 'Mark not done' : 'Complete'}: ${task.title}`, onClick: () => A.completeTask(task) }, done ? icon('check', 14) : null),
    h('div', { class: 'task-main', role: 'button', tabindex: '0', onClick: () => openTaskForm(task), onKeydown: (e) => { if (e.key === 'Enter') openTaskForm(task); } },
      h('div', { class: 'task-title' }, task.title),
      meta.length ? h('div', { class: 'task-meta' }, meta) : null),
    h('span', { class: `pri-pill pri-${task.priority}`, title: `Priority ${task.priority}` }, task.priority),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `More actions for ${task.title}`, onClick: () => taskMenu(task) }, icon('more', 18)));
  if (drag && !done) draggable(row, { payload: { type: 'task', id: task.id, from: 'list' }, handle: '.grip' });
  return row;
}

export function TaskList(tasks, opts, emptyText = 'Nothing here.') {
  if (!tasks.length) return Empty(emptyText);
  return h('div', { class: 'task-list' }, tasks.map((t) => TaskRow(t, opts)));
}

// Inline "add a task" input: type, press Enter. Used on Today & area pages.
export function InlineAdd({ placeholder = 'Add a task…', defaults = () => ({}), refocusKey }) {
  const input = h('input', { class: 'input inline-add', placeholder, 'aria-label': placeholder, autocomplete: 'off', 'data-refocus': refocusKey || '' });
  const add = () => {
    const title = input.value.trim();
    if (!title) return;
    const d = defaults();
    store.put('tasks', { ...A_makeTask(), ...d, title, status: d.dueDate || d.scheduledDate ? 'Planned' : 'Inbox', createdDate: todayISO() });
    input.value = '';
    if (refocusKey) window.__refocus = refocusKey;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  return h('div', { class: 'inline-add-wrap' }, icon('plus', 16), input,
    h('button', { class: 'btn small', type: 'button', onClick: add }, 'Add'));
}

// ---- Routine chip row (today checklist + weekly dots) ----------------------
export function RoutineRow(routine, iso = todayISO(), { showWeek = true } = {}) {
  const done = routineLogged(routine.id, iso);
  const w = routineWeek(routine, iso);
  const color = areaColor(routine.area, store.getSettings());
  const progressText = routine.mode === 'weekly' ? `${w.done} / ${w.expected} this week` : `${Math.min(w.done, w.expected || w.done)} of ${w.expected} this week`;
  const dots = h('div', { class: 'week-dots', 'aria-hidden': 'true' }, w.days.map((d) => h('i', { class: `wd${d.done ? ' done' : ''}${d.due && !d.done ? ' due' : ''}${d.date === iso ? ' today' : ''}`, title: fmtDate(d.date) })));
  return h('div', { class: `routine-row${done ? ' done' : ''}`, style: { '--area': color } },
    h('button', { class: `check${done ? ' on' : ''}`, type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': `${done ? 'Unmark' : 'Mark'} ${routine.title}`, onClick: () => A.toggleRoutine(routine, iso) }, done ? icon('check', 14) : null),
    h('div', { class: 'task-main', role: 'button', tabindex: '0', onClick: () => openRoutineForm(routine), onKeydown: (e) => { if (e.key === 'Enter') openRoutineForm(routine); } },
      h('div', { class: 'task-title' }, routine.title),
      h('div', { class: 'task-meta' }, h('span', null, routine.mode === 'weekly' ? `Goal ${routine.target}× / week` : describe(routine.recurrence)), routine.startMin != null ? h('span', { class: 'meta-time' }, icon('clock', 12), fmtMin(routine.startMin)) : null)),
    showWeek ? h('div', { class: 'routine-week' }, dots, h('span', { class: 'small muted' }, progressText)) : null);
}

export function openEntity(it) {
  if (it.kind === 'event') openEventForm(it.ref);
  else if (it.kind === 'task') openTaskForm(it.ref);
  else openRoutineForm(it.ref);
}

// Handle drops of tasks/events/routines onto a time grid.
export function dropOnTimeline(payload, startMin, date) {
  if (payload.type === 'task') { const t = store.get('tasks', payload.id); if (t) A.scheduleTaskAt(t, date, startMin); }
  else if (payload.type === 'event') { const e = store.get('events', payload.id); if (e) A.moveEvent(e, startMin); }
  else if (payload.type === 'routine') { const r = store.get('routines', payload.id); if (r) A.moveRoutine(r, startMin); }
}

export function resizeItem(it, end) {
  if (it.kind === 'task') A.resizeTask(it.ref, end);
  else if (it.kind === 'event') A.resizeEvent(it.ref, end);
  else A.resizeRoutine(it.ref, end);
}

export function toggleItem(it, date) {
  if (it.kind === 'task') A.completeTask(it.ref);
  else if (it.kind === 'routine') A.toggleRoutine(it.ref, date);
}

export const tomorrow = () => addDays(todayISO(), 1);
