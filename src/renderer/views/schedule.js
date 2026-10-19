(function () {
  'use strict';
  const App = window.App;
  const { dates, planner } = App;

  App.views.schedule = {
    render(root, params) {
      const p = App.state.profile;
      if (!p) return App.go('plan');
      const sel = params.date || App.today;
      const ym = params.ym || sel.slice(0, 7);
      const [y, m] = ym.split('-').map(Number);
      const plan = planner.buildPhases(p);
      const weeks = dates.monthMatrix(y, m);

      const cell = (c) => {
        const tasks = planner.tasksFor(p, c.iso, plan);
        const done = tasks.filter((t) => App.isDone(t.id, c.iso)).length;
        const evs = App.liveEvents().filter((e) => e.date === c.iso);
        const isExam = c.iso === p.examDate;
        const cls = ['day', tasks.length && !isExam ? 'has-task' : '', tasks.length && done === tasks.length ? 'all-done' : '', evs.length ? 'has-ev' : '', c.inMonth ? '' : 'out', c.iso === App.today ? 'today' : '', c.iso === sel ? 'sel' : '', isExam ? 'exam' : ''].join(' ');
        let mini = '';
        if (isExam) mini = `JLPT ${p.level}`;
        else if (tasks.length) mini = `${done}/${tasks.length} 완료`;
        const ph = planner.phaseOf(plan, c.iso);
        return `<button class="${cls}" data-date="${c.iso}" aria-label="${App.esc(dates.formatKo(c.iso))}">
          <span class="num">${c.day}</span>
          ${mini ? `<span class="mini">${App.esc(mini)}</span>` : ''}
          ${ph && !isExam && tasks.length ? `<span class="mini">${App.esc(ph.name)}</span>` : ''}
          ${evs.slice(0, 2).map((e) => `<span class="ev">${App.esc(e.title)}</span>`).join('')}
        </button>`;
      };

      const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const nextYm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      const evs = App.liveEvents().filter((e) => e.date === sel);

      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>일정</h1><p>날짜를 눌러 할 일을 확인하고, 접수·모의고사 같은 개인 일정을 추가하세요.</p></div>
          <div class="row"><button class="btn" data-ym="${prevYm}" aria-label="이전 달">‹</button>
            <b style="min-width:110px;text-align:center">${y}년 ${m}월</b>
            <button class="btn" data-ym="${nextYm}" aria-label="다음 달">›</button>
            <button class="btn" data-today>오늘</button></div></div>
        <div class="sched">
          <div class="card"><div class="cal">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<div class="wd">${w}</div>`).join('')}
            ${weeks.flat().map(cell).join('')}</div></div>
          <div class="stack">
            <div class="card"><h2>${App.esc(dates.formatKo(sel))}</h2><div id="sel-tasks" style="margin-top:8px"></div></div>
            <div class="card"><h2>개인 일정</h2>
              <div class="stack" id="ev-list" style="margin:8px 0">${evs.length ? evs.map((e) => `<div class="row between"><span>${App.esc(e.title)}</span>
                <button class="btn ghost sm danger" data-del="${App.esc(e.id)}">삭제</button></div>`).join('') : '<p class="small muted">이 날의 일정이 없습니다.</p>'}</div>
              <form class="row" id="ev-form"><input type="text" name="title" placeholder="예: JLPT 접수 마감" maxlength="60" style="flex:1" aria-label="일정 제목">
                <button class="btn primary sm" type="submit">추가</button></form></div>
          </div>
        </div></div>`));

      root.querySelectorAll('[data-ym]').forEach((b) => b.addEventListener('click', () => App.go('schedule', { ym: b.dataset.ym, date: sel })));
      root.querySelector('[data-today]').addEventListener('click', () => App.go('schedule', {}));
      root.querySelectorAll('.cal button.day').forEach((b) => b.addEventListener('click', () => App.go('schedule', { ym, date: b.dataset.date })));
      App.renderTaskList(root.querySelector('#sel-tasks'), sel, { start: sel === App.today, onChange: () => App.go('schedule', { ym, date: sel }) });
      root.querySelector('#ev-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = e.target.title.value.trim();
        if (!title) return;
        App.state.events.push({ id: App.newId('ev'), date: sel, title, t: App.now() });
        App.save();
        App.go('schedule', { ym, date: sel });
      });
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
        const ev = App.state.events.find((e) => e.id === b.dataset.del);
        if (ev) { ev.deleted = true; ev.t = App.now(); } // 동기화를 위해 삭제 표시(톰스톤)
        App.save();
        App.go('schedule', { ym, date: sel });
      }));
    },
  };
})();
