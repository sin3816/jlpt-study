'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store, migrate } = require('./store');

// 테스트 격리: JLPT_USER_DATA 가 있으면 그 폴더에 저장
if (process.env.JLPT_USER_DATA) app.setPath('userData', process.env.JLPT_USER_DATA);

const ROOT = path.join(__dirname, '..', '..');
// 동기화 서버(기본 GitHub). 테스트에서는 JLPT_SYNC_API 로 모의 서버를 지정한다.
const SYNC_API = process.env.JLPT_SYNC_API || 'https://api.github.com';
const ALLOWED_ORIGINS = new Set([new URL(SYNC_API).origin, 'https://gist.githubusercontent.com']);
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
  ipcMain.handle('env:config', () => ({ platform: 'desktop', syncApi: SYNC_API }));
  // 동기화용 HTTP: 허용된 호스트(GitHub API·Gist 원본)로만 요청을 중계한다
  ipcMain.handle('http:fetch', async (_e, url, opts = {}) => {
    let u;
    try { u = new URL(url); } catch (_) { return { status: 0, body: '', error: 'bad url' }; }
    if (!ALLOWED_ORIGINS.has(u.origin)) return { status: 0, body: '', error: `허용되지 않은 주소: ${u.origin}` };
    try {
      // net.fetch: Chromium 네트워크 스택 → Windows 프록시 설정을 따른다
      const r = await net.fetch(url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
      return { status: r.status, body: await r.text() };
    } catch (err) {
      return { status: 0, body: '', error: String(err.message || err) };
    }
  });
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
      // 병합은 렌더러가 한다(덮어쓰기 X)
      const raw = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      return { ok: true, state: migrate(raw) };
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
