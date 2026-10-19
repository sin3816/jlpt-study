(async function () {
  'use strict';
  const App = window.App;
  const [content, state, envToday] = await Promise.all([window.api.loadContent(), window.api.loadState(), window.api.envToday()]);
  App.content = content;
  App.state = state;
  App.today = envToday || App.dates.toISO(new Date());
  App.applyTheme();
  // 음성 목록은 비동기로 로드되므로 잠깐 기다린다(최대 0.8초)
  if (window.speechSynthesis) {
    await new Promise((r) => {
      if (speechSynthesis.getVoices().length) return r();
      speechSynthesis.onvoiceschanged = () => r();
      setTimeout(r, 800);
    });
  }
  App.go(state.profile ? 'dashboard' : 'plan');
  document.body.dataset.ready = '1';
})();
