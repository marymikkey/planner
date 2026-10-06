// Global "+" flow: one sheet, six types, no navigation. Reuses the entity form bodies.
import { h } from './dom.js';
import { openSheet } from './modal.js';
import { toast } from './dom.js';
import * as C from './controls.js';
import * as F from './forms.js';
import * as store from '../core/store.js';
import * as M from '../core/models.js';
import { todayISO } from '../core/dates.js';

const TYPES = [
  { value: 'task', label: 'Task' }, { value: 'event', label: 'Event' }, { value: 'routine', label: 'Routine' },
  { value: 'expense', label: 'Expense' }, { value: 'meal', label: 'Meal' }, { value: 'health', label: 'Health' },
];

export function openQuickAdd({ type = 'task', date = todayISO(), area } = {}) {
  let form = null;
  let current = type;
  const host = h('div', { class: 'qa-body' });
  const defaults = {
    task: () => F.taskFormBody({ dueDate: date, area: area || store.getSettings().lastArea || 'Work' }, { compact: true }),
    event: () => F.eventFormBody({ date, ...(area ? { area } : {}) }),
    routine: () => F.routineFormBody(area ? { area } : {}),
    expense: () => F.transactionFormBody({ date }),
    meal: () => F.mealFormBody({ date }),
    health: () => F.healthFormBody(date),
  };
  const show = (t) => {
    current = t;
    form = defaults[t]();
    host.replaceChildren(form.el);
    requestAnimationFrame(() => form.focus?.());
  };
  const tabs = C.segmented(TYPES, current, { label: 'What to add', onChange: show });
  const save = () => {
    const r = form.read();
    if (r.error) { r.error[0].input?.focus(); toast(r.error[1]); return; }
    if (r.empty) { toast('Nothing to save yet — fill in anything you like.'); return; }
    const v = r.value;
    switch (current) {
      case 'task': store.updateSettings({ lastArea: v.area }); store.put('tasks', M.makeTask(v)); break;
      case 'event': store.put('events', M.makeEvent(v)); break;
      case 'routine': store.put('routines', M.makeRoutine(v)); break;
      case 'expense': F.saveTransaction(r); break;
      case 'meal': store.put('meals', M.makeMeal(v)); break;
      case 'health': store.put('healthEntries', v); break;
      default: break;
    }
    toast(`${TYPES.find((x) => x.value === current).label} added`);
    dlg.close();
  };
  const dlg = openSheet({
    title: 'Quick add',
    body: h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); save(); } }, h('div', { class: 'qa-tabs' }, tabs.el), host, h('button', { type: 'submit', hidden: true })),
    footer: [h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn primary', type: 'button', onClick: save }, 'Add')],
  });
  show(current);
}
