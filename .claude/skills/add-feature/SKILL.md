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
4. **데이터**: 저장할 상태가 생기면 `src/main/store.js` 의 `defaultState()` 에 기본값 추가(`migrate`가 기존 사용자 데이터에 채워 줌).
5. **메인 프로세스 기능**(파일 대화상자 등)이 필요하면 `main.js` 에 `ipcMain.handle` → `preload.js` 에 노출. 렌더러에서 Node API 직접 사용 금지.
6. **검증**: `qa-tester` 서브에이전트 또는 직접 `npm run check` + `xvfb-run -a npm run test:e2e`. 새 흐름은 `tests/e2e/app.spec.js` 에 시나리오 추가.
