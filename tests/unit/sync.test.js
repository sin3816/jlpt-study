'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const stateMod = require('../../src/core/state');
const sync = require('../../src/core/sync');

const { normalize } = stateMod;
const { merge, stable, applyTo, toPayload, fromPayload, GistClient, syncOnce } = sync;

// ---- 테스트용 기기 상태 ----
function device(id, fill) {
  const s = normalize({ local: { deviceId: id } });
  fill(s);
  return s;
}
const A = () => device('pc', (s) => {
  s.profile = { level: 'N3', startDate: '2026-10-19', examDate: '2026-12-06', dailyMinutes: 60, t: 100 };
  s.compMeta['2026-10-19|t1'] = { on: true, t: 110 };
  s.compMeta['2026-10-19|t2'] = { on: true, t: 120 };
  s.events.push({ id: 'e1', date: '2026-11-01', title: '접수', t: 130 });
  s.attempts.push({ id: 'a1', qid: 'n3-v-001', level: 'N3', section: 'vocab', chosen: 0, correct: true, at: '2026-10-19', t: 140 });
  s.cards['N3|経験'] = { ease: 2.5, interval: 1, reps: 1, due: '2026-10-20', t: 150 };
  s.wrong['n3-g-001'] = { level: 'N3', count: 1, resolved: false, t: 160 };
  s.activity['2026-10-19'] = { pc: { q: 1, cards: 1, t: 170 } };
  s.mocks.push({ id: 'm1', level: 'N3', score: 90, t: 180 });
});
const B = () => device('phone', (s) => {
  s.profile = { level: 'N2', startDate: '2026-10-19', examDate: '2026-12-06', dailyMinutes: 30, t: 50 }; // 더 오래된 프로필
  s.compMeta['2026-10-19|t2'] = { on: false, t: 200 };  // PC가 체크한 걸 폰에서 나중에 해제
  s.compMeta['2026-10-20|t1'] = { on: true, t: 210 };
  s.events.push({ id: 'e1', date: '2026-11-01', title: '접수', t: 220, deleted: true }); // 폰에서 삭제
  s.events.push({ id: 'e2', date: '2026-11-05', title: '모의고사', t: 225 });
  s.attempts.push({ id: 'b1', qid: 'n3-g-002', level: 'N3', section: 'grammar', chosen: 1, correct: false, at: '2026-10-19', t: 230 });
  s.cards['N3|経験'] = { ease: 2.6, interval: 3, reps: 2, due: '2026-10-22', t: 240 };     // 더 최근 복습
  s.activity['2026-10-19'] = { phone: { q: 2, cards: 5, t: 250 } };
  s.mocks.push({ id: 'm2', level: 'N3', score: 100, t: 260 });
});

test('merge: 기기별 변경이 모두 합쳐진다', () => {
  const m = merge(A(), B());
  assert.equal(m.profile.level, 'N3', '프로필은 최근 것(t 큰 쪽)');
  assert.deepEqual(m.compMeta['2026-10-19|t1'], { on: true, t: 110 });
  assert.equal(m.compMeta['2026-10-19|t2'].on, false, '나중의 체크 해제가 이긴다');
  assert.ok(m.compMeta['2026-10-20|t1'].on);
  assert.equal(m.events.find((e) => e.id === 'e1').deleted, true, '삭제 표시 유지');
  assert.ok(m.events.find((e) => e.id === 'e2'));
  assert.deepEqual(m.attempts.map((a) => a.id), ['a1', 'b1'], '풀이 기록은 합집합, 시간순');
  assert.equal(m.cards['N3|経験'].interval, 3, '단어 카드는 최근 복습 기준');
  assert.ok(m.wrong['n3-g-001']);
  assert.deepEqual(Object.keys(m.activity['2026-10-19']).sort(), ['pc', 'phone'], '학습량은 기기별로 보존');
  assert.deepEqual(m.mocks.map((x) => x.id), ['m1', 'm2']);
});

test('merge: 교환·멱등·결합 법칙 (어떤 순서로 동기화해도 같은 결과)', () => {
  const a = A(); const b = B();
  const c = device('tablet', (s) => {
    s.compMeta['2026-10-19|t1'] = { on: false, t: 300 };
    s.attempts.push({ id: 'c1', qid: 'n3-r-001', level: 'N3', section: 'reading', chosen: 2, correct: true, at: '2026-10-20', t: 120 });
    s.profile = { level: 'N1', t: 50 }; // 같은 t 타이브레이크 확인
  });
  assert.equal(stable(merge(a, b)), stable(merge(b, a)), '교환');
  const ab = merge(a, b);
  assert.equal(stable(merge(Object.assign({}, a, ab), ab)), stable(ab), '멱등');
  const left = merge(Object.assign({}, a, merge(a, b)), c);
  const right = merge(a, Object.assign({}, b, merge(b, c)));
  assert.equal(stable(left), stable(right), '결합');
});

test('merge: 초기화(resetAt) 이전 기록은 모든 기기에서 사라진다', () => {
  const a = A();
  const b = B();
  b.resetAt = 1000; b.profile = null;
  b.attempts.push({ id: 'b2', qid: 'n3-v-002', level: 'N3', section: 'vocab', chosen: 0, correct: true, at: '2026-10-21', t: 1001 });
  const m = merge(a, b);
  assert.equal(m.resetAt, 1000);
  assert.equal(m.profile, null);
  assert.deepEqual(m.attempts.map((x) => x.id), ['b2'], '초기화 이후 기록만 남음');
  assert.deepEqual(m.compMeta, {});
  assert.deepEqual(m.activity, {});
});

test('normalize: v1 데이터 마이그레이션', () => {
  const v1 = {
    version: 1,
    profile: { level: 'N3' },
    completions: { '2026-10-19': ['x', 'y'] },
    events: [{ id: 'ev-1', date: '2026-10-20', title: 'a' }],
    attempts: [{ qid: 'q1', level: 'N3', section: 'vocab', chosen: 0, correct: true, at: '2026-10-19' }],
    activity: { '2026-10-19': { q: 3, cards: 2 } },
    mocks: [{ level: 'N3', at: '2026-10-19', score: 80 }],
    settings: { theme: 'dark' },
  };
  const s = normalize(v1);
  assert.equal(s.profile.t, 0);
  assert.deepEqual(s.compMeta['2026-10-19|x'], { on: true, t: 0 });
  assert.deepEqual(s.completions['2026-10-19'], ['x', 'y']);
  assert.ok(s.attempts[0].id);
  assert.deepEqual(stateMod.activityOn(s, '2026-10-19'), { q: 3, cards: 2 });
  assert.ok(s.mocks[0].id);
  assert.equal(s.settings.theme, 'dark');
  assert.ok(s.local.deviceId);
  // 결정적: 같은 입력 → 같은 기록 ID
  assert.equal(normalize(v1).attempts[0].id, s.attempts[0].id);
});

test('applyTo: 객체 참조를 유지하고 completions 를 다시 만든다', () => {
  const local = A();
  const ref = local;
  applyTo(local, merge(local, B()));
  assert.equal(local, ref);
  assert.deepEqual(local.completions['2026-10-19'], ['t1']);
  assert.deepEqual(local.completions['2026-10-20'], ['t1']);
  assert.equal(local.local.deviceId, 'pc', '기기 전용 값은 그대로');
});

test('payload: 압축·복원 왕복', () => {
  const s = merge(A(), B());
  const full = Object.assign(normalize({ local: { deviceId: 'pc' } }), s);
  const p = toPayload(full, 'pc');
  assert.ok(Array.isArray(p.data.attempts[0]));
  assert.equal(p.data.local, undefined, '기기 전용 값(토큰 등)은 올리지 않음');
  assert.equal(p.data.settings, undefined);
  const back = fromPayload(JSON.parse(JSON.stringify(p)));
  assert.equal(stable(merge(back, back)), stable(merge(s, s)));
  assert.throws(() => fromPayload({ app: 'other' }));
});

// ---- 모의 Gist 서버(메모리) ----
function fakeGitHub() {
  const gists = {};
  let n = 0;
  let clock = 0;
  const calls = [];
  async function http(url, opts) {
    const u = new URL(url);
    calls.push(`${opts.method} ${u.pathname}`);
    if (u.hostname === 'raw.example') return { status: 200, body: gists[u.pathname.slice(1)].files['jlpt-sync.json'].content };
    if (opts.headers.Authorization !== 'Bearer good') return { status: 401, body: '{}' };
    const body = opts.body ? JSON.parse(opts.body) : null;
    const now = () => `2026-10-19T00:00:${String(++clock).padStart(2, '0')}Z`;
    if (opts.method === 'GET' && u.pathname === '/gists') {
      return { status: 200, body: JSON.stringify(u.searchParams.get('page') === '1' ? Object.values(gists).map((g) => ({ id: g.id, files: g.files })) : []) };
    }
    if (opts.method === 'POST' && u.pathname === '/gists') {
      const id = `g${++n}`;
      gists[id] = { id, files: body.files, updated_at: now() };
      return { status: 201, body: JSON.stringify(gists[id]) };
    }
    const id = u.pathname.split('/')[2];
    if (!gists[id]) return { status: 404, body: '{}' };
    if (opts.method === 'GET') {
      const f = gists[id].files['jlpt-sync.json'];
      const big = f.content.length > 1500; // 1MB 대신 작은 값으로 잘림 흉내
      return { status: 200, body: JSON.stringify({ id, updated_at: gists[id].updated_at, files: { 'jlpt-sync.json': big ? { content: f.content.slice(0, 100), truncated: true, raw_url: `https://raw.example/${id}` } : { content: f.content } } }) };
    }
    if (opts.method === 'PATCH') {
      Object.assign(gists[id].files, body.files);
      gists[id].updated_at = now();
      return { status: 200, body: JSON.stringify(gists[id]) };
    }
    return { status: 405, body: '' };
  }
  return { http, gists, calls };
}

test('syncOnce: PC 첫 연결 → Gist 생성, 폰 연결 → 자동 발견·병합, 다시 PC → 폰 변경 수신', async () => {
  const gh = fakeGitHub();
  const pc = A();
  const phone = B();
  const r1 = await syncOnce(pc, new GistClient('good', gh.http));
  assert.ok(r1.gistId);
  assert.equal(r1.pushed, true);
  assert.equal(Object.keys(gh.gists).length, 1);

  const r2 = await syncOnce(phone, new GistClient('good', gh.http)); // gistId 모름 → 찾아냄
  assert.equal(r2.gistId, r1.gistId);
  assert.equal(r2.localChanged, true);
  assert.equal(phone.profile.level, 'N3', '폰이 PC의 계획을 받음');
  assert.ok(phone.attempts.some((a) => a.id === 'a1'));
  assert.ok(gh.calls.some((c) => c === 'GET /gists'), '목록에서 찾음');

  const r3 = await syncOnce(pc, new GistClient('good', gh.http), { gistId: r1.gistId });
  assert.equal(r3.localChanged, true);
  assert.equal(pc.compMeta['2026-10-19|t2'].on, false, 'PC가 폰의 체크 해제를 받음');
  assert.equal(sync.fingerprint(pc), sync.fingerprint(phone), '두 기기 수렴');

  const r4 = await syncOnce(pc, new GistClient('good', gh.http), { gistId: r1.gistId });
  assert.equal(r4.pushed, false, '변경 없으면 올리지 않음');
  assert.equal(r4.localChanged, false);
});

test('syncOnce: 잘린 파일은 raw_url 로 받기, 잘못된 토큰은 오류', async () => {
  const gh = fakeGitHub();
  const pc = A();
  for (let i = 0; i < 50; i++) pc.attempts.push({ id: `x${i}`, qid: 'n3-v-001', level: 'N3', section: 'vocab', chosen: 0, correct: true, at: '2026-10-19', t: 500 + i });
  const r1 = await syncOnce(pc, new GistClient('good', gh.http));
  const phone = B();
  await syncOnce(phone, new GistClient('good', gh.http), { gistId: r1.gistId });
  assert.equal(phone.attempts.length, 52);
  await assert.rejects(syncOnce(B(), new GistClient('bad', gh.http)), /토큰/);
});

test('syncOnce: Gist 가 삭제됐으면 새로 만든다', async () => {
  const gh = fakeGitHub();
  const r = await syncOnce(A(), new GistClient('good', gh.http), { gistId: 'gone' });
  assert.ok(r.gistId && r.gistId !== 'gone');
});
