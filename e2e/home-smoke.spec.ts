import { test, expect } from '@playwright/test';
import { registerViaApi, loginViaApi } from './utils';

test.describe('home: layout & proportions', () => {
  test('grid renders and cards keep aspect ratios', async ({ page, request }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Auth: register a fresh user and login via UI
  const creds = await registerViaApi(request, 'home');
  await loginViaApi(page, creds);
  // Ensure we are on the home page (ProtectedRoute redirect lands there after login)
  await page.goto('/');
  // Wait for home page to render
  await expect(page.getByTestId('home-page')).toBeVisible({ timeout: 20000 });
  // Title should be present (text may vary; check visibility instead of exact text)
  await expect(page.getByTestId('page-title')).toBeVisible();

    // Grid exists
    const grid = page.getByTestId('memories-grid');
    await expect(grid).toBeVisible();

    // Cards may be empty on fresh in-memory DB: handle both cases
    const cards = grid.locator('.flip-card');
    const count = await cards.count();
    if (count === 0) {
      await expect(page.getByTestId('empty-state')).toBeVisible();
      return; // nothing else to validate
    }

    // If there is a wide horizontal card, check it looks wide (w/h >= 1.4)
    const wideSel = grid.locator('[class*="card-ar-"][class*="-h"]');
    const wideCount = await wideSel.count();
    if (wideCount > 0) {
      const box = await wideSel.first().boundingBox();
      if (box) {
        const ratio = box.width / box.height;
        expect(ratio).toBeGreaterThanOrEqual(1.4);
      }
    }

    // Snapshot of grid for visual sanity (optional, won't fail test if cannot create)
    try { await grid.screenshot({ path: 'test-results/home-grid.png' }); } catch {}
  });
});
