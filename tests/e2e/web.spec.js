// 모바일 웹앱(PWA) E2E — Galaxy S24 Ultra 화면(384×832, 터치)으로 실행
'use strict';
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { serve } = require('../../scripts/serve-web');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'test-results', 'screens-mobile');
fs.mkdirSync(SHOTS, { recursive: true });

const S24_ULTRA = {
  viewport: { width: 384, height: 832 },
  deviceScaleFactor: 2.8125,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  locale: 'ko-KR',
};
test.use(S24_ULTRA);

let server; let base;
test.beforeAll(async () => {
  execFileSync('node', [path.join(ROOT, 'scripts/build-web.js'), 'www'], { cwd: ROOT });
  server = await serve(path.join(ROOT, 'www'), 0);
  base = `http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(async () => { if (server) server.close(); });

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
async function noHorizontalScroll(page) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw, '가로 스크롤 없음').toBeLessThanOrEqual(w);
}

test.describe.serial('모바일 웹앱 (S24 Ultra)', () => {
  let page; let context; const errors = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext(S24_ULTRA);
    page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?today=2026-10-19`);
    await page.waitForSelector('body[data-ready="1"]');
  });
  test.afterAll(async () => { await context.close(); });

  test('첫 화면: 계획 만들기, 하단 탭 표시, 사이드바 숨김', async () => {
    await expect(page.getByRole('heading', { name: '학습 계획 만들기' })).toBeVisible();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();
    await noHorizontalScroll(page);
    await shot(page, '01-plan-form');
    await page.locator('label:has(input[name=level][value=N2])').tap();
    await page.locator('label:has(input[name=exam][value="2026-12-06"])').tap();
    await page.locator('#save-plan').tap();
    await expect(page.locator('.timeline .ph')).toHaveCount(4);
    await noHorizontalScroll(page);
    await shot(page, '02-plan');
  });

  test('홈: 오늘 할 일·KPI', async () => {
    await page.locator('#tabbar [data-route=dashboard]').tap();
    await expect(page.getByRole('heading', { name: '오늘의 학습' })).toBeVisible();
    await expect(page.locator('#tabbar [data-route=dashboard]')).toHaveAttribute('aria-current', 'page');
    await noHorizontalScroll(page);
    await shot(page, '03-home');
  });

  test('문제: 터치로 풀기 → 해설 → 결과', async () => {
    await page.locator('#tabbar [data-route=practice]').tap();
    await page.locator('.seg[data-k=count] button[data-v="5"]').tap();
    await page.locator('#start').tap();
    for (let i = 0; i < 5; i++) {
      await page.locator('.choice').nth(1).tap();
      await expect(page.locator('.explain')).toBeVisible();
      if (i === 0) { await noHorizontalScroll(page); await shot(page, '04-quiz'); }
      await page.locator('#next').tap();
    }
    await expect(page.locator('.result-score').first()).toBeVisible();
    await expect(page.locator('.kbd-hint')).toHaveCount(0);
    await shot(page, '05-result');
  });

  test('단어: 카드 뒤집기·평가', async () => {
    await page.locator('#tabbar [data-route=vocab]').tap();
    await page.locator('#go').tap();
    await page.locator('#flip').tap();
    await expect(page.locator('.fcard .meaning')).toBeVisible();
    await noHorizontalScroll(page);
    await shot(page, '06-card');
    await page.locator('[data-q="2"]').tap();
    await expect(page.locator('.fcard .word')).toBeVisible();
  });

  test('일정·더보기·가이드·설정 화면', async () => {
    await page.locator('#tabbar [data-route=schedule]').tap();
    await expect(page.locator('.cal button.day').first()).toBeVisible();
    await noHorizontalScroll(page);
    await shot(page, '07-schedule');
    await page.locator('#tabbar [data-route=more]').tap();
    await expect(page.getByRole('heading', { name: '더보기' })).toBeVisible();
    await shot(page, '08-more');
    await page.locator('.menu-row[data-route=guide]').tap();
    await expect(page.getByRole('heading', { name: 'JLPT N2 개요' })).toBeVisible();
    await expect(page.locator('#tabbar [data-route=more]')).toHaveAttribute('aria-current', 'page');
    await noHorizontalScroll(page);
    await shot(page, '09-guide');
    await page.locator('#tabbar [data-route=more]').tap();
    await page.locator('.menu-row[data-route=settings]').tap();
    await expect(page.getByRole('heading', { name: 'PC ↔ 폰 동기화' })).toBeVisible();
    await noHorizontalScroll(page);
    await shot(page, '10-settings');
  });

  test('PWA: 매니페스트·서비스워커·오프라인 실행·기록 유지', async () => {
    const mf = await (await page.request.get(`${base}manifest.webmanifest`)).json();
    expect(mf.display).toBe('standalone');
    expect(mf.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    expect(mf.icons.some((i) => i.sizes === '192x192')).toBe(true);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller || true);
    await page.reload(); // SW 가 페이지를 제어하도록
    await page.waitForSelector('body[data-ready="1"]');
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]');
    await expect(page.getByRole('heading', { name: '오늘의 학습' })).toBeVisible(); // 계획이 남아 있음(IndexedDB)
    await page.locator('#tabbar [data-route=more]').tap();
    await page.locator('.menu-row[data-route=stats]').tap();
    await expect(page.locator('.kpi .value').first()).toHaveText('5'); // 푼 문제 5개 유지
    await shot(page, '11-offline-stats');
    await context.setOffline(false);
  });

  test('다크 모드', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.locator('#tabbar [data-route=dashboard]').tap();
    await shot(page, '12-home-dark');
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('오류 없음', async () => { expect(errors).toEqual([]); });
});
