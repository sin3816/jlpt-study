// 사용자 데이터 저장소: userData/jlpt-data.json 에 원자적 쓰기(임시파일→rename) + 백업 1개 유지
'use strict';
const fs = require('fs');
const path = require('path');
const { defaultState, normalize, SCHEMA_VERSION } = require('../core/state');

const migrate = normalize;

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'jlpt-data.json');
    this.backup = path.join(dir, 'jlpt-data.backup.json');
    fs.mkdirSync(dir, { recursive: true });
  }

  load() {
    for (const f of [this.file, this.backup]) {
      try {
        if (fs.existsSync(f)) return normalize(JSON.parse(fs.readFileSync(f, 'utf8')));
      } catch (_) { /* 손상 시 백업으로 */ }
    }
    const s = normalize(null);
    this.save(s); // deviceId 고정
    return s;
  }

  save(state) {
    const data = JSON.stringify(state, null, 1);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, data, 'utf8');
    if (fs.existsSync(this.file)) {
      try { fs.copyFileSync(this.file, this.backup); } catch (_) { /* ignore */ }
    }
    fs.renameSync(tmp, this.file);
    return true;
  }
}

module.exports = { Store, defaultState, migrate, normalize, SCHEMA_VERSION };
