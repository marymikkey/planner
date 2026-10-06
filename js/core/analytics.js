// Descriptive analytics. Pure functions over store data, no DOM.
// Deliberately simple and transparent: daily series, moving averages, weekly/monthly
// aggregation and Spearman correlation. A future ML layer can consume buildDaily()
// output directly (one aligned numeric array per metric).

import * as store from './store.js';
import { rangeDays, startOfWeek, addDays, monthKey, localDateOf } from './dates.js';
import { effectiveDate, taskMinutes } from './queries.js';

// agg: how to combine days into weeks/months in aggregated charts.
export const BASE_METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg', agg: 'avg', group: 'Body' },
  { key: 'sleep', label: 'Sleep duration', unit: 'h', agg: 'avg', group: 'Body' },
  { key: 'bedtime', label: 'Bedtime', unit: 'time', agg: 'avg', group: 'Body' },
  { key: 'coffee', label: 'Coffee', unit: 'cups', agg: 'avg', group: 'Body' },
  { key: 'activityMin', label: 'Activity', unit: 'min', agg: 'avg', group: 'Body' },
  { key: 'steps', label: 'Steps', unit: '', agg: 'avg', group: 'Body' },
  { key: 'mood', label: 'Mood', unit: '/10', agg: 'avg', group: 'Mind' },
  { key: 'energy', label: 'Energy', unit: '/10', agg: 'avg', group: 'Mind' },
  { key: 'stress', label: 'Stress', unit: '/10', agg: 'avg', group: 'Mind' },
  { key: 'productivity', label: 'Productivity', unit: '/10', agg: 'avg', group: 'Mind' },
  { key: 'wellbeing', label: 'Overall wellbeing', unit: '/10', agg: 'avg', group: 'Mind' },
  { key: 'spend', label: 'Spending', unit: 'money', agg: 'sum', group: 'Life' },
  { key: 'tasksDone', label: 'Tasks completed', unit: '', agg: 'sum', group: 'Life' },
  { key: 'focusHours', label: 'Time on completed tasks', unit: 'h', agg: 'sum', group: 'Life' },
];

export function metricList() {
  const custom = store.list('customMetrics')
    .filter((m) => !m.archived && ['number', 'scale', 'boolean'].includes(m.type))
    .map((m) => ({ key: `custom:${m.id}`, label: m.name, unit: m.unit || (m.type === 'scale' ? '/10' : ''), agg: 'avg', group: 'Custom' }));
  return [...BASE_METRICS, ...custom];
}

// Bedtime after midnight (e.g. 00:30) belongs to the same night as 23:30 -> shift by 24h.
export const bedtimeValue = (min) => (min == null ? null : min < 720 ? min + 1440 : min);

export function buildDaily(from, to) {
  const dates = rangeDays(from, to);
  const health = new Map(store.list('healthEntries').map((h) => [h.date, h]));
  const spend = new Map();
  for (const t of store.list('transactions')) if (t.type === 'expense') spend.set(t.date, (spend.get(t.date) || 0) + t.amount);
  const done = new Map(), focus = new Map();
  for (const t of store.list('tasks')) {
    if (t.status === 'Done' && t.completedDate) {
      done.set(t.completedDate, (done.get(t.completedDate) || 0) + 1);
      focus.set(t.completedDate, (focus.get(t.completedDate) || 0) + taskMinutes(t) / 60);
    }
  }
  const customs = store.list('customMetrics');
  const metrics = {};
  const col = (key, fn) => { metrics[key] = dates.map(fn); };
  const h = (d, k) => health.get(d)?.[k] ?? null;
  col('weight', (d) => h(d, 'weight'));
  col('sleep', (d) => (h(d, 'sleepMin') != null ? h(d, 'sleepMin') / 60 : null));
  col('bedtime', (d) => bedtimeValue(h(d, 'bedtimeMin')));
  for (const k of ['coffee', 'activityMin', 'steps', 'mood', 'energy', 'stress', 'productivity', 'wellbeing']) col(k, (d) => h(d, k));
  col('spend', (d) => spend.get(d) ?? null);
  col('tasksDone', (d) => done.get(d) ?? null);
  col('focusHours', (d) => (focus.get(d) > 0 ? focus.get(d) : null));
  for (const m of customs) {
    col(`custom:${m.id}`, (d) => {
      const v = health.get(d)?.custom?.[m.id];
      if (v == null || v === '') return null;
      if (m.type === 'boolean') return v ? 1 : 0;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    });
  }
  return { dates, metrics };
}

// Trailing moving average over non-null values in the window.
export function movingAverage(values, window = 7, minCount = 1) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v) => v != null);
    return slice.length >= minCount ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

// Aggregate daily values into week or month buckets. Returns [{key, value}].
export function aggregate(dates, values, mode, op, weekStart = 1) {
  const buckets = new Map();
  dates.forEach((d, i) => {
    const k = mode === 'week' ? startOfWeek(d, weekStart) : monthKey(d);
    if (!buckets.has(k)) buckets.set(k, []);
    if (values[i] != null) buckets.get(k).push(values[i]);
  });
  return [...buckets.entries()].map(([key, vals]) => ({
    key,
    value: vals.length ? (op === 'sum' ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length) : null,
  }));
}

// ---- Correlation -----------------------------------------------------------
function ranks(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avgRank = (i + j) / 2 + 1; // ties share the average rank
    for (let k = i; k <= j; k++) r[idx[k][1]] = avgRank;
    i = j + 1;
  }
  return r;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : null;
}

// Pairs x[d] with y[d+lag]. Only days where both exist are used.
export function lagPairs(xs, ys, lag = 0) {
  const pairs = [];
  for (let i = 0; i + lag < xs.length; i++) {
    const x = xs[i], y = ys[i + lag];
    if (x != null && y != null) pairs.push([x, y, i]);
  }
  return pairs;
}

export const MIN_SAMPLES = 8;

export function spearman(pairs) {
  const n = pairs.length;
  if (n < MIN_SAMPLES) return { n, rho: null };
  const rho = pearson(ranks(pairs.map((p) => p[0])), ranks(pairs.map((p) => p[1])));
  return { n, rho };
}

export function describeCorrelation(rho, n) {
  if (rho == null) return { text: `Not enough overlapping data yet (${n} of ${MIN_SAMPLES} days needed).`, strength: null };
  const a = Math.abs(rho);
  const strength = a < 0.1 ? 'negligible' : a < 0.3 ? 'weak' : a < 0.5 ? 'moderate' : a < 0.7 ? 'strong' : 'very strong';
  if (strength === 'negligible') return { text: 'No clear association', strength };
  return { text: `${strength[0].toUpperCase()}${strength.slice(1)} ${rho > 0 ? 'positive' : 'negative'} association`, strength };
}

// ---- Tasks: planned vs completed, time by area -----------------------------
export function weeklyPlannedVsDone(from, to, weekStart = 1) {
  const weeks = new Map();
  const bucket = (d) => { const k = startOfWeek(d, weekStart); if (!weeks.has(k)) weeks.set(k, { planned: 0, done: 0 }); return weeks.get(k); };
  for (const t of store.list('tasks')) {
    if (t.status === 'Skipped') continue;
    const d = t.status === 'Done' ? (effectiveDate(t) || t.completedDate) : effectiveDate(t);
    if (!d || d < from || d > to) continue;
    const b = bucket(d);
    b.planned++;
    if (t.status === 'Done') b.done++;
  }
  // make sure every week in range is present
  for (let d = startOfWeek(from, weekStart); d <= to; d = addDays(d, 7)) bucket(d);
  return [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, ...v }));
}

export function areaTime(from, to, areas) {
  const out = Object.fromEntries(areas.map((a) => [a, { planned: 0, actual: 0, logged: 0 }]));
  for (const t of store.list('tasks')) {
    if (t.status === 'Skipped' || !out[t.area]) continue;
    const d = effectiveDate(t) || t.completedDate;
    if (!d || d < from || d > to) continue;
    out[t.area].planned += t.durationMin || 0;
    if (t.actualMin != null) { out[t.area].actual += t.actualMin; out[t.area].logged++; }
  }
  return out;
}

export { localDateOf };
