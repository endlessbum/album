import { test, expect } from '@playwright/test';

async function login(page: any, request: any) {
  const suffix = Date.now().toString();
  const email = `e2e+roleplay+${suffix}@example.com`;
  const username = `roleplay_${suffix}`;
  const password = 'Passw0rd!e2e';
  const res = await request.post('/api/register', { data: { email, username, password } });
  expect(res.ok()).toBeTruthy();
  await page.goto('/auth');
  await page.getByTestId('tab-login').click();
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('button-login').click();
  await page.waitForURL('**/');
}

// Минимальный стабильный флоу для "Ролевой игры": выбрать сценарий, стартануть, отправить сообщение, сменить подсказку
// Тест не полагается на реального партнёра: UI позволяет отправить локальное сообщение и запрос новой подсказки

test('role-playing: select scenario, start, send message', async ({ page, request }) => {
  await login(page, request);

  // Перейти на /games через SPA
  await page.getByRole('link', { name: 'Игры' }).click();
  await page.waitForURL('**/games');
  await expect(page.getByTestId('games-page')).toBeVisible();

  // Открыть карточку ролевой игры
  await page.getByTestId('games-grid').getByTestId('game-card-role-playing').click();
  await expect(page.getByTestId('button-back')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Ролевая/i);

  // Выбрать первый сценарий
  const firstScenario = page.getByTestId('scenario-1');
  await expect(firstScenario).toBeVisible();
  await firstScenario.click();

  // Дождаться кнопки старта
  const startBtn = page.getByTestId('button-start-roleplay');
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // Отправить сообщение в роли
  await page.getByTestId('input-message').fill('Привет! Погнали по сценарию.');
  await page.getByTestId('button-send-message').click();

  // Попросить новую подсказку
  await page.getByTestId('button-new-prompt').click();

  // Базовые ассерты: остались на странице игры, кнопка "Назад" присутствует
  await expect(page.getByTestId('button-back')).toBeVisible();
});
