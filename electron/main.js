'use strict';
// Electron entry point: lifecycle only. Windows, menus, IPC and storage live in their own modules.
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { openStore } = require('./db');
const { createWindow } = require('./window');
const { migrateLegacyData } = require('./legacy');
const { buildMenu } = require('./menu');
const { registerIpc } = require('./ipc');

const isMac = process.platform === 'darwin';
// keep the data somewhere else:  TICKNER_USER_DATA=/some/folder npm start
if (process.env.TICKNER_USER_DATA) app.setPath('userData', process.env.TICKNER_USER_DATA);

let win = null, store = null;
const send = action => { if (win) win.webContents.send('menu', action); };

function openWindow() {
  win = createWindow();
  win.on('closed', () => { win = null; });
}

// two copies would fight over the database file
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

registerIpc({ getWindow: () => win, getStore: () => store, send });

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.example.tickner');
  const userData = app.getPath('userData');
  const dbFile = path.join(userData, 'tickner.db');
  // the app used to be called "Tasks": bring its data along the first time Tickner starts
  try { migrateLegacyData({ userData, appData: process.env.TICKNER_USER_DATA || app.getPath('appData') }); }
  catch (err) { console.error('[legacy] could not import data from the old Tasks folder:', err.message); }
  try { store = openStore(dbFile); }
  catch (err) {
    dialog.showErrorBox(app.name + ' can’t open its database', String((err && err.message) || err) + '\n\nFile: ' + dbFile);
    app.quit();
    return;
  }
  buildMenu({ send, getDbFile: () => (store ? store.file : null) });
  openWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) openWindow(); });
});

app.on('will-quit', () => { if (store) { store.close(); store = null; } });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
