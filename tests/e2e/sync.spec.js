// PC(Electron) ↔ 폰(모바일 웹앱) 양방향 동기화 E2E — 모의 Gist 서버 사용
'use strict';
const { test, expect, _electron: electron } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve } = require('../../scripts/serve-web');
const { startMockGist, TOKEN } = require('../helpers/mock-gist');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'test-results', 'screens-sync');
fs.mkdirSync(SHOTS, { recursive: true });

test.describe.serial('PC ↔ 폰 동기화', () => {
  let gist; let web; let base;
  let pcApp; let pc; let phoneCtx; let phone; let userData;
  const launchPc = async () => {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox');
    pcApp = await electron.launch({ args, env: Object.assign({}, process.env, { JLPT_USER_DATA: userData, JLPT_TODAY: '2026-10-19', JLPT_SYNC_API: gist.url }) });
    pc = await pcApp.firstWindow();
    await pc.waitForSelector('body[data-ready="1"]');
  };

  test.beforeAll(async ({ browser }) => {
    gist = await startMockGist();
    execFileSync('node', [path.join(ROOT, 'scripts/build-web.js'), 'www'], { cwd: ROOT });
    web = await serve(path.join(ROOT, 'www'), 0);
    base = `http://127.0.0.1:${web.address().port}/`;

    // PC
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-sync-'));
    await launchPc();

    // 폰: api.github.com 요청을 모의 서버로 돌린다
    phoneCtx = await browser.newContext({ viewport: { width: 384, height: 832 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.8125 });
    await phoneCtx.route('https://api.github.com/**', async (route) => {
      const u = new URL(route.request().url());
      const resp = await route.fetch({ url: gist.url + u.pathname + u.search });
      await route.fulfill({ response: resp });
    });
    phone = await phoneCtx.newPage();
    await phone.goto(`${base}?today=2026-10-19`);
    await phone.waitForSelector('body[data-ready="1"]');
  });

  test.afterAll(async () => {
    if (pcApp) await pcApp.close();
    if (phoneCtx) await phoneCtx.close();
    if (web) web.close();
    if (gist) await gist.close();
  });

  const fp = (page) => page.evaluate(() => JLPT.sync.fingerprint(App.state));

  test('PC: 계획 생성·학습 후 GitHub 토큰으로 연결 → Gist 생성', async () => {
    await pc.locator('label:has(input[name=level][value=N3])').click();
    await pc.locator('label:has(input[name=exam][value="2026-12-06"])').click();
    await pc.locator('#save-plan').click();
    await pc.locator('#nav [data-route=dashboard]').click();
    await pc.locator('#today-tasks .task').first().locator('input').check();
    await pc.locator('#nav [data-route=schedule]').click();
    await pc.locator('#ev-form input[name=title]').fill('JLPT 접수 마감');
    await pc.locator('#ev-form button[type=submit]').click();

    await pc.locator('#nav [data-route=settings]').click();
    await pc.locator('#sync-form input[name=token]').fill('잘못된토큰');
    await pc.locator('#sync-connect').click();
    await expect(pc.locator('#toast')).toContainText('토큰 형식');
    await pc.locator('#sync-form input[name=token]').fill(TOKEN);
    await pc.locator('#sync-connect').click();
    await expect(pc.locator('#sync-now')).toBeVisible();
    expect(Object.keys(gist.gists)).toHaveLength(1);
    const g = Object.values(gist.gists)[0];
    expect(g.public).toBe(false);
    const payload = JSON.parse(g.files['jlpt-sync.json'].content);
    expect(payload.data.profile.level).toBe('N3');
    expect(JSON.stringify(payload)).not.toContain(TOKEN); // 토큰은 올라가지 않음
    await pc.screenshot({ path: path.join(SHOTS, '01-pc-connected.png') });
  });

  test('폰: 같은 토큰으로 연결 → PC의 계획·완료·일정을 받는다', async () => {
    await expect(phone.getByRole('heading', { name: '학습 계획 만들기' })).toBeVisible();
    await phone.locator('#tabbar [data-route=more]').tap();
    await phone.locator('.menu-row[data-route=settings]').tap();
    await phone.locator('#sync-form input[name=token]').fill(TOKEN);
    await phone.locator('#sync-connect').tap();
    await expect(phone.locator('#sync-now')).toBeVisible();
    expect(Object.keys(gist.gists)).toHaveLength(1); // 새로 만들지 않고 기존 것을 찾음
    await phone.screenshot({ path: path.join(SHOTS, '02-phone-connected.png') });

    await phone.locator('#tabbar [data-route=dashboard]').tap();
    await expect(phone.getByText('JLPT N3 시험까지')).toBeVisible();
    await expect(phone.locator('#today-tasks .task.done')).toHaveCount(1);
    await phone.locator('#tabbar [data-route=schedule]').tap();
    await phone.locator('.cal button.day[data-date="2026-10-19"]').tap();
    await expect(phone.locator('#ev-list')).toContainText('JLPT 접수 마감');
  });

  test('폰에서 학습·체크·일정 삭제 → PC가 받는다', async () => {
    // 폰: 일정 삭제, 두 번째 할 일 체크, 문제 풀기
    await phone.locator('#ev-list [data-del]').tap();
    await phone.locator('#tabbar [data-route=dashboard]').tap();
    await phone.locator('#today-tasks .task').nth(1).locator('input').tap();
    await phone.locator('#tabbar [data-route=practice]').tap();
    await phone.locator('.seg[data-k=count] button[data-v="5"]').tap();
    await phone.locator('#start').tap();
    for (let i = 0; i < 5; i++) { await phone.locator('.choice').first().tap(); await phone.locator('#next').tap(); }
    await expect(phone.locator('.result-score').first()).toBeVisible();
    await phone.locator('#tabbar [data-route=more]').tap();
    await phone.locator('.menu-row[data-route=settings]').tap();
    await phone.locator('#sync-now').tap();
    await expect(phone.locator('#toast')).toContainText('동기화했어요');

    // PC: 지금 동기화
    await pc.locator('#nav [data-route=settings]').click();
    await pc.locator('#sync-now').click();
    await expect(pc.locator('#toast')).toContainText(/동기화했어요|가져왔어요/);
    await pc.locator('#nav [data-route=dashboard]').click();
    await expect(pc.locator('#today-tasks .task.done')).toHaveCount(2);
    await pc.locator('#nav [data-route=stats]').click();
    await expect(pc.locator('.kpi .value').first()).toHaveText('5');
    await pc.locator('#nav [data-route=schedule]').click();
    await expect(pc.locator('.cal .ev')).toHaveCount(0);
    await pc.screenshot({ path: path.join(SHOTS, '03-pc-after-sync.png') });
  });

  test('양쪽 데이터가 완전히 같아진다(수렴)', async () => {
    await phone.locator('#sync-now').tap();
    await expect(phone.locator('#toast')).toContainText(/동기화했어요|가져왔어요/);
    expect(await fp(pc)).toBe(await fp(phone));
  });

  test('PC 재실행 후에도 연결·기록 유지, 자동 동기화로 폰 변경 수신', async () => {
    // 폰: 계획 수정(하루 90분) 후 동기화
    await phone.locator('#tabbar [data-route=more]').tap();
    await phone.locator('.menu-row[data-route=plan]').tap();
    await phone.locator('#edit-plan').tap();
    await phone.locator('input[name=dailyMinutes]').fill('90');
    await phone.locator('#save-plan').tap();
    await phone.evaluate(() => App.sync.run('manual'));

    // PC 재실행 → 시작 시 자동 동기화(boot)
    await pcApp.close();
    await launchPc();
    await expect(pc.locator('#foot-sync')).toContainText(/동기화됨|분 전/, { timeout: 15000 });
    await pc.locator('#nav [data-route=plan]').click();
    await expect(pc.locator('.page-head p')).toContainText('하루 90분');
    expect(await fp(pc)).toBe(await fp(phone));
    await pc.screenshot({ path: path.join(SHOTS, '04-pc-restarted.png') });
  });
});
