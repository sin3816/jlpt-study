// 웹(PWA)용 플랫폼 어댑터: Electron preload 의 window.api 와 같은 인터페이스를 브라우저 API로 구현한다.
// 저장: IndexedDB(용량 넉넉, 휴대폰에서 지속 저장 요청). 콘텐츠: content.js(빌드 시 생성).
(function () {
  'use strict';

  const DB = 'jlpt-study';
  const STORE = 'kv';
  let dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function get(key) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function put(entries) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      const s = tx.objectStore(STORE);
      for (const [k, v] of entries) s.put(v, k);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  function parse(text) { try { return text ? JSON.parse(text) : null; } catch (_) { return null; } }

  const params = new URLSearchParams(location.search);

  window.api = {
    async loadState() {
      try {
        const main = parse(await get('state'));
        if (main) return main;
        const bak = parse(await get('state.backup'));
        if (bak) return bak;
      } catch (_) { /* IndexedDB 사용 불가 시 아래로 */ }
      const s = JLPT.state.normalize(null);
      await this.saveState(s).catch(() => {});
      return s;
    },
    async saveState(state) {
      const text = JSON.stringify(state);
      const prev = await get('state').catch(() => null);
      await put(prev ? [['state.backup', prev], ['state', text]] : [['state', text]]);
      return true;
    },
    async loadContent() { return self.JLPT_CONTENT || {}; },
    async envToday() { return /^\d{4}-\d{2}-\d{2}$/.test(params.get('today') || '') ? params.get('today') : null; },
    async envConfig() { return { platform: 'web', syncApi: 'https://api.github.com' }; },

    // 내보내기: 공유 시트(카카오톡·Drive 등)가 되면 공유, 아니면 다운로드 폴더에 저장
    async exportData(state) {
      const name = `jlpt-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      try {
        const file = new File([blob], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'JLPT 스터디 백업' });
          return { ok: true };
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false };
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { ok: true, path: name };
    },

    importData() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          const f = input.files && input.files[0];
          if (!f) return resolve({ ok: false });
          try { resolve({ ok: true, state: JLPT.state.normalize(JSON.parse(await f.text())) }); } catch (e) { resolve({ ok: false, error: String(e.message || e) }); }
        };
        input.click();
      });
    },

    async httpFetch(url, opts = {}) {
      try {
        const r = await fetch(url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body, cache: 'no-store' });
        return { status: r.status, body: await r.text() };
      } catch (e) {
        return { status: 0, body: '', error: navigator.onLine === false ? '오프라인 상태입니다' : String(e.message || e) };
      }
    },
  };

  // 휴대폰이 저장 공간을 정리할 때 기록이 지워지지 않도록 지속 저장 요청
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // 오프라인 실행을 위한 서비스 워커
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
