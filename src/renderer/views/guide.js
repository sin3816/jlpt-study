(function () {
  'use strict';
  const App = window.App;
  const { quiz, dates } = App;

  // 시험 시간(분) — 2026년 기준 공식 시험 구성
  const TIMES = {
    N1: [['언어지식(문자·어휘·문법)·독해', 110], ['청해', 55]],
    N2: [['언어지식(문자·어휘·문법)·독해', 105], ['청해', 50]],
    N3: [['언어지식(문자·어휘)', 30], ['언어지식(문법)·독해', 70], ['청해', 40]],
    N4: [['언어지식(문자·어휘)', 25], ['언어지식(문법)·독해', 55], ['청해', 35]],
    N5: [['언어지식(문자·어휘)', 20], ['언어지식(문법)·독해', 40], ['청해', 30]],
  };

  App.views.guide = {
    render(root, params) {
      const lv = params.level || App.level();
      const data = App.levelData(lv);
      const pass = quiz.PASS[lv];
      const exams = dates.upcomingExamDates(App.today, 2);
      if (!data) { root.innerHTML = '<div class="empty">콘텐츠가 없습니다.</div>'; return; }
      const g = data.guide;
      const groupNames = pass.groups.length === 2 ? ['언어지식(문자·어휘·문법)·독해', '청해'] : ['언어지식(문자·어휘·문법)', '독해', '청해'];

      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>학습 가이드</h1><p>레벨별 시험 구성, 영역별 공부법, 핵심 문법을 정리했습니다.</p></div>
          <div class="seg" role="group" aria-label="레벨">${App.LEVELS.map((l) => `<button data-lv="${l}" aria-pressed="${l === lv}">${l}</button>`).join('')}</div></div>
        <div class="card"><h2>JLPT ${lv} 개요</h2><p>${App.esc(g.summary)}</p>
          <div class="grid g4" style="margin-top:14px">
            <div class="kpi"><div class="label">권장 어휘</div><div class="value">${g.targetVocab.toLocaleString()}<small>개</small></div></div>
            <div class="kpi"><div class="label">권장 한자</div><div class="value">${g.targetKanji.toLocaleString()}<small>자</small></div></div>
            <div class="kpi"><div class="label">합격점</div><div class="value">${pass.pass}<small>/180</small></div></div>
            <div class="kpi"><div class="label">예상 학습 시간</div><div class="sub" style="font-size:13px;color:var(--text);margin-top:6px">${App.esc(g.studyHours)}</div></div>
          </div></div>
        <div class="grid g2">
          <div class="card"><h2>시험 시간</h2><div class="table-wrap"><table><thead><tr><th>과목</th><th class="num">시간</th></tr></thead><tbody>
            ${TIMES[lv].map(([n, t]) => `<tr><td>${n}</td><td class="num">${t}분</td></tr>`).join('')}</tbody></table></div></div>
          <div class="card"><h2>득점 구분과 기준점</h2><div class="table-wrap"><table><thead><tr><th>득점 구분</th><th class="num">만점</th><th class="num">기준점</th></tr></thead><tbody>
            ${groupNames.map((n, i) => `<tr><td>${n}</td><td class="num">${pass.max[i]}</td><td class="num">${pass.min[i]}</td></tr>`).join('')}</tbody></table></div>
            <p class="small muted" style="margin-top:8px">총점이 합격점 이상이고, 모든 득점 구분이 기준점 이상이어야 합격입니다.</p></div>
        </div>
        <div class="grid g2">${g.sections.map((s) => `<div class="card"><div class="card-head"><h2>${App.esc(s.name)}</h2>${App.sectionChip(s.id)}</div>
          <ul class="tips">${s.tips.map((t) => `<li>${App.esc(t)}</li>`).join('')}</ul>
          <div class="row" style="margin-top:12px"><button class="btn sm" data-practice="${s.id}">${App.esc(s.name)} 문제 풀기</button></div></div>`).join('')}</div>
        <div class="card"><h2>${lv} 학습 전략</h2><ol class="tips">${g.strategies.map((t) => `<li>${App.esc(t)}</li>`).join('')}</ol></div>
        <div class="card"><div class="card-head"><h2>핵심 문법 ${g.grammarPoints.length}개</h2><span class="small muted">예문 옆 ▶ 버튼으로 발음을 들을 수 있어요</span></div>
          <div class="table-wrap"><table><thead><tr><th style="width:22%">문형</th><th style="width:22%">의미</th><th>예문</th><th></th></tr></thead><tbody>
          ${g.grammarPoints.map((p, i) => `<tr><td class="ja" lang="ja"><b>${App.esc(p.pattern)}</b></td><td>${App.esc(p.meaning)}</td>
            <td><div class="ja" lang="ja">${App.esc(p.example)}</div><div class="small muted">${App.esc(p.exampleKo)}</div></td>
            <td><button class="btn ghost sm" data-say="${i}" aria-label="예문 듣기">▶</button></td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><h2>시험 정보</h2>
          <ul class="tips">
            <li>JLPT는 매년 7월·12월 첫째 일요일에 시행됩니다. 다음 시험일: ${exams.map((d) => App.esc(dates.formatKo(d))).join(', ')}</li>
            <li>N1~N5 모두 같은 날 시행되므로 한 회차에 한 레벨만 응시할 수 있습니다.</li>
            <li>접수 기간·응시료·시험장은 국가와 회차마다 다릅니다. 반드시 공식 사이트에서 확인하세요.</li>
            <li>준비물: 수험표, 신분증, HB 연필 또는 샤프, 지우개, 아날로그 손목시계(스마트워치 불가).</li>
          </ul>
          <div class="row" style="margin-top:10px">
            <a class="btn sm" href="https://www.jlpt.or.kr/" target="_blank" rel="noopener">한국 JLPT 공식 사이트</a>
            <a class="btn sm" href="https://www.jlpt.jp/" target="_blank" rel="noopener">JLPT 공식 사이트 (일본)</a>
          </div></div>
      </div>`));

      root.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => App.go('guide', { level: b.dataset.lv })));
      root.querySelectorAll('[data-practice]').forEach((b) => b.addEventListener('click', () => App.go('practice', { level: lv, section: b.dataset.practice })));
      root.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => {
        const ok = App.tts.speak(g.grammarPoints[Number(b.dataset.say)].example);
        if (!ok) App.toast('일본어 음성이 없습니다. 설정 화면의 안내를 확인하세요.');
      }));
    },
  };
})();
