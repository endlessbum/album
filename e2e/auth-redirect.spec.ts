import { test, expect } from '@playwright/test';

// Unauthenticated users should be redirected from / to /auth

test('redirects unauthenticated / -> /auth and shows legal links', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/auth');
  const privacy = page.getByTestId('link-privacy');
  const terms = page.getByTestId('link-terms');
  await expect(privacy).toBeVisible();
  await expect(terms).toBeVisible();
});
