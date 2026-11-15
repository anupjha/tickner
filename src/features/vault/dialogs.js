// Modal dialogs of the vault: add/edit a secret, delete, settings (auto-lock, master password, erase).
import { el } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { openDialog, closeDialog, dlgBtn, ibtn, field, toast } from '../../core/ui.js';
import { normUrl } from '../../core/util.js';
import { AUTO_LOCK_CHOICES, getVaultPrefs, setVaultPrefs } from '../../core/prefs.js';
import * as session from '../../services/vault/session.js';
import { genPassword } from '../../services/vault/crypto.js';
import { strengthMeter } from './widgets.js';

export const KINDS = { login: 'Login', passcode: 'Passcode / PIN', other: 'Other' };
const open = (title, description, body, buttons) => openDialog(title, description, body, buttons, { sensitive: true });
const cancelBtn = () => dlgBtn('Cancel', 'btn-outline', closeDialog);

export function openItemEditor(item, onSaved) {
  const kind = el('select', { className: 'input' });
  Object.entries(KINDS).forEach(([k, v]) => kind.append(el('option', { value: k, textContent: v })));
  kind.value = item ? item.kind : 'login';
  const title = el('input', { className: 'input', type: 'text', value: item ? item.title : '', placeholder: 'e.g. GitHub, Home Wi-Fi, Garage code' });
  const user = el('input', { className: 'input', type: 'text', value: item ? item.username || '' : '', autocomplete: 'off', placeholder: 'Username or email' });
  const secret = el('input', { className: 'input', type: 'password', value: item ? item.secret : '', autocomplete: 'new-password', spellcheck: false });
  const eye = ibtn('', 'btn-outline btn-icon', 'eye', () => {
    secret.type = secret.type === 'password' ? 'text' : 'password';
    eye.innerHTML = svg(secret.type === 'password' ? 'eye' : 'eyeoff', 16);
  });
  const url = el('input', { className: 'input', type: 'text', value: item ? item.url || '' : '', autocomplete: 'off', placeholder: 'example.com' });
  const notes = el('textarea', { className: 'input', value: item ? item.notes || '' : '' });

  // password generator
  const length = el('input', { className: 'input', type: 'number', value: 20, min: 8, max: 64 });
  const sets = { lower: true, upper: true, digits: true, symbols: true };
  const checks = Object.entries({ lower: 'a-z', upper: 'A-Z', digits: '0-9', symbols: '#$%' }).map(([k, text]) => {
    const c = el('input', { type: 'checkbox', checked: true }); c.onchange = () => { sets[k] = c.checked; };
    return el('label', {}, c, text);
  });
  const generate = ibtn('Generate', 'btn-outline sm-text', 'repeat', () => {
    const p = genPassword(Math.min(64, Math.max(8, parseInt(length.value, 10) || 20)), sets);
    if (!p) return;
    secret.value = p; secret.type = 'text'; eye.innerHTML = svg('eyeoff', 16);
  });

  const err = el('p', { className: 'v-err' });
  const body = el('div', {}, field('Type', kind), field('Title', title), field('Username (optional)', user),
    field('Secret', el('div', { className: 'pw-row' }, secret, eye)), el('div', { className: 'gen-row' }, generate, 'Length', length, ...checks),
    field('Website (optional)', url), field('Notes (optional)', notes), err);

  const save = async () => {
    const t = title.value.trim(), s = secret.value;
    if (!t) { err.textContent = 'Give it a title.'; return; }
    if (!s) { err.textContent = 'Enter the secret.'; return; }
    let u = url.value.trim();
    if (u) { u = normUrl(u); if (!u) { err.textContent = 'That website address isn’t valid.'; return; } }
    const data = { kind: kind.value, title: t.slice(0, 120), username: user.value.trim().slice(0, 200), secret: s.slice(0, 2000), url: u || '', notes: notes.value.slice(0, 5000), updated: Date.now() };
    try { await session.upsert(item ? item.id : null, data); }
    catch (e) { err.textContent = 'Couldn’t save. Is storage full?'; return; }
    closeDialog(); onSaved();
  };
  open(item ? 'Edit secret' : 'Add a secret', 'Everything here is encrypted before it’s saved.', [body], [cancelBtn(), dlgBtn('Save', 'btn-default', save)]);
  setTimeout(() => title.focus(), 0);
}

export function confirmDelete(item, onDone) {
  open('Delete this secret?', item.title, [], [cancelBtn(), dlgBtn('Delete', 'btn-destructive', async () => {
    try { await session.remove(item.id); } catch (e) { toast('Couldn’t save the change.'); }
    closeDialog(); onDone();
  })]);
}

export function openSettings({ onPrefsChanged, onErased }) {
  const choice = el('select', { className: 'input' });
  const current = getVaultPrefs().autoLockMin;
  AUTO_LOCK_CHOICES.forEach(m => choice.append(el('option', { value: m, textContent: m + (m > 1 ? ' minutes' : ' minute'), selected: m === current })));
  choice.onchange = () => { setVaultPrefs({ autoLockMin: +choice.value }); onPrefsChanged(); };

  const pw = placeholder => el('input', { className: 'input', type: 'password', autocomplete: 'off', placeholder });
  const cur = pw('Current master password'), n1 = pw('New master password (10+ characters)'), n2 = pw('Confirm new password');
  const err = el('p', { className: 'v-err' });
  const change = ibtn('Change master password', 'btn-outline', 'lock', async () => {
    err.textContent = '';
    if (n1.value.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
    if (n1.value !== n2.value) { err.textContent = 'The new passwords don’t match.'; return; }
    if (!(await session.verifyPassword(cur.value))) { err.textContent = 'The current password is wrong.'; return; }
    try { await session.changePassword(n1.value); closeDialog(); toast('Master password changed'); }
    catch (e) { err.textContent = 'Couldn’t save the change.'; }
  });
  const body = el('div', {}, field('Auto-lock after', choice), field('Change master password', cur, n1, n2, strengthMeter(n1)), err, change);
  body.lastChild.style.marginBottom = '16px';
  body.append(ibtn('Erase vault…', 'btn-outline destructive-text', 'trash', () => confirmErase(onErased)));
  open('Vault settings', 'Your master password is never stored anywhere.', [body], [dlgBtn('Close', 'btn-outline', closeDialog)]);
}

function confirmErase(onErased) {
  const box = el('input', { className: 'input', type: 'text', placeholder: 'Type ERASE to confirm', autocomplete: 'off' });
  open('Erase the vault?', 'This permanently deletes every secret in it. Export a backup first if you might need them.', [box],
    [cancelBtn(), dlgBtn('Erase vault', 'btn-destructive', () => {
      if (box.value.trim().toUpperCase() !== 'ERASE') { box.focus(); return; }
      session.erase(); closeDialog(); onErased(); toast('Vault erased');
    })]);
}
