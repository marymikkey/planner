// Small reusable form controls. Each returns { el, get(), set?(v) } so forms can be
// assembled without a framework and values read back uniformly.
import { h } from './dom.js';
import { fmtMin, parseTime } from '../core/dates.js';
import { DAY_LETTERS } from '../core/recurrence.js';
import { isRu } from '../i18n.js';

let seq = 0;
const nid = (p) => `${p}-${++seq}`;

export function field(label, ctl, { hint, className = '' } = {}) {
  const id = ctl.id || nid('f');
  const target = ctl.input || ctl.el.querySelector?.('input, select, textarea');
  if (target && !target.id) target.id = id;
  const isGroup = ctl.group;
  return h('div', { class: `field ${className}` },
    isGroup ? h('div', { class: 'label', id: `${id}-l` }, label) : h('label', { class: 'label', for: target?.id || id }, label),
    ctl.el,
    hint ? h('div', { class: 'hint' }, hint) : null);
}

export function textInput(value = '', { placeholder = '', type = 'text', required = false, maxlength, autofocus = false, inputmode } = {}) {
  const input = h('input', { type, value: value ?? '', placeholder, required, maxlength, autofocus, inputmode, autocomplete: 'off', class: 'input' });
  return { el: input, input, get: () => input.value.trim(), set: (v) => { input.value = v ?? ''; } };
}

export function textArea(value = '', { placeholder = '', rows = 3 } = {}) {
  const input = h('textarea', { placeholder, rows, class: 'input' });
  input.value = value ?? '';
  return { el: input, input, get: () => input.value.trim(), set: (v) => { input.value = v ?? ''; } };
}

export function numberInput(value, { min, max, step = 'any', placeholder = '', unit } = {}) {
  const input = h('input', { type: 'number', inputmode: 'decimal', min, max, step, placeholder, class: 'input', value: value ?? '' });
  const el = unit ? h('div', { class: 'with-unit' }, input, h('span', { class: 'unit' }, unit)) : input;
  return {
    el, input,
    get: () => (input.value === '' ? null : Number(input.value)),
    set: (v) => { input.value = v ?? ''; },
  };
}

export function dateInput(value) {
  const input = h('input', { type: 'date', class: 'input', value: value || '' });
  return { el: input, input, get: () => input.value || null, set: (v) => { input.value = v || ''; } };
}

// Time of day. Returns minutes in 0..1439 (callers normalise past-midnight themselves).
export function timeInput(minutes) {
  const input = h('input', { type: 'time', class: 'input', value: minutes != null ? fmtMin(minutes) : '' });
  return { el: input, input, get: () => parseTime(input.value), set: (v) => { input.value = v != null ? fmtMin(v) : ''; } };
}

export function select(options, value) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const input = h('select', { class: 'input' }, opts.map((o) => h('option', { value: o.value ?? '' }, o.label)));
  input.value = value ?? '';
  if (input.value !== (value ?? '') && opts.length) input.value = opts[0].value ?? '';
  const ctl = {
    el: input, input, get: () => (input.value === '' ? null : input.value), set: (v) => { input.value = v ?? ''; },
    setOptions(next, keep) {
      const cur = keep ?? input.value;
      input.replaceChildren(...next.map((o) => h('option', { value: o.value ?? '' }, o.label)));
      input.value = cur ?? '';
      if (input.value !== (cur ?? '')) input.value = next[0]?.value ?? '';
    },
    onChange: (fn) => input.addEventListener('change', fn),
  };
  return ctl;
}

// Segmented radio group (priority, entry type, ...)
export function segmented(options, value, { label = 'Options', onChange } = {}) {
  let current = value;
  const btns = options.map((o) => {
    const opt = typeof o === 'string' ? { value: o, label: o } : o;
    const b = h('button', {
      type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(opt.value === current), dataset: { v: opt.value },
      onClick: () => set(opt.value, true),
    }, opt.label);
    return b;
  });
  const el = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, btns);
  function set(v, user) {
    current = v;
    btns.forEach((b) => { const on = b.dataset.v === v; b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); });
    if (user) onChange?.(v);
  }
  set(current);
  return { el, group: true, get: () => current, set: (v) => set(v, false) };
}

// Toggle chips: single or multi select, with optional custom entry.
export function chipPicker(options, selected = [], { multi = true, allowCustom = false, label = 'Choose' } = {}) {
  const sel = new Set(selected);
  const opts = [...new Set([...options, ...selected])];
  const wrap = h('div', { class: 'chips', role: 'group', 'aria-label': label });
  const build = () => {
    wrap.replaceChildren(...opts.map((o) => h('button', {
      type: 'button', class: `chip${sel.has(o) ? ' on' : ''}`, 'aria-pressed': String(sel.has(o)),
      onClick: () => {
        if (sel.has(o)) sel.delete(o); else { if (!multi) sel.clear(); sel.add(o); }
        build();
      },
    }, o)));
    if (allowCustom) {
      const input = h('input', { class: 'chip-input', placeholder: '+ custom', 'aria-label': 'Add custom tag', onKeydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
      }, onBlur: () => add() });
      const add = () => { const v = input.value.trim(); if (v) { if (!opts.includes(v)) opts.push(v); if (!multi) sel.clear(); sel.add(v); build(); } };
      wrap.append(input);
    }
  };
  build();
  return { el: wrap, group: true, get: () => [...sel], set: (v) => { sel.clear(); (v || []).forEach((x) => { sel.add(x); if (!opts.includes(x)) opts.push(x); }); build(); } };
}

export function dayPicker(days = []) {
  const sel = new Set(days);
  const letters = isRu() ? ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'] : DAY_LETTERS;
  const btns = letters.map((l, i) => h('button', {
    type: 'button', class: `chip day${sel.has(i) ? ' on' : ''}`, 'aria-pressed': String(sel.has(i)),
    'aria-label': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i],
    onClick: (e) => { sel.has(i) ? sel.delete(i) : sel.add(i); e.currentTarget.classList.toggle('on'); e.currentTarget.setAttribute('aria-pressed', String(sel.has(i))); },
  }, l));
  // Monday-first visual order
  const order = [1, 2, 3, 4, 5, 6, 0].map((i) => btns[i]);
  return { el: h('div', { class: 'chips' }, order), group: true, get: () => [...sel].sort() };
}

// Recurrence picker: none / daily / weekdays / weekly(days) / every N days / monthly.
export function recurrenceControl(rec = { type: 'none' }, { allowNone = true } = {}) {
  const types = [
    ...(allowNone ? [{ value: 'none', label: 'Does not repeat' }] : []),
    { value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Every weekday' },
    { value: 'weekly', label: 'Weekly on selected days' }, { value: 'interval', label: 'Every N days' }, { value: 'monthly', label: 'Monthly' },
  ];
  const type = select(types, rec.type || (allowNone ? 'none' : 'daily'));
  const days = dayPicker(rec.days || []);
  const every = numberInput(rec.every || 2, { min: 1, step: 1 });
  const daysRow = h('div', { class: 'sub-field' }, days.el);
  const everyRow = h('div', { class: 'sub-field' }, h('span', { class: 'muted' }, 'Every '), every.el, h('span', { class: 'muted' }, ' days'));
  const sync = () => { daysRow.hidden = type.get() !== 'weekly'; everyRow.hidden = type.get() !== 'interval'; };
  type.onChange(sync); sync();
  return {
    el: h('div', null, type.el, daysRow, everyRow), group: true, input: type.input,
    get: () => {
      const t = type.get() || 'none';
      if (t === 'weekly') return { type: t, days: days.get() };
      if (t === 'interval') return { type: t, every: Math.max(1, every.get() || 1) };
      return { type: t };
    },
  };
}

// 1..10 tap scale. Tap the selected value again to clear it (all check-in fields are optional).
export function rating(value, { label = 'Rating' } = {}) {
  let cur = value ?? null;
  const btns = Array.from({ length: 10 }, (_, i) => h('button', {
    type: 'button', class: 'rate-btn', role: 'radio', 'aria-label': `${label} ${i + 1}`, onClick: () => { cur = cur === i + 1 ? null : i + 1; paint(); },
  }, String(i + 1)));
  const el = h('div', { class: 'rating', role: 'radiogroup', 'aria-label': label }, btns);
  const paint = () => btns.forEach((b, i) => { b.classList.toggle('on', cur === i + 1); b.classList.toggle('lt', cur != null && i + 1 < cur); b.setAttribute('aria-checked', String(cur === i + 1)); });
  paint();
  return { el, group: true, get: () => cur, set: (v) => { cur = v ?? null; paint(); } };
}

export function stepper(value, { min = 0, max = 99, label = 'Value' } = {}) {
  let cur = value ?? null;
  const out = h('span', { class: 'step-val', 'aria-live': 'polite' }, cur ?? '–');
  const set = (v) => { cur = v; out.textContent = v ?? '–'; };
  const el = h('div', { class: 'stepper' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Decrease ${label}`, onClick: () => set(cur == null ? null : cur <= min ? null : cur - 1) }, '−'),
    out,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Increase ${label}`, onClick: () => set(Math.min(max, (cur ?? min - 1) + 1)) }, '+'));
  return { el, group: true, get: () => cur, set };
}

export function checkbox(label, value = false) {
  const input = h('input', { type: 'checkbox', checked: !!value });
  return { el: h('label', { class: 'check-line' }, input, h('span', null, label)), input, get: () => input.checked, set: (v) => { input.checked = !!v; } };
}
