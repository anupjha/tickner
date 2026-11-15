// Update-check actions shared by the bell, the panel and the Help menu.
import { toast } from '../../core/ui.js';
import * as notes from '../../services/notifications.js';
import * as updates from '../../services/updates.js';

// Runs a check. When it finds a release nobody has been told about yet, it can also raise a system notification.
export async function runCheck() {
  const r = await updates.check();
  if (r.status === 'available' && r.item && notes.prefs().system && window.desktop && window.desktop.notify) {
    window.desktop.notify(`${document.title} ${r.version} is available`, 'Open the bell to see what’s new.');
  }
  return r;
}

const MESSAGES = {
  unsupported: 'Update checks are only available in the desktop app.',
  'not-configured': 'Update checks aren’t set up for this build.',
  error: 'Couldn’t check for updates right now.'
};

// user-triggered check: always tells the user what happened. Returns the result.
export async function manualCheck() {
  const r = await runCheck();
  if (MESSAGES[r.status]) toast(MESSAGES[r.status]);
  else if (r.status === 'current') toast(`You’re up to date (${r.version}).`);
  else if (r.status === 'available') toast(`Version ${r.version} is available.`);
  return r;
}
