// Study: courses, classes (recurring fixed events), assignments (global tasks), exams, notes.
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, relativeDay, fmtMin, addDays } from '../core/dates.js';
import { activeSubjects, compareTasks } from '../core/queries.js';
import { occursOn, describe } from '../core/recurrence.js';
import { areaColor } from '../core/models.js';
import { Card, PageHead, Btn, TaskRow, Empty, InlineAdd, openEntity } from '../ui/components.js';
import { openSubjectForm, openEventForm } from '../ui/forms.js';

const AREA = 'Study';

function nextOccurrences(ev, n = 1, horizon = 120) {
  const out = [];
  const today = todayISO();
  for (let i = 0; i < horizon && out.length < n; i++) {
    const d = addDays(today, i);
    if (occursOn(ev.recurrence, ev.date, d) && !(ev.exceptions || []).includes(d)) out.push(d);
  }
  return out;
}

export function render(root, params) {
  const today = todayISO();
  const s = store.getSettings();
  const subjectId = params[0];
  const subject = subjectId ? store.get('subjects', subjectId) : null;
  const tasks = store.list('tasks').filter((t) => t.area === AREA && (!subject || t.subjectId === subject.id));
  const events = store.list('events').filter((e) => e.area === AREA && (!subject || e.subjectId === subject.id));
  const classes = events.filter((e) => e.kind === 'class');
  const exams = events.filter((e) => e.kind === 'exam' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const open = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
  const subjName = (id) => store.get('subjects', id)?.name;

  if (subjectId && !subject) { root.append(Empty('That course no longer exists.'), h('a', { class: 'btn', href: '#/study' }, 'Back')); return; }

  root.append(PageHead(subject ? subject.name : 'Study', {
    back: subject ? { href: '#/study', label: 'Study' } : null,
    sub: subject ? null : 'Courses, classes, assignments and exams.',
    actions: [
      subject ? Btn('Edit course', () => openSubjectForm(subject), { ic: 'edit' }) : Btn('New course', () => openSubjectForm({}), { ic: 'plus' }),
      Btn('Class', () => openEventForm({ kind: 'class', area: AREA, subjectId: subject?.id || null, recurrence: { type: 'weekly', days: [] } }), { ic: 'plus' }),
      Btn('Exam', () => openEventForm({ kind: 'exam', area: AREA, subjectId: subject?.id || null }), { ic: 'plus' }),
    ],
  }));

  const left = h('div', { class: 'stack' });
  if (!subject) {
    const subs = activeSubjects();
    left.append(Card('Courses', null, subs.length ? h('div', { class: 'project-grid' }, subs.map((sb) => {
      const o = store.list('tasks').filter((t) => t.subjectId === sb.id && t.status !== 'Done' && t.status !== 'Skipped').length;
      const nextExam = store.list('events').filter((e) => e.subjectId === sb.id && e.kind === 'exam' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
      return h('a', { class: 'project-card', href: `#/study/${sb.id}`, style: { '--area': areaColor(AREA, s) } },
        h('h3', null, sb.name), h('div', { class: 'small muted' }, `${o} open assignment${o === 1 ? '' : 's'}`),
        nextExam ? h('span', { class: 'chip-static' }, `Exam ${relativeDay(nextExam.date)}`) : null);
    })) : Empty('Add a course to organise classes and assignments.')));
  }
  left.append(Card('Assignments & deadlines', { sub: `${open.length} open` },
    InlineAdd({ placeholder: 'Add an assignment…', refocusKey: 'study-add', defaults: () => ({ area: AREA, subjectId: subject?.id || null }) }),
    open.length ? h('div', { class: 'task-list' }, open.map((t) => TaskRow(t, { showArea: false, showDate: true, today }))) : Empty('No open assignments.')));

  const right = h('div', { class: 'stack' },
    Card('Exams & tests', null, exams.length ? h('ul', { class: 'plain-list' }, exams.map((e) => h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openEntity({ kind: 'event', ref: e }), onKeydown: (k) => { if (k.key === 'Enter') openEntity({ kind: 'event', ref: e }); } },
      h('strong', null, e.title), h('span', { class: 'muted small' }, `${relativeDay(e.date)} · ${fmtMin(e.startMin)}${!subject && e.subjectId ? ` · ${subjName(e.subjectId)}` : ''}`)))) : Empty('No upcoming exams.')),
    Card('Classes', { sub: 'These appear automatically in Today and Planner.' }, classes.length ? h('ul', { class: 'plain-list' }, classes.map((e) => {
      const next = nextOccurrences(e, 1)[0];
      return h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openEntity({ kind: 'event', ref: e }), onKeydown: (k) => { if (k.key === 'Enter') openEntity({ kind: 'event', ref: e }); } },
        h('strong', null, e.title), h('span', { class: 'muted small' }, `${describe(e.recurrence)} · ${fmtMin(e.startMin)}–${fmtMin(e.endMin)}${next ? ` · next ${relativeDay(next)}` : ''}`));
    })) : Empty('No classes yet.')));

  if (subject) {
    const notes = h('textarea', { class: 'input notes-area', rows: 7, placeholder: 'Course notes…', 'aria-label': 'Course notes', onChange: (e) => store.put('subjects', { ...subject, notes: e.target.value }) });
    notes.value = subject.notes || '';
    right.append(Card('Notes', null, notes));
  }
  root.append(h('div', { class: 'two-col' }, left, right));
  if (window.__refocus === 'study-add') { window.__refocus = null; root.querySelector('[data-refocus="study-add"]')?.focus(); }
}
