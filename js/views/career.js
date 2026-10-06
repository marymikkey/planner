// Career & ML: tasks, projects and an editable visual roadmap.
import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO } from '../core/dates.js';
import { compareTasks } from '../core/queries.js';
import { TOPIC_STATUSES } from '../core/models.js';
import { Card, PageHead, Btn, TaskRow, Empty, Progress, InlineAdd } from '../ui/components.js';
import { ProjectGrid, ProjectDetail } from './projects.js';
import { openProjectForm, openGroupForm, openTopicForm } from '../ui/forms.js';
import { segmented } from '../ui/controls.js';

const AREA = 'Career & ML';
const ui = { tab: 'roadmap' };
const statusClass = (s) => `topic-status s-${TOPIC_STATUSES.indexOf(s)}`;

export function render(root, params, { rerender }) {
  if (params[0]) return ProjectDetail(root, AREA, params[0], 'career');
  const today = todayISO();
  const tabs = segmented([{ value: 'roadmap', label: 'Roadmap' }, { value: 'tasks', label: 'Tasks' }, { value: 'projects', label: 'Projects' }], ui.tab, { label: 'Career sections', onChange: (v) => { ui.tab = v; rerender(); } });
  root.append(PageHead('Career & ML', { sub: 'Skills, interviews, CV, job search and pet projects.', actions: tabs.el }));

  if (ui.tab === 'tasks') {
    const open = store.list('tasks').filter((t) => t.area === AREA && t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
    const done = store.list('tasks').filter((t) => t.area === AREA && t.status === 'Done').sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || '')).slice(0, 10);
    root.append(Card('Tasks', { sub: `${open.length} open` },
      InlineAdd({ placeholder: 'Add a career task…', refocusKey: 'career-add', defaults: () => ({ area: AREA }) }),
      open.length ? h('div', { class: 'task-list' }, open.map((t) => TaskRow(t, { showArea: false, showDate: true, today }))) : Empty('No open tasks.'),
      done.length ? h('details', { class: 'done-box' }, h('summary', null, 'Recently completed'), h('div', { class: 'task-list' }, done.map((t) => TaskRow(t, { showArea: false, drag: false })))) : null));
    if (window.__refocus === 'career-add') { window.__refocus = null; root.querySelector('[data-refocus="career-add"]')?.focus(); }
  } else if (ui.tab === 'projects') {
    root.append(h('div', { class: 'toolbar' }, Btn('New project', () => openProjectForm({ area: AREA }), { ic: 'plus' })), ProjectGrid(AREA, 'career'));
  } else {
    root.append(Roadmap());
  }
}

function Roadmap() {
  const groups = store.list('roadmapGroups').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const topics = store.list('roadmapTopics');
  const wrap = h('div', { class: 'roadmap' });
  for (const g of groups) {
    const ts = topics.filter((t) => t.groupId === g.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const avg = ts.length ? ts.reduce((a, t) => a + (t.progress || 0), 0) / ts.length : 0;
    wrap.append(Card(g.name, {
      className: 'rm-group', sub: ts.length ? `${ts.length} topic${ts.length > 1 ? 's' : ''} · ${Math.round(avg)}% avg` : 'No topics yet',
      actions: [Btn('Edit', () => openGroupForm(g), { kind: 'small' }), Btn('Topic', () => openTopicForm({ groupId: g.id }), { kind: 'small', ic: 'plus' })],
    },
    ts.length ? h('ul', { class: 'topic-list' }, ts.map((t) => {
      const related = store.list('tasks').filter((x) => x.topicId === t.id && x.status !== 'Done').length;
      return h('li', null, h('button', { class: 'topic-row', type: 'button', onClick: () => openTopicForm(t) },
        h('div', { class: 'tr-top' }, h('span', { class: 'tr-name' }, t.name), h('span', { class: statusClass(t.status) }, t.status)),
        Progress(t.progress || 0, { label: `${t.name} progress` }),
        h('div', { class: 'small muted' }, `${t.progress || 0}%${related ? ` · ${related} open task${related > 1 ? 's' : ''}` : ''}${t.notes ? ' · has notes' : ''}`)));
    })) : Empty('Add the first topic for this area.')));
  }
  wrap.append(h('div', { class: 'toolbar' }, Btn('Add group', () => openGroupForm({}), { ic: 'plus' })));
  return wrap;
}
