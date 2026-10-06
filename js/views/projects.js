// Project cards + project detail, shared by Work and Career & ML.
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, fmtDate, relativeDay, fmtMin, diffDays } from '../core/dates.js';
import { projectsFor, projectProgress, compareTasks } from '../core/queries.js';
import { areaColor } from '../core/models.js';
import { Card, Progress, TaskRow, InlineAdd, Empty, PageHead, Btn, openEntity } from '../ui/components.js';
import { openProjectForm, openEventForm } from '../ui/forms.js';
import { occursOn } from '../core/recurrence.js';

export function ProjectGrid(area, base, { general = false } = {}) {
  const color = areaColor(area, store.getSettings());
  const cards = [];
  const mk = (id, name, deadline, notes) => {
    const p = projectProgress(id === 'general' ? null : id, area);
    const pctVal = p.total ? (p.done / p.total) * 100 : 0;
    return h('a', { class: 'project-card', href: `#/${base}/${id}`, style: { '--area': color } },
      h('div', { class: 'pc-top' }, h('h3', null, name), deadline ? h('span', { class: 'chip-static' }, `Due ${relativeDay(deadline)}`) : null),
      notes ? h('p', { class: 'muted clamp' }, notes) : null,
      Progress(pctVal, { color, label: `${name} progress` }),
      h('div', { class: 'small muted' }, p.total ? `${p.done} of ${p.total} tasks done` : 'No tasks yet'));
  };
  if (general) cards.push(mk('general', 'General', null, 'Tasks that don’t belong to a project.'));
  for (const p of projectsFor(area)) cards.push(mk(p.id, p.name, p.deadline, p.notes));
  return h('div', { class: 'project-grid' }, cards, !projectsFor(area).length && !general ? Empty('No projects yet.') : null);
}

export function ProjectDetail(root, area, projectId, base) {
  const s = store.getSettings();
  const today = todayISO();
  const general = projectId === 'general';
  const project = general ? { id: null, name: 'General', area, notes: '', deadline: null } : store.get('projects', projectId);
  if (!project) { root.append(Empty('That project no longer exists.'), h('a', { class: 'btn', href: `#/${base}` }, 'Back')); return; }
  const color = areaColor(area, s);
  const tasks = store.list('tasks').filter((t) => (general ? t.area === area && !t.projectId : t.projectId === project.id));
  const open = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
  const done = tasks.filter((t) => t.status === 'Done');
  const pr = tasks.filter((t) => t.status !== 'Skipped');
  const pctVal = pr.length ? (done.length / pr.length) * 100 : 0;

  const events = store.list('events').filter((e) => (general ? e.area === area && !e.projectId : e.projectId === project.id));
  const upcoming = [];
  for (const e of events) {
    for (let i = 0; i < 30 && upcoming.filter((u) => u.e.id === e.id).length < 2; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (occursOn(e.recurrence, e.date, iso) && !(e.exceptions || []).includes(iso)) upcoming.push({ e, iso });
    }
  }
  upcoming.sort((a, b) => a.iso.localeCompare(b.iso) || a.e.startMin - b.e.startMin);

  root.append(PageHead(project.name, {
    back: { href: `#/${base}`, label: area }, sub: project.deadline ? `Deadline ${fmtDate(project.deadline)}` : null,
    actions: general ? null : Btn('Edit', () => openProjectForm(project), { ic: 'edit' }),
  }));

  const notes = h('textarea', { class: 'input notes-area', rows: 5, placeholder: 'Project notes…', 'aria-label': 'Project notes', onChange: (e) => { if (!general) store.put('projects', { ...project, notes: e.target.value }); } });
  notes.value = project.notes || '';
  if (general) notes.disabled = true;

  root.append(h('div', { class: 'two-col' },
    h('div', { class: 'stack' },
      Card('Tasks', { sub: `${open.length} open · ${done.length} done` },
        InlineAdd({ placeholder: `Add a task to ${project.name}…`, refocusKey: 'proj-add', defaults: () => ({ area, projectId: general ? null : project.id, dueDate: null }) }),
        open.length ? h('div', { class: 'task-list' }, open.map((t) => TaskRow(t, { showArea: false, showDate: true }))) : Empty('No open tasks.'),
        done.length ? h('details', { class: 'done-box' }, h('summary', null, `Done (${done.length})`), h('div', { class: 'task-list' }, done.map((t) => TaskRow(t, { showArea: false, drag: false })))) : null)),
    h('div', { class: 'stack' },
      Card('Progress', null, Progress(pctVal, { color, label: 'Project progress' }), h('p', { class: 'muted small' }, pr.length ? `${done.length} of ${pr.length} tasks complete` : 'Add tasks to see progress.'),
        project.deadline ? h('p', { class: 'small' }, `Deadline ${fmtDate(project.deadline)} · ${(() => { const d = diffDays(today, project.deadline); return d < 0 ? `${-d} days past` : d === 0 ? 'today' : `${d} days to go`; })()}`) : null),
      Card('Meetings', { actions: Btn('Add', () => openEventForm({ area, projectId: general ? null : project.id }), { kind: 'small', ic: 'plus' }) },
        upcoming.length ? h('ul', { class: 'plain-list' }, upcoming.slice(0, 8).map(({ e, iso }) => h('li', { class: 'link-row', role: 'button', tabindex: '0', onClick: () => openEntity({ kind: 'event', ref: e }), onKeydown: (k) => { if (k.key === 'Enter') openEntity({ kind: 'event', ref: e }); } }, h('strong', null, e.title), h('span', { class: 'muted small' }, `${relativeDay(iso)} · ${fmtMin(e.startMin)}`)))) : Empty('No upcoming meetings.')),
      Card('Notes', null, notes))));
  if (window.__refocus === 'proj-add') { window.__refocus = null; root.querySelector('[data-refocus="proj-add"]')?.focus(); }
}
