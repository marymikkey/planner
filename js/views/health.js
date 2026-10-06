// Health: a lightweight wellbeing log (not a medical tool). Fast daily check-in + gentle trends.
import { h, icon } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, addDays, fmtDate, fmtDur, fmtMin } from '../core/dates.js';
import { buildDaily, movingAverage } from '../core/analytics.js';
import { Card, PageHead, Btn, Empty, pickDate } from '../ui/components.js';
import { LineChart } from '../ui/charts.js';
import { openHealthForm, openMetricForm } from '../ui/forms.js';

export function render(root) {
  const today = todayISO();
  const entry = store.get('healthEntries', today);
  const from = addDays(today, -59);
  const { dates, metrics } = buildDaily(from, today);
  const xFmt = (d, long) => fmtDate(d, long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });

  root.append(PageHead('Health', {
    sub: 'A gentle log for sleep, mood and habits. Not medical advice.',
    actions: [Btn('Other day…', () => pickDate('Check-in for…', today, (d) => openHealthForm(d)), {}), Btn(entry ? 'Edit today’s check-in' : 'Check in', () => openHealthForm(today), { kind: 'primary', ic: 'check' })],
  }));

  // Today's snapshot
  const bits = [];
  const add = (label, v) => v != null && v !== '' && bits.push(h('div', { class: 'snap' }, h('span', { class: 'snap-l' }, label), h('span', { class: 'snap-v' }, v)));
  if (entry) {
    add('Weight', entry.weight != null ? `${entry.weight} kg` : null);
    add('Sleep', entry.sleepMin != null ? `${fmtDur(entry.sleepMin)}${entry.bedtimeMin != null ? ` · ${fmtMin(entry.bedtimeMin)}→${fmtMin(entry.wakeMin)}` : ''}` : null);
    add('Coffee', entry.coffee != null ? `${entry.coffee} cup${entry.coffee === 1 ? '' : 's'}` : null);
    add('Activity', entry.activity || entry.activityMin ? `${entry.activity || 'Activity'}${entry.activityMin ? ` · ${entry.activityMin} min` : ''}` : null);
    add('Steps', entry.steps);
    for (const k of ['mood', 'energy', 'stress', 'productivity', 'wellbeing']) add(k[0].toUpperCase() + k.slice(1), entry[k] != null ? `${entry[k]}/10` : null);
  }
  const snapshot = Card('Today', { sub: 'Fill in only what you like — one number is a complete check-in.' },
    bits.length ? h('div', { class: 'snap-grid' }, bits) : Empty('No check-in yet today. Weight alone is enough.'));

  const chart = (title, domainData, series, opts = {}) => Card(title, { className: 'chart-card' }, LineChart({ domain: dates, series, xFmt, label: title, ...opts }));
  const w = metrics.weight;
  const weight = chart('Weight', null, [
    { name: 'Daily', values: w, type: 'dots', color: 'var(--c1)', opacity: 0.5 },
    { name: '7-day average', values: movingAverage(w, 7, 1), color: 'var(--c1)', width: 2.6, points: false },
  ], { yFmt: (v) => (Math.round(v * 10) / 10).toString() });
  const sleep = chart('Sleep (hours)', null, [
    { name: 'Sleep', values: metrics.sleep, type: 'bars', color: 'var(--c2)', opacity: 0.6, fmt: (v) => fmtDur(v * 60) },
    { name: '7-day average', values: movingAverage(metrics.sleep, 7, 2), color: 'var(--c1)', width: 2.2, points: false, fmt: (v) => fmtDur(v * 60) },
  ], { yMin: 0, yFmt: (v) => `${v}h` });
  const mood = chart('Mood & energy', null, [
    { name: 'Mood (7d)', values: movingAverage(metrics.mood, 7, 2), color: 'var(--c1)', width: 2.4, points: false },
    { name: 'Energy (7d)', values: movingAverage(metrics.energy, 7, 2), color: 'var(--c3)', width: 2.4, points: false },
  ], { yMin: 1, yMax: 10 });

  // Recent entries
  const recent = store.list('healthEntries').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const recentCard = Card('Recent check-ins', null, recent.length ? h('ul', { class: 'plain-list' }, recent.map((e) => {
    const parts = [e.weight != null && `${e.weight} kg`, e.sleepMin != null && fmtDur(e.sleepMin), e.mood != null && `mood ${e.mood}`, e.activityMin && `${e.activityMin} min active`].filter(Boolean);
    return h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openHealthForm(e.date), onKeydown: (k) => { if (k.key === 'Enter') openHealthForm(e.date); } },
      h('strong', null, fmtDate(e.date)), h('span', { class: 'muted small' }, parts.join(' · ') || 'Notes only'));
  })) : Empty('Your check-ins will appear here.'));

  const customs = store.list('customMetrics').filter((m) => !m.archived);
  const metricCard = Card('Custom metrics', { sub: 'Track anything — they stay private to your device.', actions: Btn('Add metric', () => openMetricForm({}), { kind: 'small', ic: 'plus' }) },
    customs.length ? h('ul', { class: 'plain-list' }, customs.map((m) => h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openMetricForm(m), onKeydown: (k) => { if (k.key === 'Enter') openMetricForm(m); } },
      h('strong', null, m.name), h('span', { class: 'muted small' }, { boolean: 'Yes / No', number: `Number${m.unit ? ` (${m.unit})` : ''}`, scale: 'Scale 1–10', category: 'Category', text: 'Text' }[m.type])))) : Empty('No custom metrics yet.'));

  root.append(h('div', { class: 'grid-2' }, snapshot, weight, sleep, mood, recentCard, metricCard));
  root.append(h('p', { class: 'muted small' }, 'More charts and correlations live in ', h('a', { href: '#/analytics' }, 'Analytics'), '.'));
}
