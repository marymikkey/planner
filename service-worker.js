/* Service worker: offline support.
 *
 * Strategy
 *  - install:  precache the whole app shell (list below) so the first visit already
 *              makes the app fully usable offline.
 *  - fetch:    same-origin GETs are served stale-while-revalidate: instant from cache,
 *              refreshed in the background, so edits to the app show up on the next load.
 *  - activate: delete caches from older versions.
 * User data is NOT cached here — it lives in IndexedDB and never touches the network.
 *
 * The CACHE_VERSION and PRECACHE list are rewritten by `node tools/build-sw.mjs`
 * (run it after changing/adding files so installed copies pick up the update).
 */

/*BEGIN GENERATED*/
const CACHE_VERSION = '0a64a3dadf';
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/base.css",
  "./styles/components.css",
  "./styles/layout.css",
  "./js/core/actions.js",
  "./js/core/analytics.js",
  "./js/core/dates.js",
  "./js/core/db.js",
  "./js/core/demo.js",
  "./js/core/format.js",
  "./js/core/io.js",
  "./js/core/models.js",
  "./js/core/queries.js",
  "./js/core/recurrence.js",
  "./js/core/store.js",
  "./js/i18n.js",
  "./js/main.js",
  "./js/theme-boot.js",
  "./js/theme.js",
  "./js/ui/charts.js",
  "./js/ui/components.js",
  "./js/ui/controls.js",
  "./js/ui/dnd.js",
  "./js/ui/dom.js",
  "./js/ui/forms.js",
  "./js/ui/modal.js",
  "./js/ui/quickadd.js",
  "./js/ui/timeline.js",
  "./js/views/analytics.js",
  "./js/views/career.js",
  "./js/views/finance.js",
  "./js/views/health.js",
  "./js/views/home.js",
  "./js/views/meals.js",
  "./js/views/personal.js",
  "./js/views/planner.js",
  "./js/views/projects.js",
  "./js/views/settings.js",
  "./js/views/study.js",
  "./js/views/today.js",
  "./js/views/work.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg"
];
/*END GENERATED*/

const CACHE = `planner-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('planner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    // Offline navigation fallback: always serve the app shell.
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
