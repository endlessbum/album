import { test, expect } from '@playwright/test';

// UI smoke with registration + redirect to home and key UI assertions

test('registers a user and shows home UI', async ({ page }) => {
  // Go to auth page
  await page.goto('/auth');

  // Switch to registration tab
  await page.getByTestId('tab-register').click();

  // Generate unique credentials per run
  const suffix = Date.now().toString();
  const email = `e2e+${suffix}@example.com`;
  const username = `user_${suffix}`;
  const password = 'Passw0rd!e2e';

  // Fill registration form
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-register-username').fill(username);
  await page.getByTestId('input-register-password').fill(password);
  await page.getByTestId('input-confirm-password').fill(password);

  // Agree to privacy policy (checkbox is linked to label)
  await page.locator('label[for="agree-register"]').click();

  // Submit
  await page.getByTestId('button-register').click();

  // Should navigate to home
  await page.waitForURL('**/');

  // Assert main UI elements
  await expect(page.getByTestId('home-page')).toBeVisible();
  await expect(page.getByTestId('page-title')).toHaveText('Наша история');
  await expect(page.getByTestId('button-create-memory')).toBeVisible();
});
