// Finance: simple monthly income / expenses / savings / budget. No merchants, no accounts.
import { h, icon } from '../ui/dom.js';
import * as store from '../core/store.js';
import { todayISO, monthKey, addMonths, monthLabel, fmtDate } from '../core/dates.js';
import { money, sum, pct } from '../core/format.js';
import { Card, PageHead, Btn, Empty, Progress } from '../ui/components.js';
import { openTransactionForm, openCategoryForm } from '../ui/forms.js';
import { numberInput } from '../ui/controls.js';
import { confirmDialog } from '../ui/modal.js';

const ui = { month: monthKey(todayISO()), showArchived: false };

export function render(root, params, { rerender }) {
  const s = store.getSettings();
  const $ = (v, o) => money(v, s, o);
  const cats = store.list('financeCategories').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const catName = (id) => store.get('financeCategories', id)?.name || 'Uncategorised';
  const txs = store.list('transactions').filter((t) => monthKey(t.date) === ui.month).sort((a, b) => b.date.localeCompare(a.date));
  const income = sum(txs.filter((t) => t.type === 'income').map((t) => t.amount));
  const expenses = sum(txs.filter((t) => t.type === 'expense').map((t) => t.amount));
  const saved = sum(txs.filter((t) => t.type === 'savings').map((t) => t.amount));
  const budget = s.monthlyBudget || 0;
  const remaining = budget - expenses;

  root.append(PageHead('Finance', { sub: 'Income, spending and savings at a glance.', actions: Btn('Add transaction', () => openTransactionForm({ date: ui.month === monthKey(todayISO()) ? todayISO() : `${ui.month}-01` }), { kind: 'primary', ic: 'plus' }) }));
  root.append(h('div', { class: 'planner-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous month', onClick: () => { ui.month = addMonths(ui.month, -1); rerender(); } }, icon('chevL')),
    h('button', { class: 'btn small', onClick: () => { ui.month = monthKey(todayISO()); rerender(); } }, 'This month'),
    h('button', { class: 'icon-btn', 'aria-label': 'Next month', onClick: () => { ui.month = addMonths(ui.month, 1); rerender(); } }, icon('chevR')),
    h('strong', { class: 'nav-label' }, monthLabel(ui.month))));

  const tile = (label, value, note) => h('div', { class: 'fin-tile' }, h('span', { class: 'snap-l' }, label), h('span', { class: 'fin-val' }, value), note ? h('span', { class: 'small muted' }, note) : null);
  const budgetInput = numberInput(budget || '', { min: 0, placeholder: 'Set budget' });
  budgetInput.input.setAttribute('aria-label', 'Monthly budget');
  budgetInput.input.addEventListener('change', () => store.updateSettings({ monthlyBudget: budgetInput.get() || 0 }));

  const summary = Card(null, { className: 'fin-summary' },
    h('div', { class: 'fin-tiles' },
      tile('Income', $(income)), tile('Expenses', $(expenses)), tile('Savings', $(saved)),
      tile('Left in budget', budget ? $(remaining) : '—', budget ? (remaining < 0 ? 'Past the plan this month' : `${pct(expenses, budget)}% of budget used`) : 'Set a monthly budget below')),
    budget ? Progress(pct(expenses, budget), { label: 'Budget used' }) : null,
    h('label', { class: 'inline-field' }, h('span', { class: 'muted small' }, 'Monthly budget'), budgetInput.el));

  // Category breakdown (spend per category, limit shown as a soft marker)
  const byCat = new Map();
  txs.filter((t) => t.type === 'expense').forEach((t) => byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount));
  const rows = cats.filter((c) => !c.archived || byCat.has(c.id)).map((c) => ({ c, spent: byCat.get(c.id) || 0 })).filter((r) => r.spent > 0 || r.c.limit).sort((a, b) => b.spent - a.spent);
  const maxSpent = Math.max(1, ...rows.map((r) => Math.max(r.spent, r.c.limit || 0)));
  const breakdown = Card('Where it went', null, rows.length ? h('ul', { class: 'cat-list' }, rows.map(({ c, spent }) => {
    const over = c.limit && spent > c.limit;
    return h('li', null, h('div', { class: 'cat-top' }, h('span', null, c.name), h('span', { class: 'muted small' }, c.limit ? `${$(spent)} / ${$(c.limit)}${over ? ' · over limit' : ''}` : $(spent))),
      h('div', { class: `bar${over ? ' soft-over' : ''}` }, h('div', { class: 'bar-fill', style: { width: `${(spent / maxSpent) * 100}%` } }), c.limit ? h('div', { class: 'bar-limit', style: { left: `${(c.limit / maxSpent) * 100}%` } }) : null));
  })) : Empty('No spending recorded this month.'));

  const txCard = Card('Transactions', { sub: `${txs.length} this month` }, txs.length ? h('ul', { class: 'plain-list tx-list' }, txs.map((t) => h('li', { class: 'link-row tx', role: 'button', tabindex: '0', onClick: () => openTransactionForm(t), onKeydown: (k) => { if (k.key === 'Enter') openTransactionForm(t); } },
    h('span', { class: 'tx-main' }, h('strong', null, t.description || (t.type === 'expense' ? catName(t.categoryId) : t.type[0].toUpperCase() + t.type.slice(1))), h('span', { class: 'muted small' }, `${fmtDate(t.date)}${t.type === 'expense' ? ` · ${catName(t.categoryId)}` : ''}${t.recurring ? ' · recurring' : ''}`)),
    h('span', { class: `tx-amt ${t.type}` }, `${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${$(t.amount)}`)))) : Empty('No transactions this month.'));

  // Recurring templates
  const tpls = store.list('recurringTransactions');
  const recurring = Card('Recurring', { sub: 'Generated automatically on schedule.' }, tpls.length ? h('ul', { class: 'plain-list' }, tpls.map((t) => h('li', { class: 'link-row' },
    h('span', { class: 'tx-main' }, h('strong', null, t.description || catName(t.categoryId)), h('span', { class: 'muted small' }, `${$(t.amount)} · ${t.frequency}${t.active ? '' : ' · paused'}`)),
    h('span', { class: 'row-actions' },
      h('button', { class: 'btn small', onClick: () => store.put('recurringTransactions', { ...t, active: !t.active }) }, t.active ? 'Pause' : 'Resume'),
      h('button', { class: 'btn small danger-text', onClick: async () => { if (await confirmDialog('Stop this recurring item? Past transactions are kept.', { confirmLabel: 'Stop' })) store.remove('recurringTransactions', t.id); } }, 'Stop'))))) : Empty('Add a transaction and choose “Repeats monthly” to automate it.'));

  const active = cats.filter((c) => !c.archived), archived = cats.filter((c) => c.archived);
  const catCard = Card('Categories', { sub: 'Rename, set monthly limits, or archive.', actions: Btn('Add', () => openCategoryForm({}), { kind: 'small', ic: 'plus' }) },
    h('div', { class: 'chips' }, active.map((c) => h('button', { class: 'chip', type: 'button', onClick: () => openCategoryForm(c), title: c.limit ? `Limit ${$(c.limit)}` : '' }, c.name))),
    h('div', { class: 'row-actions' }, archived.length ? h('button', { class: 'btn-link', type: 'button', onClick: () => { ui.showArchived = !ui.showArchived; rerender(); } }, `${ui.showArchived ? 'Hide' : 'Show'} archived (${archived.length})`) : null),
    ui.showArchived ? h('div', { class: 'chips' }, archived.map((c) => h('button', { class: 'chip', type: 'button', onClick: () => store.put('financeCategories', { ...c, archived: false }), title: 'Restore' }, `↺ ${c.name}`))) : null);

  root.append(summary, h('div', { class: 'two-col' }, h('div', { class: 'stack' }, breakdown, catCard), h('div', { class: 'stack' }, txCard, recurring)));
}
