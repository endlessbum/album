import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { registerViaApi, loginUI } from './utils';

// Быстрые a11y-проверки авторизованных страниц: Музыка, Профиль, Настройки
// Все комментарии на русском 🇷🇺

test.describe.configure({ mode: 'serial' }); // Сериализуем, чтобы снизить флак на логине

test.beforeEach(async ({ page, request }) => {
  const creds = await registerViaApi(request, 'a11y');
  await loginUI(page, creds);
});

type Target = { name: string; navigate: (page: any) => Promise<void>; assertReady: (page: any) => Promise<void> };
const authedRoutes: Target[] = [
  {
    name: 'music',
    navigate: async (page) => { await page.getByRole('link', { name: 'Музыка' }).click(); },
    assertReady: async (page) => { await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible(); },
  },
  {
    name: 'profile',
    navigate: async (page) => { await page.getByRole('link', { name: 'Профиль' }).click(); },
    assertReady: async (page) => { await expect(page.getByTestId('profile-page')).toBeVisible(); },
  },
  {
    name: 'settings',
    navigate: async (page) => { await page.getByRole('link', { name: 'Настройки' }).click(); },
    assertReady: async (page) => { await expect(page.getByTestId('settings-page')).toBeVisible(); },
  },
];

for (const target of authedRoutes) {
    test(`a11y (auth): ${target.name}`, async ({ page }) => {
      await target.navigate(page);
      await target.assertReady(page);
      // Небольшая пауза, чтобы UI стабилизировался перед Axe
      await page.waitForTimeout(200);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

  const serious = (results.violations || []).filter(v => !['minor', 'moderate'].includes(v.impact || ''));
  // Делаем проверку строгой: не допускаем серьёзных/критичных нарушений
  expect(serious, `[a11y:${target.name}] серьёзные нарушения: ${serious.map(v => v.id).join(', ')}`).toHaveLength(0);
  });
}
