// Sheets (bottom sheet on phones, centred dialog on desktop), confirmations and action menus.
// Focus is moved into the sheet, Escape closes it, and focus returns to the opener.
import { h, icon } from './dom.js';

const openStack = [];

export function openSheet({ title, body, footer, wide = false, onClose } = {}) {
  const opener = document.activeElement;
  const titleId = `sheet-title-${Math.random().toString(36).slice(2, 7)}`;
  const close = () => {
    overlay.remove();
    document.body.classList.toggle('modal-open', openStack.length > 1);
    openStack.pop();
    onClose?.();
    if (opener && document.contains(opener)) opener.focus?.();
  };
  const sheet = h('div', { class: `sheet${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('div', { class: 'sheet-head' },
      h('h2', { id: titleId }, title || ''),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: close }, icon('x'))),
    h('div', { class: 'sheet-body' }, body),
    footer ? h('div', { class: 'sheet-foot' }, footer) : null);
  const overlay = h('div', {
    class: 'overlay',
    onMousedown: (e) => { if (e.target === overlay) close(); },
    onKeydown: (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') trapFocus(e, sheet);
    },
  }, sheet);
  document.getElementById('overlay-root').append(overlay);
  document.body.classList.add('modal-open');
  openStack.push(overlay);
  const first = sheet.querySelector('[autofocus], input:not([type=hidden]), textarea, select, button.primary');
  requestAnimationFrame(() => (first || sheet).focus());
  return { close, sheet, overlay };
}

function trapFocus(e, root) {
  const f = [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// Only for destructive actions (spec: avoid annoying dialogs for routine things).
export function confirmDialog(message, { confirmLabel = 'Delete', title = 'Are you sure?', danger = true } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const dlg = openSheet({
      title,
      body: h('p', { class: 'muted' }, message),
      footer: [
        h('button', { class: 'btn', type: 'button', onClick: () => { finish(false); dlg.close(); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onClick: () => { finish(true); dlg.close(); } }, confirmLabel),
      ],
      onClose: () => finish(false),
    });
    dlg.sheet.classList.add('small');
  });
}

// List of tappable actions: [{label, icon, onClick, danger}]
export function actionSheet(title, actions) {
  const dlg = openSheet({
    title,
    body: h('div', { class: 'action-list' }, actions.filter(Boolean).map((a) =>
      h('button', {
        class: `action-item${a.danger ? ' danger-text' : ''}`, type: 'button',
        onClick: () => { dlg.close(); setTimeout(() => a.onClick(), 0); },
      }, a.icon ? icon(a.icon, 18) : null, a.label))),
  });
  dlg.sheet.classList.add('small');
  return dlg;
}
