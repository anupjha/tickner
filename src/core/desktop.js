// Hooks for the Electron shell: platform styling and native-menu commands.
import { run } from './commands.js';

export const isDesktop = () => typeof window !== 'undefined' && !!window.desktop;

export function initDesktop() {
  if (!isDesktop()) return;
  document.documentElement.classList.add('desktop', 'platform-' + window.desktop.platform);
  window.desktop.onMenu(action => run(action));
}
