import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

async function loginNewUser(page: any, request: any) {
  // Используем устойчивые хелперы с ретраями
  const creds = await registerViaApi(request, 'settings');
  await loginUI(page, creds);
}

test('toggle dark mode and change font (no save)', async ({ page, request }) => {
  await loginNewUser(page, request);

  // Go to settings via bottom nav
  await page.getByRole('link', { name: 'Настройки' }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

  // Switch to Appearance tab
  await page.getByTestId('tab-appearance').click();

  // Toggle dark mode: html element should gain class 'dark'
  const htmlEl = page.locator('html');
  const wasDark = await htmlEl.evaluate((el) => el.classList.contains('dark'));
  await page.getByTestId('switch-dark-mode').click();
  await expect(htmlEl).toHaveClass(new RegExp(wasDark ? '\\blight\\b' : '\\bdark\\b'));

  // Change font via select
  await page.getByTestId('select-font').click();
  // Choose the first available option in the dropdown list
  const firstOption = page.locator('[role="listbox"] [role="option"]').first();
  await firstOption.click();

  // No save action required; just ensure UI remains responsive
  await expect(page.getByTestId('settings-page')).toBeVisible();
});
