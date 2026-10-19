(function () {
  'use strict';
  const App = window.App;

  App.views.wrong = {
    render(root, params) {
      const filter = params.filter || 'open';
      const lvFilter = params.lv || 'all';
      const entries = Object.entries(App.state.wrong)
        .map(([id, w]) => Object.assign({ id }, w, App.findQuestion(id) || {}))
        .filter((e) => e.q)
        .filter((e) => (filter === 'open' ? !e.resolved : e.resolved))
        .filter((e) => lvFilter === 'all' || e.level === lvFilter)
        .sort((a, b) => (b.count - a.count) || (a.lastAt < b.lastAt ? 1 : -1));
      const openAll = Object.values(App.state.wrong).filter((w) => !w.resolved);

      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>오답노트</h1><p>틀린 문제가 자동으로 모입니다. 같은 문제를 연속 2번 맞히면 해결됨으로 옮겨져요.</p></div>
          <div class="row">${entries.length && filter === 'open' ? '<button class="btn primary" id="retry">오답 다시 풀기</button>' : ''}
            ${params.taskId ? '<button class="btn" id="done-task">복습 완료</button>' : ''}</div></div>
        <div class="row between">
          <div class="seg" data-k="filter"><button data-v="open" aria-pressed="${filter === 'open'}">미해결 ${openAll.length}</button>
            <button data-v="resolved" aria-pressed="${filter === 'resolved'}">해결됨</button></div>
          <div class="seg" data-k="lv"><button data-v="all" aria-pressed="${lvFilter === 'all'}">전체</button>
            ${App.LEVELS.map((l) => `<button data-v="${l}" aria-pressed="${lvFilter === l}">${l}</button>`).join('')}</div>
        </div>
        <div class="card">${entries.length ? entries.map((e) => `<details class="wq"><summary>
            <span class="chip">${e.level}</span>${App.sectionChip(e.q.section)}
            <span class="ja" lang="ja" style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${App.richJa(e.q.prompt.split("\n").pop())}</span>
            <span class="small muted">${e.count}회 틀림 · ${App.esc(e.lastAt)}</span></summary>
            <div class="body">
              ${e.q.passage ? `<div class="passage ja" lang="ja">${App.richJa(e.q.passage)}</div>` : ''}
              ${e.q.audioScript ? `<div class="passage ja" lang="ja">${App.esc(e.q.audioScript)}</div>` : ''}
              <div class="ja" lang="ja">${App.richJa(e.q.prompt)}</div>
              <ol class="ja" lang="ja" style="margin:0;padding-left:22px">${e.q.choices.map((c, i) => `<li style="${i === e.q.answer ? 'color:var(--ok);font-weight:700' : i === e.lastChoice ? 'color:var(--bad);text-decoration:line-through' : ''}">${App.esc(c)}</li>`).join('')}</ol>
              <div class="muted">${App.esc(e.q.explanation)}</div>
              <div class="row"><button class="btn sm" data-toggle="${App.esc(e.id)}">${e.resolved ? '미해결로 되돌리기' : '해결됨으로 표시'}</button></div>
            </div></details>`).join('')
          : `<div class="empty"><h3>${filter === 'open' ? '미해결 오답이 없습니다' : '해결한 오답이 아직 없습니다'}</h3><p>연습문제를 풀면 틀린 문제가 여기에 모입니다.</p></div>`}</div>
      </div>`));

      const nav = (o) => App.go('wrong', Object.assign({ filter, lv: lvFilter, taskId: params.taskId, taskDate: params.taskDate }, o));
      root.querySelectorAll('.seg[data-k]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => nav({ [seg.dataset.k]: b.dataset.v }))));
      root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const w = App.state.wrong[b.dataset.toggle];
        w.resolved = !w.resolved; w.streak = 0; w.t = App.now();
        App.save(); nav({});
      }));
      const retry = root.querySelector('#retry');
      if (retry) retry.addEventListener('click', () => {
        // 레벨별로 묶어 가장 많은 레벨부터
        const byLv = {};
        entries.forEach((e) => { (byLv[e.level] = byLv[e.level] || []).push(e.id); });
        const lv = Object.keys(byLv).sort((a, b) => byLv[b].length - byLv[a].length)[0];
        App.go('practice', { level: lv, ids: byLv[lv].slice(0, 20), taskId: params.taskId, taskDate: params.taskDate });
      });
      const dt = root.querySelector('#done-task');
      if (dt) dt.addEventListener('click', () => { App.completeTask(params.taskId, params.taskDate); App.toast('복습을 완료로 표시했어요'); App.go('dashboard'); });
    },
  };
})();
