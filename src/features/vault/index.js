// Vault view: create / unlock screens and the list of secrets. Crypto and storage live in services/vault.
import './vault.css';
import { el, scope } from '../../core/dom.js';
import { on } from '../../core/bus.js';
import { getVaultPrefs } from '../../core/prefs.js';
import { toast, iconBtn, ibtn, field, closeSensitiveDialog } from '../../core/ui.js';
import { hostOf, normUrl } from '../../core/util.js';
import * as session from '../../services/vault/session.js';
import { cryptoAvailable } from '../../services/vault/crypto.js';
import { strengthMeter, shell, copySecret, row } from './widgets.js';
import { KINDS, openItemEditor, confirmDelete, openSettings } from './dialogs.js';

export const id = 'vault';
export const label = 'Vault';

let $, query = '', active = false, idleTimer = null;
const revealed = new Set();   // ids of secrets currently shown (auto-hidden after 15 s, cleared on lock)

export function mount(section) {
  $ = scope(section);
  section.innerHTML = '<div id="vaultRoot"></div>';
  // auto-lock: any activity restarts the timer
  ['pointerdown', 'keydown', 'input'].forEach(ev => addEventListener(ev, resetIdle, true));
  on('vault:locked', () => { clearTimeout(idleTimer); revealed.clear(); closeSensitiveDialog(); render(); });
}
export function show() { active = true; render(); }
export function hide() { active = false; }
export function reset() { query = ''; revealed.clear(); }

function resetIdle() {
  if (!session.isUnlocked()) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { session.lock(); toast('Vault locked after inactivity'); }, getVaultPrefs().autoLockMin * 60000);
}

function render() {
  const root = $('vaultRoot');
  if (!cryptoAvailable()) { root.replaceChildren(shell('Encryption unavailable', 'This browser context doesn’t support the Web Crypto API, so the vault can’t be used here.', el('span'))); return; }
  if (!session.exists()) root.replaceChildren(setupScreen());
  else if (!session.isUnlocked()) root.replaceChildren(lockedScreen());
  else root.replaceChildren(...unlockedScreen());
}

function setupScreen() {
  const pw = el('input', { className: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' });
  const pw2 = el('input', { className: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'Type it again' });
  const ack = el('input', { type: 'checkbox' }), err = el('p', { className: 'v-err' });
  const btn = el('button', { className: 'btn btn-default', type: 'submit', textContent: 'Create vault' });
  const form = el('form', {}, field('Master password', pw), strengthMeter(pw), field('Confirm master password', pw2),
    el('label', { className: 'gen-row' }, ack, 'I understand that if I forget this password, my vault can’t be recovered.'), err, btn);
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    if (pw.value.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
    if (pw.value !== pw2.value) { err.textContent = 'The passwords don’t match.'; return; }
    if (!ack.checked) { err.textContent = 'Please confirm you understand there’s no recovery.'; return; }
    btn.disabled = true; btn.textContent = 'Creating…';
    try { await session.create(pw.value); resetIdle(); toast('Vault created and unlocked'); } catch (x) { /* nothing was stored */ }
    render();
  };
  return shell('Create your vault', 'Logins, passcodes and other secrets are encrypted with your master password before they’re saved on this device.', form);
}

function lockedScreen() {
  const pw = el('input', { className: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Master password' });
  const err = el('p', { className: 'v-err' }), btn = el('button', { className: 'btn btn-default', type: 'submit', textContent: 'Unlock' });
  const form = el('form', {}, field('Master password', pw), err, btn);
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Unlocking…';
    const wait = session.unlockDelayMs();
    if (wait) await new Promise(r => setTimeout(r, wait));
    if (await session.unlock(pw.value)) { resetIdle(); render(); return; }
    pw.value = ''; btn.disabled = false; btn.textContent = 'Unlock'; err.textContent = 'That password didn’t work.'; pw.focus();
  };
  if (active) setTimeout(() => pw.focus(), 0);
  return shell('Vault locked', 'Enter your master password to see your secrets.', form);
}

function unlockedScreen() {
  const list = el('ul', { id: 'vList' });
  const search = el('input', { className: 'input', type: 'search', placeholder: 'Search by title, username or website', value: query });
  search.oninput = e => { query = e.target.value.trim().toLowerCase(); fillList(list); };
  const settings = ibtn('', 'btn-outline btn-icon', 'sliders', () => openSettings({ onPrefsChanged: () => { resetIdle(); render(); }, onErased: render }));
  settings.setAttribute('aria-label', 'Vault settings'); settings.title = 'Vault settings';
  const tools = el('div', { className: 'v-tools' }, search,
    ibtn('Add', 'btn-default', 'plus', () => openItemEditor(null, render)),
    ibtn('Lock', 'btn-outline', 'lock', () => session.lock()), settings);
  const note = el('p', { className: 'sub', textContent: 'Encrypted on this device · auto-locks after ' + getVaultPrefs().autoLockMin + ' min of inactivity' });
  note.style.margin = '0 0 14px';
  fillList(list);
  return [tools, note, list];
}

function fillList(ul) {
  const items = session.getItems()
    .filter(it => !query || (it.title + ' ' + (it.username || '') + ' ' + (it.url || '')).toLowerCase().includes(query))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (!items.length) {
    const e = el('div', { className: 'empty' });
    e.innerHTML = '<p class="serif"></p><span></span>';
    const any = session.getItems().length > 0;
    e.firstChild.textContent = any ? 'No matches' : 'Nothing stored yet';
    e.lastChild.textContent = any ? 'Try a different search.' : 'Add a login, passcode or any secret you want to keep safe.';
    ul.replaceChildren(e); return;
  }
  ul.replaceChildren(...items.map(card));
}

function card(item) {
  const li = el('li', { className: 'vcard' });
  li.append(el('div', { className: 'vhead' }, el('div', { className: 'avatar', textContent: (item.title || '?').charAt(0) }),
    el('div', { className: 'vt', textContent: item.title }), el('span', { className: 'badge badge-outline', textContent: KINDS[item.kind] || 'Other' }),
    iconBtn('pencil', 'Edit', '', () => openItemEditor(item, render)), iconBtn('trash', 'Delete', 'destructive', () => confirmDelete(item, render))));

  if (item.username) li.append(row('Username', el('span', { className: 'vv', textContent: item.username }), iconBtn('copy', 'Copy username', '', () => copySecret(item.username, 'Username'))));

  const shown = revealed.has(item.id);
  const eye = iconBtn(shown ? 'eyeoff' : 'eye', shown ? 'Hide' : 'Show', '', () => {
    if (shown) revealed.delete(item.id);
    else { revealed.add(item.id); setTimeout(() => { revealed.delete(item.id); if (session.isUnlocked() && $('vList')) fillList($('vList')); }, 15000); }
    fillList($('vList'));
  });
  li.append(row(item.kind === 'passcode' ? 'Passcode' : 'Secret',
    el('span', { className: 'vv mono', textContent: shown ? item.secret : '••••••••••' }), eye,
    iconBtn('copy', 'Copy secret', '', () => copySecret(item.secret, 'Secret'))));

  const link = item.url && normUrl(item.url);
  if (link) li.append(row('Website', el('a', { className: 'vv', href: link, target: '_blank', rel: 'noopener noreferrer', textContent: hostOf(link) })));
  if (item.notes) li.append(el('div', { className: 'vnotes', textContent: item.notes }));
  return li;
}
