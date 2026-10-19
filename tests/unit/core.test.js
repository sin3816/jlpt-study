'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dates = require('../../src/core/dates');
const srs = require('../../src/core/srs');
const planner = require('../../src/core/planner');
const quiz = require('../../src/core/quiz');
const { Store, defaultState } = require('../../src/main/store');
const { validateLevel } = require('../../scripts/validate-content');

test('dates: 7월·12월 첫째 일요일 계산', () => {
  assert.equal(dates.firstSundayOf(2026, 7), '2026-07-05');
  assert.equal(dates.firstSundayOf(2026, 12), '2026-12-06');
  assert.equal(dates.firstSundayOf(2027, 7), '2027-07-04');
  assert.deepEqual(dates.upcomingExamDates('2026-10-19', 3), ['2026-12-06', '2027-07-04', '2027-12-05']);
  assert.deepEqual(dates.upcomingExamDates('2026-12-06', 1), ['2027-07-04']);
});

test('dates: 덧셈·차이·유효성', () => {
  assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dates.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(dates.diffDays('2026-10-19', '2026-12-06'), 48);
  assert.equal(dates.isValidISO('2026-02-30'), false);
  assert.equal(dates.isValidISO('2026-02-28'), true);
  const m = dates.monthMatrix(2026, 10);
  assert.equal(m.length, 6);
  assert.equal(m[0][0].iso, '2026-09-27'); // 10/1은 목요일
});

test('srs: 모름은 오늘 다시, 쉬움은 간격 증가', () => {
  let c = srs.review(null, 0, '2026-10-19');
  assert.equal(c.due, '2026-10-19');
  assert.equal(c.lapses, 1);
  c = srs.review(null, 2, '2026-10-19');
  assert.equal(c.due, '2026-10-20');
  const c2 = srs.review(c, 2, '2026-10-20');
  assert.equal(c2.interval, 4);
  const c3 = srs.review(c2, 3, '2026-10-24');
  assert.ok(c3.interval > 4);
  assert.throws(() => srs.review(null, 5, '2026-10-19'));
});

test('srs: 오늘 볼 카드 선택', () => {
  const words = [{ word: 'a' }, { word: 'b' }, { word: 'c' }, { word: 'd' }];
  const cards = { a: { due: '2026-10-18' }, b: { due: '2026-10-25' } };
  const r = srs.pickToday(words, cards, '2026-10-19', 1);
  assert.deepEqual(r.due.map((w) => w.word), ['a']);
  assert.deepEqual(r.fresh.map((w) => w.word), ['c']);
});

const profile = { level: 'N3', startDate: '2026-10-19', examDate: '2026-12-06', dailyMinutes: 60, weakSections: ['listening'], restDays: [] };

test('planner: 프로필 검증', () => {
  assert.deepEqual(planner.validateProfile(profile), []);
  assert.ok(planner.validateProfile(Object.assign({}, profile, { examDate: '2026-10-20' })).length);
  assert.ok(planner.validateProfile(Object.assign({}, profile, { dailyMinutes: 5 })).length);
  assert.ok(planner.validateProfile(Object.assign({}, profile, { level: 'N9' })).length);
});

test('planner: 단계가 시작일~시험 전날을 빈틈없이 덮는다', () => {
  const plan = planner.buildPhases(profile);
  assert.equal(plan.totalDays, 48);
  assert.equal(plan.phases[0].start, '2026-10-19');
  assert.equal(plan.phases[plan.phases.length - 1].end, '2026-12-05');
  for (let i = 1; i < plan.phases.length; i++) {
    assert.equal(plan.phases[i].start, dates.addDays(plan.phases[i - 1].end, 1));
  }
  assert.equal(plan.phases.reduce((s, p) => s + p.days, 0), 48);
  for (const p of plan.phases) {
    const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  }
  // 약점(청해) 가중치가 기본보다 커야 함
  const base = planner.buildPhases(Object.assign({}, profile, { weakSections: [] }));
  assert.ok(plan.phases[0].weights.listening > base.phases[0].weights.listening);
});

test('planner: 짧은 기간(7일)도 동작', () => {
  const p = Object.assign({}, profile, { startDate: '2026-11-29', examDate: '2026-12-06' });
  const plan = planner.buildPhases(p);
  assert.equal(plan.phases.reduce((s, x) => s + x.days, 0), 7);
  for (let d = p.startDate; d < p.examDate; d = dates.addDays(d, 1)) {
    assert.ok(planner.tasksFor(p, d, plan).length > 0, d);
  }
});

test('planner: 날짜별 할 일은 결정적이고 고유 id를 가진다', () => {
  const a = planner.tasksFor(profile, '2026-10-20');
  const b = planner.tasksFor(profile, '2026-10-20');
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((t) => t.id)).size, a.length);
  assert.ok(a.some((t) => t.kind === 'vocab'));
  assert.deepEqual(planner.tasksFor(profile, '2026-10-18'), []);
  assert.equal(planner.tasksFor(profile, '2026-12-06')[0].kind, 'exam');
  assert.deepEqual(planner.tasksFor(profile, '2026-12-07'), []);
});

test('planner: 쉬는 요일에는 할 일이 없다', () => {
  const p = Object.assign({}, profile, { restDays: [1] }); // 월요일
  assert.equal(dates.weekday('2026-10-19'), 1);
  assert.deepEqual(planner.tasksFor(p, '2026-10-19'), []);
});

test('planner: 실전 단계 토요일은 모의고사', () => {
  const plan = planner.buildPhases(profile);
  const prac = plan.phases.find((p) => p.id === 'practice');
  let d = prac.start;
  while (dates.weekday(d) !== 6) d = dates.addDays(d, 1);
  if (d <= prac.end) assert.ok(planner.tasksFor(profile, d, plan).some((t) => t.kind === 'mock'));
});

test('planner: 진행률', () => {
  const ts = planner.tasksFor(profile, '2026-10-19');
  const r0 = planner.progress(profile, {}, '2026-10-19');
  assert.equal(r0.done, 0);
  assert.equal(r0.total, ts.length);
  const r1 = planner.progress(profile, { '2026-10-19': ts.map((t) => t.id) }, '2026-10-19');
  assert.equal(r1.rate, 1);
});

const sample = [
  { id: 'x-v-1', section: 'vocab', answer: 0, passage: undefined },
  { id: 'x-v-2', section: 'vocab', answer: 1 },
  { id: 'x-g-1', section: 'grammar', answer: 2 },
  { id: 'x-r-1', section: 'reading', answer: 3, passage: 'P1' },
  { id: 'x-r-2', section: 'reading', answer: 0, passage: 'P1' },
  { id: 'x-l-1', section: 'listening', answer: 1 },
];

test('quiz: 출제·지문 묶기·시드 재현', () => {
  const a = quiz.buildSet(sample, { count: 6, seed: 42 });
  const b = quiz.buildSet(sample, { count: 6, seed: 42 });
  assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
  const i = a.findIndex((q) => q.passage === 'P1');
  assert.equal(a[i + 1].passage, 'P1');
  assert.ok(quiz.buildSet(sample, { section: 'vocab', count: 10, seed: 1 }).every((q) => q.section === 'vocab'));
  const wrong = quiz.buildSet(sample, { mode: 'wrong', count: 10 }, { wrong: { 'x-g-1': { resolved: false }, 'x-v-1': { resolved: true } } });
  assert.deepEqual(wrong.map((q) => q.id), ['x-g-1']);
  const unseen = quiz.buildSet(sample, { mode: 'unseen', count: 10, seed: 3 }, { seen: new Set(['x-v-1', 'x-v-2', 'x-g-1', 'x-r-1', 'x-r-2']) });
  assert.deepEqual(unseen.map((q) => q.id), ['x-l-1']);
});

test('quiz: 채점·환산 점수', () => {
  const g = quiz.grade(sample, [0, 1, 2, 3, 0, 1]);
  assert.equal(g.correct, 6);
  const est = quiz.estimateScore('N3', g.bySection);
  assert.equal(est.total, 180);
  assert.equal(est.passed, true);
  const g2 = quiz.grade(sample, [1, 0, 0, 0, 1, 0]);
  const est2 = quiz.estimateScore('N3', g2.bySection);
  assert.equal(est2.total, 0);
  assert.equal(est2.passed, false);
  const est5 = quiz.estimateScore('N5', g.bySection);
  assert.equal(est5.parts.length, 2);
  assert.equal(est5.parts[0].max, 120);
});

test('quiz: 연속 학습일', () => {
  assert.equal(quiz.streak(['2026-10-17', '2026-10-18', '2026-10-19'], '2026-10-19'), 3);
  assert.equal(quiz.streak(['2026-10-17', '2026-10-18'], '2026-10-19'), 2);
  assert.equal(quiz.streak(['2026-10-16'], '2026-10-19'), 0);
});

test('store: 저장·로드·손상 복구', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-'));
  const st = new Store(dir);
  const first = st.load();
  assert.equal(first.profile, null);
  assert.ok(first.local.deviceId, '기기 ID 생성');
  assert.equal(st.load().local.deviceId, first.local.deviceId, '기기 ID 유지');
  const s = defaultState();
  s.profile = profile;
  st.save(s);
  st.save(s); // 백업 생성
  assert.deepEqual(st.load().profile, Object.assign({}, profile, { t: 0 }));
  fs.writeFileSync(path.join(dir, 'jlpt-data.json'), '{broken');
  assert.deepEqual(st.load().profile, Object.assign({}, profile, { t: 0 })); // 백업에서 복구
});

test('content: 모든 레벨 파일이 스키마를 통과한다', () => {
  const dir = path.join(__dirname, '..', '..', 'data', 'levels');
  for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1']) {
    const f = path.join(dir, `${lv}.json`);
    const r = validateLevel(JSON.parse(fs.readFileSync(f, 'utf8')), f);
    assert.deepEqual(r.errors, [], lv);
  }
});
