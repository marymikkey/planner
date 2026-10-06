import { locale, isRu } from '../i18n.js';

// Date helpers. All dates are local calendar dates stored as 'YYYY-MM-DD' strings
// (never UTC timestamps) so "today" always matches what the user sees on the wall clock.
// Times of day are integer minutes; values >= 1440 mean "after midnight, same planner day".

export const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parse at noon so DST shifts can never push us onto a neighbouring day.
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);

export const dow = (iso) => parseISO(iso).getDay(); // 0 = Sunday

export function startOfWeek(iso, weekStart = 1) {
  const delta = (dow(iso) - weekStart + 7) % 7;
  return addDays(iso, -delta);
}

export const weekDays = (iso, weekStart = 1) => {
  const s = startOfWeek(iso, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};

export function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const monthKey = (iso) => iso.slice(0, 7);
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const monthLabel = (key) =>
  parseISO(key + '-01').toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
export const monthStart = (key) => key + '-01';
export const monthEnd = (key) => addDays(addMonths(key, 1) + '-01', -1);


export const fmtDate = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseISO(iso).toLocaleDateString(locale(), opts);
export const fmtLong = (iso) =>
  parseISO(iso).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtWeekday = (iso, style = 'short') =>
  parseISO(iso).toLocaleDateString(locale(), { weekday: style });

export function relativeDay(iso, today = todayISO()) {
  const d = diffDays(today, iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return fmtDate(iso);
}

export const nowMin = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

// minutes -> 'HH:MM' (wraps past midnight)
export const fmtMin = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export function parseTime(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function fmtDur(min) {
  if (min == null || Number.isNaN(min)) return '—';
  min = Math.round(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  const [hu, mu] = isRu() ? [' ч', ' мин'] : ['h', 'm'];
  if (h && m) return isRu() ? `${h} ч ${m} мин` : `${h}h ${m}m`;
  if (h) return `${h}${hu}`;
  return `${m}${mu}`;
}

export const localDateOf = (isoDateTime) => (isoDateTime ? toISO(new Date(isoDateTime)) : null);
