// 사용자 상태 모델: 기본값·정규화(마이그레이션). Electron(main)과 웹(PWA)이 함께 사용한다.
// 동기화를 위해 모든 기록에 ms 타임스탬프 t 를 둔다. (docs/SYNC_DESIGN.md 참고)
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).state = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA_VERSION = 2;

  function randomId(len = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    const g = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null;
    if (g) {
      const buf = new Uint8Array(len);
      g.getRandomValues(buf);
      for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
    } else {
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }

  function defaultSettings() {
    return { theme: 'system', ttsRate: 0.9, newCardsPerDay: 20 };
  }

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      profile: null,
      completions: {},   // { 'YYYY-MM-DD': [taskId] } — 화면·계획용(compMeta에서 파생)
      compMeta: {},      // { 'YYYY-MM-DD|taskId': { on, t } } — 동기화용 원본
      events: [],        // [{ id, date, title, t, deleted? }]
      attempts: [],      // [{ id, qid, level, section, chosen, correct, at, t }]
      wrong: {},         // { qid: { level, count, lastAt, resolved, lastChoice, streak, t } }
      cards: {},         // { 'N3|単語': { ease, interval, reps, due, lapses, last, t } }
      activity: {},      // { 'YYYY-MM-DD': { deviceId: { q, cards, t } } }
      mocks: [],         // [{ id, level, at, correct, total, score, passed, t }]
      resetAt: 0,        // 전체 초기화 시각(이전 기록은 병합 시 버려짐)
      settings: defaultSettings(),           // 기기별 설정(동기화 안 함)
      local: { deviceId: null, deviceName: '', sync: defaultSync() }, // 기기 전용(동기화 안 함)
    };
  }

  function defaultSync() {
    return { token: '', gistId: '', auto: true, lastSyncAt: 0, lastError: '', lastRemoteUpdatedAt: '' };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  // 완료 메타 → 화면용 completions
  function deriveCompletions(compMeta) {
    const out = {};
    const keys = Object.keys(compMeta).sort();
    for (const k of keys) {
      const m = compMeta[k];
      if (!m || !m.on) continue;
      const i = k.indexOf('|');
      const d = k.slice(0, i);
      (out[d] = out[d] || []).push(k.slice(i + 1));
    }
    return out;
  }

  // 어떤 버전의 데이터든 현재 스키마로 맞춘다. 같은 입력이면 같은 결과(결정적)여야 한다(deviceId 생성 제외).
  function normalize(raw) {
    const s = defaultState();
    if (!isObj(raw)) { s.local.deviceId = randomId(); return s; }

    s.profile = isObj(raw.profile) ? Object.assign({}, raw.profile) : null;
    if (s.profile && !Number.isFinite(s.profile.t)) s.profile.t = 0;

    s.settings = Object.assign(defaultSettings(), isObj(raw.settings) ? raw.settings : {});
    const loc = isObj(raw.local) ? raw.local : {};
    const dev = loc.deviceId || randomId();
    s.local = {
      deviceId: dev,
      deviceName: loc.deviceName || '',
      sync: Object.assign(defaultSync(), isObj(loc.sync) ? loc.sync : {}),
    };
    s.resetAt = Number.isFinite(raw.resetAt) ? raw.resetAt : 0;

    // 완료: compMeta 우선, 없으면 v1 completions 에서 생성
    if (isObj(raw.compMeta)) {
      for (const [k, m] of Object.entries(raw.compMeta)) {
        if (isObj(m) && k.includes('|')) s.compMeta[k] = { on: !!m.on, t: Number(m.t) || 0 };
      }
    }
    if (isObj(raw.completions)) {
      for (const [d, ids] of Object.entries(raw.completions)) {
        if (!Array.isArray(ids)) continue;
        for (const id of ids) {
          const k = `${d}|${id}`;
          if (!s.compMeta[k]) s.compMeta[k] = { on: true, t: 0 };
        }
      }
    }
    s.completions = deriveCompletions(s.compMeta);

    // 일정
    if (Array.isArray(raw.events)) {
      s.events = raw.events.filter(isObj).map((e, i) => Object.assign({}, e, {
        id: e.id || `ev-legacy-${dev}-${i}-${e.date}`,
        t: Number(e.t) || 0,
      }));
    }

    // 풀이 기록
    if (Array.isArray(raw.attempts)) {
      s.attempts = raw.attempts.filter(isObj).map((a, i) => Object.assign({}, a, {
        id: a.id || `L-${dev}-${i}-${a.qid}-${a.at}`,
        t: Number(a.t) || 0,
      }));
    }

    if (isObj(raw.wrong)) {
      for (const [k, w] of Object.entries(raw.wrong)) if (isObj(w)) s.wrong[k] = Object.assign({}, w, { t: Number(w.t) || 0 });
    }
    if (isObj(raw.cards)) {
      for (const [k, c] of Object.entries(raw.cards)) if (isObj(c)) s.cards[k] = Object.assign({}, c, { t: Number(c.t) || 0 });
    }

    // 학습량: v1 {q, cards} → v2 {deviceId: {q, cards, t}}
    if (isObj(raw.activity)) {
      for (const [d, v] of Object.entries(raw.activity)) {
        if (!isObj(v)) continue;
        if (typeof v.q === 'number' || typeof v.cards === 'number') {
          s.activity[d] = { [dev]: { q: v.q || 0, cards: v.cards || 0, t: 0 } };
        } else {
          const per = {};
          for (const [dev, c] of Object.entries(v)) if (isObj(c)) per[dev] = { q: c.q || 0, cards: c.cards || 0, t: Number(c.t) || 0 };
          s.activity[d] = per;
        }
      }
    }

    if (Array.isArray(raw.mocks)) {
      s.mocks = raw.mocks.filter(isObj).map((m, i) => Object.assign({}, m, { id: m.id || `M-${dev}-${i}-${m.at}-${m.score}`, t: Number(m.t) || 0 }));
    }
    return s;
  }

  // 날짜별 학습량 합계(모든 기기)
  function activityOn(state, date) {
    const per = state.activity[date];
    const out = { q: 0, cards: 0 };
    if (!per) return out;
    for (const v of Object.values(per)) { out.q += v.q || 0; out.cards += v.cards || 0; }
    return out;
  }

  function activeDays(state) {
    return Object.keys(state.activity).filter((d) => { const a = activityOn(state, d); return a.q + a.cards > 0; });
  }

  // 내보내기용: 기기 전용 값(토큰·Gist ID 등) 전부 제거
  function forExport(state) {
    const c = JSON.parse(JSON.stringify(state));
    delete c.local;
    return c;
  }

  // 상태 안의 가장 큰 타임스탬프(하이브리드 논리 시계용)
  function maxStamp(state) {
    let m = Number(state.resetAt) || 0;
    const see = (x) => { const t = x && Number(x.t); if (t > m) m = t; };
    see(state.profile);
    Object.values(state.compMeta || {}).forEach(see);
    (state.events || []).forEach(see);
    (state.attempts || []).forEach(see);
    Object.values(state.wrong || {}).forEach(see);
    Object.values(state.cards || {}).forEach(see);
    Object.values(state.activity || {}).forEach((per) => Object.values(per).forEach(see));
    (state.mocks || []).forEach(see);
    return m;
  }

  return { SCHEMA_VERSION, defaultState, defaultSettings, defaultSync, normalize, deriveCompletions, activityOn, activeDays, forExport, maxStamp, randomId };
});
