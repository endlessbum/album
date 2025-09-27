import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: сохранить основные настройки (фон чата и шрифт) и проверить мгновенное применение UI
// Комментарии на русском

test('settings: save chat background and font', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'sett');
  await loginUI(page, creds);

  // Перейти в Настройки
  await page.getByRole('link', { name: 'Настройки' }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();

  // Открыть вкладку Сообщения
  await page.getByTestId('tab-messages').click();

  // Выбрать фоновую тему для чата
  const bgSelect = page.getByTestId('select-chat-background');
  await bgSelect.click();
  await page.getByRole('option', { name: 'Голубой' }).click();

  // Перейти во вкладку Оформление
  await page.getByTestId('tab-appearance').click();

  // Выбрать шрифт интерфейса
  const fontSelect = page.getByTestId('select-font');
  await fontSelect.click();
  await page.getByRole('option', { name: 'Manrope' }).click();

  // Сохранить
  const saveBtn = page.getByTestId('button-save-settings');
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Проверить localStorage (в этом же контексте)
  const ls = await page.evaluate(() => ({
    chatBg: localStorage.getItem('ui:chatBackground'),
    font: localStorage.getItem('ui:font'),
  }));
  expect(ls.chatBg).toBe('blue');
  expect(ls.font).toBe('Manrope');

  // Проверить применённую переменную CSS шрифта
  const cssFamily = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-sans'));
  expect(cssFamily).toContain('Manrope');
});
