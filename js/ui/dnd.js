// Pointer-based drag & drop. HTML5 drag events don't work on iOS touch screens, so this
// small implementation uses Pointer Events instead:
//  - mouse:  drag starts after a few pixels of movement
//  - touch:  drag starts from an explicit grip handle (touch-action: none), or after a
//            short long-press on the item itself, so normal scrolling is never hijacked.
// Drop targets register with dropZone(); the nearest accepting zone under the pointer wins.

const zones = new WeakMap();
let active = null;

export function dropZone(el, handlers) {
  zones.set(el, handlers);
  el.setAttribute('data-dz', '');
  return el;
}

const preventTouchScroll = (e) => { if (active) e.preventDefault(); };

export function draggable(el, { payload, handle, getGhost } = {}) {
  const grip = handle ? el.querySelector(handle) : el;
  if (!grip) return;
  el.classList.add('draggable-item');
  if (handle) grip.classList.add('drag-handle');
  grip.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!handle && e.target.closest('button, input, select, textarea, a, [data-nodrag]')) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    const touch = e.pointerType !== 'mouse';
    const immediate = !touch || !!handle;
    let timer = null, began = false;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const begin = (x, y) => { began = true; beginDrag(el, typeof payload === 'function' ? payload() : payload, x, y, getGhost); };
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!began) {
        const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
        if (immediate && dist > 5) begin(ev.clientX, ev.clientY);
        else if (!immediate && dist > 8) cleanup(); // user is scrolling
      } else dragMove(ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      cleanup();
      if (began) endDrag(ev.clientX, ev.clientY, ev.type === 'pointercancel');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (!immediate) timer = setTimeout(() => { begin(sx, sy); navigator.vibrate?.(8); }, 350);
  });
  // Keep the browser from starting a native image/text drag on desktop.
  el.addEventListener('dragstart', (e) => e.preventDefault());
}

function beginDrag(el, payload, x, y, getGhost) {
  const rect = el.getBoundingClientRect();
  const ghost = (getGhost ? getGhost(el) : el.cloneNode(true));
  ghost.classList.add('dnd-ghost');
  ghost.style.width = `${Math.min(rect.width, 320)}px`;
  document.body.append(ghost);
  active = { el, payload, ghost, zone: null, x, y, grab: { dx: Math.min(x - rect.left, 300), dy: y - rect.top }, raf: 0 };
  el.classList.add('dragging');
  document.body.classList.add('is-dragging');
  document.addEventListener('touchmove', preventTouchScroll, { passive: false });
  placeGhost();
  dragMove(x, y);
  const tick = () => { if (!active) return; autoScroll(); active.raf = requestAnimationFrame(tick); };
  active.raf = requestAnimationFrame(tick);
}

function placeGhost() {
  const a = active;
  a.ghost.style.transform = `translate(${a.x - a.grab.dx}px, ${a.y - a.grab.dy}px)`;
}

function findZone(x, y, payload) {
  let n = document.elementFromPoint(x, y);
  while (n) {
    const z = n.closest?.('[data-dz]');
    if (!z) return null;
    const h = zones.get(z);
    if (h && (!h.accept || h.accept(payload))) return { el: z, h };
    n = z.parentElement;
  }
  return null;
}

function dragMove(x, y) {
  const a = active;
  if (!a) return;
  a.x = x; a.y = y;
  placeGhost();
  const found = findZone(x, y, a.payload);
  if (a.zone && (!found || found.el !== a.zone.el)) { a.zone.el.classList.remove('dz-over'); a.zone.h.onLeave?.(a.payload); }
  if (found) {
    found.el.classList.add('dz-over');
    found.h.onOver?.(a.payload, pointInfo(found.el, a));
  }
  a.zone = found;
}

const pointInfo = (zoneEl, a) => ({ x: a.x, y: a.y, grabDy: a.grab.dy, rect: zoneEl.getBoundingClientRect(), zoneEl });

function autoScroll() {
  const a = active;
  const edge = 64;
  const sc = a.zone?.el.closest?.('.tl-scroll');
  if (sc) {
    const r = sc.getBoundingClientRect();
    if (a.y < r.top + edge) sc.scrollTop -= 10; else if (a.y > r.bottom - edge) sc.scrollTop += 10;
    if (a.zone) a.zone.h.onOver?.(a.payload, pointInfo(a.zone.el, a));
  }
  if (a.y < edge) window.scrollBy(0, -12); else if (a.y > window.innerHeight - edge) window.scrollBy(0, 12);
}

function endDrag(x, y, cancelled) {
  if (!cancelled) dragMove(x, y); // resolve the zone at the exact release point (fast flicks)
  const a = active;
  active = null;
  cancelAnimationFrame(a.raf);
  document.removeEventListener('touchmove', preventTouchScroll);
  a.ghost.remove();
  a.el.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.dz-over').forEach((n) => n.classList.remove('dz-over'));
  // Swallow the click that follows a drag release.
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 80);
  if (a.zone) a.zone.h.onLeave?.(a.payload);
  if (!cancelled && a.zone) {
    a.zone.h.onDrop?.(a.payload, { x, y, grabDy: a.grab.dy, rect: a.zone.el.getBoundingClientRect(), zoneEl: a.zone.el });
  }
}
