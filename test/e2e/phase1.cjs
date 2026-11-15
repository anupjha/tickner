'use strict';
// Launch #1 of the real desktop app: use every feature through the UI.
const path = require('path');
process.env.TICKNER_USER_DATA = process.env.UD;
process.env.TICKNER_DEBUG = '1';
const { app, BrowserWindow } = require('electron');
require('../../electron/main.js');
const { ok, wait, finish } = require('./lib.cjs');

const DRIVER_SRC = require('fs').readFileSync(path.join(__dirname, 'lib.cjs'), 'utf8').match(/const DRIVER = `([\s\S]*?)`;/)[1];

app.whenReady().then(async () => {
  let win; for (let i = 0; i < 60 && !(win = BrowserWindow.getAllWindows()[0]); i++) await wait(100);
  const logs = []; win.webContents.on('console-message', e => { if (e.level === 'error') logs.push(e.message); });
  await wait(1500);
  const run = c => win.webContents.executeJavaScript(c);
  const until = async (expr, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await run(expr)) return true; await wait(100); } return false; };
  await run(DRIVER_SRC);
  await until('!!window.__app');
  const T = (s, ...a) => run(`__t.${s}`.replace('()', '') + (a.length ? '(' + a.map(x => JSON.stringify(x)).join(',') + ')' : ''));
  const q = sel => run(`__t.qa(${JSON.stringify(sel)}).length`);
  const txt = sel => run(`__t.txt(${JSON.stringify(sel)})`);

  ok(await run('typeof window.desktop.db') === 'object', 'desktop bridge is present');
  ok(await q('#views .tab') === 5, 'five tabs are registered');
  ok(await run(`document.title === 'Tickner' && document.querySelector('h1').textContent === 'Tickner'`), 'page title and heading say Tickner');
  ok(win.getTitle() === 'Tickner' || win.getTitle().length > 0, 'window has a title (' + win.getTitle() + ')');

  // ---------- tasks ----------
  await run(`__t.set('#view-tasks #text','Water plants'); __t.set('#view-tasks #due','2030-01-05'); __t.set('#view-tasks #tags','home, chores'); __t.set('#view-tasks #repeat','weekly'); __t.submit('#view-tasks #add')`);
  ok(await q('#view-tasks li.item') === 1, 'task added through the form');
  ok((await txt('#view-tasks li.item .meta')).includes('Weekly') && (await txt('#view-tasks li.item .meta')).includes('#home'), 'task shows repeat and tag badges');
  await run(`__t.click('#view-tasks li.item .cb')`);
  ok(await q('#view-tasks li.item') === 2, 'completing a weekly task creates the next one');
  ok((await txt('.toast')).includes('Next weekly task added for Jan 12'), 'toast announces the next due date');
  ok(await txt('#view-tasks #count') === '1 task left', 'count shows one task left');
  await run(`__t.clickBtn('#view-tasks #tabs','Completed')`);
  ok(await q('#view-tasks li.item') === 1, 'Completed filter shows 1');
  await run(`__t.clickBtn('#view-tasks #tabs','All')`);
  await run(`__t.dbl('#view-tasks li.item:nth-child(2) .label')`);
  await run(`__t.set('#view-tasks li.item input[type=text]','Water the plants'); __t.key('#view-tasks li.item input[type=text]','Enter')`);
  ok(await run(`__t.qa('#view-tasks li.item .label').map(e=>e.textContent).includes('Water the plants')`), 'edit in place saves with Enter');
  await run(`__t.clickBtn('#view-tasks #tagbar','#home')`);
  ok(await q('#view-tasks li.item') === 2, 'tag chip filters the list');
  await run(`__t.clickBtn('#view-tasks #tagbar','#home')`);

  // ---------- daily plan ----------
  await run(`__t.tab('Daily plan')`);
  ok(await run(`!document.querySelector('#view-plan').hidden && document.querySelector('#view-tasks').hidden`), 'switching tabs shows the plan only');
  const openId = await run(`__app.state.todos.find(t => !t.done).id`);
  await run(`__t.set('#view-plan #bTitle','Deep work'); __t.set('#view-plan #bStart','09:00'); __t.set('#view-plan #bEnd','10:30'); __t.set('#view-plan #bTask', ${JSON.stringify(openId)}); __t.submit('#view-plan #blockForm')`);
  ok(await q('#view-plan .block') === 1, 'block appears on the timeline');
  ok((await txt('#view-plan #planSummary')).includes('1 block · 1h 30m planned'), 'summary shows planned time');
  await run(`__t.click('#view-plan .block .cb')`);
  ok(await run(`__app.state.todos[1].done === true && __app.state.todos.length === 3`), 'ticking the block completes the linked task and spawns the next one');

  // ---------- bookmarks ----------
  await run(`__t.tab('Bookmarks')`);
  await run(`__t.set('#view-marks #mUrl','javascript:alert(1)'); __t.submit('#view-marks #markForm')`);
  ok((await txt('#view-marks #mMsg')).includes('valid'), 'javascript: link is rejected');
  await run(`__t.set('#view-marks #mUrl','example.com/docs'); __t.set('#view-marks #mTitle','Docs'); __t.set('#view-marks #mTags','dev'); __t.submit('#view-marks #markForm')`);
  ok(await q('#view-marks li.mark') === 1, 'bookmark saved');
  await run(`__t.set('#view-marks #mUrl','example.com/docs'); __t.submit('#view-marks #markForm')`);
  ok((await txt('#view-marks #mMsg')).includes('already'), 'duplicate link is refused');
  ok(await run(`(a => a.rel.includes('noopener') && a.href === 'https://example.com/docs' && a.target === '_blank')(__t.q('#view-marks li.mark a.mt'))`), 'link opens safely (noopener, https)');
  await run(`__t.click('#view-marks li.mark button[title="Add to favorites"]')`);
  ok(await run(`__app.state.marks[0].fav === true`), 'favorite toggled');

  // ---------- scratch pad ----------
  await run(`__t.tab('Scratch pad')`);
  ok(await run(`!document.querySelector('#nEmpty').hidden`), 'empty state is shown');
  await run(`__t.click('#nNew'); __t.set('#nText','Groceries\\nmilk, eggs')`); await wait(600);
  await run(`__t.click('#nNew'); __t.set('#nText','Ideas\\n- ship it')`); await wait(600);
  ok(await q('#nList .note-item') === 2, 'two notes are listed');
  await run(`__t.click('#nPin')`);
  ok(await run(`__t.qa('#nList .ni-title')[0].textContent.trim()`) === 'Ideas', 'pinned note moves to the top');
  await run(`__t.click('#nDel')`);
  ok(await run(`document.querySelector('dialog').open`), 'delete asks for confirmation');
  await run(`__t.clickBtn('dialog','Delete')`);
  ok(await q('#nList .note-item') === 1, 'note deleted');
  await run(`__t.click('#nNew')`); await run(`__t.tab('Tasks')`);
  ok(await run(`__app.state.notes.length === 1`), 'blank note is discarded when leaving the tab');
  await run(`__t.tab('Scratch pad')`);

  // ---------- vault ----------
  await run(`__t.tab('Vault')`);
  ok((await txt('#vaultRoot h2')) === 'Create your vault', 'vault starts at setup');
  await run(`(() => { const i = __t.qa('#vaultRoot input[type=password]'); i[0].value = 'short'; i[1].value = 'short'; __t.click('#vaultRoot input[type=checkbox]'); __t.submit('#vaultRoot form'); })()`);
  ok((await txt('#vaultRoot .v-err')).includes('10 characters'), 'short master password rejected');
  await run(`(() => { const i = __t.qa('#vaultRoot input[type=password]'); i[0].value = 'correct horse battery'; i[1].value = 'correct horse battery'; __t.submit('#vaultRoot form'); })()`);
  ok(await until('__app.session.isUnlocked()'), 'vault created and unlocked');
  await until(`!!document.querySelector('#vaultRoot .v-tools')`);
  await run(`__t.clickBtn('#vaultRoot .v-tools','Add')`);
  await run(`(() => { __t.set('dialog input[placeholder^="e.g."]','GitHub'); __t.set('dialog input[placeholder="Username or email"]','octo@example.com'); __t.set('dialog input[type=password]','S3cr3t-Pa55!'); __t.clickBtn('dialog','Save'); })()`);
  ok(await until(`document.querySelectorAll('#vaultRoot .vcard').length === 1`), 'secret saved and listed');
  ok((await txt('#vaultRoot .vv.mono')).startsWith('••'), 'secret is masked by default');
  ok(await until(`document.querySelector('#dlgBody').children.length === 0`, 3000), 'dialog contents are wiped after closing');
  await run(`__t.click('#vaultRoot .vcard button[title="Show"]')`);
  ok((await txt('#vaultRoot .vv.mono')) === 'S3cr3t-Pa55!', 'reveal shows the secret');
  await run(`__t.clickBtn('#vaultRoot .v-tools','Lock')`);
  ok(await run(`!__app.session.isUnlocked() && document.querySelector('#vaultRoot h2').textContent === 'Vault locked'`), 'lock clears the session and shows the lock screen');
  await run(`__t.set('#vaultRoot input[type=password]','wrong password!'); __t.submit('#vaultRoot form')`);
  ok(await until(`(document.querySelector('#vaultRoot .v-err')||{}).textContent.includes("didn")`), 'wrong password is refused');
  await run(`__t.set('#vaultRoot input[type=password]','correct horse battery'); __t.submit('#vaultRoot form')`);
  ok(await until(`__app.session.isUnlocked()`, 30000), 'right password unlocks (after the throttle delay)');

  // ---------- backup / theme / native menu ----------
  const exp = await run(`JSON.stringify(__app.backup.buildExport())`);
  ok(!exp.includes('S3cr3t') && JSON.parse(exp).data.vault.data.length > 20, 'export contains the vault only as ciphertext');
  ok(await run(`(() => { const c = __app.backup.cleanImport(JSON.parse(${JSON.stringify(exp)})); return __app.backup.total(__app.backup.applyImport(c, 'merge')) === 0; })()`), 'importing your own export adds nothing');
  await run(`__t.click('#theme')`);
  const theme = await run(`document.documentElement.dataset.theme`);
  win.webContents.send('menu', 'view:notes'); await wait(300);
  ok(await run(`document.querySelector('#view-notes').hidden === false`), 'native menu command switches view');
  win.webContents.send('menu', 'note:new'); await wait(300);
  ok(await run(`document.activeElement.id === 'nText'`), 'native "New Note" command focuses a new note');
  ok(logs.length === 0, 'no console errors' + (logs.length ? ': ' + logs.join(' | ') : ''));
  require('fs').writeFileSync(path.join(process.env.UD, 'theme.txt'), theme);
  await wait(500);
  finish();
});
