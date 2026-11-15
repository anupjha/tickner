'use strict';
const { Menu, shell, app } = require('electron');

const isMac = process.platform === 'darwin';

// `send(action)` forwards a command name to the page (see src/core/commands.js); each action is registered there.
function buildMenu({ send, getDbFile }) {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => send('note:new') },
        { type: 'separator' },
        { label: 'Export Data…', accelerator: 'CmdOrCtrl+S', click: () => send('export') },
        { label: 'Import Data…', accelerator: 'CmdOrCtrl+O', click: () => send('import') },
        { type: 'separator' },
        { label: isMac ? 'Show Database in Finder' : 'Show Database in Folder', click: () => { const f = getDbFile(); if (f) shell.showItemInFolder(f); } },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Tasks', accelerator: 'CmdOrCtrl+1', click: () => send('view:tasks') },
        { label: 'Daily Plan', accelerator: 'CmdOrCtrl+2', click: () => send('view:plan') },
        { label: 'Bookmarks', accelerator: 'CmdOrCtrl+3', click: () => send('view:marks') },
        { label: 'Scratch Pad', accelerator: 'CmdOrCtrl+4', click: () => send('view:notes') },
        { label: 'Vault', accelerator: 'CmdOrCtrl+5', click: () => send('view:vault') },
        { type: 'separator' },
        { label: 'Toggle Light/Dark', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('theme') },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }])
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'What’s New', click: () => send('notifications:open') },
        { label: 'Check for Updates…', click: () => send('updates:check') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
