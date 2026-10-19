(function () {
  'use strict';
  const App = window.App;
  const { dates, planner } = App;

  const LEVEL_DESC = {
    N5: '기초 인사·간단한 문장', N4: '일상 회화 기초', N3: '일상 장면 대부분 이해',
    N2: '뉴스·업무 문서 이해', N1: '논설·전문 분야 이해',
  };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  function form(root, edit) {
    const p = App.state.profile || {};
    const exams = dates.upcomingExamDates(App.today, 3);
    const minStart = App.today;
    const cur = {
      level: p.level || 'N3',
      startDate: edit && p.startDate ? p.startDate : App.today,
      examDate: p.examDate || exams[0],
      dailyMinutes: p.dailyMinutes || 60,
      weakSections: p.weakSections || [],
      restDays: p.restDays || [],
    };
    const examIsPreset = exams.includes(cur.examDate);

    root.appendChild(App.el(`<div class="page">
      <div class="page-head"><div><h1>${edit ? '학습 계획 수정' : '학습 계획 만들기'}</h1>
        <p>목표 레벨과 시험일, 하루 학습 시간을 알려주시면 시험일까지 단계별 계획과 날짜별 할 일을 만들어 드려요.</p></div></div>
      <form class="stack" id="plan-form" novalidate>
        <div class="card stack"><h2>1. 목표 레벨</h2>
          <div class="pick cols5">${App.LEVELS.map((lv) => `<label><input type="radio" name="level" value="${lv}" ${cur.level === lv ? 'checked' : ''}>
            <span class="t">${lv}</span><span class="d">${LEVEL_DESC[lv]}</span></label>`).join('')}</div></div>
        <div class="card stack"><h2>2. 시험일</h2>
          <div class="pick cols4">${exams.map((d) => `<label><input type="radio" name="exam" value="${d}" ${cur.examDate === d ? 'checked' : ''}>
            <span class="t">${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월</span><span class="d">${App.esc(dates.formatKo(d))} · D-${dates.diffDays(App.today, d)}</span></label>`).join('')}
            <label><input type="radio" name="exam" value="custom" ${examIsPreset ? '' : 'checked'}><span class="t">직접 입력</span>
            <input type="date" name="customExam" value="${examIsPreset ? '' : App.esc(cur.examDate)}" min="${minStart}"></label></div>
          <p class="small muted">JLPT는 매년 7월·12월 첫째 일요일에 시행됩니다. 접수 일정은 학습 가이드의 '시험 정보'에서 확인하세요.</p></div>
        <div class="grid g2">
          <div class="card stack"><h2>3. 학습 시간</h2>
            <label class="field"><span>시작일</span><input type="date" name="startDate" value="${App.esc(cur.startDate)}"></label>
            <label class="field"><span>하루 학습 시간: <b id="mins-out">${cur.dailyMinutes}</b>분</span>
              <input type="range" name="dailyMinutes" min="15" max="240" step="15" value="${cur.dailyMinutes}">
              <span class="hint">평일 기준으로 꾸준히 지킬 수 있는 시간을 고르세요.</span></label>
            <div class="field"><span>쉬는 요일</span><div class="row">${WD.map((w, i) => `<label class="row" style="gap:4px"><input type="checkbox" name="rest" value="${i}" ${cur.restDays.includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div></div>
          </div>
          <div class="card stack"><h2>4. 약한 영역</h2>
            <p class="small muted">선택한 영역은 매일 학습 시간이 1.5배로 배정됩니다.</p>
            <div class="stack">${planner.SECTIONS.map((s) => `<label class="row"><input type="checkbox" name="weak" value="${s}" ${cur.weakSections.includes(s) ? 'checked' : ''}> ${App.sectionChip(s)}</label>`).join('')}</div>
          </div>
        </div>
        <div id="form-err" class="notice" hidden></div>
        <div class="row" style="justify-content:flex-end">
          ${edit ? '<button type="button" class="btn" id="cancel">취소</button>' : ''}
          <button type="submit" class="btn primary" id="save-plan">${edit ? '계획 다시 만들기' : '계획 만들기'}</button>
        </div>
      </form></div>`));

    const f = root.querySelector('#plan-form');
    f.dailyMinutes.addEventListener('input', () => { root.querySelector('#mins-out').textContent = f.dailyMinutes.value; });
    f.customExam.addEventListener('input', () => { f.querySelector('input[name=exam][value=custom]').checked = true; });
    const cancel = root.querySelector('#cancel');
    if (cancel) cancel.addEventListener('click', () => App.go('plan'));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const examSel = f.querySelector('input[name=exam]:checked');
      const profile = {
        level: f.querySelector('input[name=level]:checked').value,
        examDate: examSel && examSel.value === 'custom' ? f.customExam.value : examSel && examSel.value,
        startDate: f.startDate.value,
        dailyMinutes: Number(f.dailyMinutes.value),
        weakSections: [...f.querySelectorAll('input[name=weak]:checked')].map((x) => x.value),
        restDays: [...f.querySelectorAll('input[name=rest]:checked')].map((x) => Number(x.value)),
        createdAt: (App.state.profile && App.state.profile.createdAt) || App.today,
      };
      const errs = planner.validateProfile(profile);
      if (profile.restDays.length >= 7) errs.push('쉬는 요일을 모두 선택할 수는 없습니다');
      const box = root.querySelector('#form-err');
      if (errs.length) { box.hidden = false; box.textContent = errs.join(' · '); return; }
      App.state.profile = profile;
      App.save();
      App.toast('학습 계획이 만들어졌어요');
      App.go('plan');
    });
  }

  function overview(root) {
    const p = App.state.profile;
    const plan = planner.buildPhases(p);
    const cur = planner.phaseOf(plan, App.today);
    const prog = planner.progress(p, App.state.completions, App.today);
    // 이번 주 배정 시간
    const weekAlloc = { vocab: 0, grammar: 0, reading: 0, listening: 0, other: 0 };
    for (let i = 0; i < 7; i++) {
      const d = App.dates.addDays(App.today, i);
      for (const t of planner.tasksFor(p, d, plan)) {
        if (t.section && weekAlloc[t.section] !== undefined) weekAlloc[t.section] += t.minutes;
        else weekAlloc.other += t.minutes;
      }
    }
    const weekTotal = Object.values(weekAlloc).reduce((a, b) => a + b, 0);

    root.appendChild(App.el(`<div class="page">
      <div class="page-head"><div><h1>학습 계획</h1>
        <p>JLPT ${p.level} · ${App.esc(p.startDate)} ~ ${App.esc(p.examDate)} (${plan.totalDays}일) · 하루 ${p.dailyMinutes}분</p></div>
        <button class="btn" id="edit-plan">계획 수정</button></div>
      <div class="card"><div class="card-head"><h2>단계별 로드맵</h2><span class="small muted">달성률 ${App.pct(prog.rate)}</span></div>
        <div class="timeline">${plan.phases.map((ph) => `<div class="ph ${cur && cur.id === ph.id ? 'current' : ''}" style="flex:${ph.days}">
          <div class="n">${App.esc(ph.name)}</div><div class="d">${ph.start.slice(5)} ~ ${ph.end.slice(5)} · ${ph.days}일</div>
          <div class="alloc" title="영역별 시간 배분">${planner.SECTIONS.map((s) => `<i style="width:${App.pct(ph.weights[s])};background:var(--s-${s})"></i>`).join('')}</div>
        </div>`).join('')}</div>
        <div class="legend" style="margin-top:12px">${planner.SECTIONS.map((s) => `<span><i class="dot" style="background:var(--s-${s})"></i>${App.SECTION_NAMES[s]}</span>`).join('')}</div>
      </div>
      <div class="grid g2">${plan.phases.map((ph) => `<div class="card"><div class="card-head"><h2>${App.esc(ph.name)}</h2>
          ${cur && cur.id === ph.id ? '<span class="chip" style="color:var(--accent)">진행 중</span>' : ''}</div>
          <p>${App.esc(ph.desc)}</p>
          <div style="margin-top:10px">${planner.SECTIONS.map((s) => `<div class="sec-row"><span class="small">${App.SECTION_NAMES[s]}</span>
            <div class="bar"><i style="width:${App.pct(ph.weights[s])};background:var(--s-${s})"></i></div>
            <span class="pct">${Math.round(p.dailyMinutes * ph.weights[s])}분</span></div>`).join('')}</div></div>`).join('')}</div>
      <div class="card"><h2>앞으로 7일 배정 시간</h2>
        <div class="alloc" style="height:14px">${['vocab', 'grammar', 'reading', 'listening'].map((s) => `<i style="width:${weekTotal ? (weekAlloc[s] / weekTotal) * 100 : 0}%;background:var(--s-${s})"></i>`).join('')}<i style="width:${weekTotal ? (weekAlloc.other / weekTotal) * 100 : 0}%;background:var(--muted)"></i></div>
        <div class="legend" style="margin-top:10px">${['vocab', 'grammar', 'reading', 'listening'].map((s) => `<span><i class="dot" style="background:var(--s-${s})"></i>${App.SECTION_NAMES[s]} ${weekAlloc[s]}분</span>`).join('')}<span><i class="dot" style="background:var(--muted)"></i>복습·모의고사 ${weekAlloc.other}분</span></div>
      </div>
    </div>`));
    root.querySelector('#edit-plan').addEventListener('click', () => App.go('plan', { edit: true }));
  }

  App.views.plan = {
    render(root, params) {
      if (!App.state.profile || params.edit) form(root, !!App.state.profile);
      else overview(root);
    },
  };
})();
