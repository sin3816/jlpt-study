// 학습 계획 생성기: 프로필(레벨·시험일·하루 학습시간·약점)로 단계별 계획과 날짜별 할 일을 만든다.
(function (root, factory) {
  const mod = factory(root.JLPT && root.JLPT.dates ? root.JLPT.dates : (typeof require === 'function' ? require('./dates') : null));
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).planner = mod;
})(typeof self !== 'undefined' ? self : this, function (dates) {
  'use strict';

  const SECTIONS = ['vocab', 'grammar', 'reading', 'listening'];
  const SECTION_NAMES = { vocab: '문자·어휘', grammar: '문법', reading: '독해', listening: '청해' };

  const PHASES = [
    { id: 'foundation', name: '기초 다지기', ratio: 0.4, weights: { vocab: 0.4, grammar: 0.35, reading: 0.15, listening: 0.1 },
      desc: '단어·한자와 핵심 문법을 매일 꾸준히 쌓는 단계입니다. 정확도보다 범위를 넓히는 데 집중하세요.' },
    { id: 'skill', name: '실력 향상', ratio: 0.3, weights: { vocab: 0.3, grammar: 0.3, reading: 0.2, listening: 0.2 },
      desc: '문제 풀이 비중을 늘리고 독해·청해를 본격적으로 시작합니다. 틀린 문제는 오답노트로 관리하세요.' },
    { id: 'practice', name: '실전 연습', ratio: 0.2, weights: { vocab: 0.2, grammar: 0.2, reading: 0.3, listening: 0.3 },
      desc: '시간을 재고 푸는 연습을 합니다. 토요일마다 미니 모의고사로 실전 감각을 익히세요.' },
    { id: 'final', name: '총정리', ratio: 0.1, weights: { vocab: 0.3, grammar: 0.3, reading: 0.2, listening: 0.2 },
      desc: '새로운 내용보다 오답노트와 약점 복습에 집중합니다. 시험 전날은 가볍게 정리만 하세요.' },
  ];

  function normalize(w) {
    const sum = SECTIONS.reduce((s, k) => s + w[k], 0);
    const out = {};
    for (const k of SECTIONS) out[k] = w[k] / sum;
    return out;
  }

  function validateProfile(p) {
    const errs = [];
    if (!p || typeof p !== 'object') return ['프로필이 없습니다'];
    if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(p.level)) errs.push('레벨을 선택하세요');
    if (!dates.isValidISO(p.startDate)) errs.push('시작일이 올바르지 않습니다');
    if (!dates.isValidISO(p.examDate)) errs.push('시험일이 올바르지 않습니다');
    if (dates.isValidISO(p.startDate) && dates.isValidISO(p.examDate) && dates.diffDays(p.startDate, p.examDate) < 7) {
      errs.push('시험일은 시작일보다 최소 7일 뒤여야 합니다');
    }
    const m = Number(p.dailyMinutes);
    if (!Number.isFinite(m) || m < 15 || m > 600) errs.push('하루 학습 시간은 15~600분 사이로 입력하세요');
    return errs;
  }

  // 단계 구간 계산: 시작일~시험 전날을 비율로 나눈다
  function buildPhases(profile) {
    const total = dates.diffDays(profile.startDate, profile.examDate); // 시험 전날까지의 일수
    const weak = new Set(profile.weakSections || []);
    const phases = [];
    let cursor = 0;
    PHASES.forEach((ph, i) => {
      let len = i === PHASES.length - 1 ? total - cursor : Math.max(1, Math.round(total * ph.ratio));
      if (cursor + len > total) len = Math.max(0, total - cursor);
      const w = {};
      for (const k of SECTIONS) w[k] = ph.weights[k] * (weak.has(k) ? 1.5 : 1);
      phases.push({
        id: ph.id, name: ph.name, desc: ph.desc,
        start: dates.addDays(profile.startDate, cursor),
        end: dates.addDays(profile.startDate, cursor + len - 1),
        days: len,
        weights: normalize(w),
      });
      cursor += len;
    });
    return { totalDays: total, phases: phases.filter((p) => p.days > 0) };
  }

  function phaseOf(plan, iso) {
    return plan.phases.find((p) => iso >= p.start && iso <= p.end) || null;
  }

  function round5(n) { return Math.max(5, Math.round(n / 5) * 5); }

  // 날짜별 할 일. 결정적(같은 입력 → 같은 출력)이어야 완료 체크가 유지된다.
  function tasksFor(profile, iso, plan) {
    plan = plan || buildPhases(profile);
    if (iso === profile.examDate) {
      return [{ id: `${iso}:exam`, kind: 'exam', section: null, minutes: 0, label: `JLPT ${profile.level} 시험일 — 수험표·신분증·연필·지우개·손목시계 챙기기` }];
    }
    if (iso < profile.startDate || iso > profile.examDate) return [];
    const wd = dates.weekday(iso);
    if ((profile.restDays || []).includes(wd)) return [];
    const ph = phaseOf(plan, iso);
    if (!ph) return [];
    const minutes = Number(profile.dailyMinutes);
    const tasks = [];
    const daysLeft = dates.diffDays(iso, profile.examDate);

    if (daysLeft === 1) {
      return [
        { id: `${iso}:review:all`, kind: 'review', section: null, minutes: Math.min(30, minutes), label: '오답노트 가볍게 훑어보기' },
        { id: `${iso}:vocab:vocab`, kind: 'vocab', section: 'vocab', minutes: 15, label: '헷갈리는 단어 카드만 복습' },
      ];
    }

    const mockDay = (ph.id === 'practice' && wd === 6) || (ph.id === 'final' && daysLeft % 3 === 0);
    if (mockDay) {
      tasks.push({ id: `${iso}:mock`, kind: 'mock', section: null, minutes: round5(minutes * 0.8), label: `${profile.level} 미니 모의고사 (시간 재고 풀기)` });
      tasks.push({ id: `${iso}:review:all`, kind: 'review', section: null, minutes: round5(minutes * 0.2), label: '모의고사 오답 정리' });
      return tasks;
    }

    let budget = minutes;
    if (ph.id === 'final' || wd === 0) {
      const m = round5(minutes * (ph.id === 'final' ? 0.3 : 0.15));
      tasks.push({ id: `${iso}:review:all`, kind: 'review', section: null, minutes: m, label: '오답노트 복습' });
      budget -= m;
    }
    for (const sec of SECTIONS) {
      const m = round5(budget * ph.weights[sec]);
      if (m < 5) continue;
      let label;
      if (sec === 'vocab') {
        const n = Math.max(10, Math.min(60, Math.round(m * 1.2 / 5) * 5));
        tasks.push({ id: `${iso}:vocab:vocab`, kind: 'vocab', section: 'vocab', minutes: m, count: n, label: `단어 카드 ${n}장 학습·복습` });
        const q = Math.max(5, Math.round(m / 4));
        tasks.push({ id: `${iso}:practice:vocab`, kind: 'practice', section: 'vocab', minutes: 0, count: q, label: `문자·어휘 문제 ${q}문항` });
        continue;
      }
      if (sec === 'grammar') {
        const q = Math.max(5, Math.round(m / 2));
        label = ph.id === 'foundation' ? `문법 포인트 학습 + 문법 문제 ${q}문항` : `문법 문제 ${q}문항`;
        tasks.push({ id: `${iso}:practice:grammar`, kind: 'practice', section: 'grammar', minutes: m, count: q, label });
        continue;
      }
      if (sec === 'reading') {
        const q = Math.max(2, Math.round(m / 6));
        tasks.push({ id: `${iso}:practice:reading`, kind: 'practice', section: 'reading', minutes: m, count: q, label: `독해 ${q}문항 (지문 정독 후 풀기)` });
        continue;
      }
      const q = Math.max(2, Math.round(m / 4));
      tasks.push({ id: `${iso}:practice:listening`, kind: 'practice', section: 'listening', minutes: m, count: q, label: `청해 ${q}문항 (음성 듣고 풀기)` });
    }
    return tasks;
  }

  // 시작일~until 까지 할 일 완료율
  function progress(profile, completions, until) {
    const plan = buildPhases(profile);
    let total = 0;
    let done = 0;
    const end = until < profile.examDate ? until : profile.examDate;
    for (let d = profile.startDate; d <= end; d = dates.addDays(d, 1)) {
      const ts = tasksFor(profile, d, plan);
      total += ts.length;
      const c = new Set((completions && completions[d]) || []);
      done += ts.filter((t) => c.has(t.id)).length;
    }
    return { total, done, rate: total ? done / total : 0 };
  }

  return { SECTIONS, SECTION_NAMES, PHASES, validateProfile, buildPhases, phaseOf, tasksFor, progress };
});
