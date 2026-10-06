// Analytics: descriptive charts first, exploratory correlations second. No causal claims, no fake ML.
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, addDays, fmtDate, fmtMin, fmtDur, monthLabel, parseISO } from '../core/dates.js';
import { AREAS, areaColor } from '../core/models.js';
import { money } from '../core/format.js';
import * as AN from '../core/analytics.js';
import { Card, PageHead, Empty } from '../ui/components.js';
import { LineChart, ScatterChart } from '../ui/charts.js';
import * as C from '../ui/controls.js';

const ui = { days: 90, gran: 'day', x: 'sleep', y: 'mood', lag: '0' };

export function render(root, params, { rerender }) {
  const s = store.getSettings();
  const today = todayISO();
  const from = addDays(today, -(ui.days - 1));
  const { dates, metrics } = AN.buildDaily(from, today);
  const list = AN.metricList();
  const meta = Object.fromEntries(list.map((m) => [m.key, m]));

  const fmtVal = (m) => {
    if (m.unit === 'time') return (v) => fmtMin(v);
    if (m.unit === 'money') return (v) => money(v, s);
    if (m.unit === 'h') return (v) => fmtDur(v * 60);
    return (v) => String(Math.round(v * 10) / 10);
  };
  const axisFmt = (m) => {
    if (m.unit === 'time') return (v) => fmtMin(v);
    if (m.unit === 'money') return (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
    if (m.unit === 'h') return (v) => `${Math.round(v * 10) / 10}h`;
    return (v) => String(Math.round(v * 10) / 10);
  };
  const xFmtDaily = (d, long) => fmtDate(d, long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });
  const xFmtWeek = (d, long) => (long ? `Week of ${fmtDate(d)}` : fmtDate(d, { month: 'short', day: 'numeric' }));
  const xFmtMonth = (k) => monthLabel(k);

  const rangeSeg = C.segmented([{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: '180', label: '6m' }, { value: '365', label: '1y' }], String(ui.days), { label: 'Range', onChange: (v) => { ui.days = Number(v); rerender(); } });
  const granSeg = C.segmented([{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }], ui.gran, { label: 'Granularity', onChange: (v) => { ui.gran = v; rerender(); } });
  root.append(PageHead('Analytics', { sub: 'What your data shows, without judgement.', actions: [rangeSeg.el, granSeg.el] }));

  // Generic metric chart: daily values (+ moving average) or weekly/monthly aggregates.
  const metricChart = (key, { title, kind = 'line', ma = true, maMin = 2, yMin } = {}) => {
    const m = meta[key];
    if (!m) return null;
    const vals = metrics[key];
    const f = fmtVal(m);
    let domain = dates, series, xFmt = xFmtDaily;
    if (ui.gran === 'day') {
      const raw = { name: m.label, values: vals, color: 'var(--c1)', fmt: f };
      series = kind === 'bars' ? [{ ...raw, type: 'bars', color: 'var(--c2)', opacity: 0.6 }] : kind === 'dots' ? [{ ...raw, type: 'dots' }] : [{ ...raw, type: 'line', opacity: ma ? 0.5 : 1 }];
      if (kind === 'line' && ma) series[0] = { ...series[0], type: 'dots', opacity: 0.45 };
      if (ma) series.push({ name: '7-day average', values: AN.movingAverage(vals, 7, maMin), color: 'var(--c1)', width: 2.6, points: false, fmt: f });
    } else {
      const agg = AN.aggregate(dates, vals, ui.gran, m.agg, s.weekStart);
      domain = agg.map((a) => a.key);
      xFmt = ui.gran === 'week' ? xFmtWeek : xFmtMonth;
      series = [{ name: `${ui.gran === 'week' ? 'Weekly' : 'Monthly'} ${m.agg === 'sum' ? 'total' : 'average'}`, values: agg.map((a) => a.value), type: kind === 'bars' || m.agg === 'sum' ? 'bars' : 'line', color: 'var(--c1)', fmt: f }];
    }
    return Card(title || m.label, { className: 'chart-card' }, LineChart({ domain, series, xFmt, yFmt: axisFmt(m), yMin, label: title || m.label }));
  };

  const cards = [
    metricChart('weight', { title: 'Weight', kind: 'dots', maMin: 1 }),
    metricChart('sleep', { title: 'Sleep duration', kind: 'bars', yMin: 0 }),
    metricChart('bedtime', { title: 'Bedtime' }),
    metricChart('mood', { title: 'Mood', yMin: 1 }),
    metricChart('energy', { title: 'Energy', yMin: 1 }),
    metricChart('stress', { title: 'Stress', yMin: 1 }),
    metricChart('productivity', { title: 'Productivity', yMin: 1 }),
    metricChart('activityMin', { title: 'Activity (minutes)', kind: 'bars', yMin: 0 }),
    metricChart('coffee', { title: 'Coffee (cups)', kind: 'bars', yMin: 0 }),
    metricChart('spend', { title: 'Spending', kind: 'bars', ma: false, yMin: 0 }),
  ].filter(Boolean);
  root.append(h('div', { class: 'grid-2' }, cards));

  // Planned vs completed tasks (weekly)
  const pv = AN.weeklyPlannedVsDone(from, today, s.weekStart);
  const pvCard = Card('Planned vs completed tasks', { sub: 'Per week. Plans change — this is just a picture of how it went.', className: 'chart-card' }, LineChart({
    domain: pv.map((w) => w.key), xFmt: xFmtWeek, yMin: 0, yFmt: (v) => String(Math.round(v)), label: 'Planned vs completed tasks per week',
    series: [{ name: 'Planned', values: pv.map((w) => w.planned), type: 'bars', color: 'var(--c3)', opacity: 0.45 }, { name: 'Completed', values: pv.map((w) => w.done), type: 'bars', color: 'var(--c1)', opacity: 0.9 }],
  }));

  // Time by area: planned vs actual
  const at = AN.areaTime(from, today, AREAS);
  const maxMin = Math.max(60, ...AREAS.map((a) => Math.max(at[a].planned, at[a].actual)));
  const areaRows = AREAS.filter((a) => at[a].planned || at[a].actual);
  const areaCard = Card('Time by area', { sub: 'Planned duration vs the actual time you logged. Differences are information, not failure.' },
    areaRows.length ? h('ul', { class: 'cat-list' }, areaRows.map((a) => h('li', null,
      h('div', { class: 'cat-top' }, h('span', null, h('i', { class: 'dot', style: { background: areaColor(a, s) } }), ` ${a}`), h('span', { class: 'muted small' }, `Planned ${fmtDur(at[a].planned)} · Actual ${at[a].logged ? fmtDur(at[a].actual) : '—'}`)),
      h('div', { class: 'bar stacked', style: { '--area': areaColor(a, s) } },
        h('div', { class: 'bar-fill plan', style: { width: `${(at[a].planned / maxMin) * 100}%` } }),
        h('div', { class: 'bar-fill actual', style: { width: `${(at[a].actual / maxMin) * 100}%` } }))))) : Empty('Add durations to tasks to see time by area.'),
    areaRows.length ? h('p', { class: 'small muted' }, 'Actual only includes tasks where you entered the time spent (open a task → “Actual time spent”).') : null);

  root.append(h('div', { class: 'grid-2' }, pvCard, areaCard));
  root.append(correlationCard());

  function correlationCard() {
    const opts = list.map((m) => ({ value: m.key, label: m.label }));
    const xs = C.select(opts, ui.x), ys = C.select(opts, ui.y);
    const lag = C.segmented([{ value: '0', label: 'Same day' }, { value: '1', label: '+1 day' }, { value: '2', label: '+2 days' }], ui.lag, { label: 'Lag', onChange: (v) => { ui.lag = v; rerender(); } });
    xs.onChange(() => { ui.x = xs.get(); rerender(); });
    ys.onChange(() => { ui.y = ys.get(); rerender(); });
    const result = h('div', { class: 'corr-result' });
    const xm = meta[ui.x], ym = meta[ui.y];
    if (xm && ym) {
      const pairs = AN.lagPairs(metrics[ui.x], metrics[ui.y], Number(ui.lag));
      const { rho, n } = AN.spearman(pairs);
      const desc = AN.describeCorrelation(rho, n);
      const lagText = ui.lag === '0' ? 'on the same day' : `${ui.lag} day${ui.lag === '1' ? '' : 's'} later`;
      result.append(
        h('div', { class: 'corr-stats' },
          h('div', null, h('span', { class: 'snap-l' }, 'Spearman ρ'), h('strong', { class: 'corr-val' }, rho == null ? '—' : (Math.round(rho * 100) / 100).toFixed(2))),
          h('div', null, h('span', { class: 'snap-l' }, 'Days compared'), h('strong', { class: 'corr-val' }, String(n))),
          h('div', { class: 'corr-text' }, h('strong', null, desc.text), rho != null ? h('p', { class: 'muted small' }, `${xm.label} and ${ym.label} ${lagText}.${n < 30 ? ' Small sample — treat as a hint only.' : ''}`) : null)),
        rho != null || n ? ScatterChart({ pairs, xLabel: xm.label, yLabel: ym.label, xFmt: axisFmt(xm), yFmt: axisFmt(ym) }) : null);
    }
    return Card('Correlation explorer', { sub: 'Pick two metrics to look for loose patterns in your own data.' },
      h('div', { class: 'row3' }, C.field('Metric X', xs), C.field('Metric Y (compared with X)', ys), C.field('Lag', lag)),
      result,
      h('p', { class: 'notice small' }, 'Correlation does not imply causation.'));
  }
}
