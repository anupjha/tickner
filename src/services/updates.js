// Update check. Only the desktop app can do it: the page itself has no network access, so the main process
// fetches the release feed (see electron/updates.js) and this module turns the answer into a notification.
import { currentVersion, compareVersions, recordUpdate, markChecked } from './notifications.js';

const bridge = () => (typeof window !== 'undefined' && window.desktop && window.desktop.checkForUpdates ? window.desktop : null);
let configured = false;

export const supported = () => !!bridge();
export const isConfigured = () => configured;

// asks the desktop app whether a release feed is set up for this build
export async function init() {
  const b = bridge();
  if (!b) return;
  try { configured = !!(await b.updateStatus()).configured; } catch (e) { configured = false; }
}

// -> { status: 'unsupported' | 'not-configured' | 'error' | 'current' | 'available', version?, item? }
export async function check() {
  const b = bridge();
  if (!b) return { status: 'unsupported' };
  let r;
  try { r = await b.checkForUpdates(); } catch (e) { return { status: 'error' }; }
  if (!r || !r.ok) return { status: r && r.reason === 'not-configured' ? 'not-configured' : 'error' };
  markChecked();
  const current = currentVersion();
  if (compareVersions(r.version, current) <= 0) return { status: 'current', version: current };
  return { status: 'available', version: r.version, item: recordUpdate(r) };   // item is null if it was already announced or dismissed
}
