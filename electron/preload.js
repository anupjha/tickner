'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// the only things the web page may ask the desktop shell to do
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  saveFile: (filename, data) => ipcRenderer.invoke('file:save', filename, data),
  openFile: () => ipcRenderer.invoke('file:open'),
  updateStatus: () => ipcRenderer.invoke('updates:status'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  openExternal: url => ipcRenderer.invoke('shell:open', url),
  notify: (title, body) => ipcRenderer.send('notify:native', title, body),
  onMenu: cb => ipcRenderer.on('menu', (_e, action) => cb(action)),
  db: {
    loadAll: () => ipcRenderer.sendSync('db:loadAll'),
    save: (key, value) => ipcRenderer.sendSync('db:save', key, value),
    remove: key => ipcRenderer.sendSync('db:remove', key)
  }
});
