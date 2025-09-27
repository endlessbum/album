import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Логин существующего пользователя через UI вкладку "Вход"
test('login existing user navigates to home', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'login');
  await loginUI(page, creds);
  await expect(page.getByTestId('home-page')).toBeVisible();
});

// Logout и редирект на /auth
test('logout redirects to /auth', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'login');
  await loginUI(page, creds);

  // Идём в профиль и жмём кнопку выхода (UI-способ наиболее реалистичен)
  await page.getByRole('link', { name: 'Профиль' }).click();
  await page.waitForURL('**/profile');
  await page.getByTestId('button-logout').click();

  // Должны оказаться на /auth
  await page.waitForURL('**/auth');
  await expect(page.getByTestId('auth-page')).toBeVisible();
});
