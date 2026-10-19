// 렌더러 공통: 상태, 라우터, 헬퍼. 각 화면은 views/*.js 에서 App.views[이름] 으로 등록한다.
(function () {
  'use strict';
  const { dates, planner, quiz, srs } = window.JLPT;

  const ICONS = {
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    plan: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    schedule: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    guide: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    practice: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    vocab: '<rect x="2" y="6" width="14" height="14" rx="2"/><path d="M8 2h12a2 2 0 0 1 2 2v12"/>',
    wrong: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    stats: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const NAV = [
    ['dashboard', '대시보드'], ['plan', '학습 계획'], ['schedule', '일정'], ['guide', '학습 가이드'],
    ['practice', '연습문제'], ['vocab', '단어장'], ['wrong', '오답노트'], ['stats', '통계'], ['settings', '설정'],
  ];
  const SECTION_NAMES = planner.SECTION_NAMES;
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

  const App = {
    views: {},
    state: null,
    content: {},
    today: null,
    route: 'dashboard',
    params: {},
    cleanup: null,
    dates, planner, quiz, srs, SECTION_NAMES, LEVELS,
  };

  // ---------- helpers ----------
  App.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  // ＿語＿ → 밑줄 표시 (문제지 스타일)
  App.richJa = function (s) {
    return App.esc(s).replace(/＿([^＿\n]+)＿/g, '<u>$1</u>');
  };
  App.el = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  App.pct = (x) => `${Math.round((x || 0) * 100)}%`;
  App.sectionChip = (s) => `<span class="chip ${s}">${App.esc(SECTION_NAMES[s] || s)}</span>`;

  App.toast = function (msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(App._toastT);
    App._toastT = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // 앱 내부 확인창 (window.confirm 대신)
  App.confirm = function (title, body, okLabel = '확인', danger = false) {
    return new Promise((resolve) => {
      const m = document.getElementById('modal');
      m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
        <h2 id="mt">${App.esc(title)}</h2><p class="muted">${App.esc(body)}</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" data-r="0">취소</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${App.esc(okLabel)}</button>
        </div></div>`;
      m.hidden = false;
      const done = (v) => { m.hidden = true; m.innerHTML = ''; resolve(v); };
      m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.dataset.r === '1')));
      m.querySelector('[data-r="1"]').focus();
    });
  };

  // ---------- persistence ----------
  let saveTimer = null;
  App.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.api.saveState(App.state), 150);
  };
  App.flush = function () {
    clearTimeout(saveTimer);
    return window.api.saveState(App.state);
  };
  window.addEventListener('beforeunload', () => { window.api.saveState(App.state); });

  // ---------- domain helpers ----------
  App.level = function () {
    return (App.state.profile && App.state.profile.level) || App.params.level || 'N3';
  };
  App.levelData = (lv) => App.content[lv] || null;
  App.allQuestions = (lv) => (App.content[lv] ? App.content[lv].questions : []);
  App.findQuestion = function (id) {
    for (const lv of LEVELS) {
      const q = App.allQuestions(lv).find((x) => x.id === id);
      if (q) return { q, level: lv };
    }
    return null;
  };

  App.bumpActivity = function (kind, n = 1) {
    const a = (App.state.activity[App.today] = App.state.activity[App.today] || { q: 0, cards: 0 });
    a[kind] = (a[kind] || 0) + n;
  };

  App.recordAttempt = function (q, level, chosen) {
    const correct = chosen === q.answer;
    App.state.attempts.push({ qid: q.id, level, section: q.section, chosen, correct, at: App.today });
    if (App.state.attempts.length > 20000) App.state.attempts.splice(0, App.state.attempts.length - 20000);
    const w = App.state.wrong[q.id];
    if (!correct) {
      App.state.wrong[q.id] = { level, count: (w ? w.count : 0) + 1, lastAt: App.today, resolved: false, lastChoice: chosen };
    } else if (w && !w.resolved) {
      w.streak = (w.streak || 0) + 1;
      if (w.streak >= 2) w.resolved = true; // 연속 2번 맞히면 자동 해결
    }
    App.bumpActivity('q');
    App.save();
    return correct;
  };

  App.completeTask = function (taskId, date) {
    if (!taskId) return;
    const d = date || App.today;
    const list = (App.state.completions[d] = App.state.completions[d] || []);
    if (!list.includes(taskId)) list.push(taskId);
    App.save();
  };
  App.toggleTask = function (taskId, date, on) {
    const list = (App.state.completions[date] = App.state.completions[date] || []);
    const i = list.indexOf(taskId);
    if (on && i < 0) list.push(taskId);
    if (!on && i >= 0) list.splice(i, 1);
    App.save();
  };
  App.isDone = (taskId, date) => ((App.state.completions[date] || []).includes(taskId));

  App.dueCardCount = function (lv) {
    const data = App.levelData(lv);
    if (!data) return { due: 0, fresh: 0 };
    const keyed = {};
    for (const [k, v] of Object.entries(App.state.cards)) if (k.startsWith(lv + '|')) keyed[k.slice(lv.length + 1)] = v;
    const r = srs.pickToday(data.vocab, keyed, App.today, App.state.settings.newCardsPerDay);
    return { due: r.due.length, fresh: r.fresh.length };
  };

  App.openWrongCount = function () {
    return Object.values(App.state.wrong).filter((w) => !w.resolved).length;
  };

  // ---------- TTS (Windows 일본어 음성 사용) ----------
  App.tts = {
    voice() {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      return vs.find((v) => /^ja/i.test(v.lang)) || null;
    },
    available() { return !!this.voice(); },
    speak(text, onend) {
      if (!window.speechSynthesis) return false;
      speechSynthesis.cancel();
      const clean = String(text).replace(/^(男|女|先生|学生|店員|客|アナウンス)[：:]/gm, '');
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'ja-JP';
      const v = this.voice();
      if (v) u.voice = v;
      u.rate = Number(App.state.settings.ttsRate) || 0.9;
      if (onend) u.onend = onend;
      speechSynthesis.speak(u);
      return !!v;
    },
    stop() { if (window.speechSynthesis) speechSynthesis.cancel(); },
  };
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

  // ---------- router ----------
  App.go = function (route, params = {}) {
    App.tts.stop();
    if (typeof App.cleanup === 'function') { try { App.cleanup(); } catch (_) { /* noop */ } }
    App.cleanup = null;
    App.route = route;
    App.params = params;
    App.render();
  };

  App.renderNav = function () {
    const nav = document.getElementById('nav');
    const wrongN = App.openWrongCount();
    nav.innerHTML = NAV.map(([id, label]) => `
      <button data-route="${id}" ${App.route === id ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><span>${label}</span>
        ${id === 'wrong' && wrongN ? `<span class="badge">${wrongN}</span>` : ''}
      </button>`).join('');
    nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => App.go(b.dataset.route)));
    const p = App.state.profile;
    const sub = document.getElementById('brand-sub');
    const foot = document.getElementById('sidebar-foot');
    if (p) {
      const d = dates.diffDays(App.today, p.examDate);
      sub.textContent = `목표 ${p.level} · ${d > 0 ? 'D-' + d : d === 0 ? 'D-Day' : '시험 종료'}`;
      foot.innerHTML = `시험일 ${App.esc(dates.formatKo(p.examDate))}`;
    } else {
      sub.textContent = '학습 계획을 만들어 보세요';
      foot.textContent = '';
    }
  };

  App.render = function () {
    App.renderNav();
    const main = document.getElementById('main');
    main.innerHTML = '';
    const view = App.views[App.route] || App.views.dashboard;
    view.render(main, App.params || {});
    main.scrollTop = 0;
  };

  App.applyTheme = function () {
    const t = App.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  };

  window.App = App;
})();
