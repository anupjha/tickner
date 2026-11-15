'use strict';
// A user upgrading from the old "Tasks" app: an old tasks.db sits in the data folder. Tickner must pick it up.
const path = require('path'), fs = require('fs');
process.env.TICKNER_USER_DATA = process.env.UD;
process.env.TICKNER_DEBUG = '1';
const { openStore } = require('../../electron/db');
const old = openStore(path.join(process.env.UD, 'tasks.db'));
old.save('todos.v1', JSON.stringify([{ id: 'old1', text: 'Written by the old Tasks app', done: false }]));
old.save('todos.theme', 'dark');
old.close();

const { app, BrowserWindow } = require('electron');
require('../../electron/main.js');
const { ok, wait, finish } = require('./lib.cjs');
app.whenReady().then(async () => {
  let win; for (let i = 0; i < 60 && !(win = BrowserWindow.getAllWindows()[0]); i++) await wait(100);
  await wait(1500);
  const run = c => win.webContents.executeJavaScript(c);
  ok(await run(`document.querySelectorAll('#view-tasks li.item .label')[0].textContent`) === 'Written by the old Tasks app', 'old data shows up in the new app');
  ok(await run(`document.documentElement.dataset.theme`) === 'dark', 'old theme setting came along');
  ok(fs.existsSync(path.join(process.env.UD, 'tickner.db')) && fs.existsSync(path.join(process.env.UD, 'tasks.db')), 'new database created, old one kept as a backup');
  await wait(300);
  finish();
});
