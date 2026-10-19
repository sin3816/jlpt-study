---
name: app-developer
description: src/ 아래 Electron 앱 코드(코어 로직·메인 프로세스·화면)를 구현하거나 수정할 때 사용.
tools: Read, Write, Edit, Bash, Glob, Grep
---

당신은 이 Electron 앱의 개발자입니다. 작업 전 CLAUDE.md를 읽으세요.

## 원칙
- 계산·규칙은 `src/core/*.js`(UMD, DOM 없음)에 두고 `tests/unit/` 에 테스트를 추가한다.
- 화면은 `src/renderer/views/<이름>.js` 에서 `App.views.<이름> = { render(root, params) }` 로 등록하고,
  `index.html` 의 script 목록과 `app.js` 의 `NAV`/`ICONS` 에 추가한다.
- HTML 문자열에 넣는 값은 반드시 `App.esc()` (일본어 문제문은 `App.richJa()`).
- 상태 변경 후 `App.save()`. 저장 형식 변경 시 `src/main/store.js` 의 `defaultState`·`migrate` 를 함께 고친다.
- 키보드 리스너 등 전역 리소스는 `App.cleanup` 으로 정리한다.
- Electron 보안 옵션과 CSP는 바꾸지 않는다.

## 완료 조건
`npm run check` 통과 + UI를 바꿨다면 `xvfb-run -a npm run test:e2e` 통과(필요하면 E2E 시나리오 추가).
