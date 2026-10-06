// Vertical day timeline. Range defaults to the user's preferred day (e.g. 06:00 -> 01:00)
// but expands automatically to contain any item outside it (never a hard limit).
// Overlapping blocks are laid out side by side. Blocks can be dragged (move) or resized
// from the bottom grip; dropping from outside (task lists) is handled by the zone.

import { h, icon } from './dom.js';
import { dropZone, draggable } from './dnd.js';
import { fmtMin, nowMin, todayISO, fmtDur } from '../core/dates.js';
import { areaColor } from '../core/models.js';

const SNAP = 15;
const scrollMemory = new Map(); // scroll position survives re-renders

function layoutColumns(items) {
  // Greedy interval colouring inside clusters of overlapping items.
  const out = new Map();
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.startMin);
      if (c === -1) { c = cols.length; cols.push(0); }
      cols[c] = it.endMin;
      out.set(it.key, { col: c });
    }
    cluster.forEach((it) => { out.get(it.key).cols = cols.length; });
    cluster = [];
  };
  for (const it of items) {
    if (it.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

export function Timeline({
  date, items, settings, scrollKey = date, ppm = 0.95, onOpen, onToggle, onDropPayload, onResize, onUnschedule, onCreateAt,
}) {
  const minStart = items.length ? Math.min(...items.map((i) => i.startMin)) : Infinity;
  const maxEnd = items.length ? Math.max(...items.map((i) => i.endMin)) : -Infinity;
  const rs = Math.min(settings.dayStartMin, Math.floor(minStart / 60) * 60);
  const re = Math.max(settings.dayEndMin, Math.ceil(maxEnd / 60) * 60);
  const height = (re - rs) * ppm;
  const y = (m) => (m - rs) * ppm;
  const isToday = date === todayISO();

  const hours = [];
  for (let m = rs; m <= re; m += 60) {
    hours.push(h('div', { class: 'tl-hour', style: { top: `${y(m)}px` } }, h('span', { class: 'tl-label' }, fmtMin(m))));
  }

  const layout = layoutColumns(items);
  const col = h('div', { class: 'tl-col' });
  for (const it of items) {
    const { col: c, cols } = layout.get(it.key);
    col.append(Block(it, { y, ppm, c, cols, settings, onOpen, onToggle, onResize, rs }));
  }

  const indicator = h('div', { class: 'tl-drop-ind', hidden: true }, h('span', null));
  const body = h('div', { class: 'tl-body', style: { height: `${height}px` } }, hours, col, indicator);

  let nowLine = null;
  const placeNow = () => {
    const n = nowMin();
    const m = n < rs && settings.dayEndMin > 1440 && n < settings.dayEndMin - 1440 ? n + 1440 : n;
    if (!nowLine) return;
    nowLine.style.top = `${y(m)}px`;
    nowLine.hidden = m < rs || m > re;
  };
  if (isToday) {
    nowLine = h('div', { class: 'tl-now', 'aria-hidden': 'true' });
    body.append(nowLine);
    placeNow();
    const iv = setInterval(() => { if (!body.isConnected) clearInterval(iv); else placeNow(); }, 60000);
  }

  // Moving an existing block keeps the grab point; dragging a list row places the block's top at the pointer.
  const timeAt = (info, p) => {
    const raw = rs + (info.y - info.rect.top - (p.from === 'timeline' ? info.grabDy : 6)) / ppm;
    return Math.max(rs, Math.round(raw / SNAP) * SNAP);
  };

  dropZone(body, {
    accept: (p) => ['task', 'event', 'routine'].includes(p.type),
    onOver: (p, info) => {
      const t = timeAt(info, p);
      indicator.hidden = false;
      indicator.style.top = `${y(t)}px`;
      indicator.firstChild.textContent = fmtMin(t);
    },
    onLeave: () => { indicator.hidden = true; },
    onDrop: (p, info) => onDropPayload?.(p, timeAt(info, p), date),
  });

  if (onCreateAt) {
    body.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tl-block')) return;
      const r = body.getBoundingClientRect();
      onCreateAt(Math.round((rs + (e.clientY - r.top) / ppm) / SNAP) * SNAP);
    });
  }

  const scroller = h('div', { class: 'tl-scroll', 'data-tl': scrollKey }, body);
  scroller.addEventListener('scroll', () => scrollMemory.set(scrollKey, scroller.scrollTop), { passive: true });
  requestAnimationFrame(() => {
    if (scrollMemory.has(scrollKey)) scroller.scrollTop = scrollMemory.get(scrollKey);
    else {
      const focusMin = isToday ? Math.max(rs, nowMin() - 60) : items.length ? minStart - 30 : rs + 120;
      scroller.scrollTop = Math.max(0, y(focusMin));
    }
  });

  const empty = !items.length ? h('p', { class: 'tl-empty muted' }, 'Nothing scheduled. Drag a task onto the timeline to block time.') : null;
  return h('div', { class: 'timeline' }, scroller, empty);

  function Block(it, o) {
    const dur = it.endMin - it.startMin;
    const top = o.y(it.startMin);
    const hgt = Math.max(dur * o.ppm, 22);
    const color = areaColor(it.area, settings);
    const short = hgt < 40;
    const el = h('div', {
      class: `tl-block ${it.kind}${it.done ? ' done' : ''}${short ? ' short' : ''}`,
      role: 'button', tabindex: '0',
      'aria-label': `${it.title}, ${fmtMin(it.startMin)} to ${fmtMin(it.endMin)}${it.done ? ', done' : ''}`,
      style: { top: `${top}px`, height: `${hgt}px`, left: `calc(${(o.c / o.cols) * 100}% + 2px)`, width: `calc(${100 / o.cols}% - 4px)`, '--area': color },
      onClick: () => onOpen?.(it),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(it); } },
    },
    it.kind !== 'event' ? h('button', {
      class: `tl-check${it.done ? ' on' : ''}`, type: 'button', 'aria-label': it.done ? 'Mark not done' : 'Mark done',
      onClick: (e) => { e.stopPropagation(); onToggle?.(it); },
    }, it.done ? icon('check', 12) : null) : null,
    h('div', { class: 'tl-text' },
      h('div', { class: 'tl-title' }, it.title),
      h('div', { class: 'tl-time' }, short ? `${fmtMin(it.startMin)}` : `${fmtMin(it.startMin)}–${fmtMin(it.endMin)} · ${fmtDur(dur)}`)),
    onResize ? h('div', { class: 'tl-resize', 'data-nodrag': '', title: 'Drag to resize', 'aria-hidden': 'true' }) : null);

    draggable(el, {
      payload: () => ({ type: it.kind, id: it.id, from: 'timeline' }),
      getGhost: (n) => { const g = n.cloneNode(true); g.style.height = `${hgt}px`; return g; },
    });
    if (onResize) attachResize(el, it, o);
    return el;
  }

  function attachResize(el, it, o) {
    const grip = el.querySelector('.tl-resize');
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { grip.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      const top = el.getBoundingClientRect().top;
      let end = it.endMin;
      const move = (ev) => {
        end = Math.max(it.startMin + SNAP, Math.round((it.startMin + (ev.clientY - top) / o.ppm) / SNAP) * SNAP);
        el.style.height = `${Math.max((end - it.startMin) * o.ppm, 22)}px`;
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        if (end !== it.endMin) onResize(it, end);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  }
}
