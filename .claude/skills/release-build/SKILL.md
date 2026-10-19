---
name: release-build
description: Windows 설치 파일·포터블 exe를 빌드하거나 새 버전을 배포할 때 사용. "빌드해줘", "exe 만들어줘", "버전 올려".
---

# 릴리스 빌드 절차

1. 전체 검사: `npm test` (검증 + 단위 + E2E). 실패하면 빌드하지 않는다.
2. 버전 올리기: `npm version patch --no-git-tag-version` (기능 추가는 minor). 설정 화면의 버전 문구(`src/renderer/views/settings.js`)도 맞춘다.
3. 빌드: `npm run dist:win`
   - Windows: 그대로 실행
   - Linux/macOS에서 교차 빌드: wine 필요. 없으면 `npx electron-builder --win dir --x64` 로 폴더형(win-unpacked) 빌드 후 zip
4. 결과물(`dist/`):
   - `JLPT-Study-Setup-<버전>.exe` — 설치본(설치 경로 선택 가능)
   - `JLPT-Study-Portable-<버전>.exe` — 설치 없이 실행
5. 서명되지 않은 exe라 처음 실행 시 SmartScreen 경고가 뜰 수 있다 → "추가 정보 → 실행".
6. CHANGELOG.md 에 변경 사항을 한 줄씩 기록한다.
