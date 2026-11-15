import { el } from './dom.js';
import { svg } from './icons.js';
import { getTheme, setTheme } from './prefs.js';
import { register } from './commands.js';
import { on } from './bus.js';

let button = null;
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
export const currentTheme = () => document.documentElement.dataset.theme || (systemDark() ? 'dark' : 'light');

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (button) button.innerHTML = svg(theme === 'dark' ? 'sun' : 'moon', 18);
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next); setTheme(next);
}

export function initTheme(actionsEl) {
  button = el('button', { className: 'btn btn-outline btn-icon', type: 'button', id: 'theme', title: 'Toggle theme', onclick: toggleTheme });
  button.setAttribute('aria-label', 'Toggle theme');
  actionsEl.append(button);
  applyTheme(getTheme() || (systemDark() ? 'dark' : 'light'));
  register('theme', toggleTheme);
  on('theme:set', applyTheme);
}
