// Minimal dependency-free SVG charts (line / bars / dots, and scatter), themed through CSS
// variables so they follow light/dark mode. Missing values break lines instead of being
// interpolated, so gaps in tracking stay visible and honest.

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, styles = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v);
  return el;
};

export function niceScale(min, max, ticks = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const rough = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= rough) || mag * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step * 1e6) / 1e6 * step);
  return { lo, hi, ticks: out };
}

// Charts are rebuilt at the container's real pixel width so text stays crisp and readable
// on phones (no stretched SVG text).
function responsive(wrap, build, minH) {
  let w = 0;
  wrap.style.minHeight = `${minH}px`;
  new ResizeObserver((entries) => {
    const nw = Math.round(entries[0].contentRect.width);
    if (nw > 0 && Math.abs(nw - w) > 6) { w = nw; wrap.replaceChildren(...build(Math.max(260, nw))); }
  }).observe(wrap);
  return wrap;
}

const PAD = { l: 46, r: 10, t: 10, b: 24 };

export function LineChart(opts) {
  return responsive(h('div', { class: 'chart' }), (W) => buildLine(opts, W), (opts.height || 190) + 40);
}

function buildLine({ domain, series, height = 190, yFmt = (v) => String(Math.round(v * 10) / 10), xFmt = (v) => v, yMin, yMax, label = 'Chart' }, W) {
  const H = height;
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  const vals = series.flatMap((x) => x.values).filter((v) => v != null);
  if (!vals.length) return [h('div', { class: 'chart-empty' }, 'No data in this range yet.')];
  const hasBars = series.some((x) => x.type === 'bars');
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hasBars) lo = Math.min(0, lo);
  if (yMin != null) lo = yMin;
  if (yMax != null) hi = yMax;
  const pad = hasBars || yMin != null ? 0 : (hi - lo) * 0.1 || 1;
  const sc = niceScale(yMin != null ? lo : lo - pad, yMax != null ? hi : hi + pad, 4);
  const n = domain.length;
  const slot = pw / n;
  const x = (i) => PAD.l + (i + 0.5) * slot;
  const y = (v) => PAD.t + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, class: 'chart-svg' });
  for (const t of sc.ticks) {
    svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: y(t), y2: y(t), class: 'c-grid' }));
    const tx = s('text', { x: PAD.l - 6, y: y(t) + 3.5, class: 'c-axis', 'text-anchor': 'end' }); tx.textContent = yFmt(t); svg.append(tx);
  }
  const xt = Math.min(5, n);
  for (let k = 0; k < xt; k++) {
    const i = xt === 1 ? 0 : Math.round((k * (n - 1)) / (xt - 1));
    const tx = s('text', { x: x(i), y: H - 6, class: 'c-axis', 'text-anchor': k === 0 ? 'start' : k === xt - 1 ? 'end' : 'middle' });
    tx.setAttribute('x', k === 0 ? PAD.l : k === xt - 1 ? W - PAD.r : x(i));
    tx.textContent = xFmt(domain[i]); svg.append(tx);
  }

  for (const ser of series) {
    const color = ser.color || 'var(--c1)';
    if (ser.type === 'bars') {
      const bw = Math.max(2, Math.min(22, slot * 0.7));
      ser.values.forEach((v, i) => {
        if (v == null) return;
        const y0 = y(Math.max(0, sc.lo)), y1 = y(v);
        svg.append(s('rect', { x: x(i) - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y0 - y1)), rx: Math.min(3, bw / 2) }, { fill: color, opacity: ser.opacity ?? 0.85 }));
      });
      continue;
    }
    if (ser.type !== 'dots') {
      let d = '', pen = false;
      ser.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
      });
      if (d) svg.append(s('path', { d, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-width': ser.width || 2, ...(ser.dashed ? { 'stroke-dasharray': '4 4' } : {}) }, { stroke: color, opacity: ser.opacity ?? 1 }));
    }
    if (ser.type === 'dots' || (ser.points ?? n <= 45)) {
      ser.values.forEach((v, i) => { if (v != null) svg.append(s('circle', { cx: x(i), cy: y(v), r: ser.type === 'dots' ? 2.8 : 2.2 }, { fill: color, opacity: ser.type === 'dots' ? (ser.opacity ?? 0.55) : 1 })); });
    }
  }

  const cursor = s('line', { y1: PAD.t, y2: PAD.t + ph, class: 'c-cursor' }); cursor.style.display = 'none'; svg.append(cursor);
  const readout = h('div', { class: 'chart-readout', 'aria-live': 'off' }, ' ');
  const overlay = s('rect', { x: PAD.l, y: PAD.t, width: pw, height: ph, fill: 'transparent' });
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.floor((px - PAD.l) / slot)));
    cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i)); cursor.style.display = '';
    readout.replaceChildren(h('strong', null, xFmt(domain[i], true)), ...series.filter((q) => !q.hidden).map((q) =>
      h('span', { class: 'ro-item' }, h('i', { class: 'swatch', style: { background: q.color || 'var(--c1)' } }), `${q.name}: `, q.values[i] == null ? '—' : (q.fmt || yFmt)(q.values[i]))));
  };
  overlay.addEventListener('pointermove', show);
  overlay.addEventListener('pointerdown', show);
  overlay.addEventListener('pointerleave', () => { cursor.style.display = 'none'; });
  svg.append(overlay);

  const legend = series.filter((q) => !q.hidden).length > 1
    ? h('div', { class: 'legend' }, series.filter((q) => !q.hidden).map((q) => h('span', { class: 'ro-item' }, h('i', { class: 'swatch', style: { background: q.color || 'var(--c1)' } }), q.name)))
    : null;
  return [readout, svg, legend];
}

export function ScatterChart(opts) {
  return responsive(h('div', { class: 'chart' }), (W) => buildScatter(opts, W), (opts.height || 230) + 30);
}

function buildScatter({ pairs, xFmt = String, yFmt = String, xLabel, yLabel, height = 230 }, W) {
  if (!pairs.length) return [h('div', { class: 'chart-empty' }, 'No overlapping data.')];
  const H = height, pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b - 12;
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]);
  const sx = niceScale(Math.min(...xs), Math.max(...xs), 5), sy = niceScale(Math.min(...ys), Math.max(...ys), 4);
  const X = (v) => PAD.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw;
  const Y = (v) => PAD.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': `Scatter plot of ${xLabel} and ${yLabel}` });
  for (const t of sy.ticks) {
    svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(t), y2: Y(t), class: 'c-grid' }));
    const tx = s('text', { x: PAD.l - 6, y: Y(t) + 3.5, class: 'c-axis', 'text-anchor': 'end' }); tx.textContent = yFmt(t); svg.append(tx);
  }
  for (const t of sx.ticks) {
    const tx = s('text', { x: X(t), y: PAD.t + ph + 14, class: 'c-axis', 'text-anchor': 'middle' }); tx.textContent = xFmt(t); svg.append(tx);
  }
  for (const [px, py] of pairs) svg.append(s('circle', { cx: X(px), cy: Y(py), r: 3.6 }, { fill: 'var(--c1)', opacity: 0.55 }));
  const ax = s('text', { x: W / 2, y: H - 2, class: 'c-axis', 'text-anchor': 'middle' }); ax.textContent = xLabel; svg.append(ax);
  return [svg, h('div', { class: 'legend' }, `Each dot is one day · vertical axis: ${yLabel}`)];
}
