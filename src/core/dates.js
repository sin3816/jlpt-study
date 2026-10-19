// 날짜 유틸 (로컬 날짜 기준, 'YYYY-MM-DD' 문자열 사용)
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.JLPT = root.JLPT || {}).dates = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  function toISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseISO(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function isValidISO(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    const d = parseISO(s);
    return toISO(d) === s;
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  // b - a (일)
  function diffDays(a, b) {
    const ms = parseISO(b) - parseISO(a);
    return Math.round(ms / 86400000);
  }

  function weekday(iso) { return parseISO(iso).getDay(); } // 0=일

  // 해당 연·월(1~12)의 첫 번째 일요일
  function firstSundayOf(year, month) {
    const d = new Date(year, month - 1, 1);
    const offset = (7 - d.getDay()) % 7;
    d.setDate(1 + offset);
    return toISO(d);
  }

  // JLPT는 매년 7월·12월 첫째 일요일에 시행(해외 기준 대부분 동일). today 이후의 시험일 n개.
  function upcomingExamDates(today, n = 3) {
    const out = [];
    let y = parseISO(today).getFullYear();
    while (out.length < n) {
      for (const m of [7, 12]) {
        const d = firstSundayOf(y, m);
        if (d > today && out.length < n) out.push(d);
      }
      y++;
    }
    return out;
  }

  function monthMatrix(year, month) {
    // month: 1~12, 일요일 시작 6주 행렬
    const first = new Date(year, month - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + w * 7 + i);
        row.push({ iso: toISO(d), inMonth: d.getMonth() === month - 1, day: d.getDate() });
      }
      weeks.push(row);
    }
    return weeks;
  }

  function formatKo(iso) {
    const d = parseISO(iso);
    const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
  }

  return { toISO, parseISO, isValidISO, addDays, diffDays, weekday, firstSundayOf, upcomingExamDates, monthMatrix, formatKo };
});
