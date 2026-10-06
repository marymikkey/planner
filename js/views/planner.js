// Planner: Day view (time grid + unscheduled panel) and Week view (seven day overview + inbox).
import { h, icon, toast } from '../ui/dom.js';
import * as store from '../core/store.js';
import * as A from '../core/actions.js';
import { todayISO, addDays, fmtLong, fmtDate, fmtWeekday, weekDays, fmtMin, diffDays } from '../core/dates.js';
import { timelineItems, unscheduledForDay, inboxTasks, tasksOnDay, eventsOn, routinesOn, routineLogged, isActive } from '../core/queries.js';
import { areaColor } from '../core/models.js';
import { Card, TaskRow, Empty, PageHead, Btn, openEntity, dropOnTimeline, resizeItem, toggleItem, RoutineRow } from '../ui/components.js';
import { Timeline } from '../ui/timeline.js';
import { dropZone, draggable } from '../ui/dnd.js';
import { segmented } from '../ui/controls.js';
import { confirmDialog, actionSheet } from '../ui/modal.js';
import { openQuickAdd } from '../ui/quickadd.js';
import { openEventForm } from '../ui/forms.js';

const ui = { mode: 'day', date: todayISO() };
export const setPlannerDate = (d) => { ui.date = d; ui.mode = 'day'; };

export function render(root, params, { rerender }) {
  const s = store.getSettings();
  const step = ui.mode === 'day' ? 1 : 7;
  const label = ui.mode === 'day'
    ? fmtLong(ui.date)
    : `${fmtDate(weekDays(ui.date, s.weekStart)[0])} – ${fmtDate(weekDays(ui.date, s.weekStart)[6])}`;

  const modeSeg = segmented([{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }], ui.mode, { label: 'View', onChange: (v) => { ui.mode = v; rerender(); } });
  const nav = h('div', { class: 'planner-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous', onClick: () => { ui.date = addDays(ui.date, -step); rerender(); } }, icon('chevL')),
    h('button', { class: 'btn small', onClick: () => { ui.date = todayISO(); rerender(); } }, 'Today'),
    h('button', { class: 'icon-btn', 'aria-label': 'Next', onClick: () => { ui.date = addDays(ui.date, step); rerender(); } }, icon('chevR')),
    h('strong', { class: 'nav-label' }, label));

  const actions = [modeSeg.el,
    ui.mode === 'day' ? h('button', { class: 'icon-btn', 'aria-label': 'Day options', onClick: () => dayMenu(ui.date) }, icon('more')) : null];
  root.append(PageHead('Planner', { actions }), nav);
  root.append(ui.mode === 'day' ? dayView() : weekView(rerender));
}

function dayMenu(date) {
  actionSheet(fmtLong(date), [
    { label: 'Clear this day', icon: 'trash', danger: true, onClick: async () => {
      if (await confirmDialog('Remove time blocks and one-off events from this day? Tasks stay in your lists, and recurring events and routines are kept.', { confirmLabel: 'Clear day', title: 'Clear day' })) { A.clearDay(date); toast('Day cleared'); }
    } },
    { label: 'Add event', icon: 'plus', onClick: () => openEventForm({ date }) },
  ]);
}

// ---- Day -------------------------------------------------------------------
function dayView() {
  const s = store.getSettings();
  const date = ui.date;
  const items = timelineItems(date);
  const timeline = Card(null, { className: 'c-schedule tall' }, Timeline({
    date, items, settings: s, scrollKey: `planner-${date}`,
    onOpen: openEntity, onToggle: (it) => toggleItem(it, date), onResize: resizeItem, onDropPayload: dropOnTimeline,
    onCreateAt: (m) => openEventForm({ date, startMin: m, endMin: m + 60 }),
  }));

  const unsched = unscheduledForDay(date);
  const inbox = inboxTasks();
  const panel = h('div', { class: 'side-panel' },
    Card('Unscheduled', { sub: 'Drag onto the timeline to block time.' }, unsched.length ? h('div', { class: 'task-list' }, unsched.map((t) => TaskRow(t, { today: date }))) : Empty('Everything for this day has a time.')),
    Card('Inbox', { sub: 'Not planned yet.', actions: Btn('Add', () => openQuickAdd({ type: 'task', date }), { kind: 'small', ic: 'plus' }) },
      inbox.length ? h('div', { class: 'task-list' }, inbox.map((t) => TaskRow(t, { today: date, showDate: true }))) : Empty('Inbox is empty.')));
  dropZone(panel, { accept: (p) => p.type === 'task' && p.from === 'timeline', onDrop: (p) => { const t = store.get('tasks', p.id); if (t) A.unscheduleTask(t); } });
  return h('div', { class: 'planner-day' }, timeline, panel);
}

// ---- Week ------------------------------------------------------------------
function weekView(rerender) {
  const s = store.getSettings();
  const today = todayISO();
  const days = weekDays(ui.date, s.weekStart);
  const cols = days.map((d) => {
    const evs = eventsOn(d);
    const tasks = tasksOnDay(d);
    const fixedRoutines = routinesOn(d).filter((r) => r.mode === 'fixed');
    const body = h('div', { class: 'day-items' });
    for (const e of evs) {
      body.append(h('div', { class: 'mini event', role: 'button', tabindex: '0', style: { '--area': areaColor(e.area, s) }, onClick: () => openEntity({ kind: 'event', ref: e }), onKeydown: (k) => { if (k.key === 'Enter') openEntity({ kind: 'event', ref: e }); } },
        h('span', { class: 'mini-time' }, fmtMin(e.startMin)), h('span', { class: 'mini-title' }, e.title)));
    }
    for (const r of fixedRoutines) {
      body.append(h('div', { class: `mini routine${routineLogged(r.id, d) ? ' done' : ''}`, style: { '--area': areaColor(r.area, s) } },
        h('button', { class: `check small${routineLogged(r.id, d) ? ' on' : ''}`, type: 'button', 'aria-label': `Toggle ${r.title}`, onClick: () => A.toggleRoutine(r, d) }, routineLogged(r.id, d) ? icon('check', 10) : null),
        h('span', { class: 'mini-title' }, r.title)));
    }
    for (const t of tasks) body.append(MiniTask(t));
    if (!body.children.length) body.append(h('p', { class: 'empty small' }, 'Free'));
    const col = h('section', { class: `week-col${d === today ? ' today' : ''}`, 'aria-label': fmtLong(d) },
      h('header', { class: 'week-col-head' },
        h('button', { class: 'day-link', onClick: () => { ui.date = d; ui.mode = 'day'; rerender(); } },
          h('span', { class: 'wd-name' }, fmtWeekday(d)), h('span', { class: 'wd-num' }, parseInt(d.slice(8), 10))),
        h('button', { class: 'icon-btn small', 'aria-label': `Add to ${fmtLong(d)}`, onClick: () => openQuickAdd({ type: 'task', date: d }) }, icon('plus', 16))),
      body);
    dropZone(col, { accept: (p) => p.type === 'task', onDrop: (p) => { const t = store.get('tasks', p.id); if (t) A.moveTaskToDay(t, d); } });
    return col;
  });

  const refDay = days.includes(today) ? today : days[0];
  const weekly = store.list('routines').filter((r) => !r.archived && r.mode === 'weekly');
  const inbox = inboxTasks();
  return h('div', { class: 'planner-week' },
    h('div', { class: 'week-grid' }, cols),
    weekly.length ? Card('Weekly goals', { sub: 'Do them on whichever days suit you.' }, h('div', { class: 'routine-list' }, weekly.map((r) => RoutineRow(r, refDay)))) : null,
    Card('Inbox', { sub: 'Drag a task onto a day to plan it.' }, inbox.length ? h('div', { class: 'task-list' }, inbox.map((t) => TaskRow(t, { today }))) : Empty('Inbox is empty.')));
}

function MiniTask(t) {
  const s = store.getSettings();
  const done = t.status === 'Done';
  const el = h('div', { class: `mini task pri-${t.priority}${done ? ' done' : ''}`, style: { '--area': areaColor(t.area, s) } },
    h('button', { class: `check small${done ? ' on' : ''}`, type: 'button', 'aria-label': `${done ? 'Reopen' : 'Complete'} ${t.title}`, onClick: () => A.completeTask(t) }, done ? icon('check', 10) : null),
    h('span', { class: 'mini-title', role: 'button', tabindex: '0', onClick: () => import('../ui/forms.js').then((m) => m.openTaskForm(t)) }, t.title),
    t.startMin != null && t.scheduledDate ? h('span', { class: 'mini-time' }, fmtMin(t.startMin)) : null);
  if (!done) draggable(el, { payload: { type: 'task', id: t.id, from: 'week' } });
  return el;
}
