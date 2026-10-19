(function () {
  'use strict';
  const App = window.App;
  const { dates, quiz, planner } = App;

  function activityChart(days) {
    const W = 640; const H = 180; const P = { l: 28, r: 8, t: 10, b: 24 };
    const max = Math.max(5, ...days.map((d) => d.q + d.cards));
    const bw = (W - P.l - P.r) / days.length;
    const y = (v) => H - P.b - ((H - P.t - P.b) * v) / max;
    const ticks = [0, Math.round(max / 2), max];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 14일 학습량">
      ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--border)"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${days.map((d, i) => {
        const x = P.l + i * bw + bw * 0.18; const w = bw * 0.64;
        const hq = (H - P.t - P.b) * d.q / max; const hc = (H - P.t - P.b) * d.cards / max;
        return `<g><title>${d.iso}: 문제 ${d.q} · 카드 ${d.cards}</title>
          <rect x="${x}" y="${H - P.b - hq}" width="${w}" height="${hq}" fill="var(--s-grammar)" rx="2"/>
          <rect x="${x}" y="${H - P.b - hq - hc}" width="${w}" height="${hc}" fill="var(--s-vocab)" rx="2"/>
          <text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${Number(d.iso.slice(8))}</text></g>`;
      }).join('')}
    </svg>`;
  }

  App.views.stats = {
    render(root, params) {
      const lv = params.level || App.level();
      const atts = App.state.attempts;
      const lvAtts = atts.filter((a) => a.level === lv);
      const acc = quiz.sectionAccuracy(atts, lv);
      const totalCorrect = lvAtts.filter((a) => a.correct).length;
      const activeDays = App.activeDays();
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const iso = dates.addDays(App.today, -i);
        const a = App.activityOn(iso);
        days.push({ iso, q: a.q || 0, cards: a.cards || 0 });
      }
      const mocks = App.state.mocks.filter((m) => m.level === lv).slice(-10).reverse();
      // 약점 태그
      const tagStat = {};
      for (const a of lvAtts) {
        const f = App.findQuestion(a.qid);
        if (!f) continue;
        for (const t of f.q.tags || []) {
          const s = (tagStat[t] = tagStat[t] || { c: 0, t: 0 });
          s.t++; if (a.correct) s.c++;
        }
      }
      const weakTags = Object.entries(tagStat).filter(([, s]) => s.t >= 2).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t).slice(0, 5);

      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>통계</h1><p>학습량과 정답률을 확인하고 약한 부분을 찾아보세요.</p></div>
          <div class="seg" role="group" aria-label="레벨">${App.LEVELS.map((l) => `<button data-lv="${l}" aria-pressed="${l === lv}">${l}</button>`).join('')}</div></div>
        <div class="grid g4">
          <div class="card kpi"><div class="label">푼 문제 (${lv})</div><div class="value">${lvAtts.length}</div></div>
          <div class="card kpi"><div class="label">정답률</div><div class="value">${lvAtts.length ? App.pct(totalCorrect / lvAtts.length) : '—'}</div></div>
          <div class="card kpi"><div class="label">학습한 날</div><div class="value">${activeDays.length}<small>일</small></div></div>
          <div class="card kpi"><div class="label">연속 학습</div><div class="value">${quiz.streak(activeDays, App.today)}<small>일</small></div></div>
        </div>
        <div class="grid g3">
          <div class="card span2 chart"><div class="card-head"><h2>최근 14일 학습량</h2>
            <div class="legend"><span><i class="dot" style="background:var(--s-grammar)"></i>문제</span><span><i class="dot" style="background:var(--s-vocab)"></i>단어 카드</span></div></div>
            ${activityChart(days)}</div>
          <div class="card"><h2>섹션별 정답률</h2>
            ${planner.SECTIONS.map((s) => { const a = acc[s]; return `<div class="sec-row"><span>${App.SECTION_NAMES[s]}</span>
              <div class="bar"><i style="width:${a ? App.pct(a.correct / a.total) : 0};background:var(--s-${s})"></i></div>
              <span class="pct">${a ? `${App.pct(a.correct / a.total)}` : '—'}</span></div><div class="small muted" style="margin:-4px 0 4px 90px">${a ? `${a.correct}/${a.total}문항` : '아직 기록 없음'}</div>`; }).join('')}</div>
        </div>
        <div class="grid g2">
          <div class="card"><h2>모의고사 기록</h2>${mocks.length ? `<div class="table-wrap"><table><thead><tr><th>날짜</th><th class="num">정답</th><th class="num">예상 점수</th><th>판정</th></tr></thead><tbody>
            ${mocks.map((m) => `<tr><td>${App.esc(m.at)}</td><td class="num">${m.correct}/${m.total}</td><td class="num">${m.score}</td><td style="color:${m.passed ? 'var(--ok)' : 'var(--bad)'}">${m.passed ? '합격권' : '불합격권'}</td></tr>`).join('')}</tbody></table></div>`
            : '<p class="muted">아직 모의고사 기록이 없습니다.</p>'}</div>
          <div class="card"><h2>보완이 필요한 유형</h2>${weakTags.length ? weakTags.map(([t, s]) => `<div class="sec-row"><span class="small">${App.esc(t)}</span>
              <div class="bar"><i style="width:${App.pct(s.c / s.t)}"></i></div><span class="pct">${s.c}/${s.t}</span></div>`).join('')
            : '<p class="muted">유형별로 2문항 이상 풀면 약한 유형을 보여 드려요.</p>'}</div>
        </div>
      </div>`));
      root.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => App.go('stats', { level: b.dataset.lv })));
    },
  };
})();
