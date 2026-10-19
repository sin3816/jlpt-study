(function () {
  'use strict';
  const App = window.App;
  const { quiz } = App;

  let S = null; // 현재 세션

  function seenSet(level) {
    return new Set(App.state.attempts.filter((a) => a.level === level).map((a) => a.qid));
  }

  function start(opts) {
    const level = opts.level;
    const qs = App.allQuestions(level);
    let set;
    if (opts.mode === 'mock') set = quiz.buildMock(qs, 20);
    else if (opts.ids) set = opts.ids.map((id) => qs.find((q) => q.id === id)).filter(Boolean);
    else set = quiz.buildSet(qs, { section: opts.section, count: opts.count, mode: opts.pick }, { seen: seenSet(level), wrong: App.state.wrong });
    if (!set.length) { App.toast(opts.pick === 'wrong' ? '이 조건의 오답이 없습니다.' : '문제가 없습니다.'); return false; }
    S = {
      mode: opts.mode === 'mock' ? 'mock' : 'practice',
      level, questions: set, i: 0, answers: new Array(set.length).fill(null), revealed: false,
      taskId: opts.taskId, taskDate: opts.taskDate,
      deadline: opts.mode === 'mock' ? Date.now() + quiz.mockMinutes(level, set.length) * 60000 : null,
      finished: false,
    };
    return true;
  }

  // ---------------- setup ----------------
  function renderSetup(root, params) {
    const st = {
      level: params.level || App.level(),
      section: params.section || 'all',
      count: params.count || 10,
      pick: params.pick || 'unseen',
    };
    const draw = () => {
      root.innerHTML = '';
      const qs = App.allQuestions(st.level);
      const n = (s) => qs.filter((q) => s === 'all' || q.section === s).length;
      const wrongN = Object.entries(App.state.wrong).filter(([, w]) => !w.resolved && w.level === st.level).length;
      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>연습문제</h1><p>영역과 문항 수를 골라 풀어 보세요. 풀이 즉시 정답과 해설을 보여 드려요.</p></div></div>
        <div class="grid g3">
          <div class="card span2 stack"><h2>문제 풀기</h2>
            <div class="field"><span>레벨</span><div class="seg" data-k="level">${App.LEVELS.map((l) => `<button data-v="${l}" aria-pressed="${st.level === l}">${l}</button>`).join('')}</div></div>
            <div class="field"><span>영역</span><div class="seg" data-k="section">
              ${[['all', '전체'], ...App.planner.SECTIONS.map((s) => [s, App.SECTION_NAMES[s]])].map(([v, l]) => `<button data-v="${v}" aria-pressed="${st.section === v}">${l} <span class="muted small">${n(v)}</span></button>`).join('')}</div></div>
            <div class="field"><span>문항 수</span><div class="seg" data-k="count">${[5, 10, 20, 50].map((c) => `<button data-v="${c}" aria-pressed="${st.count === c}">${c === 50 ? '전체' : c + '문항'}</button>`).join('')}</div></div>
            <div class="field"><span>출제 방식</span><div class="seg" data-k="pick">${[['unseen', '안 푼 문제 우선'], ['random', '무작위'], ['wrong', `오답만 (${wrongN})`]].map(([v, l]) => `<button data-v="${v}" aria-pressed="${st.pick === v}">${l}</button>`).join('')}</div></div>
            <div class="row" style="justify-content:flex-end"><button class="btn primary" id="start">풀기 시작</button></div>
          </div>
          <div class="card stack"><h2>미니 모의고사</h2>
            <p>실제 시험 비율(어휘·문법·독해·청해)대로 20문항을 출제합니다. 시간이 끝나거나 제출하면 예상 점수와 합격 여부를 알려 드려요.</p>
            <p class="small muted">제한시간 ${quiz.mockMinutes(st.level, 20)}분 · 풀이 중에는 정답이 표시되지 않습니다.</p>
            <button class="btn primary" id="mock">${st.level} 모의고사 시작</button>
          </div>
        </div></div>`));
      root.querySelectorAll('.seg[data-k]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const k = seg.dataset.k;
        st[k] = k === 'count' ? Number(b.dataset.v) : b.dataset.v;
        draw();
      })));
      root.querySelector('#start').addEventListener('click', () => {
        if (start({ level: st.level, section: st.section, count: st.count, pick: st.pick })) renderRun(root);
      });
      root.querySelector('#mock').addEventListener('click', () => { if (start({ level: st.level, mode: 'mock' })) renderRun(root); });
    };
    draw();
  }

  // ---------------- run ----------------
  let timerId = null;
  function renderRun(root) {
    clearInterval(timerId);
    const q = S.questions[S.i];
    const ans = S.answers[S.i];
    const isMock = S.mode === 'mock';
    const reveal = !isMock && S.revealed;
    const ttsOk = App.tts.available();
    const showScript = q.section === 'listening' && (reveal || !ttsOk);

    root.innerHTML = '';
    root.appendChild(App.el(`<div class="page"><div class="quiz">
      <div class="qmeta">
        <div class="row">${App.sectionChip(q.section)}<span class="small muted">${S.level} · ${isMock ? '모의고사' : '연습'}</span></div>
        <div class="row"><span class="small muted">${S.i + 1} / ${S.questions.length}</span>
          ${isMock ? '<span class="timer" id="timer"></span>' : ''}
          <button class="btn ghost sm" id="quit">그만두기</button></div>
      </div>
      <div class="bar" style="margin-bottom:16px"><i style="width:${((S.i + (reveal || (isMock && ans !== null) ? 1 : 0)) / S.questions.length) * 100}%"></i></div>
      <div class="card">
        ${q.section === 'listening' ? `<div class="audio"><button class="btn primary sm" id="play">▶ 음성 재생</button>
          <span class="small muted">${ttsOk ? '일본어 음성으로 읽어 줍니다. 여러 번 들을 수 있어요.' : '일본어 음성이 설치되어 있지 않아 스크립트를 보여 드립니다.'}</span></div>` : ''}
        ${showScript ? `<div class="passage ja" lang="ja">${App.esc(q.audioScript)}</div>` : ''}
        ${q.passage ? `<div class="passage ja" lang="ja">${App.richJa(q.passage)}</div>` : ''}
        <div class="qprompt ja" lang="ja">${App.richJa(q.prompt)}</div>
        <div class="choices">${q.choices.map((c, i) => {
          let cls = '';
          if (reveal) cls = i === q.answer ? 'correct' : i === ans ? 'wrong' : '';
          else if (ans === i) cls = 'sel';
          return `<button class="choice ${cls}" data-i="${i}" ${reveal ? 'disabled' : ''}><span class="no">${i + 1}</span><span class="ja" lang="ja">${App.esc(c)}</span></button>`;
        }).join('')}</div>
        ${reveal ? `<div class="explain ${ans === q.answer ? 'ok' : 'bad'}"><h3>${ans === q.answer ? '정답입니다' : `오답 — 정답은 ${q.answer + 1}번`}</h3><p>${App.esc(q.explanation)}</p></div>` : ''}
      </div>
      <div class="row between" style="margin-top:14px">
        <span class="small muted kbd-hint"><span class="kbd">1</span>~<span class="kbd">4</span> 선택 · <span class="kbd">Enter</span> 다음</span>
        <div class="row">
          ${isMock ? `<button class="btn" id="prev" ${S.i === 0 ? 'disabled' : ''}>이전</button>` : ''}
          ${isMock ? (S.i < S.questions.length - 1 ? '<button class="btn" id="next">다음</button>' : '') + '<button class="btn primary" id="submit">제출</button>'
            : `<button class="btn primary" id="next" ${reveal ? '' : 'disabled'}>${S.i < S.questions.length - 1 ? '다음 문제' : '결과 보기'}</button>`}
        </div>
      </div>
    </div></div>`));

    const choose = (i) => {
      if (isMock) { S.answers[S.i] = i; renderRun(root); return; }
      if (S.revealed) return;
      S.answers[S.i] = i;
      S.revealed = true;
      App.recordAttempt(q, S.level, i);
      renderRun(root);
    };
    const next = () => {
      if (!isMock && !S.revealed) return;
      if (S.i < S.questions.length - 1) { S.i++; S.revealed = false; renderRun(root); }
      else if (!isMock) finish(root);
    };
    root.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))));
    const nb = root.querySelector('#next'); if (nb) nb.addEventListener('click', next);
    const pb = root.querySelector('#prev'); if (pb) pb.addEventListener('click', () => { S.i--; renderRun(root); });
    const sb = root.querySelector('#submit');
    if (sb) sb.addEventListener('click', async () => {
      const blank = S.answers.filter((a) => a === null).length;
      if (blank && !(await App.confirm('모의고사 제출', `아직 ${blank}문항을 풀지 않았습니다. 제출할까요?`, '제출'))) return;
      finish(root);
    });
    root.querySelector('#quit').addEventListener('click', async () => {
      if (await App.confirm('풀이 그만두기', '지금까지 푼 기록은 저장됩니다. 그만둘까요?', '그만두기')) { S = null; App.go('practice', {}); }
    });
    const play = root.querySelector('#play');
    if (play) play.addEventListener('click', () => { if (!App.tts.speak(q.audioScript)) App.toast('일본어 음성이 없습니다. 스크립트를 확인하세요.'); });

    if (isMock) {
      const t = root.querySelector('#timer');
      const tick = () => {
        const left = Math.max(0, S.deadline - Date.now());
        const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000);
        t.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        t.classList.toggle('low', left < 120000);
        if (left <= 0) { clearInterval(timerId); App.toast('시간이 끝났습니다'); finish(root); }
      };
      tick();
      timerId = setInterval(tick, 1000);
    }

    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      if (document.getElementById('modal').hidden === false) return;
      if (/^[1-4]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key) - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (isMock) { if (S.i < S.questions.length - 1) { S.i++; renderRun(root); } } else next(); }
    };
    removeOnRerender(onKey);
    document.addEventListener('keydown', onKey);
  }

  // renderRun 이 다시 호출될 때 이전 keydown 리스너를 제거
  let lastKey = null;
  function removeOnRerender(fn) {
    if (lastKey && lastKey !== fn) document.removeEventListener('keydown', lastKey);
    lastKey = fn;
  }

  // ---------------- result ----------------
  function finish(root) {
    clearInterval(timerId);
    if (lastKey) { document.removeEventListener('keydown', lastKey); lastKey = null; }
    App.tts.stop();
    if (S.mode === 'mock' && !S.finished) {
      S.questions.forEach((q, i) => App.recordAttempt(q, S.level, S.answers[i] === null ? -1 : S.answers[i]));
    }
    S.finished = true;
    const g = quiz.grade(S.questions, S.answers);
    const est = S.mode === 'mock' ? quiz.estimateScore(S.level, g.bySection) : null;
    if (est) App.state.mocks.push({ id: App.newId('m'), t: App.now(), level: S.level, at: App.today, correct: g.correct, total: g.total, score: est.total, passed: est.passed });
    if (S.taskId) App.completeTask(S.taskId, S.taskDate);
    App.save();
    App.renderNav();

    const wrongIds = S.questions.filter((q, i) => S.answers[i] !== q.answer).map((q) => q.id);
    root.innerHTML = '';
    root.appendChild(App.el(`<div class="page"><div class="quiz stack">
      <div class="card"><div class="row between">
        <div><div class="small muted">${S.level} ${S.mode === 'mock' ? '미니 모의고사' : '연습'} 결과</div>
          <div class="result-score">${g.correct} <span class="muted" style="font-size:20px">/ ${g.total}</span></div>
          <div class="muted">정답률 ${App.pct(g.rate)}${S.taskId ? ' · 오늘 할 일을 완료로 표시했어요' : ''}</div></div>
        ${est ? `<div style="text-align:right"><div class="small muted">예상 환산 점수(참고)</div>
          <div class="result-score" style="color:${est.passed ? 'var(--ok)' : 'var(--bad)'}">${est.total}<span class="muted" style="font-size:16px"> /180</span></div>
          <div class="small">${est.passed ? '합격권' : `합격점 ${est.pass}점까지 ${Math.max(0, est.pass - est.total)}점`}</div></div>` : ''}
      </div>
      <div style="margin-top:12px">${Object.entries(g.bySection).map(([s, v]) => `<div class="sec-row"><span>${App.SECTION_NAMES[s]}</span>
        <div class="bar"><i style="width:${App.pct(v.correct / v.total)};background:var(--s-${s})"></i></div><span class="pct">${v.correct}/${v.total}</span></div>`).join('')}</div>
      ${est ? `<div class="table-wrap"><table style="margin-top:10px"><thead><tr><th>득점 구분</th><th class="num">예상</th><th class="num">기준점</th></tr></thead><tbody>
        ${est.parts.map((p) => `<tr><td>${p.name}</td><td class="num">${p.score}/${p.max}</td><td class="num" style="color:${p.ok ? 'var(--ok)' : 'var(--bad)'}">${p.min} ${p.ok ? '통과' : '미달'}</td></tr>`).join('')}</tbody></table></div>
        <p class="small muted" style="margin-top:6px">실제 JLPT는 등화(척도) 점수라 이 환산값과 다를 수 있습니다.</p>` : ''}
      </div>
      <div class="row" style="justify-content:flex-end">
        ${wrongIds.length ? '<button class="btn" id="retry-wrong">틀린 문제 다시 풀기</button>' : ''}
        <button class="btn" id="again">새로 풀기</button><button class="btn primary" id="home">대시보드</button></div>
      <div class="card"><h2>문항별 해설</h2>${S.questions.map((q, i) => {
        const a = S.answers[i]; const ok = a === q.answer;
        return `<details class="wq" ${ok ? '' : 'open'}><summary><span class="dot" style="background:${ok ? 'var(--ok)' : 'var(--bad)'}"></span>
          <span class="small muted">${i + 1}.</span> ${App.sectionChip(q.section)} <span class="ja" lang="ja" style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${App.richJa(q.prompt.split("\n").pop())}</span></summary>
          <div class="body">
            ${q.audioScript ? `<div class="passage ja" lang="ja">${App.esc(q.audioScript)}</div>` : ''}
            <div class="ja" lang="ja">${App.richJa(q.prompt)}</div>
            <div>내 답: <b class="ja" lang="ja">${a === null || a < 0 ? '무응답' : App.esc(q.choices[a])}</b> · 정답: <b class="ja" lang="ja" style="color:var(--ok)">${App.esc(q.choices[q.answer])}</b></div>
            <div class="muted">${App.esc(q.explanation)}</div></div></details>`;
      }).join('')}</div>
    </div></div>`));
    const lv = S.level;
    const rw = root.querySelector('#retry-wrong');
    if (rw) rw.addEventListener('click', () => { if (start({ level: lv, ids: wrongIds })) renderRun(root); });
    root.querySelector('#again').addEventListener('click', () => { S = null; App.go('practice', { level: lv }); });
    root.querySelector('#home').addEventListener('click', () => { S = null; App.go('dashboard'); });
  }

  App.views.practice = {
    render(root, params) {
      S = null;
      if (lastKey) { document.removeEventListener('keydown', lastKey); lastKey = null; }
      App.cleanup = () => { clearInterval(timerId); if (lastKey) { document.removeEventListener('keydown', lastKey); lastKey = null; } };
      if (params.autostart === 'mock') {
        if (start({ level: params.level, mode: 'mock', taskId: params.taskId, taskDate: params.taskDate })) return renderRun(root);
      } else if (params.autostart === 'practice') {
        if (start({ level: params.level, section: params.section, count: params.count, pick: 'unseen', taskId: params.taskId, taskDate: params.taskDate })) return renderRun(root);
      } else if (params.ids) {
        if (start({ level: params.level, ids: params.ids, taskId: params.taskId, taskDate: params.taskDate })) return renderRun(root);
      }
      renderSetup(root, params);
    },
  };
})();
