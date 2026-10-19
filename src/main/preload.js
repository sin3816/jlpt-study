'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  loadContent: () => ipcRenderer.invoke('content:load'),
  envToday: () => ipcRenderer.invoke('env:today'),
  exportData: (state) => ipcRenderer.invoke('data:export', state),
  importData: () => ipcRenderer.invoke('data:import'),
});
