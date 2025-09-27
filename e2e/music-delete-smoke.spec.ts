import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: удаление аудио — открываем Музыку, если есть трек, удаляем через меню и проверяем что строка исчезла

async function ensureHasRow(page: any) {
  const list = page.getByTestId('music-list');
  const exists = await list.isVisible().catch(() => false);
  return exists;
}

test('music: delete smoke', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'mdel');
  await loginUI(page, creds);

  await page.getByRole('link', { name: 'Музыка' }).click();
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();

  const hasList = await ensureHasRow(page);
  if (!hasList) test.skip(true, 'Нет треков для удаления');

  const firstRow = page.getByTestId(/^music-row-/).first();
  const titleBefore = await firstRow.textContent();

  // Меню → Удалить
  await firstRow.getByRole('button', { name: 'Дополнительно' }).click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();

  // Подтверждения нет — ждём, что строка исчезнет/изменится
  await expect(firstRow).not.toHaveText(titleBefore || '', { timeout: 10000 });
});
