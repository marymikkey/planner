// Recurrence rules shared by events, routines, tasks and recurring transactions.
// A rule is a small plain object: { type, days?, every?, until? }
//   type: none | daily | weekdays | weekly | interval | monthly
// Occurrences are computed on demand ("does this rule hit date X?"), never
// materialised, so editing a template instantly updates every day.

import { dow, diffDays, parseISO, addDays } from './dates.js';

export function occursOn(rec, anchorISO, iso) {
  if (!anchorISO) return false;
  if (!rec || rec.type === 'none') return iso === anchorISO;
  if (iso < anchorISO) return false;
  if (rec.until && iso > rec.until) return false;
  switch (rec.type) {
    case 'daily': return true;
    case 'weekdays': { const d = dow(iso); return d >= 1 && d <= 5; }
    case 'weekly': {
      const days = rec.days && rec.days.length ? rec.days : [dow(anchorISO)];
      return days.includes(dow(iso));
    }
    case 'interval': return diffDays(anchorISO, iso) % Math.max(1, rec.every || 1) === 0;
    case 'monthly': return parseISO(iso).getDate() === parseISO(anchorISO).getDate();
    default: return false;
  }
}

export function nextOccurrence(rec, anchorISO, afterISO) {
  if (!rec || rec.type === 'none') return null;
  let d = addDays(afterISO, 1);
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) {
    if (occursOn(rec, anchorISO, d)) return d;
  }
  return null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES_SHORT = DAY_NAMES;

export function describe(rec) {
  if (!rec || rec.type === 'none') return 'Does not repeat';
  switch (rec.type) {
    case 'daily': return 'Every day';
    case 'weekdays': return 'Every weekday';
    case 'weekly': return rec.days?.length ? `Every ${rec.days.map((d) => DAY_NAMES[d]).join(', ')}` : 'Every week';
    case 'interval': return `Every ${rec.every || 1} days`;
    case 'monthly': return 'Every month';
    default: return '';
  }
}
