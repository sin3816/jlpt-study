(function () {
  'use strict';
  const App = window.App;

  function syncCard() {
    const c = App.state.local.sync;
    const on = !!c.token;
    const when = c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString('ko-KR') : '아직 없음';
    return `<div class="card stack" id="sync-card"><div class="card-head" style="margin:0"><h2>PC ↔ 폰 동기화</h2>
        <span class="chip" id="sync-chip" style="color:${on ? (c.lastError ? 'var(--bad)' : 'var(--ok)') : 'var(--muted)'}">${App.esc(App.sync.label())}</span></div>
      ${on ? `
        <p class="muted">GitHub 비공개 Gist 하나에 학습 기록을 저장하고, 다른 기기와 자동으로 합칩니다. 같은 토큰을 다른 기기에도 입력하면 연결됩니다.</p>
        <table><tbody>
          <tr><td class="muted" style="width:130px">마지막 동기화</td><td id="sync-when">${App.esc(when)}</td></tr>
          <tr><td class="muted">저장소(Gist)</td><td class="small">${App.esc(c.gistId || '-')}</td></tr>
          <tr><td class="muted">이 기기 ID</td><td class="small">${App.esc(App.state.local.deviceId)}</td></tr>
        </tbody></table>
        ${c.lastError ? `<div class="notice" style="background:var(--bad-weak)">${App.esc(c.lastError)}</div>` : ''}
        <label class="row"><input type="checkbox" id="sync-auto" ${c.auto ? 'checked' : ''}> 자동 동기화 (앱 시작·전환 시, 변경 20초 후, 5분마다)</label>
        <div class="row"><button class="btn primary" id="sync-now">지금 동기화</button><span style="flex:1"></span><button class="btn danger" id="sync-off">연결 해제</button></div>`
      : `
        <p class="muted">GitHub 계정의 <b>개인 액세스 토큰</b>(Gists 읽기·쓰기 권한만)을 입력하면 이 기기와 다른 기기의 학습 기록이 자동으로 합쳐집니다. 만드는 방법은 설치 가이드(docs/MOBILE_INSTALL.md)를 참고하세요.</p>
        <form class="row" id="sync-form"><input type="text" name="token" placeholder="github_pat_… 또는 ghp_…" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px" aria-label="GitHub 토큰">
          <button class="btn primary" type="submit" id="sync-connect">연결</button></form>
        <p class="small muted">토큰은 이 기기에만 저장되며 내보내기 파일에는 포함되지 않습니다.</p>`}
    </div>`;
  }

  App.views.settings = {
    render(root) {
      const s = App.state.settings;
      const voice = App.tts.voice();
      const isWeb = App.env.platform === 'web';
      const voiceHelp = isWeb
        ? '일본어 음성이 없습니다. 휴대폰 설정 → 일반 → 글자 읽어주기(TTS)에서 기본 엔진을 <b>Google 음성 인식 및 합성</b>으로 바꾸고, 엔진 설정에서 <b>일본어</b> 음성 데이터를 설치하세요. 음성이 없어도 청해 스크립트로 학습할 수 있습니다.'
        : '일본어 음성이 설치되어 있지 않습니다. Windows 설정 → 시간 및 언어 → 언어 및 지역에서 <b>일본어</b>를 추가하고, 음성 기능(텍스트 음성 변환)을 설치한 뒤 앱을 다시 실행하세요. 음성이 없어도 청해 스크립트로 학습할 수 있습니다.';
      root.appendChild(App.el(`<div class="page">
        <div class="page-head"><div><h1>설정</h1><p>동기화, 화면, 음성, 학습량과 데이터 백업을 관리합니다.</p></div></div>
        ${syncCard()}
        <div class="grid g2">
          <div class="card stack"><h2>화면</h2>
            <div class="field"><span>테마</span><div class="seg" data-k="theme">${[['system', '시스템 설정'], ['light', '라이트'], ['dark', '다크']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${s.theme === v}">${l}</button>`).join('')}</div></div>
            <label class="field"><span>하루 새 단어 수: <b id="nc-out">${s.newCardsPerDay}</b>장</span>
              <input type="range" id="nc" min="5" max="50" step="5" value="${s.newCardsPerDay}"></label>
          </div>
          <div class="card stack"><h2>일본어 음성 (청해·발음)</h2>
            <p class="${voice ? '' : 'notice'}">${voice ? `사용 중인 음성: <b>${App.esc(voice.name)}</b>` : voiceHelp}</p>
            <label class="field"><span>읽기 속도: <b id="rate-out">${s.ttsRate}</b>x</span>
              <input type="range" id="rate" min="0.5" max="1.3" step="0.1" value="${s.ttsRate}"></label>
            <div><button class="btn sm" id="test-voice">음성 테스트</button></div>
          </div>
        </div>
        <div class="card stack"><h2>데이터</h2>
          <p class="muted">학습 기록은 이 기기에 저장됩니다. 동기화를 쓰지 않을 때는 내보내기 파일을 다른 기기에서 가져오면 기록이 <b>합쳐집니다</b>(덮어쓰지 않음).</p>
          <div class="row"><button class="btn" id="export">내보내기 (JSON)</button><button class="btn" id="import">가져와서 합치기</button>
            <span style="flex:1"></span><button class="btn danger" id="reset">모든 기록 초기화</button></div>
        </div>
        <div class="card"><h2>정보</h2><p class="muted small">JLPT 스터디 ${App.esc(App.version || '')} (${isWeb ? '모바일 웹앱' : 'Windows'}) · 문제와 해설은 학습용으로 새로 작성한 것이며 실제 기출문제가 아닙니다. JLPT는 국제교류기금과 일본국제교육지원협회의 시험입니다.</p></div>
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

      // 동기화
      const form = root.querySelector('#sync-form');
      if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = form.token.value.trim();
        if (!/^(github_pat_|ghp_|gho_|ghu_)[A-Za-z0-9_]{20,}$/.test(token) && !App.env.syncApi.startsWith('http://127.0.0.1')) {
          App.toast('GitHub 토큰 형식이 아닙니다'); return;
        }
        const btn = root.querySelector('#sync-connect');
        btn.disabled = true; btn.textContent = '연결 중…';
        try {
          const r = await App.sync.connect(token);
          App.toast(r.localChanged ? '연결했어요. 다른 기기의 기록을 합쳤습니다' : '연결했어요. 이 기기의 기록을 올렸습니다');
          App.go(App.route === 'settings' ? 'settings' : App.route);
        } catch (err) {
          App.toast(`연결 실패: ${err.message}`);
          btn.disabled = false; btn.textContent = '연결';
        }
      });
      const now = root.querySelector('#sync-now');
      if (now) now.addEventListener('click', async () => {
        now.disabled = true;
        try { await App.sync.run('manual'); App.toast('동기화했어요'); } catch (err) { App.toast(`동기화 실패: ${err.message}`); }
        if (App.route === 'settings') App.go('settings');
      });
      const auto = root.querySelector('#sync-auto');
      if (auto) auto.addEventListener('change', () => { App.state.local.sync.auto = auto.checked; App.save(); });
      const off = root.querySelector('#sync-off');
      if (off) off.addEventListener('click', async () => {
        if (!(await App.confirm('동기화 연결 해제', '이 기기의 연결만 해제합니다. 기록과 GitHub에 저장된 데이터는 그대로 남습니다.', '해제'))) return;
        await App.sync.disconnect();
        App.go('settings');
      });
      const unsub = App.sync.onChange(() => {
        const chip = document.getElementById('sync-chip');
        if (chip) chip.textContent = App.sync.label();
      });
      App.cleanup = unsub;

      root.querySelector('#export').addEventListener('click', async () => {
        await App.flush();
        const r = await window.api.exportData(JLPT.state.forExport(App.state));
        if (r.ok) App.toast('내보냈습니다');
      });
      root.querySelector('#import').addEventListener('click', async () => {
        const r = await window.api.importData();
        if (r.ok) {
          const incoming = JLPT.state.normalize(r.state);
          JLPT.sync.applyTo(App.state, JLPT.sync.merge(App.state, incoming));
          await App.flush();
          App.toast('가져온 기록을 합쳤습니다');
          App.go('dashboard');
        } else if (r.error) App.toast(`가져오기 실패: ${r.error}`);
      });
      root.querySelector('#reset').addEventListener('click', async () => {
        const msg = App.sync.enabled()
          ? '학습 계획, 풀이 기록, 단어 카드, 일정이 모두 삭제됩니다. 동기화가 켜져 있어 연결된 다른 기기의 기록도 함께 초기화됩니다. 되돌릴 수 없습니다.'
          : '학습 계획, 풀이 기록, 단어 카드, 일정이 모두 삭제됩니다. 되돌릴 수 없습니다.';
        if (!(await App.confirm('모든 기록 초기화', msg, '초기화', true))) return;
        const t = App.now();
        const fresh = JLPT.state.defaultState();
        fresh.resetAt = t;
        fresh.settings = App.state.settings;
        fresh.local = App.state.local;
        for (const k of Object.keys(App.state)) delete App.state[k];
        Object.assign(App.state, fresh);
        await App.flush();
        if (App.sync.enabled()) App.sync.run('auto');
        App.go('plan');
      });
    },
  };
})();
