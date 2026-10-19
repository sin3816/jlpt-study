(function () {
  'use strict';
  const App = window.App;
  const { dates, planner, quiz } = App;

  App.startTask = function (t, date) {
    const level = App.state.profile.level;
    const base = { level, taskId: t.id, taskDate: date || App.today };
    if (t.kind === 'vocab') return App.go('vocab', Object.assign(base, { autostart: true }));
    if (t.kind === 'practice') return App.go('practice', Object.assign(base, { autostart: 'practice', section: t.section, count: t.count || 10 }));
    if (t.kind === 'mock') return App.go('practice', Object.assign(base, { autostart: 'mock' }));
    if (t.kind === 'review') return App.go('wrong', base);
    return null;
  };

  App.renderTaskList = function (container, date, opts = {}) {
    const p = App.state.profile;
    const tasks = planner.tasksFor(p, date);
    if (!tasks.length) {
      container.innerHTML = `<div class="empty small">${date < p.startDate ? '계획 시작 전입니다.' : date > p.examDate ? '시험이 끝났습니다. 수고하셨어요!' : '오늘은 쉬는 날입니다.'}</div>`;
      return;
    }
    container.innerHTML = `<div class="tasks">${tasks.map((t) => {
      const done = App.isDone(t.id, date);
      const startable = t.kind !== 'exam' && opts.start !== false;
      return `<div class="task ${done ? 'done' : ''}" data-id="${App.esc(t.id)}">
        <input type="checkbox" ${done ? 'checked' : ''} aria-label="완료 표시: ${App.esc(t.label)}">
        <span class="label">${t.section ? App.sectionChip(t.section) + ' ' : ''}${App.esc(t.label)}</span>
        ${t.minutes ? `<span class="min">${t.minutes}분</span>` : ''}
        ${startable ? '<button class="btn sm" data-start>시작</button>' : ''}
      </div>`;
    }).join('')}</div>`;
    container.querySelectorAll('.task').forEach((row) => {
      const t = tasks.find((x) => x.id === row.dataset.id);
      row.querySelector('input').addEventListener('change', (e) => {
        App.toggleTask(t.id, date, e.target.checked);
        row.classList.toggle('done', e.target.checked);
        if (opts.onChange) opts.onChange();
      });
      const s = row.querySelector('[data-start]');
      if (s) s.addEventListener('click', () => App.startTask(t, date));
    });
  };

  App.views.dashboard = {
    render(root) {
      const p = App.state.profile;
      if (!p) return App.go('plan');
      const data = App.levelData(p.level);
      const dLeft = dates.diffDays(App.today, p.examDate);
      const plan = planner.buildPhases(p);
      const ph = planner.phaseOf(plan, App.today);
      const prog = planner.progress(p, App.state.completions, App.today);
      const activeDays = App.activeDays();
      const streak = quiz.streak(activeDays, App.today);
      const acc = quiz.sectionAccuracy(App.state.attempts, p.level);
      const cards = App.dueCardCount(p.level);
      const wrongN = App.openWrongCount();
      const upcoming = App.liveEvents().filter((e) => e.date >= App.today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 4);

      root.appendChild(App.el(`<div class="page">
        <div class="page-head">
          <div><h1>오늘의 학습</h1><p>${App.esc(dates.formatKo(App.today))}${ph ? ` · 현재 단계: <b>${App.esc(ph.name)}</b>` : ''}</p></div>
          <div class="row"><button class="btn" data-go="practice">문제 풀기</button><button class="btn primary" data-go="vocab">단어 카드</button></div>
        </div>
        <div class="grid g4">
          <div class="card kpi hero"><div class="label">JLPT ${p.level} 시험까지</div>
            <div class="value">${dLeft > 0 ? 'D-' + dLeft : dLeft === 0 ? 'D-Day' : '종료'}</div>
            <div class="sub">${App.esc(dates.formatKo(p.examDate))}</div></div>
          <div class="card kpi"><div class="label">계획 달성률</div><div class="value">${App.pct(prog.rate)}</div>
            <div class="bar" style="margin-top:6px"><i style="width:${App.pct(prog.rate)}"></i></div>
            <div class="sub" style="margin-top:4px">${prog.done} / ${prog.total} 할 일</div></div>
          <div class="card kpi"><div class="label">연속 학습</div><div class="value">${streak}<small>일</small></div>
            <div class="sub">문제나 단어 카드를 풀면 기록돼요</div></div>
          <div class="card kpi"><div class="label">오늘 복습할 단어</div><div class="value">${cards.due}<small>장</small></div>
            <div class="sub">새 단어 ${cards.fresh}장 대기 · 오답 ${wrongN}개</div></div>
        </div>
        <div class="grid g3">
          <div class="card span2"><div class="card-head"><h2>오늘 할 일</h2><button class="btn ghost sm" data-go="schedule">일정 전체 보기</button></div>
            <div id="today-tasks"></div></div>
          <div class="card"><h2>섹션별 정답률 (${p.level})</h2>
            ${planner.SECTIONS.map((s) => {
              const a = acc[s];
              const r = a ? a.correct / a.total : 0;
              return `<div class="sec-row"><span>${App.esc(App.SECTION_NAMES[s])}</span>
                <div class="bar"><i style="width:${a ? App.pct(r) : '0%'};background:var(--s-${s})"></i></div>
                <span class="pct">${a ? App.pct(r) : '<span class="muted">—</span>'}</span></div>`;
            }).join('')}
            <p class="small muted" style="margin-top:8px">${data ? `문제 은행 ${data.questions.length}문항 · 단어 ${data.vocab.length}개` : ''}</p>
          </div>
        </div>
        <div class="grid g2">
          <div class="card"><h2>${ph ? App.esc(ph.name) + ' 단계 안내' : '학습 단계'}</h2>
            <p>${ph ? App.esc(ph.desc) : '계획 기간이 아닙니다.'}</p>
            ${ph ? `<p class="small muted" style="margin-top:8px">${App.esc(ph.start)} ~ ${App.esc(ph.end)} (${ph.days}일)</p>` : ''}</div>
          <div class="card"><div class="card-head"><h2>다가오는 일정</h2><button class="btn ghost sm" data-go="schedule">일정 추가</button></div>
            ${upcoming.length ? `<div class="stack">${upcoming.map((e) => `<div class="row between"><span>${App.esc(e.title)}</span><span class="small muted">${App.esc(e.date)}</span></div>`).join('')}</div>`
              : '<p class="muted">등록된 일정이 없습니다. 접수 마감일이나 모의고사 날짜를 추가해 보세요.</p>'}</div>
        </div>
      </div>`));
      root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => App.go(b.dataset.go)));
      App.renderTaskList(root.querySelector('#today-tasks'), App.today);
    },
  };
})();
