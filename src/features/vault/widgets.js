// Small vault-specific UI pieces.
import { el } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { toast, copyText } from '../../core/ui.js';
import { passwordBits } from '../../services/vault/crypto.js';

// strength bar + label that follows a password <input>
export function strengthMeter(input) {
  const bar = el('i'), label = el('span');
  label.style.cssText = 'font-size:.78rem;color:var(--muted-foreground)';
  const box = el('div', {}, el('div', { className: 'meter' }, bar), label);
  box.style.marginBottom = '12px';
  input.addEventListener('input', () => {
    const bits = passwordBits(input.value);
    bar.style.width = Math.min(100, bits / 80 * 100) + '%';
    bar.style.background = bits < 40 ? 'var(--destructive)' : bits < 60 ? '#d9a441' : 'var(--primary)';
    label.textContent = input.value ? (bits < 40 ? 'Weak' : bits < 60 ? 'Okay' : bits < 80 ? 'Good' : 'Strong') + ' · a long passphrase works best' : '';
  });
  return box;
}

// big centered card used by the setup and locked screens
export function shell(title, description, form) {
  const icon = el('div', { className: 'vlock-icon' });
  icon.innerHTML = svg('lock', 22);
  return el('div', { className: 'vault-wrap card card-pad' }, icon, el('h2', { className: 'serif', textContent: title }), el('p', { textContent: description }), form);
}

// copied secrets are wiped from the clipboard after 30 seconds
let clipTimer = null;
export function copySecret(text, what) {
  copyText(text, () => {
    toast(what + ' copied · clears in 30 s');
    clearTimeout(clipTimer);
    clipTimer = setTimeout(async () => {
      try { if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText(''); }
      catch (e) { try { await navigator.clipboard.writeText(''); } catch (e2) { /* ignore */ } }
    }, 30000);
  });
}

export const row = (label, value, ...actions) =>
  el('div', { className: 'vrow' }, el('span', { className: 'vl', textContent: label }), value, ...actions);
