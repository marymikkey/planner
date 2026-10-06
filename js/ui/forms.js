// Entity forms: task / event / routine / transaction / meal / health / project / subject / topic ...
// Each opener builds a form out of controls.js pieces and shows it in a sheet.
// Quick Add reuses the same builders (as embeddable bodies) so there is a single
// definition of "what a task looks like".

import { h, toast } from './dom.js';
import * as C from './controls.js';
import { openSheet, confirmDialog } from './modal.js';
import * as store from '../core/store.js';
import * as M from '../core/models.js';
import { todayISO, parseTime, fmtMin, addDays } from '../core/dates.js';
import { normalizeStartMin, materializeRecurringTx } from '../core/actions.js';
import { projectsFor, activeSubjects } from '../core/queries.js';

const settings = () => store.getSettings();
const areaOptions = M.AREAS;

// ---- generic: wrap a body+save into a sheet --------------------------------
function formSheet({ title, body, onSave, onDelete, saveLabel = 'Save', deleteLabel = 'Delete' }) {
  let dlg;
  const form = h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } }, body, h('button', { type: 'submit', hidden: true }));
  const submit = () => {
    const ok = onSave();
    if (ok !== false) dlg.close();
  };
  const footer = [
    onDelete ? h('button', { class: 'btn danger-text', type: 'button', onClick: async () => { if (await confirmDialog(`Delete this ${deleteLabel.toLowerCase()}? This can’t be undone.`)) { onDelete(); dlg.close(); } } }, 'Delete') : null,
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Cancel'),
    h('button', { class: 'btn primary', type: 'button', onClick: submit }, saveLabel),
  ];
  dlg = openSheet({ title, body: form, footer });
  return dlg;
}

const invalid = (ctl, msg) => { ctl.input?.focus(); ctl.input?.setAttribute('aria-invalid', 'true'); toast(msg); return false; };

// Items on the timeline sit in the "planner day": a start like 00:30 means just after midnight.

// ---- Task ------------------------------------------------------------------
export function taskFormBody(initial = {}, { compact = false } = {}) {
  const t = M.makeTask(initial);
  const title = C.textInput(t.title, { placeholder: 'What needs doing?', required: true, autofocus: true });
  const area = C.select(areaOptions, t.area);
  const group = C.select([{ value: '', label: '—' }], '');
  const groupField = C.field('Project', group);
  const syncGroup = () => {
    const a = area.get();
    let opts = null, label = 'Project';
    if (a === 'Work' || a === 'Career & ML') opts = projectsFor(a).map((p) => ({ value: `p:${p.id}`, label: p.name }));
    else if (a === 'Study') { opts = activeSubjects().map((p) => ({ value: `s:${p.id}`, label: p.name })); label = 'Course'; }
    else if (a === 'Personal') { opts = settings().personalCategories.map((c) => ({ value: `c:${c}`, label: c })); label = 'Category'; }
    groupField.hidden = !opts || (!opts.length && a !== 'Personal');
    groupField.querySelector('.label').textContent = label;
    if (opts) group.setOptions([{ value: '', label: a === 'Work' ? 'General' : 'None' }, ...opts], currentGroup());
  };
  const currentGroup = () => (t.projectId ? `p:${t.projectId}` : t.subjectId ? `s:${t.subjectId}` : t.subcategory ? `c:${t.subcategory}` : '');
  area.onChange(() => { t.projectId = t.subjectId = t.subcategory = null; syncGroup(); });
  syncGroup();

  const priority = C.segmented(M.PRIORITIES, t.priority, { label: 'Priority' });
  const due = C.dateInput(t.dueDate);
  const dueTime = C.timeInput(parseTime(t.dueTime));
  const dur = C.numberInput(t.durationMin, { min: 0, step: 5, unit: 'min', placeholder: '30' });
  const durChips = h('div', { class: 'chips' }, [15, 30, 60, 90, 120].map((m) => h('button', { type: 'button', class: 'chip', onClick: () => dur.set(m) }, m >= 60 ? `${m / 60}h` : `${m}m`)));
  const energy = C.segmented(M.ENERGY, t.energy, { label: 'Energy' });
  const status = C.select(M.STATUSES, t.status);
  const tags = C.textInput((t.tags || []).join(', '), { placeholder: 'comma, separated' });
  const notes = C.textArea(t.notes, { placeholder: 'Notes' });
  const sDate = C.dateInput(t.scheduledDate);
  const sStart = C.timeInput(t.startMin != null ? t.startMin : null);
  const sEnd = C.timeInput(t.endMin != null ? t.endMin : null);
  const actual = C.numberInput(t.actualMin, { min: 0, step: 5, unit: 'min', placeholder: 'optional' });
  const rec = C.recurrenceControl(t.recurrence || { type: 'none' });

  const main = [
    C.field('Title', title),
    h('div', { class: 'row2' }, C.field('Area', area), groupField),
    C.field('Priority', priority),
    h('div', { class: 'row2' }, C.field('Due date', due), C.field('Duration', dur)),
    h('div', { class: 'quick-chips' }, durChips),
  ];
  const more = [
    h('div', { class: 'row2' }, C.field('Due time', dueTime), C.field('Status', status)),
    C.field('Energy needed', energy),
    h('fieldset', { class: 'fieldset' }, h('legend', null, 'Time block (optional)'),
      h('div', { class: 'row3' }, C.field('Day', sDate), C.field('Start', sStart), C.field('End', sEnd))),
    C.field('Repeat', rec),
    C.field('Tags', tags),
    C.field('Notes', notes),
    C.field('Actual time spent', actual, { hint: 'Optional. Used for Planned vs Actual in Analytics.' }),
  ];
  const el = h('div', { class: 'form-body' }, main, compact ? h('details', { class: 'more' }, h('summary', null, 'More options'), h('div', { class: 'form-body' }, more)) : more);

  return {
    el, focus: () => title.input.focus(),
    read() {
      if (!title.get()) return { error: [title, 'Add a title'] };
      const g = group.get();
      let st = status.get();
      const sd = sDate.get();
      let startMin = sStart.get(), endMin = sEnd.get();
      if (sd && startMin != null) {
        startMin = normalizeStartMin(startMin);
        if (endMin != null) {
          if (startMin >= 1440) endMin += 1440;
          if (endMin <= startMin) endMin += 1440;
        } else endMin = startMin + (dur.get() || 30);
      } else { startMin = null; endMin = null; }
      const scheduled = sd && startMin != null;
      let durationMin = dur.get();
      if (scheduled && endMin != null && (durationMin == null || sEnd.get() != null)) durationMin = endMin - startMin;
      if (st === 'Inbox' && (due.get() || scheduled)) st = 'Planned';
      return {
        value: {
          ...initial, title: title.get(), area: area.get(),
          projectId: g?.startsWith('p:') ? g.slice(2) : null,
          subjectId: g?.startsWith('s:') ? g.slice(2) : null,
          subcategory: g?.startsWith('c:') ? g.slice(2) : null,
          priority: priority.get(), dueDate: due.get(), dueTime: dueTime.get() != null ? fmtMin(dueTime.get()) : null,
          durationMin, energy: energy.get(), status: st, tags: tags.get().split(',').map((x) => x.trim()).filter(Boolean),
          notes: notes.get(), scheduledDate: scheduled ? sd : null, startMin: scheduled ? startMin : null, endMin: scheduled ? endMin : null,
          actualMin: actual.get(), recurrence: rec.get(),
          completedDate: st === 'Done' ? (initial.completedDate || todayISO()) : null,
          createdDate: initial.createdDate || todayISO(),
        },
      };
    },
  };
}

export function openTaskForm(initial = {}, { onSaved } = {}) {
  const form = taskFormBody(initial);
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New task' : 'Edit task',
    body: form.el,
    deleteLabel: 'Task',
    onDelete: isNew ? null : () => store.remove('tasks', initial.id),
    onSave: () => {
      const r = form.read();
      if (r.error) return invalid(...r.error);
      const saved = store.put('tasks', M.makeTask(r.value));
      if (isNew) store.updateSettings({ lastArea: saved.area });
      onSaved?.(saved);
    },
  });
}

// ---- Event / class / exam --------------------------------------------------
export function eventFormBody(initial = {}) {
  const e = M.makeEvent({ date: todayISO(), ...initial });
  const kind = e.kind;
  const title = C.textInput(e.title, { placeholder: kind === 'class' ? 'Class name' : kind === 'exam' ? 'Exam or test' : 'Meeting, appointment…', autofocus: true });
  const date = C.dateInput(e.date);
  const start = C.timeInput(e.startMin % 1440);
  const end = C.timeInput(e.endMin % 1440);
  const area = C.select(areaOptions, e.area);
  const group = C.select([{ value: '', label: '—' }], '');
  const groupField = C.field('Project', group);
  const cur = () => (e.projectId ? `p:${e.projectId}` : e.subjectId ? `s:${e.subjectId}` : '');
  const sync = () => {
    const a = area.get();
    const opts = a === 'Study' ? activeSubjects().map((s) => ({ value: `s:${s.id}`, label: s.name })) : (a === 'Work' || a === 'Career & ML') ? projectsFor(a).map((p) => ({ value: `p:${p.id}`, label: p.name })) : null;
    groupField.hidden = !opts;
    groupField.querySelector('.label').textContent = a === 'Study' ? 'Course' : 'Project';
    if (opts) group.setOptions([{ value: '', label: 'None' }, ...opts], cur());
  };
  area.onChange(() => { e.projectId = e.subjectId = null; sync(); }); sync();
  const rec = C.recurrenceControl(e.recurrence || { type: 'none' });
  const notes = C.textArea(e.notes, { placeholder: 'Notes' });
  const el = h('div', { class: 'form-body' },
    C.field('Title', title),
    C.field('Date', date),
    h('div', { class: 'row2' }, C.field('Starts', start), C.field('Ends', end)),
    h('div', { class: 'row2' }, C.field('Area', area), groupField),
    C.field('Repeat', rec),
    C.field('Notes', notes));
  return {
    el, focus: () => title.input.focus(),
    read() {
      if (!title.get()) return { error: [title, 'Add a title'] };
      const s = normalizeStartMin(start.get() ?? 600);
      let en = end.get() ?? s + 60;
      en = s >= 1440 ? en + 1440 : en;
      if (en <= s) en += 1440;
      const g = group.get();
      return { value: { ...initial, kind, title: title.get(), date: date.get() || todayISO(), startMin: s, endMin: en, area: area.get(), projectId: g?.startsWith('p:') ? g.slice(2) : null, subjectId: g?.startsWith('s:') ? g.slice(2) : null, recurrence: rec.get(), notes: notes.get() } };
    },
  };
}

export function openEventForm(initial = {}, { onSaved } = {}) {
  const form = eventFormBody(initial);
  const isNew = !initial.id;
  const noun = initial.kind === 'class' ? 'class' : initial.kind === 'exam' ? 'exam' : 'event';
  formSheet({
    title: `${isNew ? 'New' : 'Edit'} ${noun}`, body: form.el, deleteLabel: noun,
    onDelete: isNew ? null : () => store.remove('events', initial.id),
    onSave: () => {
      const r = form.read();
      if (r.error) return invalid(...r.error);
      const saved = store.put('events', M.makeEvent(r.value)); // persist first: `onSaved?.(store.put())` would skip put() when onSaved is undefined
      onSaved?.(saved);
    },
  });
}

// ---- Routine ---------------------------------------------------------------
export function routineFormBody(initial = {}) {
  const r = M.makeRoutine({ mode: 'weekly', ...initial });
  const title = C.textInput(r.title, { placeholder: 'e.g. Treadmill, Vacuum…', autofocus: true });
  const area = C.select(areaOptions, r.area);
  const mode = C.segmented([{ value: 'weekly', label: 'Weekly goal' }, { value: 'fixed', label: 'Fixed schedule' }], r.mode, { label: 'Routine style', onChange: () => sync() });
  const target = C.stepper(r.target || 3, { min: 1, max: 14, label: 'times per week' });
  const rec = C.recurrenceControl(r.recurrence?.type === 'none' ? { type: 'daily' } : r.recurrence, { allowNone: false });
  const start = C.timeInput(r.startMin != null ? r.startMin % 1440 : null);
  const dur = C.numberInput(r.durationMin, { min: 5, step: 5, unit: 'min' });
  const notes = C.textArea(r.notes, { placeholder: 'Notes' });
  const targetRow = h('div', null, C.field('Times per week', target, { hint: 'Any days you like — no fixed weekdays needed.' }));
  const fixedRow = h('div', { class: 'form-body' }, C.field('Repeats', rec), h('div', { class: 'row2' }, C.field('Time (optional)', start), C.field('Duration', dur)));
  const sync = () => { targetRow.hidden = mode.get() !== 'weekly'; fixedRow.hidden = mode.get() !== 'fixed'; };
  sync();
  const el = h('div', { class: 'form-body' }, C.field('Title', title), C.field('Area', area), C.field('Style', mode), targetRow, fixedRow, C.field('Notes', notes));
  return {
    el, focus: () => title.input.focus(),
    read() {
      if (!title.get()) return { error: [title, 'Add a title'] };
      const fixed = mode.get() === 'fixed';
      return { value: { ...initial, title: title.get(), area: area.get(), mode: mode.get(), target: target.get() || 3, recurrence: fixed ? rec.get() : { type: 'none' }, startMin: fixed && start.get() != null ? normalizeStartMin(start.get()) : null, durationMin: dur.get(), notes: notes.get(), startDate: initial.startDate || todayISO() } };
    },
  };
}

export function openRoutineForm(initial = {}, { onSaved } = {}) {
  const form = routineFormBody(initial);
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New routine' : 'Edit routine', body: form.el, deleteLabel: 'Routine',
    onDelete: isNew ? null : () => store.remove('routines', initial.id),
    onSave: () => {
      const r = form.read();
      if (r.error) return invalid(...r.error);
      const saved = store.put('routines', M.makeRoutine(r.value));
      onSaved?.(saved);
    },
  });
}

// ---- Transaction -----------------------------------------------------------
export function transactionFormBody(initial = {}) {
  const t = M.makeTransaction({ date: todayISO(), ...initial });
  const type = C.segmented([{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'savings', label: 'Savings' }], t.type, { label: 'Type', onChange: () => sync() });
  const amount = C.numberInput(t.amount || '', { min: 0, step: 'any', placeholder: '0', unit: M.CURRENCIES[settings().currency] || settings().currency });
  amount.input.setAttribute('inputmode', 'decimal');
  const cats = store.list('financeCategories').filter((c) => !c.archived || c.id === t.categoryId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const category = C.select(cats.map((c) => ({ value: c.id, label: c.name })), t.categoryId || cats.find((c) => c.name === 'Groceries')?.id || cats[0]?.id);
  const catField = C.field('Category', category);
  const date = C.dateInput(t.date);
  const desc = C.textInput(t.description, { placeholder: 'Description' });
  const freq = C.select([{ value: '', label: 'One-time' }, { value: 'monthly', label: 'Repeats monthly' }, { value: 'weekly', label: 'Repeats weekly' }], '');
  const note = C.textArea(t.note, { placeholder: 'Optional note', rows: 2 });
  const sync = () => { catField.hidden = type.get() !== 'expense'; };
  sync();
  const recField = !initial.id ? C.field('Recurrence', freq) : null;
  const el = h('div', { class: 'form-body' }, C.field('Type', type), C.field('Amount', amount), catField, C.field('Date', date), C.field('Description', desc), recField, C.field('Note', note));
  return {
    el, focus: () => amount.input.focus(),
    read() {
      const a = amount.get();
      if (!a || a <= 0) return { error: [amount, 'Enter an amount'] };
      return { value: { ...initial, type: type.get(), amount: a, categoryId: type.get() === 'expense' ? category.get() : null, date: date.get() || todayISO(), description: desc.get(), note: note.get() }, frequency: freq.get() };
    },
  };
}

export function openTransactionForm(initial = {}, { onSaved } = {}) {
  const form = transactionFormBody(initial);
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New transaction' : 'Edit transaction', body: form.el, deleteLabel: 'Transaction',
    onDelete: isNew ? null : () => store.remove('transactions', initial.id),
    onSave: () => {
      const r = form.read();
      if (r.error) return invalid(...r.error);
      saveTransaction(r);
      onSaved?.();
    },
  });
}

export function saveTransaction(r) {
  if (r.frequency) {
    // Recurring: create a template; the first instance is generated right away.
    const v = r.value;
    store.put('recurringTransactions', M.makeRecurringTx({ type: v.type, amount: v.amount, categoryId: v.categoryId, description: v.description, note: v.note, frequency: r.frequency, startDate: v.date }));
    materializeRecurringTx();
  } else store.put('transactions', M.makeTransaction(r.value));
}

// ---- Meal ------------------------------------------------------------------
export function mealFormBody(initial = {}) {
  const now = new Date();
  const hh = now.getHours();
  const guessType = hh < 11 ? 'Breakfast' : hh < 16 ? 'Lunch' : hh < 22 ? 'Dinner' : 'Other';
  const m = M.makeMeal({ date: todayISO(), time: fmtMin(hh * 60 + now.getMinutes()), type: guessType, ...initial });
  const desc = C.textInput(m.description, { placeholder: 'What did you eat?', autofocus: true });
  const type = C.select(M.MEAL_TYPES, m.type);
  const time = C.timeInput(parseTime(m.time));
  const date = C.dateInput(m.date);
  const tags = C.chipPicker(settings().mealTags, m.tags, { allowCustom: true, label: 'Tags' });
  const fields = [C.field('Description', desc), h('div', { class: 'row3' }, C.field('Type', type), C.field('Time', time), C.field('Date', date)), C.field('Tags', tags)];
  let cal, pro, fat, carb;
  if (settings().macros) {
    cal = C.numberInput(m.calories, { min: 0, unit: 'kcal' }); pro = C.numberInput(m.protein, { min: 0, unit: 'g' });
    fat = C.numberInput(m.fat, { min: 0, unit: 'g' }); carb = C.numberInput(m.carbs, { min: 0, unit: 'g' });
    fields.push(h('div', { class: 'row2' }, C.field('Calories', cal), C.field('Protein', pro)), h('div', { class: 'row2' }, C.field('Fat', fat), C.field('Carbs', carb)));
  }
  return {
    el: h('div', { class: 'form-body' }, fields), focus: () => desc.input.focus(),
    read() {
      if (!desc.get()) return { error: [desc, 'Describe the meal'] };
      return { value: { ...initial, description: desc.get(), type: type.get(), time: time.get() != null ? fmtMin(time.get()) : null, date: date.get() || todayISO(), tags: tags.get(), ...(cal ? { calories: cal.get(), protein: pro.get(), fat: fat.get(), carbs: carb.get() } : {}) } };
    },
  };
}

export function openMealForm(initial = {}, { onSaved } = {}) {
  const form = mealFormBody(initial);
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'Log a meal' : 'Edit meal', body: form.el, deleteLabel: 'Meal',
    onDelete: isNew ? null : () => store.remove('meals', initial.id),
    onSave: () => {
      const r = form.read();
      if (r.error) return invalid(...r.error);
      const saved = store.put('meals', M.makeMeal(r.value));
      onSaved?.(saved);
    },
  });
}

// ---- Health daily check-in -------------------------------------------------
// Every field is optional: entering only a weight is a complete check-in.
export function healthFormBody(date = todayISO()) {
  const existing = store.get('healthEntries', date) || {};
  const e = existing;
  const weight = C.numberInput(e.weight, { min: 20, max: 400, step: 0.1, unit: 'kg', placeholder: '—' });
  const bed = C.timeInput(e.bedtimeMin ?? null);
  const wake = C.timeInput(e.wakeMin ?? null);
  const sleepOut = h('span', { class: 'sleep-calc' }, '');
  const calc = () => {
    const b = bed.get(), w = wake.get();
    sleepOut.textContent = b != null && w != null ? `Sleep: ${Math.floor(sleepMinutes(b, w) / 60)}h ${sleepMinutes(b, w) % 60}m` : '';
  };
  bed.input.addEventListener('input', calc); wake.input.addEventListener('input', calc); calc();
  const coffee = C.stepper(e.coffee, { min: 0, max: 20, label: 'cups of coffee' });
  const activity = C.textInput(e.activity || '', { placeholder: 'e.g. Walk, Treadmill' });
  const actMin = C.numberInput(e.activityMin, { min: 0, step: 5, unit: 'min' });
  const steps = C.numberInput(e.steps, { min: 0, step: 100, placeholder: 'optional' });
  const ratings = {
    mood: C.rating(e.mood, { label: 'Mood' }), energy: C.rating(e.energy, { label: 'Energy' }), stress: C.rating(e.stress, { label: 'Stress' }),
    productivity: C.rating(e.productivity, { label: 'Productivity' }), wellbeing: C.rating(e.wellbeing, { label: 'Overall wellbeing' }),
  };
  const symptoms = C.textInput(e.symptoms || '', { placeholder: 'optional' });
  const notes = C.textArea(e.notes || '', { placeholder: 'Anything worth remembering', rows: 2 });

  const customs = store.list('customMetrics').filter((m) => !m.archived);
  const customCtl = customs.map((m) => {
    const v = e.custom?.[m.id];
    let ctl;
    if (m.type === 'boolean') ctl = C.segmented([{ value: '', label: '–' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], v === true ? 'yes' : v === false ? 'no' : '', { label: m.name });
    else if (m.type === 'number') ctl = C.numberInput(v, { unit: m.unit });
    else if (m.type === 'scale') ctl = C.rating(v, { label: m.name });
    else if (m.type === 'category') ctl = C.select([{ value: '', label: '—' }, ...(m.options || []).map((o) => ({ value: o, label: o }))], v ?? '');
    else ctl = C.textInput(v ?? '');
    return { m, ctl };
  });

  const rate = (label, key) => C.field(label, ratings[key]);
  const el = h('div', { class: 'form-body' },
    C.field('Weight', weight),
    h('div', { class: 'row2' }, C.field('Bedtime', bed), C.field('Wake time', wake)), sleepOut,
    C.field('Coffee', coffee),
    h('div', { class: 'row2' }, C.field('Activity', activity), C.field('Duration', actMin)),
    C.field('Steps', steps),
    h('fieldset', { class: 'fieldset' }, h('legend', null, 'How did the day feel? (1–10, optional)'),
      rate('Mood', 'mood'), rate('Energy', 'energy'), rate('Stress', 'stress'), rate('Productivity', 'productivity'), rate('Overall wellbeing', 'wellbeing')),
    customCtl.length ? h('fieldset', { class: 'fieldset' }, h('legend', null, 'Custom metrics'), customCtl.map(({ m, ctl }) => C.field(m.name, ctl))) : null,
    C.field('Symptoms', symptoms), C.field('Notes', notes),
    h('p', { class: 'muted small' }, 'A lightweight wellbeing log — not medical advice.'));

  return {
    el, focus: () => weight.input.focus(),
    read() {
      const b = bed.get(), w = wake.get();
      const custom = {};
      for (const { m, ctl } of customCtl) {
        let v = ctl.get();
        if (m.type === 'boolean') v = v === 'yes' ? true : v === 'no' ? false : null;
        if (v != null && v !== '') custom[m.id] = v;
      }
      const raw = {
        weight: weight.get(), bedtimeMin: b, wakeMin: w, sleepMin: b != null && w != null ? sleepMinutes(b, w) : null,
        coffee: coffee.get(), activity: activity.get() || null, activityMin: actMin.get(), steps: steps.get(),
        mood: ratings.mood.get(), energy: ratings.energy.get(), stress: ratings.stress.get(), productivity: ratings.productivity.get(), wellbeing: ratings.wellbeing.get(),
        symptoms: symptoms.get() || null, notes: notes.get() || null, custom,
      };
      // Store only what was actually entered.
      const entry = { id: date, date };
      for (const [k, v] of Object.entries(raw)) if (v != null && v !== '' && !(k === 'custom' && !Object.keys(v).length)) entry[k] = v;
      return { value: entry, empty: Object.keys(entry).length <= 2 };
    },
  };
}

export const sleepMinutes = (bed, wake) => (wake > bed ? wake - bed : wake + 1440 - bed);

export function openHealthForm(date = todayISO(), { onSaved } = {}) {
  const form = healthFormBody(date);
  const exists = !!store.get('healthEntries', date);
  formSheet({
    title: `Check-in · ${date === todayISO() ? 'today' : date}`, body: form.el, saveLabel: 'Save check-in', deleteLabel: 'Check-in',
    onDelete: exists ? () => store.remove('healthEntries', date) : null,
    onSave: () => {
      const r = form.read();
      if (r.empty) { toast('Nothing to save yet — fill in anything you like.'); return false; }
      store.put('healthEntries', r.value);
      onSaved?.();
    },
  });
}

// ---- Project / subject / topic / group / metric / category -----------------
export function openProjectForm(initial = {}) {
  const p = M.makeProject(initial);
  const name = C.textInput(p.name, { placeholder: 'Project name', autofocus: true });
  const deadline = C.dateInput(p.deadline);
  const notes = C.textArea(p.notes, { placeholder: 'Notes' });
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New project' : 'Edit project', deleteLabel: 'Project',
    body: h('div', { class: 'form-body' }, C.field('Name', name), C.field('Deadline', deadline), C.field('Notes', notes)),
    onDelete: isNew ? null : () => {
      store.list('tasks').filter((t) => t.projectId === initial.id).forEach((t) => store.put('tasks', { ...t, projectId: null }));
      store.remove('projects', initial.id);
    },
    onSave: () => { if (!name.get()) return invalid(name, 'Add a name'); store.put('projects', M.makeProject({ ...initial, name: name.get(), deadline: deadline.get(), notes: notes.get() })); },
  });
}

export function openSubjectForm(initial = {}) {
  const name = C.textInput(initial.name || '', { placeholder: 'Course name', autofocus: true });
  const notes = C.textArea(initial.notes || '', { placeholder: 'Notes' });
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New course' : 'Edit course', deleteLabel: 'Course',
    body: h('div', { class: 'form-body' }, C.field('Name', name), C.field('Notes', notes)),
    onDelete: isNew ? null : () => store.remove('subjects', initial.id),
    onSave: () => { if (!name.get()) return invalid(name, 'Add a name'); store.put('subjects', M.makeSubject({ ...initial, name: name.get(), notes: notes.get() })); },
  });
}

export function openGroupForm(initial = {}) {
  const name = C.textInput(initial.name || '', { placeholder: 'Group name', autofocus: true });
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New roadmap group' : 'Edit group', deleteLabel: 'Group',
    body: h('div', { class: 'form-body' }, C.field('Name', name)),
    onDelete: isNew ? null : () => { store.list('roadmapTopics').filter((t) => t.groupId === initial.id).forEach((t) => store.remove('roadmapTopics', t.id)); store.remove('roadmapGroups', initial.id); },
    onSave: () => { if (!name.get()) return invalid(name, 'Add a name'); store.put('roadmapGroups', M.makeGroup({ order: store.list('roadmapGroups').length, ...initial, name: name.get() })); },
  });
}

export function openTopicForm(initial = {}) {
  const t = M.makeTopic(initial);
  const name = C.textInput(t.name, { placeholder: 'Topic', autofocus: true });
  const status = C.segmented(M.TOPIC_STATUSES, t.status, { label: 'Status' });
  const progress = h('input', { type: 'range', min: 0, max: 100, step: 5, value: t.progress || 0, class: 'range' });
  const pOut = h('output', { class: 'range-out' }, `${t.progress || 0}%`);
  progress.addEventListener('input', () => { pOut.textContent = `${progress.value}%`; });
  const notes = C.textArea(t.notes, { placeholder: 'Notes' });
  const res = C.textArea((t.resources || []).join('\n'), { placeholder: 'One resource per line (title or link)' });
  const isNew = !initial.id;
  const related = !isNew ? store.list('tasks').filter((x) => x.topicId === initial.id) : [];
  formSheet({
    title: isNew ? 'New topic' : 'Edit topic', deleteLabel: 'Topic',
    body: h('div', { class: 'form-body' }, C.field('Topic', name), C.field('Status', status),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'topic-progress' }, 'Progress'), h('div', { class: 'range-row' }, Object.assign(progress, { id: 'topic-progress' }), pOut)),
      C.field('Notes', notes), C.field('Resources', res),
      !isNew ? h('div', { class: 'field' }, h('div', { class: 'label' }, 'Related tasks'),
        related.length ? h('ul', { class: 'plain-list' }, related.map((x) => h('li', null, `${x.status === 'Done' ? '✓ ' : ''}${x.title}`))) : h('p', { class: 'muted small' }, 'None yet.'),
        h('button', { class: 'btn', type: 'button', onClick: () => openTaskForm({ area: 'Career & ML', topicId: initial.id, title: '' }) }, 'Add related task')) : null),
    onDelete: isNew ? null : () => store.remove('roadmapTopics', initial.id),
    onSave: () => {
      if (!name.get()) return invalid(name, 'Add a name');
      store.put('roadmapTopics', M.makeTopic({ ...initial, name: name.get(), status: status.get(), progress: Number(progress.value), notes: notes.get(), resources: res.get().split('\n').map((x) => x.trim()).filter(Boolean) }));
    },
  });
}

export function openMetricForm(initial = {}) {
  const m = M.makeMetric(initial);
  const name = C.textInput(m.name, { placeholder: 'Metric name', autofocus: true });
  const type = C.select(M.METRIC_TYPES.map((x) => ({ value: x, label: { boolean: 'Yes / No', number: 'Number', scale: 'Scale 1–10', category: 'Category', text: 'Text' }[x] })), m.type);
  const unit = C.textInput(m.unit, { placeholder: 'e.g. pages, glasses' });
  const options = C.textInput((m.options || []).join(', '), { placeholder: 'comma, separated options' });
  const unitF = C.field('Unit', unit), optF = C.field('Options', options);
  const sync = () => { unitF.hidden = type.get() !== 'number'; optF.hidden = type.get() !== 'category'; };
  type.onChange(sync); sync();
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New custom metric' : 'Edit metric', deleteLabel: 'Metric',
    body: h('div', { class: 'form-body' }, C.field('Name', name), C.field('Type', type), unitF, optF),
    onDelete: isNew ? null : () => store.put('customMetrics', { ...initial, archived: true }),
    onSave: () => { if (!name.get()) return invalid(name, 'Add a name'); store.put('customMetrics', M.makeMetric({ ...initial, name: name.get(), type: type.get(), unit: unit.get(), options: options.get().split(',').map((x) => x.trim()).filter(Boolean) })); },
  });
}

export function openCategoryForm(initial = {}) {
  const name = C.textInput(initial.name || '', { placeholder: 'Category name', autofocus: true });
  const limit = C.numberInput(initial.limit ?? null, { min: 0, placeholder: 'no limit' });
  const isNew = !initial.id;
  formSheet({
    title: isNew ? 'New category' : 'Edit category', deleteLabel: 'Category',
    body: h('div', { class: 'form-body' }, C.field('Name', name), C.field('Monthly limit', limit)),
    onDelete: isNew ? null : () => store.put('financeCategories', { ...initial, archived: true }),
    onSave: () => { if (!name.get()) return invalid(name, 'Add a name'); store.put('financeCategories', { order: store.list('financeCategories').length, archived: false, ...initial, name: name.get(), limit: limit.get() }); },
  });
}

export { formSheet, addDays };
