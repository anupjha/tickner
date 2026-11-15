'use strict';
// The desktop app with a release feed (a local test server). A newer version must be announced once, and dismissals stick.
const http = require('http');
let hits = 0;
const server = http.createServer((req, res) => {
  hits++;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ version: '1.2.0', url: 'https://example.com/releases/1.2.0', notes: 'Faster startup\n- Fixes a bug' }));
});
server.listen(0, '127.0.0.1', () => {
  process.env.TICKNER_UPDATE_FEED = `http://127.0.0.1:${server.address().port}/feed.json`;
  const { ok, wait, boot, finish } = require('./lib.cjs');
  (async () => {
    const { win, run, until } = await boot();
    ok(await until(`document.querySelector('.bell-count') && document.querySelector('.bell-count').hidden === false`, 15000), 'the automatic check found a newer version and the bell shows it');
    ok(hits >= 1, 'the feed was fetched by the main process (' + hits + ' request)');
    await run(`document.querySelector('.bell').click()`);
    ok(await run(`document.querySelector('.notif-title').textContent.startsWith('Version 1.2.0 is available')`), 'panel announces version 1.2.0');
    ok(await run(`document.querySelector('.notif-notes').textContent.includes('Faster startup')`), 'release notes are shown');
    ok(await run(`[...document.querySelectorAll('.notif-actions button')].some(b => b.textContent.includes('View release'))`), 'there is a "View release" button');
    ok(await run(`document.querySelector('.notif-settings').textContent.includes('Check now')`), 'settings offer "Check now" when a feed is configured');
    // manual check does not announce the same version twice
    await run(`__t.clickBtn('.notif-settings','Check now')`); await wait(1500);
    ok(await run(`document.querySelectorAll('.notif-item').length === 1`), 'checking again does not duplicate the notice');
    await run(`document.querySelector('.notif-item button[title="Dismiss"]').click()`);
    ok(await run(`document.querySelector('.notif-empty') !== null`), 'dismissed');
    await run(`__t.clickBtn('.notif-settings','Check now')`); await wait(1500);
    ok(await run(`document.querySelector('.notif-empty') !== null`), 'a dismissed version is not announced again');
    await run(`__t.clickBtn('dialog','Close')`);
    win.webContents.send('menu', 'updates:check'); await wait(1200);
    ok((await run(`document.querySelector('.toast').textContent`)).includes('Version 1.2.0 is available'), 'Help > Check for Updates reports the newer version');
    server.close();
    finish();
  })();
});
