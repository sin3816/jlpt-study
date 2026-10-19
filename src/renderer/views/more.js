// 모바일 '더보기' 화면: 하단 탭에 없는 메뉴 모음
(function () {
  'use strict';
  const App = window.App;
  const ITEMS = [
    ['plan', '학습 계획', '단계별 로드맵과 배정 시간'],
    ['guide', '학습 가이드', '시험 구성·공부법·핵심 문법'],
    ['wrong', '오답노트', '틀린 문제 다시 보기'],
    ['stats', '통계', '학습량·정답률·모의고사 기록'],
    ['settings', '설정', 'PC 동기화·음성·테마·백업'],
  ];

  App.views.more = {
    render(root) {
      const p = App.state.profile;
      const wrongN = App.openWrongCount();
      const d = p ? App.dates.diffDays(App.today, p.examDate) : null;
      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>더보기</h1>
          <p>${p ? `목표 ${p.level} · ${d > 0 ? 'D-' + d : d === 0 ? 'D-Day' : '시험 종료'}` : '학습 계획을 만들어 보세요'} · ${App.esc(App.sync.label())}</p></div></div>
        <div class="card" style="padding:4px 0">${ITEMS.map(([id, t, s]) => `
          <button class="menu-row" data-route="${id}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${App.ICONS[id]}</svg>
            <span class="menu-text"><b>${t}</b><span class="small muted">${s}</span></span>
            ${id === 'wrong' && wrongN ? `<span class="badge">${wrongN}</span>` : ''}
            <span class="muted" aria-hidden="true">›</span>
          </button>`).join('')}</div>
      </div>`));
      root.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => App.go(b.dataset.route)));
    },
  };
})();
