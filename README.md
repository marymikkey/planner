# Planner

A calm, local-first personal productivity app: daily & weekly planning, time blocking, routines, work / career / study organisation, wellbeing and meal logs, simple finance tracking, and descriptive analytics.

**Plain HTML + CSS + vanilla JavaScript (ES modules). No framework, no build step, no backend, no tracking.** Your data lives in your browser (IndexedDB) and never leaves it unless you export it.

Core loop: **Plan → Live → Track → Learn → Adjust.**

## Run it

ES modules and service workers need HTTP (not `file://`):

```bash
python3 tools/serve.py 8000      # then open http://localhost:8000
```

Any static server works (`npx serve`, `python3 -m http.server`, GitHub Pages, Netlify…).

**Install on iPhone:** service workers require HTTPS (localhost is the only exception), so host the folder somewhere with HTTPS (e.g. GitHub Pages), open it in Safari → Share → *Add to Home Screen*. After the first load it works offline. Data is per-device: use Export/Import JSON to move it.

First launch offers *Start fresh* or *Explore with demo data* (entirely synthetic, generated at runtime).

## Features

Today · Planner (day/week, drag & drop time blocking, inbox) · Work (projects) · Career & ML (tasks, projects, editable roadmap) · Study (courses, classes, assignments, exams, notes) · Health (fast optional daily check-in, custom metrics) · Meals (calories/macros optional, off by default) · Home (routines + chores) · Personal · Finance (income, expenses, savings, budget, category limits, recurring) · Analytics (daily / weekly / monthly series, 7-day averages, planned vs actual, Spearman correlation explorer) · Settings (theme, day range, currency, customisation, import/export, demo, reset).

Global **+** (bottom bar on phones, floating button / `n` key on desktop) adds a task, event, routine, expense, meal or health entry without leaving the page.

Scheduling objects: **events** (fixed, solid blocks), **tasks** (flexible, dashed blocks, may be time-blocked later), **routines** (fixed recurrence *or* a flexible "N× per week" goal, never asking for specific weekdays).

## Architecture

```
index.html            app shell (strict CSP: connect-src 'self' => cannot send data out)
manifest.json         PWA manifest
service-worker.js     offline cache (precache + stale-while-revalidate)
styles/               base (tokens, themes) · layout (shell, grids) · components
js/
  main.js             boot, hash router, navigation, quick-add, SW registration
  theme.js            light/dark/system
  core/               NO DOM here
    models.js         constants + record factories (the data model)
    db.js             IndexedDB adapter (only file that knows about IndexedDB)
    store.js          in-memory cache + write-through persistence + change events
    queries.js        read selectors ("which tasks are on this day?")
    actions.js        domain mutations (complete, postpone, schedule, clear day…)
    recurrence.js     recurrence rules (computed on demand, never materialised)
    analytics.js      daily series, moving average, aggregation, Spearman
    io.js             JSON / CSV import & export
    demo.js           synthetic demo data
  ui/                 dom helper, controls, forms, sheets, drag & drop, timeline, charts
  views/              one module per section: render(root, params, {rerender})
tools/
  build-sw.mjs        regenerates the SW precache list + version hash
  serve.py            no-cache dev server
  make_icons.py       generates PNG icons (no dependencies)
```

Key decisions:

- **Store with a sync cache.** Views read synchronously from memory; every write goes through `store.put/remove`, which updates IndexedDB. Records carry `id`, `createdAt`, `updatedAt`.
- **Sync-ready.** A Supabase (or other) adapter can be added beside `db.js`: subscribe to store mutations, push rows by `updatedAt`, and apply remote rows with the same `put`. UI code doesn't change.
- **Dates** are local `YYYY-MM-DD` strings; times are integer minutes; values ≥ 1440 mean "after midnight on the same planner day" (so the default 06:00 → 01:00 day works, and the timeline expands for anything outside it).
- **Drag & drop** uses Pointer Events (HTML5 DnD doesn't work on iOS). Touch drags start from the grip handle, or a long-press on blocks, so scrolling is never hijacked.
- **Analytics** is descriptive only. Correlations are Spearman, need ≥ 8 overlapping days, support lag 0/+1/+2, use wording like "moderate positive association" and always show "Correlation does not imply causation." No fake ML — `buildDaily()` returns aligned arrays that a future model can consume.

## Data, privacy, PWA

- Storage: IndexedDB database `planner-local` (settings in the `settings` store). Only the theme name is mirrored to `localStorage` to avoid a flash on load.
- No network calls except loading the app's own files. A Content-Security-Policy enforces this.
- Service worker: precaches everything on first load; afterwards serves from cache and refreshes in the background. **After changing any file run `node tools/build-sw.mjs`** so installed copies update.
- Export JSON = lossless backup of everything (re-importable, replaces current data). Export CSV = one dataset at a time (tasks, events, routines, completions, health, meals, transactions, projects).
- Reset removes everything on this device. No personal data is in the repo; demo data is fictional and generated in code.

## Known limitations / roadmap

- Roadmap groups/topics can't be reordered by drag yet (order = creation order).
- Moving a recurring event on the timeline changes its time for all occurrences.
- Planned vs Actual: actual time is entered manually on a task.
- Possible next steps: Supabase sync, reminders/notifications, per-occurrence exceptions for recurring items, task dependencies, weekly review screen, simple forecasting models on top of `buildDaily()`, automated tests.
