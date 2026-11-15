'use strict';
// Shared helpers for the end-to-end tests. They run inside Electron and drive the real UI.
const { app, BrowserWindow } = require('electron');

const results = [];
const ok = (cond, msg) => { results.push(!!cond); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// small DOM driver injected into the page
const DRIVER = `
window.__t = {
  q: s => document.querySelector(s),
  qa: s => [...document.querySelectorAll(s)],
  txt(s) { const e = this.q(s); return e ? e.textContent.trim() : null; },
  set(s, v) { const e = this.q(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
  click(s) { this.q(s).click(); },
  btn(scope, text) { return [...document.querySelectorAll(scope + ' button')].find(b => b.textContent.trim() === text); },
  clickBtn(scope, text) { const b = this.btn(scope, text); if (!b) throw new Error('no button ' + text + ' in ' + scope); b.click(); },
  tab(name) { [...document.querySelectorAll('#views .tab')].find(b => b.textContent.startsWith(name)).click(); },
  submit(s) { this.q(s).requestSubmit(); },
  key(s, k) { this.q(s).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); },
  dbl(s) { this.q(s).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }
};
0;`;

async function start({ file, preload = true, userData, query = 'debug=1' }) {
  const path = require('path');
  if (userData) app.setPath('userData', userData);
  await app.whenReady();
  const win = new BrowserWindow({ width: 1100, height: 900, show: true,
    webPreferences: preload ? { preload: path.join(__dirname, '..', '..', 'electron', 'preload.js'), contextIsolation: true, sandbox: true } : { contextIsolation: true, sandbox: true } });
  const logs = [];
  win.webContents.on('console-message', e => { if ((e.level === 'error' || e.level === 'warning')) logs.push(e.message); });
  await win.loadFile(file, { query: Object.fromEntries(new URLSearchParams(query)) });
  await win.webContents.executeJavaScript(DRIVER);
  await wait(300);
  const run = code => win.webContents.executeJavaScript(code);
  // poll until `expr` is truthy
  const until = async (expr, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await run(expr)) return true; await wait(100); } return false; };
  return { win, run, until };
}

function finish(logs) {
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  app.exit(failed ? 1 : 0);
}

// boots the real desktop app (electron/main.js) on the data folder in $UD and returns a page driver
async function boot() {
  const path = require('path');
  process.env.TICKNER_USER_DATA = process.env.UD;
  process.env.TICKNER_DEBUG = '1';
  require('../../electron/main.js');
  await app.whenReady();
  let win; for (let i = 0; i < 60 && !(win = BrowserWindow.getAllWindows()[0]); i++) await wait(100);
  await wait(1500);
  const run = code => win.webContents.executeJavaScript(code);
  const until = async (expr, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await run(expr)) return true; await wait(100); } return false; };
  await run(DRIVER);
  await until('!!window.__app');
  return { win, run, until };
}

module.exports = { ok, wait, start, boot, finish, results };
