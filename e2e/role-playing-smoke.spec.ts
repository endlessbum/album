import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI, openGame } from './utils';

// Smoke: открываем ролевую игру, кликаем по сценарию, видим фазу назначения ролей

test('role-playing: smoke select scenario and see role assignment', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'rp');
  await loginUI(page, creds);

  await openGame(page, 'game-card-role-playing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Ролевая игра/i);

  // На экране выбора должен быть список сценариев
  await expect(page.getByTestId('phase-selection')).toBeVisible();
  const scenarioCard = page.getByTestId(/^scenario-/).first();
  await scenarioCard.click();

  // Ожидаем фазу назначения ролей
  await expect(page.getByTestId('phase-role-assignment')).toBeVisible();
  await expect(page.getByTestId('button-start-roleplay')).toBeVisible();

  // smoke завершаем, не переходим к playing
});
