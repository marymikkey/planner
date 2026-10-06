// Domain mutations (complete / postpone / schedule / duplicate ...). UI-free so they
// can be reused by buttons, drag & drop, quick-add and tests.

import * as store from './store.js';
import { todayISO, addDays, diffDays, nowMin, localDateOf } from './dates.js';
import { effectiveDate, routineLogId, routineAnchor } from './queries.js';
import { nextOccurrence } from './recurrence.js';
import { makeTask, makeTransaction } from './models.js';

const snap = (m, step = 15) => Math.round(m / step) * step;

// A start time typed as 00:30 on a planner day that runs until 01:00 means "just after midnight".
export function normalizeStartMin(min, settings = store.getSettings()) {
  const wrap = settings.dayEndMin - 1440;
  return wrap > 0 && min < wrap ? min + 1440 : min;
}

export function completeTask(task) {
  const t = store.get('tasks', task.id) || task;
  if (t.status === 'Done') {
    store.put('tasks', { ...t, status: t.startMin != null || t.dueDate ? 'Planned' : 'Inbox', completedDate: null });
    return;
  }
  store.put('tasks', { ...t, status: 'Done', completedDate: todayISO() });
  // Recurring task: spawn the next occurrence once.
  if (t.recurrence?.type && t.recurrence.type !== 'none' && !t.nextGenerated) {
    const today = todayISO();
    const anchor = effectiveDate(t) || today;
    const next = nextOccurrence(t.recurrence, anchor, anchor > today ? anchor : today);
    if (next) {
      const delta = diffDays(anchor, next);
      store.put('tasks', makeTask({
        ...t, id: undefined, createdAt: undefined, status: 'Planned', completedDate: null, actualMin: null,
        nextGenerated: false, createdDate: today,
        dueDate: t.dueDate ? addDays(t.dueDate, delta) : null,
        scheduledDate: t.scheduledDate ? addDays(t.scheduledDate, delta) : null,
      }));
      store.put('tasks', { ...store.get('tasks', t.id), nextGenerated: true });
    }
  }
}

export function setStatus(task, status) {
  store.put('tasks', { ...task, status, completedDate: status === 'Done' ? todayISO() : null });
}

export function postponeTask(task, days = 1) {
  const base = effectiveDate(task) && effectiveDate(task) > todayISO() ? effectiveDate(task) : todayISO();
  moveTaskToDay(task, addDays(base, days));
}

// "Move to another day": shifts the scheduled slot (if any) and the due date, unless the
// due date is a real deadline that differs from the scheduled day.
export function moveTaskToDay(task, iso) {
  const patch = { status: task.status === 'Inbox' ? 'Planned' : task.status };
  if (task.scheduledDate) patch.scheduledDate = iso;
  if (!task.dueDate || !task.scheduledDate || task.dueDate === task.scheduledDate) patch.dueDate = iso;
  store.put('tasks', { ...task, ...patch });
}

export function scheduleTaskAt(task, iso, startMin) {
  const start = snap(startMin);
  const dur = task.durationMin || (task.endMin != null && task.startMin != null ? task.endMin - task.startMin : 30);
  store.put('tasks', {
    ...task, scheduledDate: iso, startMin: start, endMin: start + dur, durationMin: task.durationMin || dur,
    status: task.status === 'Inbox' ? 'Planned' : task.status,
    dueDate: task.dueDate || iso,
  });
}

export function unscheduleTask(task) {
  store.put('tasks', { ...task, scheduledDate: null, startMin: null, endMin: null, dueDate: task.dueDate || task.scheduledDate });
}

export function resizeTask(task, endMin) {
  store.put('tasks', { ...task, endMin, durationMin: endMin - task.startMin });
}

export function duplicateTask(task) {
  const { id, createdAt, updatedAt, ...rest } = task;
  return store.put('tasks', { ...rest, title: `${task.title} (copy)`, status: task.status === 'Done' ? 'Planned' : task.status, completedDate: null, nextGenerated: false, createdDate: todayISO() });
}

export function moveEvent(ev, startMin) {
  const dur = ev.endMin - ev.startMin;
  const s = snap(startMin);
  store.put('events', { ...ev, startMin: s, endMin: s + dur });
}
export function resizeEvent(ev, endMin) { store.put('events', { ...ev, endMin }); }

export function moveRoutine(r, startMin) { store.put('routines', { ...r, startMin: snap(startMin) }); }
export function resizeRoutine(r, endMin) { store.put('routines', { ...r, durationMin: endMin - r.startMin }); }

export function toggleRoutine(routine, iso) {
  const id = routineLogId(routine.id, iso);
  if (store.get('routineLogs', id)) store.remove('routineLogs', id);
  else store.put('routineLogs', { id, routineId: routine.id, date: iso });
}

// Clear a day without destroying templates: unschedule tasks, remove one-off events,
// and add a skip-exception to recurring events/routines for that date.
export function clearDay(iso) {
  for (const t of store.list('tasks')) {
    if (t.scheduledDate === iso && t.status !== 'Done') unscheduleTask(t);
  }
  for (const e of store.list('events')) {
    const recurring = e.recurrence?.type && e.recurrence.type !== 'none';
    if (recurring) {
      if (!(e.exceptions || []).includes(iso)) store.put('events', { ...e, exceptions: [...(e.exceptions || []), iso] });
    } else if (e.date === iso) store.remove('events', e.id);
  }
  for (const r of store.list('routines')) {
    if (r.mode === 'fixed' && !(r.exceptions || []).includes(iso) && r.recurrence?.type !== 'none') {
      store.put('routines', { ...r, exceptions: [...(r.exceptions || []), iso] });
    }
  }
}

// Turn recurring-expense templates into real transactions up to today.
export function materializeRecurringTx() {
  const today = todayISO();
  const created = [];
  for (const tpl of store.list('recurringTransactions')) {
    if (!tpl.active) continue;
    let cursor = tpl.lastGenerated ? null : tpl.startDate;
    const out = [];
    let guard = 0;
    const step = (d) => {
      if (tpl.frequency === 'weekly') return addDays(d, 7);
      const [y, m, day] = d.split('-').map(Number);
      const next = new Date(y, m, 1, 12); // first of next month
      const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const origDay = Number(tpl.startDate.slice(8, 10));
      next.setDate(Math.min(origDay, dim));
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    };
    if (tpl.lastGenerated) cursor = step(tpl.lastGenerated);
    let last = tpl.lastGenerated;
    while (cursor && cursor <= today && guard++ < 400) {
      out.push(makeTransaction({ id: `tx_${tpl.id}_${cursor}`, date: cursor, type: tpl.type, amount: tpl.amount, categoryId: tpl.categoryId, description: tpl.description, note: tpl.note, recurring: true, templateId: tpl.id }));
      last = cursor;
      cursor = step(cursor);
    }
    if (out.length) { created.push(...out); store.put('recurringTransactions', { ...tpl, lastGenerated: last }); }
  }
  if (created.length) store.putMany('transactions', created);
}

export { nowMin, localDateOf, routineAnchor };
