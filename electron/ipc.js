'use strict';
// Everything the page may ask of the main process. Each handler first checks the request came from our own window.
const { app, dialog, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const { feedUrl, checkForUpdates, isHttps } = require('./updates');

const MAX_FILE = 5 * 1024 * 1024;

function registerIpc({ getWindow, getStore, send }) {
  const trusted = e => { const w = getWindow(); return !!w && e.sender === w.webContents; };

  // ---- native file dialogs ----
  ipcMain.handle('file:save', async (e, filename, data) => {
    if (!trusted(e) || typeof filename !== 'string' || typeof data !== 'string' || data.length > 20 * 1024 * 1024) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
      defaultPath: path.join(app.getPath('documents'), path.basename(filename)),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return false;
    await fs.writeFile(filePath, data, 'utf8');
    return true;
  });

  ipcMain.handle('file:open', async e => {
    if (!trusted(e)) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (canceled || !filePaths[0]) return null;
    const stat = await fs.stat(filePaths[0]);
    if (stat.size > MAX_FILE) return { name: path.basename(filePaths[0]), text: null, tooLarge: true };
    return { name: path.basename(filePaths[0]), text: await fs.readFile(filePaths[0], 'utf8') };
  });

  // ---- updates and notifications ----
  ipcMain.handle('updates:status', e => ({ configured: trusted(e) && !!feedUrl() }));
  ipcMain.handle('updates:check', e => (trusted(e) ? checkForUpdates() : { ok: false, reason: 'error' }));
  ipcMain.handle('shell:open', (e, url) => { if (trusted(e) && isHttps(url)) shell.openExternal(url); });
  ipcMain.on('notify:native', (e, title, body) => {
    if (!trusted(e) || typeof title !== 'string' || typeof body !== 'string' || !Notification.isSupported()) return;
    const n = new Notification({ title: title.slice(0, 100), body: body.slice(0, 300) });
    n.on('click', () => { const w = getWindow(); if (w) { if (w.isMinimized()) w.restore(); w.focus(); send('notifications:open'); } });
    n.show();
  });

  // ---- database (synchronous on purpose: the page reads once at startup and wants each write confirmed) ----
  ipcMain.on('db:loadAll', e => { const s = getStore(); e.returnValue = trusted(e) && s ? s.loadAll() : {}; });
  ipcMain.on('db:save', (e, key, value) => { const s = getStore(); e.returnValue = trusted(e) && !!s && s.save(key, value); });
  ipcMain.on('db:remove', (e, key) => { const s = getStore(); e.returnValue = trusted(e) && !!s && s.remove(key); });
}

module.exports = { registerIpc };
