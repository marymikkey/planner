import { CURRENCIES } from './models.js';

export function money(amount, settings, { sign = false } = {}) {
  const code = settings?.currency || 'RUB';
  const sym = CURRENCIES[code] || code;
  const abs = String(Math.abs(Math.round(amount || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  const neg = amount < 0 ? '−' : sign && amount > 0 ? '+' : '';
  // Suffix style for ruble-like currencies, prefix for the rest.
  return ['RUB', 'UAH', 'KZT', 'PLN', 'CHF'].includes(code) ? `${neg}${abs} ${sym}` : `${neg}${sym}${abs}`;
}

export const num = (v, digits = 1) => (v == null || Number.isNaN(v) ? '—' : (Math.round(v * 10 ** digits) / 10 ** digits).toString());
export const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
export const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
export const avg = (arr) => {
  const v = arr.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? sum(v) / v.length : null;
};
