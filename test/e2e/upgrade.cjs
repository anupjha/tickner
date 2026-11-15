'use strict';
// Someone who already uses the app updates to this version: the bell must announce what's new. No update feed is configured here.
const path = require('path');
const { openStore } = require('../../electron/db');
// an existing install: has data, but no notification state yet
const seed = openStore(path.join(process.env.UD, 'tickner.db'));
seed.save('todos.v1', JSON.stringify([{ id: 'a', text: 'I was already using the app', done: false }]));
seed.close();

const { DatabaseSync } = require('node:sqlite');
const { ok, wait, boot, finish } = require('./lib.cjs');
(async () => {
  const { win, run, until } = await boot();
  ok(await run(`document.querySelector('.bell-count').hidden === false && document.querySelector('.bell-count').textContent === '1'`), 'bell shows 1 unread after the upgrade');
  ok((await run(`document.querySelector('.toast').textContent`)).startsWith('Updated to 1.1.0'), 'a toast mentions the update');
  await run(`document.querySelector('.bell').click()`);
  ok(await run(`document.querySelector('dialog').open && document.querySelector('#dlgTitle').textContent === 'Notifications'`), 'clicking the bell opens the notification panel');
  ok(await run(`document.querySelector('.notif-title').textContent.startsWith('What’s new in 1.1.0')`), 'panel lists the release notes');
  ok(await run(`!!document.querySelector('.notif-item.unread .notif-new') && document.querySelectorAll('.notif-bullets li').length === 3`), 'new item is highlighted and shows its highlights');
  ok(await run(`document.querySelector('.bell-count').hidden === true`), 'opening the panel marks everything as read');
  ok(await run(`document.querySelector('.notif-settings').textContent.includes('aren’t set up')`), 'settings explain that update checks need a feed');
  // settings toggle persists
  await run(`document.querySelector('.notif-settings details, details.notif-settings').open = true; document.querySelector('.pref input').click()`);
  ok(await run(`__app.state.notify.prefs.newFeatures === false`), 'turning a preference off is saved');
  await run(`document.querySelector('.pref input').click()`);
  await run(`__t.clickBtn('dialog','Close')`); await wait(300);
  await run(`document.querySelector('.bell').click()`);
  ok(await run(`!document.querySelector('.notif-item.unread')`), 'reopening shows it as read');
  await run(`document.querySelector('.notif-item button[title="Dismiss"]').click()`);
  ok(await run(`document.querySelector('.notif-empty') !== null`), 'dismissing leaves the "all caught up" message');
  await run(`__t.clickBtn('dialog','Close')`);
  win.webContents.send('menu', 'updates:check'); await wait(1200);
  ok((await run(`document.querySelector('.toast').textContent`)).includes('aren’t set up'), 'Help > Check for Updates explains when no feed is configured');
  win.webContents.send('menu', 'notifications:open'); await wait(400);
  ok(await run(`document.querySelector('dialog').open`), 'Help > What’s New opens the panel');
  await wait(500);
  const db = new DatabaseSync(path.join(process.env.UD, 'tickner.db'), { readOnly: true });
  const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE name='notify.v1'").get().value);
  ok(saved.seenVersion === '1.1.0' && saved.items.length === 0, 'notification state is stored in SQLite (seenVersion 1.1.0)');
  db.close();
  finish();
})();
