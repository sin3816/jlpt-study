# JLPT 스터디 — Claude 작업 가이드 (하네스)

JLPT N5~N1 학습 계획·일정·가이드·연습문제·단어장을 제공하는 Windows 데스크톱 앱(Electron).
이 파일은 Claude Code가 이 저장소에서 일할 때 지켜야 할 규칙입니다.

## 빠른 명령
| 목적 | 명령 |
|---|---|
| 앱 실행 | `npm start` |
| 콘텐츠 검증 | `npm run validate` |
| 단위 테스트 | `npm run test:unit` |
| E2E(UI) 테스트 | `npm run test:e2e` (Linux 서버에서는 `xvfb-run -a npm run test:e2e`) |
| 전체 검사 | `npm test` |
| Windows 빌드 | `npm run dist:win` → `dist/` 에 설치본·포터블 exe |

## 구조
```
src/core/        순수 로직(UMD) — 렌더러와 Node 테스트가 함께 사용. DOM·Electron 의존 금지
  dates.js       날짜 유틸, 시험일(7·12월 첫째 일요일) 계산
  planner.js     학습 계획(4단계) 생성, 날짜별 할 일, 진행률
  quiz.js        출제·채점·180점 환산·연속 학습일
  srs.js         단어 카드 간격 반복
src/main/        Electron 메인 프로세스(main.js), preload.js, 저장소(store.js)
src/renderer/    화면. app.js(상태·라우터·헬퍼) + views/*.js(화면별) + boot.js
data/levels/     레벨별 콘텐츠 JSON (스키마: docs/CONTENT_SCHEMA.md)
scripts/         validate-content.js
tests/unit/      node:test 단위 테스트
tests/e2e/       Playwright(_electron) 전체 흐름 테스트
.claude/         하네스: agents(역할), skills(작업 절차), hooks(자동 검증)
```

## 반드시 지킬 규칙
1. **검증 없이 완료라고 하지 않는다.** 코드 변경 후 `npm run check`(검증+단위), UI 변경 후 E2E까지 통과시킨다.
2. **콘텐츠 JSON을 고치면** 훅이 자동으로 검증기를 돌린다. 오류가 나면 즉시 고친다.
3. **로직은 src/core 에** 둔다. 화면(views)에는 표시·이벤트 처리만. 새 로직엔 단위 테스트를 추가한다.
4. **보안 설정 유지**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP 유지. 렌더러는 `window.api`(preload)로만 메인과 통신.
5. **외부 네트워크 없이 동작**해야 한다(오프라인 앱). 외부 CDN·폰트 금지.
6. 사용자 데이터 형식(store.js `defaultState`)을 바꾸면 `migrate()`로 이전 데이터를 보존한다.
7. 화면 문구는 한국어, 시험 문제·예문은 일본어. 일본어 텍스트에는 `lang="ja"` 를 붙인다.
8. 사용자 입력·콘텐츠를 HTML에 넣을 때는 항상 `App.esc()`/`App.richJa()` 로 이스케이프한다.
9. 실제 JLPT 기출문제를 복제하지 않는다.

## 역할(서브에이전트) — .claude/agents/
- `planner` : 기능 요구를 작업 단위·수용 기준으로 쪼갠다
- `app-developer` : src/ 구현 + 단위 테스트
- `content-author` : data/levels 콘텐츠 작성(레벨별 병렬 실행 가능)
- `content-reviewer` : 콘텐츠 정답 유일성·난이도·해설 검수
- `qa-tester` : 검증·단위·E2E 실행, 스크린샷 확인, 버그 보고

## 작업 절차(스킬) — .claude/skills/
- `add-questions` : 문제/단어 추가 절차
- `add-feature` : 새 화면·기능 추가 절차
- `release-build` : 버전 올리고 Windows 빌드
