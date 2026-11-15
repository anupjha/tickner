'use strict';
// The single-file web build, opened like a normal web page (no desktop bridge): data goes to localStorage.
const path = require('path');
const { ok, wait, start, finish } = require('./lib.cjs');
(async () => {
  const { win, run } = await start({ file: path.join(__dirname, '..', '..', 'out', 'web', 'index.html'), preload: false, userData: process.env.UD });
  ok(await run('typeof window.desktop') === 'undefined', 'no desktop bridge in the web build');
  ok(await run(`document.title === 'Tickner' && document.querySelector('h1').textContent === 'Tickner'`), 'web page title and heading say Tickner');
  await run(`__t.set('#view-tasks #text','Web task'); __t.set('#view-tasks #tags','web'); __t.submit('#view-tasks #add')`);
  await run(`__t.tab('Bookmarks'); __t.set('#view-marks #mUrl','example.org'); __t.submit('#view-marks #markForm')`);
  ok(await run(`JSON.parse(localStorage.getItem('todos.v1')).length === 1`), 'data is saved to localStorage');
  await win.webContents.reload(); await wait(1200);
  ok(await run(`document.querySelectorAll('#view-tasks li.item').length === 1`), 'task survives a reload');
  await run(`window.__t = undefined`);
  ok(await run(`document.documentElement.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'light'`), 'theme is applied');
  ok(await run(`document.querySelectorAll('#views .tab').length === 5`), 'all five tabs exist in the web build');
  // a returning visitor (has data, no recorded version) sees what's new after the page is updated
  await run(`localStorage.removeItem('todos.notify.v1')`);
  await win.webContents.reload(); await wait(1200);
  ok(await run(`document.querySelector('.bell-count').textContent === '1'`), 'web: bell lights up for a returning visitor after an update');
  await run(`document.querySelector('.bell').click()`);
  ok(await run(`document.querySelector('.notif-title').textContent.startsWith('What’s new in 1.1.0') && document.querySelector('.notif-settings').textContent.includes('desktop app')`), 'web: panel shows release notes and says update checks are desktop-only');
  finish();
})();
