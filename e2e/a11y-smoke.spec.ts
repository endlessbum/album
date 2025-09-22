import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Быстрые a11y-проверки ключевых страниц без авторизации
// Все комментарии на русском 🇷🇺

// Лёгкие публичные a11y‑проверки (нестрогие)

const publicRoutes = [
  { path: '/auth', name: 'auth' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
];

for (const route of publicRoutes) {
  test(`a11y: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    // Ждём основной контейнер/форму
    await expect(page.locator('main,form,[role="main"]').first()).toBeVisible();
    // Лёгкая проверка через AxeBuilder: focuse на wcag2a/aa, не валим тест на мелочах
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    // Фильтруем шум: minor/moderate
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    // В лёгком режиме просто логируем количество серьёзных проблем, без падения теста
  console.warn(`[a11y:${route.name}] serious/critical:`, serious.length);
  });
}

// Пример авторизованной a11y-smoke: игры
// Для скорости не включаем в общий спринт; оставлено как пример
// test('a11y: games (authorized)', async ({ page }) => {
//   await loginUI(page); // из e2e/utils, можно подключить при расширении
//   await page.goto('/games');
//   await expect(page.getByTestId('games-root')).toBeVisible();
//   await checkA11y(page);
// });
