// The notification panel (a dialog): release notes, update notices and notification settings.
import { el } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { openDialog, closeDialog, dlgBtn, ibtn, iconBtn } from '../../core/ui.js';
import { openExternal } from '../../core/platform.js';
import { parseDay } from '../../core/dates.js';
import * as notes from '../../services/notifications.js';
import * as updates from '../../services/updates.js';
import { manualCheck } from './actions.js';

const dateText = s => parseDay(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function openPanel() {
  const unread = new Set(notes.list().filter(i => !i.read).map(i => i.id));   // remember what was new when the panel opened
  const body = el('div', { className: 'notif' });
  render(body, unread);
  openDialog('Notifications', `${document.title} ${notes.currentVersion()}`, [body], [dlgBtn('Close', 'btn-default', closeDialog)]);
  notes.markAllRead();
}

function render(body, unread) {
  const items = notes.list();
  const list = el('div', { className: 'notif-list' });
  if (!items.length) list.append(el('div', { className: 'notif-empty', textContent: 'You’re all caught up. New features and updates will show up here.' }));
  items.forEach(item => list.append(itemNode(item, unread.has(item.id), () => render(body, unread))));
  body.replaceChildren(list, settingsNode(body, unread));
}

function itemNode(item, isNew, rerender) {
  const node = el('div', { className: 'notif-item' + (isNew ? ' unread' : '') });
  const release = item.type === 'whatsnew' ? notes.releaseFor(item.version) : null;
  const title = el('div', { className: 'notif-title' }, item.type === 'update' ? `Version ${item.version} is available` : `What’s new in ${item.version}`);
  if (isNew) title.append(el('span', { className: 'notif-new', textContent: 'New' }));
  const sub = item.type === 'update' ? 'A newer release was found' : release ? `${release.title} · ${dateText(release.date)}` : 'Release notes';

  const icon = el('div', { className: 'notif-icon' }); icon.innerHTML = svg(item.type === 'update' ? 'download' : 'sparkles', 16);
  node.append(el('div', { className: 'notif-head' }, icon, el('div', { className: 'notif-main' }, title, el('div', { className: 'notif-sub', textContent: sub })),
    iconBtn('trash', 'Dismiss', 'destructive', () => { notes.dismiss(item.id); rerender(); })));

  if (release) node.append(el('ul', { className: 'notif-bullets' }, ...release.highlights.map(h => el('li', { textContent: h }))));
  if (item.type === 'update') {
    if (item.notes) node.append(el('div', { className: 'notif-notes', textContent: item.notes }));
    node.append(el('div', { className: 'notif-actions' }, ibtn('View release', 'btn-default sm-text', 'download', () => openExternal(item.url))));
  }
  return node;
}

function pref(name, text) {
  const box = el('input', { type: 'checkbox', checked: notes.prefs()[name] });
  box.onchange = () => notes.setPref(name, box.checked);
  return el('label', { className: 'pref' }, box, el('span', { textContent: text }));
}

function settingsNode(body, unread) {
  const wrap = el('details', { className: 'notif-settings' }, el('summary', { textContent: 'Notification settings' }),
    pref('newFeatures', 'Tell me what’s new after an update'));
  if (!updates.supported()) {
    wrap.append(el('p', { className: 'pref-note', textContent: 'Update checks are available in the desktop app.' }));
  } else if (!updates.isConfigured()) {
    wrap.append(el('p', { className: 'pref-note', textContent: 'Update checks aren’t set up for this build (no release feed is configured).' }));
  } else {
    const status = el('p', { className: 'pref-note' });
    const last = notes.lastChecked();
    status.textContent = last ? 'Last checked ' + new Date(last).toLocaleString() : 'Not checked yet.';
    const check = ibtn('Check now', 'btn-outline sm-text', null, async () => {
      check.disabled = true; check.textContent = 'Checking…';
      const r = await manualCheck();
      if (r.item) unread.add(r.item.id);
      render(body, unread); notes.markAllRead();
    });
    wrap.append(pref('updateCheck', 'Check for updates automatically (once a day)'), pref('system', 'Show a system notification when an update is found'), status, check);
  }
  return wrap;
}
