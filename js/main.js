// App shell: boot, hash router, navigation, global quick-add, PWA registration.
import { h, icon, toast } from './ui/dom.js';
import { openSheet, confirmDialog } from './ui/modal.js';
import { openQuickAdd } from './ui/quickadd.js';
import * as store from './core/store.js';
import { materializeRecurringTx } from './core/actions.js';
import { loadDemoData } from './core/demo.js';
import { applyTheme } from './theme.js';
import { todayISO } from './core/dates.js';
import * as sync from './core/sync.js';
import { setLang, lang, startI18n, tr } from './i18n.js';

import * as today from './views/today.js';
import * as planner from './views/planner.js';
import * as work from './views/work.js';
import * as career from './views/career.js';
import * as study from './views/study.js';
import * as health from './views/health.js';
import * as meals from './views/meals.js';
import * as home from './views/home.js';
import * as personal from './views/personal.js';
import * as finance from './views/finance.js';
import * as analytics from './views/analytics.js';
import * as settings from './views/settings.js';

const ROUTES = [
  { slug: 'today', label: 'Today', icon: 'today', view: today },
  { slug: 'planner', label: 'Planner', icon: 'planner', view: planner },
  { slug: 'work', label: 'Work', icon: 'work', view: work },
  { slug: 'career', label: 'Career & ML', icon: 'career', view: career },
  { slug: 'study', label: 'Study', icon: 'study', view: study },
  { slug: 'health', label: 'Health', icon: 'health', view: health },
  { slug: 'meals', label: 'Meals', icon: 'meals', view: meals },
  { slug: 'home', label: 'Home', icon: 'home', view: home },
  { slug: 'personal', label: 'Personal', icon: 'personal', view: personal },
  { slug: 'finance', label: 'Finance', icon: 'finance', view: finance },
  { slug: 'analytics', label: 'Analytics', icon: 'analytics', view: analytics },
  { slug: 'settings', label: 'Settings', icon: 'settings', view: settings },
];
const bySlug = Object.fromEntries(ROUTES.map((r) => [r.slug, r]));

const main = document.getElementById('main');
let lastHash = null;
let lastDay = todayISO();

function parseHash() {
  const [slug, ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { route: bySlug[slug] || bySlug.today, params };
}

function renderRoute() {
  const { route, params } = parseHash();
  const hash = location.hash || '#/today';
  const keepScroll = hash === lastHash ? window.scrollY : 0;
  main.replaceChildren();
  try {
    route.view.render(main, params, { rerender: renderRoute });
  } catch (err) {
    console.error(err);
    main.append(h('div', { class: 'card' }, h('h2', null, 'Something went wrong'), h('p', { class: 'muted' }, String(err.message || err))));
  }
  if (window.__refocus) {
    main.querySelector(`[data-refocus="${window.__refocus}"]`)?.focus();
    window.__refocus = null;
  }
  document.title = `${tr(route.label)} · ${tr('Planner')}`;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === route.slug;
    a.classList.toggle('active', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  const moreActive = !['today', 'planner', 'analytics'].includes(route.slug);
  document.getElementById('nav-more')?.classList.toggle('active', moreActive);
  window.scrollTo(0, keepScroll);
  lastHash = hash;
  renderBanner();
}

// Store changes re-render the current view (coalesced; deferred while dragging or typing a tag).
let pending = false;
function scheduleRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (document.body.classList.contains('is-dragging')) { setTimeout(scheduleRender, 120); return; }
    if (document.activeElement?.matches?.('.chip-input')) return;
    applyTheme(store.getSettings().theme);
    if (store.getSettings().language !== lang()) { setLang(store.getSettings().language); startI18n(); }
    renderRoute();
  });
}

function renderBanner() {
  const el = document.getElementById('banner');
  el.replaceChildren();
  if (store.getSettings().demo) {
    el.append(h('span', null, 'Demo mode — everything you see is fictional.'),
      h('button', { class: 'btn-link', type: 'button', onClick: async () => { if (await confirmDialog('Clear demo data and start with an empty planner?', { confirmLabel: 'Clear and start fresh', title: 'Leave demo mode', danger: false })) { await store.resetAll(); store.updateSettings({ onboarded: true }); } } }, 'Exit demo & start fresh'));
  }
  el.hidden = !store.getSettings().demo;
}

// ---- Navigation chrome -------------------------------------------------------
function buildNav() {
  const side = document.getElementById('sidebar');
  side.append(
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', null, 'Planner')),
    h('button', { class: 'btn primary add-btn', type: 'button', onClick: () => openQuickAdd() }, icon('plus', 18), 'Quick add'),
    h('nav', { 'aria-label': 'Primary' }, ROUTES.map((r) => h('a', { class: 'nav-link', href: `#/${r.slug}`, 'data-nav': r.slug }, icon(r.icon, 20), r.label))));

  const mobile = document.getElementById('bottomnav');
  const item = (slug, label, ic) => h('a', { class: 'bn-item', href: `#/${slug}`, 'data-nav': slug }, icon(ic, 22), h('span', null, label));
  mobile.append(
    item('today', 'Today', 'today'), item('planner', 'Planner', 'planner'),
    h('button', { class: 'bn-add', type: 'button', 'aria-label': 'Quick add', onClick: () => openQuickAdd() }, icon('plus', 26)),
    item('analytics', 'Analytics', 'analytics'),
    h('button', { class: 'bn-item', id: 'nav-more', type: 'button', onClick: openMore }, icon('more', 22), h('span', null, 'More')));

  document.getElementById('fab').addEventListener('click', () => openQuickAdd());
}

function openMore() {
  const dlg = openSheet({
    title: 'All sections',
    body: h('div', { class: 'more-grid' }, ROUTES.filter((r) => !['today', 'planner', 'analytics'].includes(r.slug)).map((r) =>
      h('a', { class: 'more-item', href: `#/${r.slug}`, onClick: () => dlg.close() }, icon(r.icon, 24), r.label))),
  });
  dlg.sheet.classList.add('small');
}

// ---- Boot ------------------------------------------------------------------
async function boot() {
  await store.init();
  setLang(store.getSettings().language);
  startI18n();
  applyTheme(store.getSettings().theme);
  store.onError((e) => toast(`Couldn’t save: ${e?.message || e}`));
  materializeRecurringTx();
  buildNav();
  renderRoute();
  store.subscribe(scheduleRender);
  sync.onStatus(() => { if (parseHash().route.slug === 'settings' && !document.querySelector('.sheet')) renderRoute(); });
  sync.initSync();
  window.addEventListener('hashchange', renderRoute);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(store.getSettings().theme));

  // Midnight rollover / returning to a stale tab.
  const checkDay = () => { const d = todayISO(); if (d !== lastDay) { lastDay = d; materializeRecurringTx(); renderRoute(); } };
  setInterval(checkDay, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.body.classList.contains('modal-open')) {
      e.preventDefault(); openQuickAdd();
    }
  });

  if (!store.getSettings().onboarded) welcome();
  registerSW();
}

function welcome() {
  const dlg = openSheet({
    title: 'Welcome',
    body: h('div', { class: 'stack' },
      h('p', null, 'A calm place to plan your days, track how you feel and see what helps. Everything stays on this device — no account, no tracking.'),
      h('p', { class: 'muted' }, 'You can start with a blank slate or look around with fictional demo data first.')),
    footer: [
      h('button', { class: 'btn', type: 'button', onClick: async () => { await loadDemoData(); dlg.close(); toast('Demo data loaded'); } }, 'Explore with demo data'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => { store.updateSettings({ onboarded: true }); dlg.close(); } }, 'Start fresh'),
    ],
    onClose: () => { if (!store.getSettings().onboarded) store.updateSettings({ onboarded: true }); },
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Service workers need HTTPS or localhost; silently skip otherwise (app still works online).
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready — reload to apply.', { action: 'Reload', onAction: () => location.reload(), ms: 12000 });
      });
    });
  }).catch((err) => console.info('Service worker not registered:', err.message));
}

boot().catch((err) => {
  console.error(err);
  main.append(h('div', { class: 'card' }, h('h2', null, 'Couldn’t start the app'), h('p', { class: 'muted' }, String(err.message || err))));
});
