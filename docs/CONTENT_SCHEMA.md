# 학습 콘텐츠 스키마 (data/levels/nX.json)

레벨마다 JSON 파일 하나: `data/levels/n5.json` … `data/levels/n1.json`.
`npm run validate`(scripts/validate-content.js)가 이 규칙을 강제합니다. 파일을 고친 뒤에는 반드시 실행하세요.

```jsonc
{
  "level": "N3",                       // "N5"|"N4"|"N3"|"N2"|"N1" — 파일명과 일치
  "guide": {
    "summary": "한국어 2~3문장: 이 레벨이 요구하는 수준",
    "targetVocab": 3700,               // 권장 누적 어휘 수(대략치)
    "targetKanji": 650,                // 권장 누적 한자 수(대략치)
    "studyHours": "450~900시간 (한자권 학습자 기준 더 짧을 수 있음)",
    "sections": [                      // 정확히 4개: vocab, grammar, reading, listening
      { "id": "vocab", "name": "문자·어휘", "tips": ["한국어 팁", "..."] }   // tips 3~5개
    ],
    "strategies": ["레벨 전반 학습 전략(한국어)", "..."],               // 4~6개
    "grammarPoints": [                                                    // 12개 이상
      { "pattern": "〜ばかりに", "meaning": "~한 탓에(나쁜 결과)", "example": "日本語の文", "exampleKo": "한국어 번역" }
    ]
  },
  "vocab": [                                                             // 40개 이상, word 중복 금지
    { "word": "経験", "reading": "けいけん", "meaning": "경험", "example": "日本語の例文", "exampleKo": "번역" }
  ],
  "questions": [                                                         // 30개 이상
    {
      "id": "n3-v-001",                 // ^n[1-5]-(v|g|r|l)-\d{3}$, 파일 내 유일
      "section": "vocab",               // vocab | grammar | reading | listening
      "type": "kanji-reading",          // 아래 타입 표 참고
      "prompt": "＿＿の言葉の読み方として最もよいものを選んでください。\n彼は豊富な＿経験＿がある。",
      "passage": "독해 지문(reading 필수, 그 외 선택)",
      "audioScript": "청해 스크립트(listening 필수). 앱이 일본어 TTS로 읽어줌. 화자 표기 예: 男：… 女：…",
      "choices": ["けいけん", "けいげん", "きょうけん", "きょうげん"],   // 정확히 4개, 중복 금지
      "answer": 0,                      // 0~3 정답 인덱스
      "explanation": "한국어 해설: 왜 정답인지 + 오답 포인트",
      "tags": ["한자읽기"]
    }
  ]
}
```

## 섹션별 최소 문항 수 (레벨당)

| section | 최소 | 허용 type |
|---|---|---|
| vocab | 12 | kanji-reading, orthography, context, paraphrase, usage |
| grammar | 10 | grammar-form, sentence-order, text-grammar |
| reading | 5 | reading (passage 필수) |
| listening | 4 | listening (audioScript 필수) |

## 작성 원칙
- 문제·지문·선택지는 일본어, 해설·의미·팁은 한국어.
- 실제 JLPT 기출 문제를 그대로 옮기지 않는다(저작권). 출제 유형만 따르고 문장은 새로 쓴다.
- 레벨 난이도에 맞는 어휘·문법만 사용한다. 정답이 하나뿐인지, 오답이 그럴듯한지 확인한다.
- 정답 위치(answer)는 0~3에 고르게 분산한다.
- sentence-order(★) 문제는 prompt에 `＿＿ ＿＿ ★ ＿＿` 형태를 넣고, choices는 4개 조각, answer는 ★ 위치에 들어갈 조각.
