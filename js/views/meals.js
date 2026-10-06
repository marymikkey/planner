// Meals: a simple log. No calories required; macros appear only if enabled in Settings.
import { h, icon } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, addDays, fmtLong, fmtDate } from '../core/dates.js';
import { MEAL_TYPES } from '../core/models.js';
import { Card, PageHead, Btn, Empty } from '../ui/components.js';
import { openMealForm } from '../ui/forms.js';
import { sum } from '../core/format.js';

const ui = { date: todayISO() };

export function render(root, params, { rerender }) {
  const s = store.getSettings();
  const today = todayISO();
  const meals = store.list('meals').filter((m) => m.date === ui.date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

  root.append(PageHead('Meals', { sub: 'What you ate, no counting required.', actions: Btn('Log a meal', () => openMealForm({ date: ui.date }), { kind: 'primary', ic: 'plus' }) }));
  root.append(h('div', { class: 'planner-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous day', onClick: () => { ui.date = addDays(ui.date, -1); rerender(); } }, icon('chevL')),
    h('button', { class: 'btn small', onClick: () => { ui.date = today; rerender(); } }, 'Today'),
    h('button', { class: 'icon-btn', 'aria-label': 'Next day', onClick: () => { ui.date = addDays(ui.date, 1); rerender(); } }, icon('chevR')),
    h('strong', { class: 'nav-label' }, fmtLong(ui.date))));

  const dayCard = Card(null, null,
    meals.length ? h('ul', { class: 'meal-list' }, meals.map((m) => h('li', null, h('button', { class: 'meal-row', type: 'button', onClick: () => openMealForm(m) },
      h('span', { class: 'meal-time' }, m.time || '—'),
      h('span', { class: 'meal-main' }, h('strong', null, m.type), h('span', null, m.description),
        m.tags?.length ? h('span', { class: 'tag-row' }, m.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
        s.macros && (m.calories || m.protein || m.fat || m.carbs) ? h('span', { class: 'small muted' }, [m.calories && `${m.calories} kcal`, m.protein && `P ${m.protein}g`, m.fat && `F ${m.fat}g`, m.carbs && `C ${m.carbs}g`].filter(Boolean).join(' · ')) : null))))) : Empty('Nothing logged for this day.'),
    s.macros && meals.length ? h('p', { class: 'small muted' }, `Day total: ${Math.round(sum(meals.map((m) => m.calories)))} kcal · P ${Math.round(sum(meals.map((m) => m.protein)))}g · F ${Math.round(sum(meals.map((m) => m.fat)))}g · C ${Math.round(sum(meals.map((m) => m.carbs)))}g`) : null);

  // Last 7 days patterns (counts only, no judgement)
  const since = addDays(ui.date, -6);
  const week = store.list('meals').filter((m) => m.date >= since && m.date <= ui.date);
  const counts = new Map();
  week.forEach((m) => (m.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const typeCounts = MEAL_TYPES.map((t) => [t, week.filter((m) => m.type === t).length]).filter(([, n]) => n);
  const weekCard = Card('Last 7 days', { sub: `${fmtDate(since)} – ${fmtDate(ui.date)}` },
    week.length ? h('div', { class: 'stack' },
      h('div', { class: 'tag-row' }, [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => h('span', { class: 'tag' }, `${t} · ${n}`))),
      h('p', { class: 'small muted' }, typeCounts.map(([t, n]) => `${t} ${n}`).join(' · '))) : Empty('No meals in this window.'));

  root.append(h('div', { class: 'two-col' }, dayCard, weekCard));
}
