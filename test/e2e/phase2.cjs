'use strict';
// Launch #2 of the same data folder: everything must have come back from SQLite.
const path = require('path');
process.env.TICKNER_USER_DATA = process.env.UD;
process.env.TICKNER_DEBUG = '1';
const { app, BrowserWindow } = require('electron');
require('../../electron/main.js');
const { ok, wait, finish } = require('./lib.cjs');
const DRIVER_SRC = require('fs').readFileSync(path.join(__dirname, 'lib.cjs'), 'utf8').match(/const DRIVER = `([\s\S]*?)`;/)[1];

app.whenReady().then(async () => {
  let win; for (let i = 0; i < 60 && !(win = BrowserWindow.getAllWindows()[0]); i++) await wait(100);
  await wait(1500);
  const run = c => win.webContents.executeJavaScript(c);
  const until = async (expr, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await run(expr)) return true; await wait(100); } return false; };
  await run(DRIVER_SRC); await until('!!window.__app');

  ok(await run(`__app.state.todos.length === 3 && __app.state.todos[0].repeat === 'weekly'`), 'tasks reloaded from the database (with repeat)');
  ok(await run(`__t.qa('#view-tasks li.item').length === 3`), 'task list is rendered after restart');
  ok(await run(`__app.state.plan[Object.keys(__app.state.plan)[0]].length === 1`), 'plan block reloaded');
  ok(await run(`__app.state.marks.length === 1 && __app.state.marks[0].fav === true`), 'bookmark reloaded');
  ok(await run(`__app.state.notes.length === 1 && __app.state.notes[0].text.startsWith('Groceries')`), 'notes reloaded (the one that was kept)');
  const saved = require('fs').readFileSync(path.join(process.env.UD, 'theme.txt'), 'utf8');
  ok(await run(`document.documentElement.dataset.theme`) === saved, 'theme was remembered (' + saved + ')');

  await run(`__t.tab('Vault')`);
  ok(await run(`document.querySelector('#vaultRoot h2').textContent === 'Vault locked'`), 'vault starts locked after restart');
  await run(`__t.set('#vaultRoot input[type=password]','correct horse battery'); __t.submit('#vaultRoot form')`);
  ok(await until(`document.querySelectorAll('#vaultRoot .vcard').length === 1`, 30000), 'vault unlocks and shows the saved secret');
  ok(await run(`__app.session.getItems()[0].secret === 'S3cr3t-Pa55!'`), 'secret decrypts correctly');

  // import-replace in the UI layer, then it must persist too
  await run(`(() => { const f = { app:'tickner', data:{ todos:[{id:'z',text:'Imported'}], bookmarks:[{id:'q',url:'https://example.com/docs',title:'Same URL new id'}] } }; __app.backup.applyImport(__app.backup.cleanImport(f), 'replace'); })()`);
  ok(await run(`__app.state.todos.length === 1 && __app.state.marks[0].id === 'q' && __app.session.exists()`), 'replace-import swaps data but keeps the vault');
  await run(`__t.tab('Tasks')`);
  ok(await run(`__t.qa('#view-tasks li.item .label')[0].textContent === 'Imported'`), 'views redraw after an import');
  await wait(500);
  finish();
});
