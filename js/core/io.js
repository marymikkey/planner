// Import / export. JSON is the lossless format; CSV is for spreadsheets (one dataset at a time).
import * as store from './store.js';
import { describe } from './recurrence.js';
import { fmtMin } from './dates.js';

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJSON() {
  download(`planner-backup-${stamp()}.json`, JSON.stringify(store.exportAll(), null, 2), 'application/json');
}

export async function importJSON(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  store.validateImport(obj);
  await store.replaceAll(obj);
}

// ---- CSV -------------------------------------------------------------------
const esc = (v) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Prefix formula-looking text so spreadsheets don't execute it.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const lookup = (name, id, field = 'name') => store.get(name, id)?.[field] ?? '';

export const CSV_DATASETS = {
  tasks: {
    label: 'Tasks',
    cols: ['title', 'area', 'project', 'priority', 'status', 'dueDate', 'dueTime', 'durationMin', 'actualMin', 'energy', 'tags', 'scheduledDate', 'start', 'end', 'recurrence', 'createdDate', 'completedDate', 'notes'],
    rows: () => store.list('tasks').map((t) => ({
      ...t, project: lookup('projects', t.projectId) || lookup('subjects', t.subjectId),
      start: t.startMin != null ? fmtMin(t.startMin) : '', end: t.endMin != null ? fmtMin(t.endMin) : '', recurrence: describe(t.recurrence),
    })),
  },
  events: {
    label: 'Events & classes',
    cols: ['title', 'kind', 'area', 'date', 'start', 'end', 'recurrence', 'notes'],
    rows: () => store.list('events').map((e) => ({ ...e, start: fmtMin(e.startMin), end: fmtMin(e.endMin), recurrence: describe(e.recurrence) })),
  },
  routines: {
    label: 'Routines',
    cols: ['title', 'area', 'mode', 'recurrence', 'target', 'notes'],
    rows: () => store.list('routines').map((r) => ({ ...r, recurrence: r.mode === 'weekly' ? `${r.target}x / week` : describe(r.recurrence) })),
  },
  routineLogs: {
    label: 'Routine completions',
    cols: ['date', 'routine'],
    rows: () => store.list('routineLogs').map((l) => ({ ...l, routine: lookup('routines', l.routineId, 'title') })),
  },
  health: {
    label: 'Health check-ins',
    cols: ['date', 'weight', 'bedtime', 'wake', 'sleepMin', 'coffee', 'activity', 'activityMin', 'steps', 'mood', 'energy', 'stress', 'productivity', 'wellbeing', 'symptoms', 'notes', 'custom'],
    rows: () => store.list('healthEntries').map((h) => ({ ...h, bedtime: h.bedtimeMin != null ? fmtMin(h.bedtimeMin) : '', wake: h.wakeMin != null ? fmtMin(h.wakeMin) : '' })),
  },
  meals: {
    label: 'Meals',
    cols: ['date', 'time', 'type', 'description', 'tags', 'calories', 'protein', 'fat', 'carbs'],
    rows: () => store.list('meals'),
  },
  transactions: {
    label: 'Transactions',
    cols: ['date', 'type', 'amount', 'category', 'description', 'recurring', 'note'],
    rows: () => store.list('transactions').map((t) => ({ ...t, category: lookup('financeCategories', t.categoryId) })),
  },
  projects: {
    label: 'Projects',
    cols: ['name', 'area', 'deadline', 'notes'],
    rows: () => store.list('projects'),
  },
};

export function toCSV(key) {
  const ds = CSV_DATASETS[key];
  const rows = ds.rows().sort((a, b) => String(a.date || a.dueDate || a.title || '').localeCompare(String(b.date || b.dueDate || b.title || '')));
  return [ds.cols.join(','), ...rows.map((r) => ds.cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function exportCSV(key) {
  download(`planner-${key}-${stamp()}.csv`, '﻿' + toCSV(key), 'text/csv;charset=utf-8');
}
