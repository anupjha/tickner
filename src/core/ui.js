// Shared UI primitives: toast, modal dialog, buttons, clipboard.
import { el } from './dom.js';
import { svg } from './icons.js';

let dlg = null, dlgSensitive = false, toastEl = null, toastTimer = null;
const part = id => dlg.querySelector('#' + id);

export function initUI() {
  dlg = el('dialog', { className: 'dialog' });
  dlg.setAttribute('aria-labelledby', 'dlgTitle');
  dlg.append(el('h2', { className: 'serif', id: 'dlgTitle' }), el('p', { className: 'dlg-desc', id: 'dlgDesc' }),
    el('div', { id: 'dlgBody' }), el('div', { className: 'dlg-foot', id: 'dlgFoot' }));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // click on the backdrop
  dlg.addEventListener('close', () => { if (dlgSensitive) { part('dlgBody').replaceChildren(); dlgSensitive = false; } });
  toastEl = el('div', { className: 'toast' });
  toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); toastEl.hidden = true;
  document.body.append(dlg, toastEl);
}

export function toast(message) {
  toastEl.textContent = message; toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4000);
}

// body: array of nodes, buttons: array of nodes. { sensitive: true } wipes the body when the dialog closes (vault).
export function openDialog(title, description, body, buttons, { sensitive = false } = {}) {
  part('dlgTitle').textContent = title;
  part('dlgDesc').textContent = description;
  part('dlgBody').replaceChildren(...body);
  part('dlgFoot').replaceChildren(...buttons);
  dlgSensitive = sensitive;
  if (!dlg.open) dlg.showModal();
}
export const closeDialog = () => { if (dlg && dlg.open) dlg.close(); };
export function closeSensitiveDialog() {
  if (!dlg || !dlgSensitive) return;
  if (dlg.open) dlg.close();
  part('dlgBody').replaceChildren(); dlgSensitive = false;
}
export const dialogBody = () => part('dlgBody');
export const dlgBtn = (label, cls, fn) => el('button', { className: 'btn ' + cls, type: 'button', textContent: label, onclick: fn });

// small ghost icon button (used in rows)
export function iconBtn(icon, label, cls, fn) {
  const b = el('button', { type: 'button', className: 'btn btn-ghost sm ' + cls, title: label, onclick: fn });
  b.setAttribute('aria-label', label); b.innerHTML = svg(icon, 15);
  return b;
}
// regular button with an optional icon and label; no label => icon-only
export function ibtn(label, cls, icon, fn) {
  const b = el('button', { type: 'button', className: 'btn ' + cls });
  if (icon) b.innerHTML = svg(icon, 16);
  if (label) b.append(label); else b.setAttribute('aria-label', 'Toggle visibility');
  b.onclick = fn;
  return b;
}

export function copyText(text, onDone) {
  const fallback = () => {
    const t = el('textarea', { value: text }); document.body.append(t); t.select();
    try { document.execCommand('copy'); onDone(); } catch (e) { /* ignore */ }
    t.remove();
  };
  try { navigator.clipboard.writeText(text).then(onDone, fallback); } catch (e) { fallback(); }
}

// <label class="vf"><span>Label</span> ...inputs</label>
export const field = (label, ...kids) => el('label', { className: 'vf' }, el('span', { textContent: label }), ...kids);
