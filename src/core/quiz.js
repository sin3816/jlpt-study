// 문제 세트 구성·채점·통계
(function (root, factory) {
  const mod = factory(root.JLPT && root.JLPT.dates ? root.JLPT.dates : (typeof require === 'function' ? require('./dates') : null));
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).quiz = mod;
})(typeof self !== 'undefined' ? self : this, function (dates) {
  'use strict';

  // 시드 고정 난수(mulberry32) — 테스트 재현용
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 출제: section('all' 가능), count, mode('random'|'unseen'|'wrong')
  function buildSet(questions, opts = {}, history = {}) {
    const { section = 'all', count = 10, mode = 'random', seed } = opts;
    const rand = seed === undefined ? Math.random : rng(seed);
    let pool = questions.filter((q) => section === 'all' || q.section === section);
    if (mode === 'wrong') pool = pool.filter((q) => history.wrong && history.wrong[q.id] && !history.wrong[q.id].resolved);
    if (mode === 'unseen') {
      const seen = history.seen || new Set();
      const unseen = pool.filter((q) => !seen.has(q.id));
      pool = unseen.length ? unseen : pool;
    }
    let picked = shuffle(pool, rand).slice(0, Math.max(1, count));
    // 독해: 같은 지문 문항은 붙여서 보여준다
    picked = groupByPassage(picked);
    return picked;
  }

  function groupByPassage(list) {
    const out = [];
    const used = new Set();
    for (const q of list) {
      if (used.has(q.id)) continue;
      out.push(q); used.add(q.id);
      if (q.passage) {
        for (const r of list) if (!used.has(r.id) && r.passage === q.passage) { out.push(r); used.add(r.id); }
      }
    }
    return out;
  }

  // 미니 모의고사: 섹션 비율을 실제 시험과 비슷하게
  const MOCK_MIX = { vocab: 0.35, grammar: 0.3, reading: 0.2, listening: 0.15 };
  function buildMock(questions, total = 20, seed) {
    const rand = seed === undefined ? Math.random : rng(seed);
    const out = [];
    for (const [sec, r] of Object.entries(MOCK_MIX)) {
      const pool = shuffle(questions.filter((q) => q.section === sec), rand);
      out.push(...groupByPassage(pool.slice(0, Math.max(1, Math.round(total * r)))));
    }
    return out;
  }

  // 레벨별 제한시간(분) — 미니 모의고사 문항 수에 비례해 환산
  const EXAM_MINUTES = { N5: 90, N4: 115, N3: 140, N2: 155, N1: 165 };
  function mockMinutes(level, nQuestions) {
    // 실제 시험은 대략 100~110문항 내외 → 문항당 평균 시간으로 환산
    const perQ = EXAM_MINUTES[level] / 100;
    return Math.max(5, Math.round(perQ * nQuestions * 1.2));
  }

  function grade(questions, answers) {
    const bySection = {};
    let correct = 0;
    questions.forEach((q, i) => {
      const s = (bySection[q.section] = bySection[q.section] || { correct: 0, total: 0 });
      s.total++;
      if (answers[i] === q.answer) { s.correct++; correct++; }
    });
    return { correct, total: questions.length, rate: questions.length ? correct / questions.length : 0, bySection };
  }

  // 정답률로 180점 만점 환산(참고용 추정치). N4·N5는 언어지식+독해 통합 120점.
  const PASS = {
    N1: { pass: 100, groups: [['vocab', 'grammar'], ['reading'], ['listening']], max: [60, 60, 60], min: [19, 19, 19] },
    N2: { pass: 90, groups: [['vocab', 'grammar'], ['reading'], ['listening']], max: [60, 60, 60], min: [19, 19, 19] },
    N3: { pass: 95, groups: [['vocab', 'grammar'], ['reading'], ['listening']], max: [60, 60, 60], min: [19, 19, 19] },
    N4: { pass: 90, groups: [['vocab', 'grammar', 'reading'], ['listening']], max: [120, 60], min: [38, 19] },
    N5: { pass: 80, groups: [['vocab', 'grammar', 'reading'], ['listening']], max: [120, 60], min: [38, 19] },
  };
  const GROUP_NAMES = { 'vocab,grammar': '언어지식(문자·어휘·문법)', reading: '독해', listening: '청해', 'vocab,grammar,reading': '언어지식·독해' };

  function estimateScore(level, bySection) {
    const p = PASS[level];
    const parts = p.groups.map((secs, i) => {
      let c = 0; let t = 0;
      secs.forEach((s) => { if (bySection[s]) { c += bySection[s].correct; t += bySection[s].total; } });
      const score = t ? Math.round((c / t) * p.max[i]) : 0;
      return { name: GROUP_NAMES[secs.join(',')], score, max: p.max[i], min: p.min[i], ok: score >= p.min[i], measured: t > 0 };
    });
    const total = parts.reduce((s, x) => s + x.score, 0);
    return { total, pass: p.pass, parts, passed: total >= p.pass && parts.every((x) => x.ok) };
  }

  // 시도 기록 → 섹션별 정답률
  function sectionAccuracy(attempts, level) {
    const out = {};
    for (const a of attempts) {
      if (level && a.level !== level) continue;
      const s = (out[a.section] = out[a.section] || { correct: 0, total: 0 });
      s.total++; if (a.correct) s.correct++;
    }
    return out;
  }

  // 연속 학습일(오늘 또는 어제까지 이어진 날 수)
  function streak(activeDays, today) {
    const set = new Set(activeDays);
    let d = set.has(today) ? today : dates.addDays(today, -1);
    let n = 0;
    while (set.has(d)) { n++; d = dates.addDays(d, -1); }
    return n;
  }

  return { rng, shuffle, buildSet, buildMock, mockMinutes, grade, estimateScore, sectionAccuracy, streak, PASS };
});
