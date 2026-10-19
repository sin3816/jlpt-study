# JLPT 스터디 — Claude 작업 가이드 (하네스)

JLPT N5~N1 학습 계획·일정·가이드·연습문제·단어장을 제공하는 앱.
**한 벌의 화면 코드**(src/renderer)로 Windows 데스크톱(Electron)과 모바일 웹앱(PWA, 갤럭시 S24 Ultra 기준)을 함께 만들고, GitHub Gist로 기기 간 자동 동기화합니다.
이 파일은 Claude Code가 이 저장소에서 일할 때 지켜야 할 규칙입니다.

## 빠른 명령
| 목적 | 명령 |
|---|---|
| 앱 실행 | `npm start` |
| 콘텐츠 검증 | `npm run validate` |
| 단위 테스트 | `npm run test:unit` |
| E2E(UI) 테스트 | `npm run test:e2e` (Linux 서버에서는 `xvfb-run -a npm run test:e2e`) |
| 모바일 웹앱 빌드 | `npm run build:web` → `www/` (로컬 확인: `npm run serve:web`) |
| 전체 검사 | `npm test` (검증 + 단위 + Electron·모바일·동기화 E2E) |
| Windows 빌드 | `npm run dist:win` → `dist/` 에 설치본·포터블 exe |

## 구조
```
src/core/        순수 로직(UMD) — 렌더러와 Node 테스트가 함께 사용. DOM·Electron 의존 금지
  dates.js       날짜 유틸, 시험일(7·12월 첫째 일요일) 계산
  planner.js     학습 계획(4단계) 생성, 날짜별 할 일, 진행률
  quiz.js        출제·채점·180점 환산·연속 학습일
  srs.js         단어 카드 간격 반복
  state.js       상태 스키마 v2 기본값·정규화(마이그레이션), 기기 전용 값(local)
  sync.js        병합(merge)·전송 형식·GitHub Gist 클라이언트·syncOnce
src/main/        Electron 메인 프로세스(main.js: IPC, 허용 호스트만 http 중계), preload.js, store.js
src/renderer/    화면(두 플랫폼 공용). app.js(상태·라우터·헬퍼) + sync.js(자동 동기화 트리거) + views/*.js + boot.js
src/web/         PWA 전용: platform-web.js(window.api를 IndexedDB·fetch로 구현), sw.js, icons/
scripts/build-web.js  src → www/ 정적 사이트(content.js·manifest·서비스워커 생성)
.github/workflows/pages.yml  main push 시 검사 후 GitHub Pages 배포
data/levels/     레벨별 콘텐츠 JSON (스키마: docs/CONTENT_SCHEMA.md)
scripts/         validate-content.js
tests/unit/      node:test 단위 테스트
tests/e2e/       Playwright: app.spec(Electron) · web.spec(S24 화면 PWA) · sync.spec(PC↔폰 동기화)
tests/helpers/   mock-gist.js(모의 GitHub Gist 서버)
.claude/         하네스: agents(역할), skills(작업 절차), hooks(자동 검증)
```

## 반드시 지킬 규칙
1. **검증 없이 완료라고 하지 않는다.** 코드 변경 후 `npm run check`(검증+단위), UI 변경 후 E2E까지 통과시킨다.
2. **콘텐츠 JSON을 고치면** 훅이 자동으로 검증기를 돌린다. 오류가 나면 즉시 고친다.
3. **로직은 src/core 에** 둔다. 화면(views)에는 표시·이벤트 처리만. 새 로직엔 단위 테스트를 추가한다.
4. **보안 설정 유지**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP 유지. 렌더러는 `window.api`로만 플랫폼 기능 사용. 토큰은 `state.local`에만 두고 동기화·내보내기에 넣지 않는다.
5. **오프라인에서도 동작**해야 한다. 외부 CDN·폰트 금지. 네트워크는 동기화(api.github.com, gist.githubusercontent.com)만 쓴다.
6. 사용자 데이터 형식은 `src/core/state.js`가 기준이다. 바꾸면 `normalize()`로 이전 데이터를 보존한다.
7. 화면 문구는 한국어, 시험 문제·예문은 일본어. 일본어 텍스트에는 `lang="ja"` 를 붙인다.
8. 사용자 입력·콘텐츠를 HTML에 넣을 때는 항상 `App.esc()`/`App.richJa()` 로 이스케이프한다.
9. 실제 JLPT 기출문제를 복제하지 않는다.
10. **동기화 규칙(필수)**: 동기화되는 기록을 바꿀 때는 항상 `t: App.now()`를 갱신하고, 삭제는 지우지 말고 `deleted: true`(톰스톤)로 남긴다.
    새 동기화 필드를 추가하면 `core/sync.js`의 `SYNCED`와 `merge()`에 규칙을 넣고, 교환·멱등 테스트(tests/unit/sync.test.js)를 추가한다. 설계: docs/SYNC_DESIGN.md
11. **두 플랫폼 확인**: 화면을 바꾸면 PC(사이드바)와 모바일(384px, 하단 탭) 모두 확인한다. 플랫폼 기능은 `window.api`(preload.js ↔ platform-web.js) 양쪽에 같은 이름으로 구현한다.

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
