// Today: action first. Tasks, a compact schedule, tiny status + momentum.
import { h, icon } from '../ui/dom.js';
import * as store from '../core/store.js';
import * as A from '../core/actions.js';
import { todayISO, fmtWeekday, fmtDate, startOfWeek, fmtDur, fmtMin } from '../core/dates.js';
import { todayTasks, timelineItems, routinesOn, weekMomentum } from '../core/queries.js';
import { Card, TaskRow, InlineAdd, Empty, RoutineRow, Progress, Btn, openEntity, dropOnTimeline, resizeItem, toggleItem } from '../ui/components.js';
import { Timeline } from '../ui/timeline.js';
import { dropZone } from '../ui/dnd.js';
import { openHealthForm, openEventForm } from '../ui/forms.js';
import { openQuickAdd } from '../ui/quickadd.js';

export function render(root) {
  const s = store.getSettings();
  const today = todayISO();
  const weekKey = startOfWeek(today, s.weekStart);
  const { open, done } = todayTasks(today);

  // ---- header + editable weekly goal
  const goal = h('input', {
    class: 'goal-input', value: s.weeklyGoals?.[weekKey] || '', placeholder: 'Set a goal for this week…', 'aria-label': 'Weekly goal', maxlength: 120,
    onChange: (e) => store.updateSettings({ weeklyGoals: { ...s.weeklyGoals, [weekKey]: e.target.value.trim() } }),
    onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
  const head = h('header', { class: 'today-head' },
    h('div', null, h('div', { class: 'eyebrow' }, fmtWeekday(today, 'long')), h('h1', null, fmtDate(today, { day: 'numeric', month: 'long' }))),
    h('label', { class: 'goal' }, h('span', { class: 'eyebrow' }, 'Weekly goal'), goal));

  // ---- tasks
  const taskCard = Card('Today’s tasks', { sub: open.length ? `${open.length} open` : null, className: 'c-tasks' },
    InlineAdd({ placeholder: 'Add a task for today…', refocusKey: 'today-add', defaults: () => ({ area: s.lastArea || 'Work', dueDate: today }) }),
    open.length ? h('div', { class: 'task-list' }, open.map((t) => TaskRow(t, { today }))) : Empty(done.length ? 'All clear for today. Nicely done.' : 'No tasks for today yet. Add one above, or pull something in from the Planner.'),
    done.length ? h('details', { class: 'done-box' }, h('summary', null, `Completed today (${done.length})`), h('div', { class: 'task-list' }, done.map((t) => TaskRow(t, { today, drag: false })))) : null);
  // Dropping a scheduled block back on the list removes its time but keeps the task.
  dropZone(taskCard, { accept: (p) => p.type === 'task' && p.from === 'timeline', onDrop: (p) => { const t = store.get('tasks', p.id); if (t) A.unscheduleTask(t); } });

  // ---- schedule
  const items = timelineItems(today);
  const schedule = Card('Schedule', { className: 'c-schedule', actions: [
    h('a', { class: 'btn small', href: '#/planner' }, 'Planner'),
    Btn('Event', () => openEventForm({ date: today }), { kind: 'small', ic: 'plus' }),
  ] },
  Timeline({
    date: today, items, settings: s, scrollKey: 'today',
    onOpen: openEntity, onToggle: (it) => toggleItem(it, today), onResize: resizeItem, onDropPayload: dropOnTimeline,
    onCreateAt: (m) => openEventForm({ date: today, startMin: m, endMin: m + 60 }),
  }));

  // ---- status
  const hl = store.get('healthEntries', today) || {};
  const tile = (label, value, ic) => h('button', { class: 'status-tile', type: 'button', onClick: () => openHealthForm(today) }, icon(ic, 18), h('span', { class: 'st-label' }, label), h('span', { class: 'st-val' }, value));
  const status = Card('Today’s status', { className: 'c-status', actions: Btn(Object.keys(hl).length > 2 ? 'Edit check-in' : 'Check in', () => openHealthForm(today), { kind: 'small' }) },
    h('div', { class: 'status-row' },
      tile('Sleep', hl.sleepMin != null ? fmtDur(hl.sleepMin) : '—', 'moon'),
      tile('Weight', hl.weight != null ? `${hl.weight} kg` : '—', 'scale'),
      tile('Activity', hl.activityMin ? `${hl.activityMin} min` : hl.activity || '—', 'activity')));

  // ---- routines
  const routines = routinesOn(today);
  const routineCard = Card('Routines', { className: 'c-routines', sub: 'Flexible goals and fixed habits — no pressure.' },
    routines.length ? h('div', { class: 'routine-list' }, routines.map((r) => RoutineRow(r, today))) : Empty('No routines yet. Add one with the + button.'));

  // ---- momentum
  const m = weekMomentum(today);
  const row = (label, value, pctVal) => h('div', { class: 'mo-row' }, h('div', { class: 'mo-top' }, h('span', null, label), h('strong', null, value)), pctVal != null ? Progress(pctVal, { label }) : null);
  const momentum = Card('This week', { className: 'c-week', sub: 'Momentum, not scorekeeping.' },
    row('Career & ML', fmtDur(m.careerMin), null),
    row('Activity', `${m.activeDays} / ${m.activityTarget}`, Math.min(100, (m.activeDays / m.activityTarget) * 100)),
    row('Home routines', m.homeExpected ? `${m.homeDone} / ${m.homeExpected}` : '—', m.homeExpected ? Math.min(100, (m.homeDone / m.homeExpected) * 100) : null),
    row('Average sleep', m.avgSleepMin != null ? fmtDur(m.avgSleepMin) : '—', null),
    row('Tasks completed', String(m.completed), null));

  root.append(head, h('div', { class: 'today-grid' }, taskCard, schedule, status, routineCard, momentum));
  if (window.__refocus === 'today-add') { window.__refocus = null; root.querySelector('[data-refocus="today-add"]')?.focus(); }
}
