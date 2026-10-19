// 사용자 데이터 저장소: userData/jlpt-data.json 에 원자적 쓰기(임시파일→rename) + 백업 1개 유지
'use strict';
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    profile: null,
    completions: {},
    events: [],
    attempts: [],
    wrong: {},
    cards: {},
    activity: {},
    mocks: [],
    settings: { theme: 'system', ttsRate: 0.9, newCardsPerDay: 20 },
  };
}

function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const out = Object.assign(base, raw);
  out.settings = Object.assign(defaultState().settings, raw.settings || {});
  out.version = SCHEMA_VERSION;
  return out;
}

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'jlpt-data.json');
    this.backup = path.join(dir, 'jlpt-data.backup.json');
    fs.mkdirSync(dir, { recursive: true });
  }

  load() {
    for (const f of [this.file, this.backup]) {
      try {
        if (fs.existsSync(f)) return migrate(JSON.parse(fs.readFileSync(f, 'utf8')));
      } catch (_) { /* 손상 시 백업으로 */ }
    }
    return defaultState();
  }

  save(state) {
    const data = JSON.stringify(migrate(state), null, 2);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, data, 'utf8');
    if (fs.existsSync(this.file)) {
      try { fs.copyFileSync(this.file, this.backup); } catch (_) { /* ignore */ }
    }
    fs.renameSync(tmp, this.file);
    return true;
  }
}

module.exports = { Store, defaultState, migrate, SCHEMA_VERSION };
