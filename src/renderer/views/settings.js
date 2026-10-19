(function () {
  'use strict';
  const App = window.App;

  App.views.settings = {
    render(root) {
      const s = App.state.settings;
      const voice = App.tts.voice();
      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>설정</h1><p>화면, 음성, 학습량과 데이터 백업을 관리합니다.</p></div></div>
        <div class="grid g2">
          <div class="card stack"><h2>화면</h2>
            <div class="field"><span>테마</span><div class="seg" data-k="theme">${[['system', '시스템 설정'], ['light', '라이트'], ['dark', '다크']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${s.theme === v}">${l}</button>`).join('')}</div></div>
            <label class="field"><span>하루 새 단어 수: <b id="nc-out">${s.newCardsPerDay}</b>장</span>
              <input type="range" id="nc" min="5" max="50" step="5" value="${s.newCardsPerDay}"></label>
          </div>
          <div class="card stack"><h2>일본어 음성 (청해·발음)</h2>
            <p class="${voice ? '' : 'notice'}">${voice ? `사용 중인 음성: <b>${App.esc(voice.name)}</b>` : '일본어 음성이 설치되어 있지 않습니다. Windows 설정 → 시간 및 언어 → 언어 및 지역에서 <b>일본어</b>를 추가하고, 음성 기능(텍스트 음성 변환)을 설치한 뒤 앱을 다시 실행하세요. 음성이 없어도 청해 스크립트로 학습할 수 있습니다.'}</p>
            <label class="field"><span>읽기 속도: <b id="rate-out">${s.ttsRate}</b>x</span>
              <input type="range" id="rate" min="0.5" max="1.3" step="0.1" value="${s.ttsRate}"></label>
            <div><button class="btn sm" id="test-voice">음성 테스트</button></div>
          </div>
        </div>
        <div class="card stack"><h2>데이터</h2>
          <p class="muted">학습 기록은 이 PC에만 저장됩니다. 다른 PC로 옮기거나 백업하려면 내보내기를 사용하세요.</p>
          <div class="row"><button class="btn" id="export">내보내기 (JSON)</button><button class="btn" id="import">가져오기</button>
            <span style="flex:1"></span><button class="btn danger" id="reset">모든 기록 초기화</button></div>
        </div>
        <div class="card"><h2>정보</h2><p class="muted small">JLPT 스터디 1.0.0 · 문제와 해설은 학습용으로 새로 작성한 것이며 실제 기출문제가 아닙니다. JLPT는 국제교류기금과 일본국제교육지원협회의 시험입니다.</p></div>
      </div>`));

      root.querySelectorAll('.seg[data-k=theme] button').forEach((b) => b.addEventListener('click', () => {
        s.theme = b.dataset.v; App.applyTheme(); App.save(); App.go('settings');
      }));
      const nc = root.querySelector('#nc');
      nc.addEventListener('input', () => { root.querySelector('#nc-out').textContent = nc.value; s.newCardsPerDay = Number(nc.value); App.save(); });
      const rate = root.querySelector('#rate');
      rate.addEventListener('input', () => { root.querySelector('#rate-out').textContent = rate.value; s.ttsRate = Number(rate.value); App.save(); });
      root.querySelector('#test-voice').addEventListener('click', () => {
        if (!App.tts.speak('こんにちは。日本語能力試験の勉強を始めましょう。')) App.toast('일본어 음성이 없습니다');
      });
      root.querySelector('#export').addEventListener('click', async () => {
        await App.flush();
        const r = await window.api.exportData(App.state);
        if (r.ok) App.toast('내보냈습니다');
      });
      root.querySelector('#import').addEventListener('click', async () => {
        const r = await window.api.importData();
        if (r.ok) { App.state = r.state; App.applyTheme(); App.toast('가져왔습니다'); App.go('dashboard'); }
        else if (r.error) App.toast(`가져오기 실패: ${r.error}`);
      });
      root.querySelector('#reset').addEventListener('click', async () => {
        if (!(await App.confirm('모든 기록 초기화', '학습 계획, 풀이 기록, 단어 카드, 일정이 모두 삭제됩니다. 되돌릴 수 없습니다.', '초기화', true))) return;
        const settings = App.state.settings;
        App.state = { version: 1, profile: null, completions: {}, events: [], attempts: [], wrong: {}, cards: {}, activity: {}, mocks: [], settings };
        await App.flush();
        App.go('plan');
      });
    },
  };
})();
