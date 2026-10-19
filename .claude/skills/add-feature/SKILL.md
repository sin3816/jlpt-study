---
name: add-feature
description: 앱에 새 화면이나 기능을 추가·변경할 때 사용. 예: "학습 타이머 추가", "한자 쓰기 연습 화면", "목표 알림".
---

# 기능 추가 절차 (기획 → 구현 → 검증)

1. **기획**: `planner` 서브에이전트로 작업 단위·수용 기준·영향 파일을 정리한다.
2. **로직**: 계산·규칙은 `src/core/` 에 순수 함수로 작성 → `tests/unit/core.test.js`(또는 새 파일)에 테스트 추가.
3. **화면**:
   - `src/renderer/views/<name>.js` 생성: `App.views.<name> = { render(root, params) { ... } }`
   - `src/renderer/index.html` 에 `<script src="views/<name>.js">` 추가 (boot.js 보다 위)
   - 메뉴에 노출하려면 `src/renderer/app.js` 의 `NAV`, `ICONS` 에 항목 추가
   - 스타일은 `styles.css` 의 토큰(`--accent`, `--surface` 등)만 사용 → 다크 모드 자동 대응
4. **데이터**: 저장할 상태가 생기면 `src/core/state.js` 의 `defaultState()`·`normalize()` 에 추가한다.
   - 기기 간에 맞춰야 하는 데이터면: 모든 레코드에 `t`(App.now()), 삭제는 톰스톤, `core/sync.js` 의 `SYNCED`·`merge()` 에 병합 규칙 + `tests/unit/sync.test.js` 에 교환·멱등 테스트.
   - 기기별 데이터(설정 등)면 `settings` 또는 `local` 아래에 둔다(동기화 안 됨).
5. **플랫폼 기능**(파일 대화상자 등)은 `window.api` 로 추상화한다: Electron 은 `main.js`(ipcMain.handle) + `preload.js`, 웹은 `src/web/platform-web.js` 에 **같은 이름**으로 구현.
   - 모바일(폭 ≤760px)에서는 사이드바 대신 하단 탭이 나온다. 새 메뉴는 `app.js` 의 `NAV`(PC)와 `views/more.js`(모바일 더보기)에 추가.
6. **검증**: `qa-tester` 서브에이전트 또는 직접 `npm run check` + `xvfb-run -a npm run test:e2e`. 새 흐름은 `tests/e2e/app.spec.js`(PC)와 `tests/e2e/web.spec.js`(S24 화면, 가로 스크롤 없음 확인)에 시나리오 추가.
