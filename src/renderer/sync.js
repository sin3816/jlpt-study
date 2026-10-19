// 자동 동기화 엔진(PC·폰 공통). 실제 병합·통신은 core/sync.js, 여기서는 언제 실행할지와 상태 표시만 담당.
(function () {
  'use strict';
  const App = window.App;
  const core = window.JLPT.sync;

  const DEBOUNCE_MS = 20000;   // 변경 후 20초 동안 추가 변경이 없으면 올림
  const INTERVAL_MS = 5 * 60000; // 화면이 켜져 있으면 5분마다 받기

  const S = {
    running: null,
    timer: null,
    status: 'off',   // off | idle | syncing | error
    listeners: new Set(),
  };

  function cfg() { return App.state.local.sync; }
  function enabled() { return !!cfg().token; }

  function emit() { S.listeners.forEach((fn) => { try { fn(); } catch (_) { /* noop */ } }); }

  function http(url, opts) {
    return window.api.httpFetch(url, opts).then((r) => {
      if (r.status === 0) throw new Error(`네트워크 오류: ${r.error || '연결할 수 없습니다'}`);
      return r;
    });
  }

  // 진행 중인 풀이·카드 학습 화면은 다시 그리지 않는다(상태 객체는 그대로라 기록은 이어짐)
  function safeToRerender() {
    if (document.querySelector('.quiz, .flash')) return false;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return false;
    return true;
  }

  async function run(reason = 'manual') {
    if (!enabled()) { S.status = 'off'; emit(); return { skipped: true }; }
    if (S.running) return S.running;
    clearTimeout(S.timer);
    S.status = 'syncing'; emit();
    S.running = (async () => {
      const c = cfg();
      try {
        const client = new core.GistClient(c.token, http, App.env.syncApi);
        const r = await core.syncOnce(App.state, client, { gistId: c.gistId });
        c.gistId = r.gistId;
        c.lastSyncAt = Date.now();
        c.lastError = '';
        c.lastRemoteUpdatedAt = r.updatedAt || c.lastRemoteUpdatedAt;
        await window.api.saveState(App.state);
        S.status = 'idle';
        if (r.localChanged) {
          App.renderNav();
          if (safeToRerender()) App.render();
          if (reason !== 'boot') App.toast('다른 기기의 학습 기록을 가져왔어요');
        }
        return r;
      } catch (e) {
        c.lastError = String(e.message || e);
        S.status = 'error';
        await window.api.saveState(App.state);
        if (reason === 'manual' || reason === 'connect') throw e;
        return { error: c.lastError };
      } finally {
        S.running = null;
        emit();
      }
    })();
    return S.running;
  }

  function schedule() {
    if (!enabled() || !cfg().auto) return;
    clearTimeout(S.timer);
    S.timer = setTimeout(() => run('auto'), DEBOUNCE_MS);
  }

  async function connect(token) {
    const c = cfg();
    c.token = token.trim();
    c.gistId = '';
    c.lastError = '';
    try {
      return await run('connect');
    } catch (e) {
      c.token = '';
      await window.api.saveState(App.state);
      S.status = 'off'; emit();
      throw e;
    }
  }

  async function disconnect() {
    Object.assign(cfg(), JLPT.state.defaultSync());
    clearTimeout(S.timer);
    S.status = 'off';
    await window.api.saveState(App.state);
    emit();
  }

  function label() {
    const c = cfg();
    if (!c.token) return '동기화 꺼짐';
    if (S.status === 'syncing') return '동기화 중…';
    if (c.lastError) return '동기화 오류';
    if (!c.lastSyncAt) return '동기화 대기';
    const m = Math.round((Date.now() - c.lastSyncAt) / 60000);
    return m < 1 ? '방금 동기화됨' : m < 60 ? `${m}분 전 동기화` : `${Math.round(m / 60)}시간 전 동기화`;
  }

  function start() {
    S.status = enabled() ? 'idle' : 'off';
    document.addEventListener('visibilitychange', () => {
      if (!enabled() || !cfg().auto) return;
      // 앱을 나갈 때 바로 올리고, 돌아오면 바로 받는다
      run(document.visibilityState === 'hidden' ? 'hide' : 'show');
    });
    window.addEventListener('online', () => { if (enabled() && cfg().auto) run('online'); });
    setInterval(() => { if (enabled() && cfg().auto && document.visibilityState === 'visible') run('interval'); }, INTERVAL_MS);
    if (enabled() && cfg().auto) run('boot');
  }

  App.sync = { run, schedule, connect, disconnect, label, start, enabled, onChange: (fn) => { S.listeners.add(fn); return () => S.listeners.delete(fn); }, get status() { return S.status; } };
})();
