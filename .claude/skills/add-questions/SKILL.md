---
name: add-questions
description: JLPT 연습문제·단어·문법 포인트를 추가하거나 고칠 때 사용. "N2 문법 문제 20개 추가", "청해 문제 늘려줘", "단어장 보강" 같은 요청.
---

# 문제·단어 추가 절차

1. `docs/CONTENT_SCHEMA.md` 를 읽는다. id 규칙: `nX-(v|g|r|l)-NNN`, 레벨 파일 안에서 유일.
2. 대상 파일 `data/levels/nX.json` 의 마지막 번호를 확인하고 이어서 번호를 매긴다.
   ```bash
   node -e "const d=require('./data/levels/n3.json');console.log(d.questions.filter(q=>q.section==='grammar').map(q=>q.id).pop())"
   ```
3. 여러 레벨을 한꺼번에 늘릴 때는 `content-author` 서브에이전트를 레벨별로 병렬 실행한다.
4. 작성 후 `content-reviewer` 서브에이전트로 검수한다(작성자와 다른 에이전트).
5. `npm run validate` 와 `npm run test:unit` 이 통과해야 완료. (파일 저장 시 훅이 검증기를 자동 실행함)
6. 앱에서 확인: `npm start` → 연습문제 → 해당 레벨·영역 선택.

## 품질 체크리스트
- 정답 유일, 오답은 그럴듯하게, 정답 위치 0~3 고르게
- 해설(한국어)에 정답 근거 + 오답이 틀린 이유
- 청해는 `audioScript` 에 화자 표기(男：/女：), 질문 문장 포함
- 기출 복제 금지
