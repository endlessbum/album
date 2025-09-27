import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// E2E: profile save should persist name/surname (server) and status (local-only)
test('profile: save first/last name and status persists after reload', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'profile_save');
  await loginUI(page, creds);

  // Go to profile
  await page.getByRole('link', { name: 'Профиль' }).click();
  await page.waitForURL('**/profile');
  await expect(page.getByTestId('profile-page')).toBeVisible();

  // Fill fields
  const first = 'Иван';
  const last = 'Иванов';
  const status = 'Люблю тесты E2E';

  await page.getByTestId('input-first-name').fill(first);
  await page.getByTestId('input-last-name').fill(last);
  await page.getByTestId('input-status').fill(status);

  // Save
  await page.getByTestId('button-save-profile').click();

  // Expect toast or just wait until pending spinner disappears
  await expect(page.getByTestId('button-save-profile')).toBeEnabled({ timeout: 10000 });

  // Reload page to verify persistence
  await page.reload();
  await expect(page.getByTestId('profile-page')).toBeVisible();

  // Values should remain
  await expect(page.getByTestId('input-first-name')).toHaveValue(first);
  await expect(page.getByTestId('input-last-name')).toHaveValue(last);
  await expect(page.getByTestId('input-status')).toHaveValue(status);

  // Extra: navigate away and back via existing nav links
  await page.getByRole('link', { name: 'Музыка' }).click();
  await page.getByRole('link', { name: 'Профиль' }).click();
  await expect(page.getByTestId('input-first-name')).toHaveValue(first);
  await expect(page.getByTestId('input-last-name')).toHaveValue(last);
  await expect(page.getByTestId('input-status')).toHaveValue(status);
});
