// 동기화 코어: 병합(merge)·전송 형식(payload)·GitHub Gist 클라이언트.
// merge 는 교환·결합·멱등 법칙을 만족해야 한다 → 어떤 순서로 몇 번 동기화해도 모든 기기가 같은 결과로 수렴.
(function (root, factory) {
  const st = root.JLPT && root.JLPT.state ? root.JLPT.state : (typeof require === 'function' ? require('./state') : null);
  const mod = factory(st);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).sync = mod;
})(typeof self !== 'undefined' ? self : this, function (stateMod) {
  'use strict';

  const FILE = 'jlpt-sync.json';
  const DESC = 'JLPT 스터디 동기화 데이터 (jlpt-study-sync)';
  const MAX_ATTEMPTS = 20000;
  const SYNCED = ['profile', 'compMeta', 'events', 'attempts', 'wrong', 'cards', 'activity', 'mocks', 'resetAt'];

  // 결정적 비교용 직렬화(키 정렬)
  function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
    return JSON.stringify(v === undefined ? null : v);
  }

  // LWW: t 큰 쪽, 같으면 직렬화 문자열 큰 쪽(결정적 타이브레이크)
  function lww(a, b) {
    if (!a) return b;
    if (!b) return a;
    const ta = Number(a.t) || 0; const tb = Number(b.t) || 0;
    if (ta !== tb) return ta > tb ? a : b;
    return stable(a) >= stable(b) ? a : b;
  }

  function mergeMap(a, b, resetAt) {
    const out = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
      const v = lww((a || {})[k], (b || {})[k]);
      if (v && (Number(v.t) || 0) >= resetAt) out[k] = v;
    }
    return out;
  }

  function mergeById(a, b, resetAt, cap) {
    const m = new Map();
    for (const x of [...(a || []), ...(b || [])]) m.set(x.id, lww(m.get(x.id), x));
    let arr = [...m.values()].filter((x) => (Number(x.t) || 0) >= resetAt);
    arr.sort((x, y) => (x.t - y.t) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    if (cap && arr.length > cap) arr = arr.slice(arr.length - cap);
    return arr;
  }

  // 두 상태(정규화된 것)의 동기화 대상 필드를 병합한 결과(동기화 필드만 포함)
  function merge(a, b) {
    const resetAt = Math.max(Number(a.resetAt) || 0, Number(b.resetAt) || 0);
    let profile = lww(a.profile, b.profile);
    if (profile && (Number(profile.t) || 0) < resetAt) profile = null;

    const activity = {};
    for (const d of new Set([...Object.keys(a.activity || {}), ...Object.keys(b.activity || {})])) {
      const per = mergeMap((a.activity || {})[d], (b.activity || {})[d], resetAt);
      if (Object.keys(per).length) activity[d] = per;
    }
    return {
      resetAt,
      profile,
      compMeta: mergeMap(a.compMeta, b.compMeta, resetAt),
      events: mergeById(a.events, b.events, resetAt),
      attempts: mergeById(a.attempts, b.attempts, resetAt, MAX_ATTEMPTS),
      wrong: mergeMap(a.wrong, b.wrong, resetAt),
      cards: mergeMap(a.cards, b.cards, resetAt),
      activity,
      mocks: mergeById(a.mocks, b.mocks, resetAt),
    };
  }

  function pick(state) {
    const o = {};
    for (const k of SYNCED) o[k] = state[k];
    return o;
  }

  function fingerprint(state) { return stable(pick(state)); }

  // 병합 결과를 로컬 상태에 반영(객체 참조 유지 — 진행 중인 화면이 같은 state 를 계속 쓰도록)
  function applyTo(local, merged) {
    for (const k of SYNCED) local[k] = merged[k];
    local.completions = stateMod.deriveCompletions(local.compMeta);
    return local;
  }

  // ---- 전송 형식: 풀이 기록은 배열로 압축 ----
  const SEC = { vocab: 'v', grammar: 'g', reading: 'r', listening: 'l' };
  const SEC_R = { v: 'vocab', g: 'grammar', r: 'reading', l: 'listening' };

  function toPayload(state, deviceId) {
    const p = pick(state);
    p.attempts = p.attempts.map((a) => [a.id, a.qid, a.level, SEC[a.section] || a.section, a.chosen, a.correct ? 1 : 0, a.at, a.t]);
    return { app: 'jlpt-study', format: 1, savedAt: Date.now(), savedBy: deviceId || '', data: p };
  }

  function fromPayload(payload) {
    if (!payload || payload.app !== 'jlpt-study' || !payload.data) throw new Error('JLPT 스터디 동기화 데이터가 아닙니다');
    if (payload.format > 1) throw new Error('앱보다 새 버전의 동기화 데이터입니다. 앱을 업데이트하세요');
    const d = Object.assign({}, payload.data);
    d.attempts = (d.attempts || []).map((r) => (Array.isArray(r)
      ? { id: r[0], qid: r[1], level: r[2], section: SEC_R[r[3]] || r[3], chosen: r[4], correct: !!r[5], at: r[6], t: r[7] }
      : r));
    // 정규화(누락 필드 보정) 후 동기화 필드만
    return pick(stateMod.normalize(Object.assign({ local: { deviceId: 'remote' } }, d)));
  }

  // ---- GitHub Gist 클라이언트 ----
  // http(url, {method, headers, body}) → Promise<{ status, body(text) }>
  class GistClient {
    constructor(token, http, base = 'https://api.github.com') {
      this.token = token; this.http = http; this.base = base.replace(/\/$/, '');
    }

    async req(method, path, body) {
      const r = await this.http(this.base + path, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json = null;
      try { json = r.body ? JSON.parse(r.body) : null; } catch (_) { /* noop */ }
      if (r.status === 401) throw new Error('토큰이 올바르지 않거나 만료되었습니다 (401)');
      if (r.status === 403) throw new Error('권한이 없거나 요청 한도를 넘었습니다 (403). 토큰에 Gists 쓰기 권한이 있는지 확인하세요');
      if (r.status === 404) { const e = new Error('동기화 저장소를 찾을 수 없습니다 (404)'); e.code = 404; throw e; }
      if (r.status < 200 || r.status >= 300) throw new Error(`GitHub 오류 (${r.status})`);
      return json;
    }

    async findGist() {
      const found = [];
      for (let page = 1; page <= 10; page++) {
        const list = await this.req('GET', `/gists?per_page=100&page=${page}`);
        if (!Array.isArray(list) || !list.length) break;
        found.push(...list.filter((x) => x.files && x.files[FILE]));
        if (list.length < 100) break;
      }
      // 여러 개면 가장 먼저 만들어진 것(모든 기기가 같은 것을 고르도록)
      found.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)));
      return found.length ? found[0].id : null;
    }

    async createGist(payload) {
      const g = await this.req('POST', '/gists', { description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(payload) } } });
      return { id: g.id, updatedAt: g.updated_at || '' };
    }

    async pull(id) {
      const g = await this.req('GET', `/gists/${id}`);
      const f = g.files && g.files[FILE];
      if (!f) { const e = new Error('동기화 파일이 없습니다'); e.code = 404; throw e; }
      let text = f.content;
      if (f.truncated && f.raw_url) {
        const r = await this.http(f.raw_url, { method: 'GET', headers: {} });
        if (r.status !== 200) throw new Error(`원본 파일을 받지 못했습니다 (${r.status})`);
        text = r.body;
      }
      return { payload: JSON.parse(text), updatedAt: g.updated_at || '' };
    }

    async push(id, payload) {
      const g = await this.req('PATCH', `/gists/${id}`, { files: { [FILE]: { content: JSON.stringify(payload) } } });
      return { updatedAt: g.updated_at || '' };
    }
  }

  // 한 번의 동기화: 받기 → 병합 → (바뀌었으면) 올리기 → 로컬 반영
  // 반환: { gistId, localChanged, pushed, updatedAt, dirty }
  async function syncOnce(state, client, opts = {}) {
    const deviceId = state.local.deviceId;
    let gistId = opts.gistId || '';
    let remote = null;
    let updatedAt = '';
    const tryPull = async (id) => {
      try {
        const r = await client.pull(id);
        remote = fromPayload(r.payload);
        updatedAt = r.updatedAt;
        return id;
      } catch (e) {
        if (e.code !== 404) throw e;
        return '';
      }
    };
    if (gistId) gistId = await tryPull(gistId);
    if (!gistId) { // 처음 연결했거나 저장된 Gist 가 사라짐 → 계정에서 다시 찾기
      const found = await client.findGist();
      if (found) gistId = await tryPull(found);
    }
    const localFp = stable(merge(state, state));
    const merged = remote ? merge(state, remote) : merge(state, state);
    const mergedFp = stable(merged);
    const remoteFp = remote ? stable(remote) : null;
    let pushed = false;
    if (!gistId) {
      const c = await client.createGist(toPayload(Object.assign({}, state, merged), deviceId));
      gistId = c.id; updatedAt = c.updatedAt; pushed = true;
    } else if (mergedFp !== remoteFp) {
      const r = await client.push(gistId, toPayload(Object.assign({}, state, merged), deviceId));
      updatedAt = r.updatedAt; pushed = true;
    }
    // 업로드하는 동안 로컬에 새 기록이 생겼을 수 있으므로 지금 상태와 한 번 더 합친다(멱등이라 안전)
    const final = merge(state, merged);
    applyTo(state, final);
    const dirty = stable(final) !== mergedFp; // true 면 아직 올리지 않은 변경이 있음 → 곧 다시 동기화
    return { gistId, localChanged: mergedFp !== localFp, pushed, updatedAt, dirty };
  }

  return { FILE, DESC, SYNCED, stable, lww, merge, pick, fingerprint, applyTo, toPayload, fromPayload, GistClient, syncOnce };
});
