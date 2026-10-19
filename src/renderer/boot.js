(async function () {
  'use strict';
  const App = window.App;
  const [content, state, envToday, env] = await Promise.all([
    window.api.loadContent(), window.api.loadState(), window.api.envToday(), window.api.envConfig(),
  ]);
  App.content = content;
  App.state = JLPT.state.normalize(state);
  App.observeStamps();
  App.env = Object.assign({ platform: 'desktop', syncApi: 'https://api.github.com' }, env || {});
  document.documentElement.dataset.platform = App.env.platform;
  App.today = envToday || App.dates.toISO(new Date());
  App.fixedToday = !!envToday;
  App.applyTheme();
  // 음성 목록은 비동기로 로드되므로 잠깐 기다린다(최대 0.8초)
  if (window.speechSynthesis) {
    await new Promise((r) => {
      if (speechSynthesis.getVoices().length) return r();
      speechSynthesis.onvoiceschanged = () => r();
      setTimeout(r, 800);
    });
  }
  App.go(App.state.profile ? 'dashboard' : 'plan');
  App.sync.start();
  document.body.dataset.ready = '1';
})();
