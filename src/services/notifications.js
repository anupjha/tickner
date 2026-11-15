// Notification rules (no DOM): detect that the app was upgraded, keep the list of notifications, preferences.
//   whatsnew:<version>  - release notes from src/changelog.js, created when the app is upgraded
//   update:<version>    - a newer release was found by the update check (desktop)
import { state, persist } from '../core/store.js';
import { emit } from '../core/bus.js';
import { isVersion, DEFAULT_PREFS } from '../core/notify-schema.js';
import { CHANGELOG } from '../changelog.js';

// Release that existed before notifications did. An install that already has data but no recorded version is treated as coming from it.
export const BASELINE = '1.0.0';
export const currentVersion = () => (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : CHANGELOG[0].version);

const nums = v => String(v).replace(/^v/, '').split('.').map(Number);
export function compareVersions(a, b) {
  const x = nums(a), y = nums(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

const changed = () => { persist('notify'); emit('notify:changed'); };
const hasData = () => !!(state.todos.length || state.marks.length || state.notes.length || state.vault || Object.keys(state.plan).length);

// Call once at startup. Returns the "what's new" items that were just added (empty for a fresh install or no upgrade).
export function detectUpgrade(current = currentVersion()) {
  const n = state.notify, added = [];
  if (!n.seenVersion) n.seenVersion = hasData() ? BASELINE : current;
  if (compareVersions(current, n.seenVersion) > 0) {
    if (n.prefs.newFeatures) {
      CHANGELOG.filter(r => compareVersions(r.version, n.seenVersion) > 0 && compareVersions(r.version, current) <= 0)
        .sort((a, b) => compareVersions(a.version, b.version))
        .forEach(r => {
          const id = 'whatsnew:' + r.version;
          if (n.items.some(i => i.id === id)) return;
          const item = { id, type: 'whatsnew', version: r.version, createdAt: Date.now(), read: false };
          n.items.push(item); added.push(item);
        });
    }
    n.seenVersion = current;
  }
  n.items = n.items.filter(i => i.type !== 'update' || compareVersions(i.version, current) > 0).slice(-30);   // an installed update is no longer news
  changed();
  return added;
}

// newest version first
export const list = () => state.notify.items.slice().sort((a, b) => compareVersions(b.version, a.version) || b.createdAt - a.createdAt);
export const unreadCount = () => state.notify.items.filter(i => !i.read).length;
export const releaseFor = version => CHANGELOG.find(r => r.version === version) || null;

export function markAllRead() {
  let any = false;
  state.notify.items.forEach(i => { if (!i.read) { i.read = true; any = true; } });
  if (any) changed();
}

// removes a notification; a dismissed update is not announced again
export function dismiss(id) {
  const n = state.notify, item = n.items.find(i => i.id === id);
  n.items = n.items.filter(i => i.id !== id);
  if (item && item.type === 'update' && !n.dismissedUpdates.includes(item.version)) n.dismissedUpdates = [...n.dismissedUpdates, item.version].slice(-20);
  changed();
}

export const prefs = () => state.notify.prefs;
export function setPref(name, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, name)) return;
  state.notify.prefs[name] = !!value;
  changed();
}

// Adds an "update available" notification for a newer release. Returns the item, or null if there is nothing new to say.
export function recordUpdate(info, current = currentVersion()) {
  const n = state.notify;
  const version = typeof info.version === 'string' ? info.version.replace(/^v/, '') : '';
  if (!isVersion(version) || compareVersions(version, current) <= 0) return null;
  if (n.dismissedUpdates.includes(version) || n.items.some(i => i.id === 'update:' + version)) return null;
  if (typeof info.url !== 'string' || !/^https:[/][/]/i.test(info.url)) return null;
  n.items = n.items.filter(i => i.type !== 'update' || compareVersions(i.version, version) > 0);   // a newer release replaces an older pending one
  const item = { id: 'update:' + version, type: 'update', version, createdAt: Date.now(), read: false, url: info.url.slice(0, 500), notes: String(info.notes || '').slice(0, 2000) };
  n.items.push(item);
  changed();
  return item;
}

// automatic update checks run at most once a day
export const shouldAutoCheck = (now = Date.now()) => state.notify.prefs.updateCheck && now - state.notify.lastCheck > 24 * 3600 * 1000;
export const lastChecked = () => state.notify.lastCheck;
export function markChecked(now = Date.now()) { state.notify.lastCheck = now; persist('notify'); }
