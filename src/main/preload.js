'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  loadContent: () => ipcRenderer.invoke('content:load'),
  envToday: () => ipcRenderer.invoke('env:today'),
  envConfig: () => ipcRenderer.invoke('env:config'),
  exportData: (state) => ipcRenderer.invoke('data:export', state),
  importData: () => ipcRenderer.invoke('data:import'),
  httpFetch: (url, opts) => ipcRenderer.invoke('http:fetch', url, opts),
});
