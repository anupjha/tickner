'use strict';
const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';
const root = path.join(__dirname, '..');

// only http(s) links leave the app, and they open in the default browser
function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') shell.openExternal(u.href);
  } catch (e) { /* ignore malformed URLs */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1040, height: 820, minWidth: 420, minHeight: 560,
    show: false,
    title: app.name,
    icon: isMac ? undefined : path.join(root, 'build', 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // TICKNER_DEBUG=1 exposes window.__app to the page (used by the automated tests)
  win.loadFile(path.join(root, 'out', 'renderer', 'index.html'), process.env.TICKNER_DEBUG ? { query: { debug: '1' } } : undefined);
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) { e.preventDefault(); openExternal(url); }
  });
  return win;
}

module.exports = { createWindow };
