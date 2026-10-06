// Read-only selectors over the store. Views call these instead of filtering raw arrays,
// so the "which tasks belong to a day?" rules live in exactly one place.

import * as store from './store.js';
import { todayISO, parseTime, weekDays, localDateOf, addDays } from './dates.js';
import { occursOn } from './recurrence.js';

export const isActive = (t) => t.status !== 'Done' && t.status !== 'Skipped';

// A task "lives" on its scheduled date if it has one, otherwise on its due date.
export const effectiveDate = (t) => t.scheduledDate || t.dueDate || null;

export const isOverdue = (t, today = todayISO()) => {
  const d = effectiveDate(t);
  return isActive(t) && !!d && d < today;
};

const PRI = { P1: 1, P2: 2, P3: 3 };
const timeKey = (t) => {
  if (t.scheduledDate && t.startMin != null) return t.startMin;
  const due = parseTime(t.dueTime);
  return due != null ? due : 99999;
};

// Spec order: overdue -> P1 -> P2 -> P3 -> time.
export const compareTasks = (today = todayISO()) => (a, b) => {
  const oa = isOverdue(a, today) ? 0 : 1;
  const ob = isOverdue(b, today) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  if (PRI[a.priority] !== PRI[b.priority]) return PRI[a.priority] - PRI[b.priority];
  const ta = timeKey(a), tb = timeKey(b);
  if (ta !== tb) return ta - tb;
  return (a.createdAt || '').localeCompare(b.createdAt || '');
};

export const taskMinutes = (t) => t.actualMin ?? t.durationMin ?? 0;

export function todayTasks(today = todayISO()) {
  const all = store.list('tasks');
  const open = all.filter((t) => isActive(t) && effectiveDate(t) && effectiveDate(t) <= today).sort(compareTasks(today));
  const done = all.filter((t) => t.status === 'Done' && t.completedDate === today).sort(compareTasks(today));
  return { open, done };
}

export const tasksOnDay = (iso) =>
  store.list('tasks').filter((t) => effectiveDate(t) === iso && t.status !== 'Skipped').sort(compareTasks(todayISO()));

export const inboxTasks = () =>
  store.list('tasks').filter((t) => t.status === 'Inbox' && !effectiveDate(t)).sort(compareTasks());

// Tasks relevant to a day that have no time slot yet (for the planner's side panel).
export const unscheduledForDay = (iso) =>
  tasksOnDay(iso).filter((t) => isActive(t) && !(t.scheduledDate === iso && t.startMin != null));

// ---- events & routines -----------------------------------------------------
export const eventsOn = (iso) =>
  store.list('events')
    .filter((e) => occursOn(e.recurrence, e.date, iso) && !(e.exceptions || []).includes(iso))
    .sort((a, b) => a.startMin - b.startMin);

export const routineAnchor = (r) => r.startDate || localDateOf(r.createdAt) || todayISO();
export const routineLogId = (routineId, iso) => `${routineId}_${iso}`;
export const routineLogged = (routineId, iso) => !!store.get('routineLogs', routineLogId(routineId, iso));

const liveRoutines = () => store.list('routines').filter((r) => !r.archived);

export const routinesOn = (iso) =>
  liveRoutines().filter((r) => r.mode === 'weekly' || (occursOn(r.recurrence, routineAnchor(r), iso) && !(r.exceptions || []).includes(iso)));

// Per-week completion for a routine. Missed days are never "failures": we only report
// how many were done out of how many were expected.
export function routineWeek(r, anyDayInWeek) {
  const days = weekDays(anyDayInWeek, store.getSettings().weekStart);
  const logs = days.map((d) => routineLogged(r.id, d));
  const done = logs.filter(Boolean).length;
  if (r.mode === 'weekly') {
    return { done, expected: r.target || 1, days: days.map((date, i) => ({ date, due: false, done: logs[i] })) };
  }
  const anchor = routineAnchor(r);
  const cells = days.map((date, i) => ({ date, due: occursOn(r.recurrence, anchor, date) && !(r.exceptions || []).includes(date), done: logs[i] }));
  return { done, expected: cells.filter((c) => c.due || c.done).length, days: cells };
}

// Everything that can sit on a time grid for a given day.
export function timelineItems(iso) {
  const items = [];
  for (const e of eventsOn(iso)) {
    items.push({ key: `e:${e.id}`, kind: 'event', id: e.id, title: e.title, startMin: e.startMin, endMin: e.endMin, area: e.area, sub: e.kind, ref: e });
  }
  for (const t of store.list('tasks')) {
    if (t.scheduledDate === iso && t.startMin != null && t.status !== 'Skipped') {
      items.push({ key: `t:${t.id}`, kind: 'task', id: t.id, title: t.title, startMin: t.startMin, endMin: t.endMin ?? t.startMin + (t.durationMin || 30), area: t.area, done: t.status === 'Done', priority: t.priority, ref: t });
    }
  }
  for (const r of routinesOn(iso)) {
    if (r.mode === 'fixed' && r.startMin != null) {
      items.push({ key: `r:${r.id}`, kind: 'routine', id: r.id, title: r.title, startMin: r.startMin, endMin: r.startMin + (r.durationMin || 30), area: r.area, done: routineLogged(r.id, iso), ref: r });
    }
  }
  return items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export const projectsFor = (area) => store.list('projects').filter((p) => p.area === area && !p.archived).sort((a, b) => a.name.localeCompare(b.name));
export const activeSubjects = () => store.list('subjects').filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name));

export function projectProgress(projectId, area) {
  const tasks = store.list('tasks').filter((t) => (projectId ? t.projectId === projectId : t.area === area && !t.projectId) && t.status !== 'Skipped');
  const done = tasks.filter((t) => t.status === 'Done').length;
  return { done, total: tasks.length };
}

// Weekly "momentum": calm descriptive numbers, no streaks.
export function weekMomentum(today = todayISO()) {
  const s = store.getSettings();
  const days = weekDays(today, s.weekStart);
  const tasks = store.list('tasks');
  const health = store.list('healthEntries').filter((h) => days.includes(h.date));

  const careerMin = tasks.filter((t) => t.area === 'Career & ML' && t.status === 'Done' && days.includes(t.completedDate)).reduce((a, t) => a + taskMinutes(t), 0);
  const activeDays = health.filter((h) => (h.activityMin || 0) > 0 || h.activity).length;
  const sleeps = health.map((h) => h.sleepMin).filter((v) => v != null);

  let homeDone = 0, homeExpected = 0;
  for (const r of liveRoutines().filter((x) => x.area === 'Home')) {
    const w = routineWeek(r, today);
    homeDone += Math.min(w.done, w.expected || w.done);
    homeExpected += w.expected;
  }
  const completed = tasks.filter((t) => t.status === 'Done' && days.includes(t.completedDate)).length;
  return {
    careerMin, activeDays, activityTarget: s.activityTarget || 4, homeDone, homeExpected,
    avgSleepMin: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
    completed, days, tomorrow: addDays(today, 1),
  };
}
