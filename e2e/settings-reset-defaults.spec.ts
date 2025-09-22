import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: сброс настроек к сохранённым дефолтам
// Алгоритм: определяем текущий (дефолтный) шрифт, меняем на другой, жмём Reset — UI возвращается к исходному. 
// Сохранение тут не обязательно: цель теста — проверить именно откат UI к дефолтам.

test('settings: reset to defaults restores original UI font', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'setres');
  await loginUI(page, creds);

  // В Настройки → Оформление
  await page.getByRole('link', { name: 'Настройки' }).click();
  await page.getByTestId('tab-appearance').click();

  // Запоминаем текущий (дефолтный) шрифт по CSS-переменной
  const initialCss = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-sans'));
  const initialIsManrope = initialCss.includes('Manrope');
  const targetFont = initialIsManrope ? 'Inter' : 'Manrope';

  // Меняем на другой шрифт (отличный от исходного)
  await page.getByTestId('select-font').click();
  await page.getByRole('option', { name: targetFont }).click();

  // Кнопка Reset должна появиться
  const resetBtn = page.getByTestId('button-reset-settings');
  await expect(resetBtn).toBeVisible();

  // Жмём Reset и проверяем, что вернулся Manrope визуально
  await resetBtn.click();
  const revertedCss = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-sans'));
  expect(revertedCss).toContain(initialIsManrope ? 'Manrope' : 'Inter');
});
