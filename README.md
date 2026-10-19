# JLPT 스터디

JLPT N5~N1 수험생을 위한 Windows 데스크톱 학습 앱입니다. 시험일까지의 학습 계획과 날짜별 할 일을 만들어 주고, 레벨별 가이드·연습문제·단어 카드·오답노트·통계를 한곳에서 관리합니다. 인터넷 없이 동작하며 기록은 내 PC에만 저장됩니다.

## 바로 실행
`release/JLPT-Study-Portable-1.0.0.exe` 를 더블클릭하면 설치 없이 실행됩니다.
서명되지 않은 앱이라 처음에 SmartScreen 경고가 뜨면 **추가 정보 → 실행**을 누르세요. 첫 실행은 압축을 푸느라 몇 초 걸립니다.

## 주요 기능
| 화면 | 내용 |
|---|---|
| 대시보드 | D-day, 계획 달성률, 연속 학습일, 오늘 할 일(바로 시작 버튼), 섹션별 정답률 |
| 학습 계획 | 레벨·시험일(7월·12월 첫째 일요일 자동 계산)·하루 학습 시간·약한 영역·쉬는 요일 입력 → 기초 다지기 / 실력 향상 / 실전 연습 / 총정리 4단계 로드맵 |
| 일정 | 월간 달력, 날짜별 할 일 체크, 접수 마감 같은 개인 일정 추가 |
| 학습 가이드 | 레벨별 시험 시간·득점 구분·기준점, 영역별 공부법, 학습 전략, 핵심 문법 15개(예문 발음 듣기) |
| 연습문제 | 레벨·영역·문항 수·출제 방식(안 푼 문제 우선/무작위/오답만) 선택, 즉시 채점·해설, 키보드(1~4, Enter) 지원 |
| 미니 모의고사 | 실제 비율로 20문항, 제한 시간, 180점 환산 예상 점수와 기준점 통과 여부 |
| 단어장 | 레벨별 단어 카드, 간격 반복(모름·어려움·알맞음·쉬움) |
| 오답노트 | 틀린 문제 자동 수집, 2번 연속 맞히면 자동 해결, 다시 풀기 |
| 통계 | 최근 14일 학습량, 섹션별 정답률, 모의고사 기록, 약한 유형 |
| 설정 | 라이트/다크 테마, 일본어 음성 속도, 하루 새 단어 수, 데이터 내보내기/가져오기/초기화 |

**청해·발음**은 Windows의 일본어 음성(TTS)을 사용합니다. 소리가 나지 않으면 Windows 설정 → 시간 및 언어 → 언어 및 지역에서 **일본어**를 추가하고 음성 기능을 설치하세요. 음성이 없으면 스크립트를 대신 보여 줍니다.

**수록 콘텐츠**: 레벨마다 연습문제 37문항(어휘 14·문법 12·독해 6·청해 5), 단어 50개, 핵심 문법 15개로 총 185문항입니다. 모든 문제는 학습용으로 새로 작성했으며 실제 기출문제가 아닙니다. 문제는 `data/levels/*.json` 에 추가해 늘릴 수 있습니다(아래 참고).

## 개발

### 필요한 것
- Node.js 20 이상

### 명령
```bash
npm install
npm start             # 앱 실행
npm run validate      # 콘텐츠(JSON) 검증
npm run test:unit     # 코어 로직 단위 테스트
npm run test:e2e      # Electron UI 전체 흐름 테스트 (Playwright)
npm test              # 위 세 가지 전부
npm run dist:win      # Windows 설치본 + 포터블 exe → dist/
```

### 하네스(Claude Code로 이어서 개발하기)
이 저장소는 Claude Code가 안전하게 확장할 수 있도록 하네스가 구성되어 있습니다.

- `CLAUDE.md` — 구조, 명령, 반드시 지킬 규칙
- `.claude/agents/` — 역할별 서브에이전트: `planner`(기획), `app-developer`(구현), `content-author`(문제 작성), `content-reviewer`(문제 검수), `qa-tester`(테스트)
- `.claude/skills/` — 작업 절차: `add-questions`(문제 추가), `add-feature`(기능 추가), `release-build`(빌드)
- `.claude/settings.json` 훅 — 콘텐츠 JSON을 고치면 검증기, 코어 로직을 고치면 단위 테스트가 자동 실행되고, 실패하면 Claude가 바로 고칩니다
- `docs/CONTENT_SCHEMA.md` — 문제·단어 데이터 형식

예: Claude Code에서 "N2 문법 문제 20개 추가해줘" → `add-questions` 스킬 → `content-author` 작성 → `content-reviewer` 검수 → 자동 검증.

### 폴더 구조
```
src/core/       순수 로직(계획 생성, 출제·채점, 간격 반복, 날짜) — 단위 테스트 대상
src/main/       Electron 메인 프로세스, preload, 저장소
src/renderer/   화면(app.js + views/*.js)
data/levels/    N5~N1 콘텐츠
tests/          unit / e2e
```

사용자 데이터 위치: `%APPDATA%\jlpt-study\jlpt-data.json` (백업: `jlpt-data.backup.json`)
