'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store, migrate } = require('./store');

// 테스트 격리: JLPT_USER_DATA 가 있으면 그 폴더에 저장
if (process.env.JLPT_USER_DATA) app.setPath('userData', process.env.JLPT_USER_DATA);

const ROOT = path.join(__dirname, '..', '..');
let store;
let win;

function loadContent() {
  const dir = path.join(ROOT, 'data', 'levels');
  const out = {};
  for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    const f = path.join(dir, `${lv}.json`);
    if (fs.existsSync(f)) out[lv.toUpperCase()] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  return out;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'JLPT 스터디',
    backgroundColor: '#f6f5f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function registerIpc() {
  ipcMain.handle('state:load', () => store.load());
  ipcMain.handle('state:save', (_e, state) => store.save(state));
  ipcMain.handle('content:load', () => loadContent());
  ipcMain.handle('env:today', () => process.env.JLPT_TODAY || null);
  ipcMain.handle('data:export', async (_e, state) => {
    const r = await dialog.showSaveDialog(win, {
      title: '학습 데이터 내보내기',
      defaultPath: `jlpt-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, JSON.stringify(state, null, 2), 'utf8');
    return { ok: true, path: r.filePath };
  });
  ipcMain.handle('data:import', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '학습 데이터 가져오기',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const state = migrate(JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')));
      store.save(state);
      return { ok: true, state };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });
}

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  registerIpc();
  if (!process.env.JLPT_SHOW_MENU) Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
