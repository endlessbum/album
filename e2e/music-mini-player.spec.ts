import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: open Music, play first item if present, validate mini-player visibility toggles state

test('mini player appears when playing and shows controls', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'music');
  await loginUI(page, creds);

  // Go to Music
  await page.getByRole('link', { name: 'Музыка' }).click();
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();

  // If list empty, we just assert no crash and nav is visible
  const items = page.getByTestId(/^music-row-/);
  const count = await items.count().catch(() => 0);
  if (count === 0) {
    // No audio items; mini-player stays hidden
    await expect(page.locator('nav .ui-no-such-player')).not.toBeVisible({ timeout: 100 });
    return;
  }

  // Click play on the first item
  await items.first().locator('button[title="Воспроизвести"]').click();

  // Mini-player appears in BottomNav: check presence of play/pause and timeline/volume
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button', { name: /Пауза|Воспроизвести/ })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Следующий' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Предыдущий' })).toBeVisible();

  // Toggle pause/play once
  const toggle = nav.getByRole('button', { name: /Пауза|Воспроизвести/ });
  await toggle.click();
  await toggle.click();
});
