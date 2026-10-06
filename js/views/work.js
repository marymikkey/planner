import { h } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO } from '../core/dates.js';
import { todayTasks, compareTasks } from '../core/queries.js';
import { Card, PageHead, Btn, TaskRow, Empty } from '../ui/components.js';
import { ProjectGrid, ProjectDetail } from './projects.js';
import { openProjectForm } from '../ui/forms.js';
import { openQuickAdd } from '../ui/quickadd.js';

export function render(root, params) {
  if (params[0]) return ProjectDetail(root, 'Work', params[0], 'work');
  const today = todayISO();
  const openTasks = store.list('tasks').filter((t) => t.area === 'Work' && t.status !== 'Done' && t.status !== 'Skipped').sort(compareTasks(today));
  root.append(
    PageHead('Work', { sub: 'Projects, deadlines and meetings.', actions: [Btn('New project', () => openProjectForm({ area: 'Work' }), { ic: 'plus' }), Btn('New task', () => openQuickAdd({ type: 'task', area: 'Work' }), { kind: 'primary', ic: 'plus' })] }),
    ProjectGrid('Work', 'work', { general: true }),
    Card('All open work tasks', { sub: `${openTasks.length} open` }, openTasks.length ? h('div', { class: 'task-list' }, openTasks.map((t) => TaskRow(t, { showArea: false, showDate: true, today }))) : Empty('Nothing open. Enjoy the quiet.')));
}
