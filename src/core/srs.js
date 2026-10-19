// 간격 반복(SM-2 단순화). quality: 0=모름, 1=어려움, 2=알맞음, 3=쉬움
(function (root, factory) {
  const mod = factory(root.JLPT && root.JLPT.dates ? root.JLPT.dates : (typeof require === 'function' ? require('./dates') : null));
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).srs = mod;
})(typeof self !== 'undefined' ? self : this, function (dates) {
  'use strict';

  function newCard() { return { ease: 2.5, interval: 0, reps: 0, due: null, lapses: 0 }; }

  function review(card, quality, today) {
    const c = Object.assign(newCard(), card || {});
    if (quality < 0 || quality > 3) throw new Error('quality must be 0..3');
    if (quality === 0) {
      c.reps = 0;
      c.lapses += 1;
      c.interval = 0; // 오늘 다시
      c.ease = Math.max(1.3, c.ease - 0.2);
    } else {
      c.reps += 1;
      if (c.reps === 1) c.interval = quality === 3 ? 3 : 1;
      else if (c.reps === 2) c.interval = quality === 3 ? 7 : quality === 1 ? 3 : 4;
      else {
        const mult = quality === 1 ? 1.2 : quality === 3 ? c.ease * 1.3 : c.ease;
        c.interval = Math.max(c.interval + 1, Math.round(c.interval * mult));
      }
      c.ease = Math.max(1.3, c.ease + (quality === 1 ? -0.15 : quality === 3 ? 0.15 : 0));
    }
    c.due = dates.addDays(today, c.interval);
    c.last = today;
    return c;
  }

  function isDue(card, today) {
    return !card || !card.due || card.due <= today;
  }

  // 오늘 볼 카드: 기한 지난 복습 카드 먼저, 그다음 새 카드(newLimit 개)
  function pickToday(words, cards, today, newLimit = 20, keyFn = (w) => w.word) {
    const due = [];
    const fresh = [];
    for (const w of words) {
      const c = cards[keyFn(w)];
      if (!c) fresh.push(w);
      else if (isDue(c, today)) due.push(w);
    }
    due.sort((a, b) => (cards[keyFn(a)].due < cards[keyFn(b)].due ? -1 : 1));
    return { due, fresh: fresh.slice(0, newLimit) };
  }

  return { newCard, review, isDue, pickToday };
});
