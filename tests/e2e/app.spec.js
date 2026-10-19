// 앱 전체 흐름 E2E: 계획 생성 → 할 일 → 연습문제 → 단어 카드 → 모의고사 → 오답노트 → 일정 → 재실행 후 유지
'use strict';
const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = process.env.JLPT_SHOTS || path.join(ROOT, 'test-results', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-e2e-'));

async function launch() {
  const args = [ROOT];
  if (process.platform === 'linux') args.push('--no-sandbox');
  const app = await electron.launch({ args, env: Object.assign({}, process.env, { JLPT_USER_DATA: userData, JLPT_TODAY: '2026-10-19' }) });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(String(e)));
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await win.setViewportSize({ width: 1280, height: 820 }).catch(() => {});
  await win.waitForSelector('body[data-ready="1"]');
  return { app, win, errors };
}

const shot = (win, name) => win.screenshot({ path: path.join(SHOTS, `${name}.png`) });

test.describe.serial('JLPT 스터디', () => {
  let app; let win; let errors;

  test.beforeAll(async () => { ({ app, win, errors } = await launch()); });
  test.afterAll(async () => { if (app) await app.close(); });

  test('첫 실행: 계획 만들기 화면 → 계획 생성', async () => {
    await expect(win.getByRole('heading', { name: '학습 계획 만들기' })).toBeVisible();
    await shot(win, '01-plan-form');
    // 잘못된 입력: 직접 입력 시험일을 비워 두면 오류
    await win.locator('input[name=exam][value=custom]').check({ force: true });
    await win.locator('#save-plan').click();
    await expect(win.locator('#form-err')).toBeVisible();
    // 정상 입력
    await win.locator('label:has(input[name=level][value=N3])').click();
    await win.locator('label:has(input[name=exam][value="2026-12-06"])').click();
    await win.locator('input[name=weak][value=listening]').check();
    await win.locator('#save-plan').click();
    await expect(win.getByRole('heading', { name: '학습 계획', exact: true })).toBeVisible();
    await expect(win.locator('.timeline .ph')).toHaveCount(4);
    await expect(win.locator('#brand-sub')).toContainText('D-48');
    await shot(win, '02-plan-overview');
  });

  test('대시보드: 오늘 할 일 표시와 체크', async () => {
    await win.locator('#nav button[data-route=dashboard]').click();
    await expect(win.getByRole('heading', { name: '오늘의 학습' })).toBeVisible();
    const tasks = win.locator('#today-tasks .task');
    expect(await tasks.count()).toBeGreaterThan(2);
    await shot(win, '03-dashboard');
  });

  test('할 일에서 문법 문제 시작 → 풀이 → 결과 → 할 일 완료', async () => {
    await win.locator('#today-tasks .task:has(.chip.grammar) [data-start]').click();
    await expect(win.locator('.qprompt')).toBeVisible();
    let guard = 0;
    while (guard++ < 60) {
      await win.locator('.choice').first().click();
      await expect(win.locator('.explain')).toBeVisible();
      if (guard === 1) await shot(win, '04-practice-feedback');
      const next = win.locator('#next');
      const label = await next.textContent();
      await next.click();
      if (label.includes('결과')) break;
    }
    await expect(win.locator('.result-score').first()).toBeVisible();
    await shot(win, '05-practice-result');
    await win.locator('#home').click();
    await expect(win.locator('#today-tasks .task:has(.chip.grammar)')).toHaveClass(/done/);
  });

  test('단어 카드: 뒤집기·평가 (키보드)', async () => {
    await win.locator('#today-tasks .task:has(.chip.vocab):not(:has-text("문항")) [data-start]').click();
    await expect(win.locator('.fcard .word')).toBeVisible();
    await win.keyboard.press('Space');
    await expect(win.locator('.fcard .meaning')).toBeVisible();
    await shot(win, '06-flashcard');
    await win.keyboard.press('3');
    await win.keyboard.press('Space');
    await win.keyboard.press('1');
    await win.locator('#quit').click();
    await expect(win.getByRole('heading', { name: '단어장' })).toBeVisible();
  });

  test('미니 모의고사: 일부 풀고 제출 → 예상 점수', async () => {
    await win.locator('#nav button[data-route=practice]').click();
    await win.locator('#mock').click();
    await expect(win.locator('#timer')).toBeVisible();
    await win.keyboard.press('2');
    await expect(win.locator('.choice.sel')).toHaveCount(1);
    await shot(win, '07-mock');
    await win.locator('#submit').click();
    await expect(win.locator('.modal')).toBeVisible();
    await win.locator('.modal [data-r="1"]').click();
    await expect(win.getByText('예상 환산 점수(참고)')).toBeVisible();
    await shot(win, '08-mock-result');
  });

  test('오답노트에 틀린 문제가 모이고 해결 처리 가능', async () => {
    await win.locator('#nav button[data-route=wrong]').click();
    const items = win.locator('details.wq');
    expect(await items.count()).toBeGreaterThan(0);
    await items.first().locator('summary').click();
    await shot(win, '09-wrong');
    const before = await items.count();
    await items.first().locator('[data-toggle]').click();
    await expect(win.locator('details.wq')).toHaveCount(before - 1);
  });

  test('일정: 개인 일정 추가·삭제', async () => {
    await win.locator('#nav button[data-route=schedule]').click();
    await win.locator('#ev-form input[name=title]').fill('JLPT 접수 확인');
    await win.locator('#ev-form button[type=submit]').click();
    await expect(win.locator('.cal .ev', { hasText: 'JLPT 접수 확인' })).toBeVisible();
    await shot(win, '10-schedule');
    await win.locator('#ev-list [data-del]').click();
    await expect(win.locator('.cal .ev')).toHaveCount(0);
  });

  test('가이드·통계·설정 화면', async () => {
    await win.locator('#nav button[data-route=guide]').click();
    await expect(win.getByRole('heading', { name: 'JLPT N3 개요' })).toBeVisible();
    await win.locator('[data-lv=N1]').click();
    await expect(win.getByRole('heading', { name: 'JLPT N1 개요' })).toBeVisible();
    await shot(win, '11-guide');
    await win.locator('#nav button[data-route=stats]').click();
    await expect(win.getByRole('heading', { name: '통계' })).toBeVisible();
    await shot(win, '12-stats');
    await win.locator('#nav button[data-route=settings]').click();
    await win.locator('.seg[data-k=theme] button[data-v=dark]').click();
    await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark');
    await win.locator('#nav button[data-route=dashboard]').click();
    await shot(win, '13-dashboard-dark');
    await win.locator('#nav button[data-route=settings]').click();
    await win.locator('.seg[data-k=theme] button[data-v=light]').click();
  });

  test('렌더러 오류 없음', async () => {
    expect(errors).toEqual([]);
  });

  test('재실행 후 계획·기록 유지', async () => {
    await win.waitForTimeout(400); // 디바운스 저장 대기
    await app.close();
    ({ app, win, errors } = await launch());
    await expect(win.getByRole('heading', { name: '오늘의 학습' })).toBeVisible();
    await expect(win.locator('#today-tasks .task.done').first()).toBeVisible();
    await win.locator('#nav button[data-route=stats]').click();
    await expect(win.locator('.kpi .value').first()).not.toHaveText('0');
  });
});
