(function () {
  'use strict';
  const App = window.App;
  const { srs } = App;

  let V = null;
  let keyFn = null;

  function cardsFor(lv) {
    const out = {};
    for (const [k, v] of Object.entries(App.state.cards)) if (k.startsWith(lv + '|')) out[k.slice(lv.length + 1)] = v;
    return out;
  }

  function startSession(lv, params) {
    const data = App.levelData(lv);
    const r = srs.pickToday(data.vocab, cardsFor(lv), App.today, App.state.settings.newCardsPerDay);
    const queue = [...r.due, ...r.fresh];
    V = { level: lv, queue, done: 0, flipped: false, taskId: params.taskId, taskDate: params.taskDate, total: queue.length, again: 0 };
  }

  function renderCard(root) {
    const w = V.queue[0];
    root.innerHTML = '';
    if (!w) {
      if (V.taskId) App.completeTask(V.taskId, V.taskDate);
      App.save();
      root.appendChild(App.el(`<div class="page"><div class="flash card empty">
        <h3>오늘의 단어 카드를 모두 마쳤어요</h3><p>${V.done}장 학습${V.taskId ? ' · 오늘 할 일을 완료로 표시했어요' : ''}. 내일 복습 카드가 다시 준비됩니다.</p>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="list">단어 목록</button><button class="btn primary" id="home">대시보드</button></div></div></div>`));
      root.querySelector('#home').addEventListener('click', () => App.go('dashboard'));
      root.querySelector('#list').addEventListener('click', () => App.go('vocab', { level: V.level, tab: 'list' }));
      return;
    }
    const card = App.state.cards[`${V.level}|${w.word}`];
    root.appendChild(App.el(`<div class="page"><div class="flash">
      <div class="qmeta"><span class="small muted">${V.level} 단어 카드 · ${card ? '복습' : '새 단어'}</span>
        <div class="row"><span class="small muted">남은 카드 ${V.queue.length}</span><button class="btn ghost sm" id="quit">그만두기</button></div></div>
      <div class="bar" style="margin-bottom:14px"><i style="width:${V.total ? (V.done / (V.done + V.queue.length)) * 100 : 0}%"></i></div>
      <div class="card fcard">
        <div class="word" lang="ja">${App.esc(w.word)}</div>
        ${V.flipped ? `<div class="reading" lang="ja">${App.esc(w.reading)}</div>
          <div class="meaning">${App.esc(w.meaning)}</div>
          <div class="ex"><div class="ja" lang="ja">${App.esc(w.example)}</div><div>${App.esc(w.exampleKo)}</div></div>
          <button class="btn ghost sm" id="say">▶ 발음 듣기</button>` : '<p class="muted">뜻과 읽기를 떠올린 뒤 카드를 뒤집으세요.</p>'}
      </div>
      ${V.flipped ? `<div class="rate">
          <button class="btn" data-q="0">모름<small>오늘 다시</small></button>
          <button class="btn" data-q="1">어려움<small>${preview(card, 1)}</small></button>
          <button class="btn" data-q="2">알맞음<small>${preview(card, 2)}</small></button>
          <button class="btn primary" data-q="3">쉬움<small style="color:inherit;opacity:.8">${preview(card, 3)}</small></button></div>`
        : '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary" id="flip">뒤집기 <span class="kbd" style="color:inherit">Space</span></button></div>'}
      <p class="small muted" style="text-align:center;margin-top:10px">단축키: Space 뒤집기 · 1 모름 · 2 어려움 · 3 알맞음 · 4 쉬움</p>
    </div></div>`));

    const flip = () => { V.flipped = true; renderCard(root); };
    const rate = (q) => {
      const key = `${V.level}|${w.word}`;
      App.state.cards[key] = srs.review(App.state.cards[key], q, App.today);
      V.queue.shift();
      if (q === 0) { V.queue.splice(Math.min(3, V.queue.length), 0, w); V.again++; } else V.done++;
      V.flipped = false;
      App.bumpActivity('cards');
      App.save();
      renderCard(root);
    };
    const f = root.querySelector('#flip'); if (f) f.addEventListener('click', flip);
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => rate(Number(b.dataset.q))));
    const say = root.querySelector('#say'); if (say) say.addEventListener('click', () => App.tts.speak(`${w.word}。${w.example}`));
    root.querySelector('#quit').addEventListener('click', () => App.go('vocab', { level: V.level }));

    if (keyFn) document.removeEventListener('keydown', keyFn);
    keyFn = (e) => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      if (e.key === ' ' && !V.flipped) { e.preventDefault(); flip(); }
      else if (V.flipped && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(Number(e.key) - 1); }
    };
    document.addEventListener('keydown', keyFn);
  }

  function preview(card, q) {
    const c = srs.review(card, q, App.today);
    return c.interval <= 0 ? '오늘' : `${c.interval}일 후`;
  }

  function renderHome(root, params) {
    const lv = params.level || App.level();
    const data = App.levelData(lv);
    const cards = cardsFor(lv);
    const r = srs.pickToday(data.vocab, cards, App.today, App.state.settings.newCardsPerDay);
    const learned = Object.keys(cards).length;
    const tab = params.tab || 'today';
    const status = (w) => {
      const c = cards[w.word];
      if (!c) return '<span class="chip">새 단어</span>';
      if (srs.isDue(c, App.today)) return '<span class="chip" style="color:var(--accent)">복습 대기</span>';
      return `<span class="chip" style="color:var(--ok)">${App.esc(c.due)} 복습</span>`;
    };
    root.appendChild(App.el(`<div class="page">
      <div class="page-head"><div><h1>단어장</h1><p>간격 반복으로 잊어버릴 때쯤 다시 보여 드려요. 매일 조금씩이 가장 효과적입니다.</p></div>
        <div class="seg" role="group" aria-label="레벨">${App.LEVELS.map((l) => `<button data-lv="${l}" aria-pressed="${l === lv}">${l}</button>`).join('')}</div></div>
      <div class="grid g4">
        <div class="card kpi"><div class="label">오늘 복습</div><div class="value">${r.due.length}<small>장</small></div></div>
        <div class="card kpi"><div class="label">새 단어</div><div class="value">${r.fresh.length}<small>장</small></div><div class="sub">하루 최대 ${App.state.settings.newCardsPerDay}장</div></div>
        <div class="card kpi"><div class="label">학습한 단어</div><div class="value">${learned}<small>/ ${data.vocab.length}</small></div></div>
        <div class="card kpi"><div class="label">권장 어휘(${lv})</div><div class="value">${data.guide.targetVocab.toLocaleString()}</div><div class="sub">앱 수록 단어는 핵심 샘플입니다</div></div>
      </div>
      <div class="row"><div class="seg" data-tab><button data-t="today" aria-pressed="${tab === 'today'}">오늘 학습</button><button data-t="list" aria-pressed="${tab === 'list'}">단어 목록</button></div></div>
      ${tab === 'today' ? `<div class="card empty"><h3>${r.due.length + r.fresh.length ? `오늘 ${r.due.length + r.fresh.length}장을 학습합니다` : '오늘 학습할 카드가 없습니다'}</h3>
          <p>${r.due.length + r.fresh.length ? '카드를 보고 뜻을 떠올린 뒤, 얼마나 잘 기억했는지 평가하세요.' : '내일 다시 확인하거나, 다른 레벨을 선택해 보세요.'}</p>
          ${r.due.length + r.fresh.length ? '<button class="btn primary" id="go" style="margin-top:14px">학습 시작</button>' : ''}</div>`
        : `<div class="card"><table><thead><tr><th>단어</th><th>읽기</th><th>뜻</th><th>예문</th><th>상태</th></tr></thead><tbody>
          ${data.vocab.map((w) => `<tr><td class="ja" lang="ja"><b>${App.esc(w.word)}</b></td><td class="ja" lang="ja">${App.esc(w.reading)}</td><td>${App.esc(w.meaning)}</td>
            <td><div class="ja small" lang="ja">${App.esc(w.example)}</div><div class="small muted">${App.esc(w.exampleKo)}</div></td><td>${status(w)}</td></tr>`).join('')}</tbody></table></div>`}
    </div>`));
    root.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => App.go('vocab', { level: b.dataset.lv, tab })));
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => App.go('vocab', { level: lv, tab: b.dataset.t })));
    const go = root.querySelector('#go');
    if (go) go.addEventListener('click', () => { startSession(lv, params); renderCard(root); });
  }

  App.views.vocab = {
    render(root, params) {
      V = null;
      App.cleanup = () => { if (keyFn) document.removeEventListener('keydown', keyFn); keyFn = null; };
      if (params.autostart) {
        startSession(params.level || App.level(), params);
        return renderCard(root);
      }
      renderHome(root, params);
    },
  };
})();
