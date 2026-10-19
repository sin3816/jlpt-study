---
name: release-build
description: Windows exe 빌드, 모바일 웹앱(PWA) 배포, 새 버전 릴리스를 할 때 사용. "빌드해줘", "exe 만들어줘", "폰 앱 업데이트", "버전 올려".
---

# 릴리스 빌드 절차

1. 전체 검사: `npm test` (검증 + 단위 + E2E). 실패하면 빌드하지 않는다.
2. 버전 올리기: `npm version patch --no-git-tag-version` (기능 추가는 minor). `src/renderer/app.js` 의 `App.version` 도 맞춘다.
3. 빌드: `npm run dist:win`
   - Windows: 그대로 실행
   - Linux/macOS에서 교차 빌드: wine 필요. 없으면 `npx electron-builder --win dir --x64` 로 폴더형(win-unpacked) 빌드 후 zip
4. 결과물(`dist/`):
   - `JLPT-Study-Setup-<버전>.exe` — 설치본(설치 경로 선택 가능)
   - `JLPT-Study-Portable-<버전>.exe` — 설치 없이 실행
5. 서명되지 않은 exe라 처음 실행 시 SmartScreen 경고가 뜰 수 있다 → "추가 정보 → 실행".
6. CHANGELOG.md 에 변경 사항을 한 줄씩 기록한다.

## 모바일 웹앱(PWA) 배포
1. `npm run build:web` 으로 로컬 빌드가 되는지 확인(`www/`). 서비스 워커 버전은 파일 내용 해시로 자동 갱신된다.
2. `git push` (main) → `.github/workflows/pages.yml` 이 검사 후 GitHub Pages 에 배포.
3. 폰 앱은 다음 실행 때 새 파일을 받고, 그다음 실행부터 반영된다.
4. 상태 스키마를 바꾼 릴리스는 PC·폰 모두 업데이트해야 동기화가 안전하다(`fromPayload` 의 format 확인).
