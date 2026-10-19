#!/usr/bin/env node
// PostToolUse 훅: 파일을 고친 직후 자동 검증.
//  - data/levels/*.json → 콘텐츠 검증기
//  - src/core, src/main → 단위 테스트(병합·동기화 포함)
// 실패하면 exit 2 + stderr 로 Claude 에게 오류를 돌려줘 바로 고치게 한다.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(input).tool_input || {}).file_path || ''; } catch (_) { process.exit(0); }
  const root = process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..');
  const rel = path.relative(root, file).split(path.sep).join('/');

  let cmd = null;
  if (/^data\/levels\/n[1-5]\.json$/.test(rel)) cmd = ['node', ['scripts/validate-content.js', rel]];
  else if (/^src\/(core|main)\/.+\.js$/.test(rel) || /^tests\/unit\/.+\.js$/.test(rel)) {
    const files = fs.readdirSync(path.join(root, 'tests/unit')).filter((f) => f.endsWith('.test.js')).map((f) => `tests/unit/${f}`);
    cmd = ['node', ['--test', ...files]];
  }
  if (!cmd) process.exit(0);

  const r = spawnSync(cmd[0], cmd[1], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`[자동 검증 실패] ${rel}\n${(r.stdout || '').slice(-3000)}${(r.stderr || '').slice(-2000)}\n`);
    process.exit(2);
  }
  process.exit(0);
});
