#!/usr/bin/env node
// 콘텐츠 검증기: data/levels/*.json 이 docs/CONTENT_SCHEMA.md 규칙을 지키는지 확인한다.
// 사용: node scripts/validate-content.js [파일...]  (인자 없으면 전체 검사)
'use strict';
const fs = require('fs');
const path = require('path');

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SECTION_RULES = {
  vocab: { min: 12, types: ['kanji-reading', 'orthography', 'context', 'paraphrase', 'usage'], code: 'v' },
  grammar: { min: 10, types: ['grammar-form', 'sentence-order', 'text-grammar'], code: 'g' },
  reading: { min: 5, types: ['reading'], code: 'r' },
  listening: { min: 4, types: ['listening'], code: 'l' },
};

function isStr(v) { return typeof v === 'string' && v.trim().length > 0; }

function validateLevel(data, fileName) {
  const errors = [];
  const warn = [];
  const e = (m) => errors.push(m);
  const expected = path.basename(fileName, '.json').toUpperCase();

  if (!LEVELS.includes(data.level)) e(`level 값이 잘못됨: ${data.level}`);
  if (data.level !== expected) e(`level(${data.level})과 파일명(${expected}) 불일치`);
  const lv = String(data.level || '').toLowerCase();

  // guide
  const g = data.guide || {};
  if (!isStr(g.summary)) e('guide.summary 없음');
  if (!Number.isFinite(g.targetVocab)) e('guide.targetVocab 숫자 아님');
  if (!Number.isFinite(g.targetKanji)) e('guide.targetKanji 숫자 아님');
  if (!isStr(g.studyHours)) e('guide.studyHours 없음');
  const secIds = (g.sections || []).map((s) => s.id);
  for (const id of Object.keys(SECTION_RULES)) {
    if (!secIds.includes(id)) e(`guide.sections에 ${id} 없음`);
  }
  (g.sections || []).forEach((s, i) => {
    if (!isStr(s.name)) e(`guide.sections[${i}].name 없음`);
    if (!Array.isArray(s.tips) || s.tips.length < 3) e(`guide.sections[${i}].tips 3개 미만`);
  });
  if (!Array.isArray(g.strategies) || g.strategies.length < 4) e('guide.strategies 4개 미만');
  if (!Array.isArray(g.grammarPoints) || g.grammarPoints.length < 12) e('guide.grammarPoints 12개 미만');
  (g.grammarPoints || []).forEach((p, i) => {
    for (const k of ['pattern', 'meaning', 'example', 'exampleKo']) if (!isStr(p[k])) e(`grammarPoints[${i}].${k} 없음`);
  });

  // vocab
  const vocab = data.vocab || [];
  if (vocab.length < 40) e(`vocab ${vocab.length}개 (40개 이상 필요)`);
  const words = new Set();
  vocab.forEach((v, i) => {
    for (const k of ['word', 'reading', 'meaning', 'example', 'exampleKo']) if (!isStr(v[k])) e(`vocab[${i}].${k} 없음`);
    if (words.has(v.word)) e(`vocab 중복 단어: ${v.word}`);
    words.add(v.word);
  });

  // questions
  const qs = data.questions || [];
  const ids = new Set();
  const counts = { vocab: 0, grammar: 0, reading: 0, listening: 0 };
  const answerDist = [0, 0, 0, 0];
  qs.forEach((q, i) => {
    const where = `questions[${i}](${q.id || '?'})`;
    const rule = SECTION_RULES[q.section];
    if (!rule) { e(`${where}: section 잘못됨 ${q.section}`); return; }
    counts[q.section]++;
    const idRe = new RegExp(`^${lv}-${rule.code}-\\d{3}$`);
    if (!idRe.test(q.id || '')) e(`${where}: id 형식 오류 (기대: ${lv}-${rule.code}-000)`);
    if (ids.has(q.id)) e(`${where}: id 중복`);
    ids.add(q.id);
    if (!rule.types.includes(q.type)) e(`${where}: type ${q.type}은 ${q.section}에 허용되지 않음`);
    if (!isStr(q.prompt)) e(`${where}: prompt 없음`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4) e(`${where}: choices는 정확히 4개`);
    else {
      if (q.choices.some((c) => !isStr(c))) e(`${where}: 빈 선택지`);
      if (new Set(q.choices).size !== 4) e(`${where}: 선택지 중복`);
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) e(`${where}: answer는 0~3 정수`);
    else answerDist[q.answer]++;
    if (!isStr(q.explanation)) e(`${where}: explanation 없음`);
    if (q.section === 'reading' && !isStr(q.passage)) e(`${where}: reading은 passage 필수`);
    if (q.section === 'listening' && !isStr(q.audioScript)) e(`${where}: listening은 audioScript 필수`);
    if (q.tags !== undefined && !Array.isArray(q.tags)) e(`${where}: tags는 배열`);
  });
  for (const [sec, rule] of Object.entries(SECTION_RULES)) {
    if (counts[sec] < rule.min) e(`${sec} 문항 ${counts[sec]}개 (최소 ${rule.min})`);
  }
  if (qs.length >= 8 && Math.max(...answerDist) > qs.length * 0.45) {
    warn(`정답 위치 쏠림: ${answerDist.join('/')}`);
  }
  return { errors, warn, counts, total: qs.length, vocab: vocab.length };
}

function main() {
  const dir = path.join(__dirname, '..', 'data', 'levels');
  let files = process.argv.slice(2).filter((f) => f.endsWith('.json'));
  if (files.length === 0) files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
  let failed = false;
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (err) {
      console.error(`✗ ${path.basename(f)}: JSON 파싱 실패 — ${err.message}`); failed = true; continue;
    }
    const r = validateLevel(data, f);
    if (r.errors.length) {
      failed = true;
      console.error(`✗ ${path.basename(f)}: 오류 ${r.errors.length}건`);
      r.errors.slice(0, 40).forEach((m) => console.error(`   - ${m}`));
    } else {
      const c = r.counts;
      console.log(`✓ ${path.basename(f)}: 문항 ${r.total} (어휘 ${c.vocab}/문법 ${c.grammar}/독해 ${c.reading}/청해 ${c.listening}), 단어 ${r.vocab}`);
    }
    r.warn.forEach((m) => console.warn(`   ! ${m}`));
  }
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { validateLevel };
