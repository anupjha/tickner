// Notification center: a bell in the header with an unread badge. Release notes appear after an upgrade;
// the desktop app can also announce newer releases. Rules are in services/notifications.js and services/updates.js.
import './notifications.css';
import { el } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { on } from '../../core/bus.js';
import { register } from '../../core/commands.js';
import { toast } from '../../core/ui.js';
import * as notes from '../../services/notifications.js';
import * as updates from '../../services/updates.js';
import { openPanel } from './panel.js';
import { runCheck, manualCheck } from './actions.js';

export function initNotifications(actionsEl) {
  const icon = el('span'); icon.style.display = 'inline-flex'; icon.innerHTML = svg('bell', 16);
  const count = el('span', { className: 'bell-count' });
  const bell = el('button', { className: 'btn btn-outline btn-icon bell', type: 'button', onclick: openPanel }, icon, count);
  actionsEl.append(bell);

  const refresh = () => {
    const n = notes.unreadCount();
    count.hidden = n === 0;
    count.textContent = n > 9 ? '9+' : String(n);
    bell.title = n ? `${n} unread notification${n === 1 ? '' : 's'}` : 'Notifications';
    bell.setAttribute('aria-label', bell.title);
  };
  on('notify:changed', refresh);
  register('notifications:open', openPanel);
  register('updates:check', async () => { const r = await manualCheck(); if (r.status === 'available') openPanel(); });

  // what's new after an upgrade
  const added = notes.detectUpgrade();
  refresh();
  if (added.length) toast(`Updated to ${notes.currentVersion()}. Open the bell to see what’s new.`);

  // update checks (desktop only, and only when a release feed is configured)
  const autoCheck = () => { if (updates.isConfigured() && notes.shouldAutoCheck()) runCheck(); };
  updates.init().then(() => { setTimeout(autoCheck, 3000); setInterval(autoCheck, 6 * 3600 * 1000); });
}
