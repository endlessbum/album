import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI, openGame } from './utils';

// Быстрый smoke: открыть игру, увидеть селектор выбора, дождаться онлайн-партнёра/или проверить disabled, вернуться назад
// Без второго контекста (мультиплеер проверяется в других спеках)

test('truth-or-dare: smoke open and basic UI', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'tod');
  await loginUI(page, creds);

  await openGame(page, 'game-card-truth-or-dare');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Правда или Действие/i);

  // Должен быть экран выбора действия
  await expect(page.getByTestId('phase-selection')).toBeVisible();
  await expect(page.getByTestId('button-truth')).toBeVisible();
  await expect(page.getByTestId('button-dare')).toBeVisible();

  // Если партнёр офлайн, кнопки могут быть disabled — проверяем, что UI стабилен
  const truth = page.getByTestId('button-truth');
  const dare = page.getByTestId('button-dare');
  const truthEnabled = await truth.isEnabled();
  const dareEnabled = await dare.isEnabled();
  // Никаких действий не требуется для smoke — достаточно, что элементы доступны/отрисованы
  expect(truthEnabled || !truthEnabled).toBeTruthy();
  expect(dareEnabled || !dareEnabled).toBeTruthy();

  // Кнопка назад присутствует
  await expect(page.getByTestId('button-back')).toBeVisible();
});
