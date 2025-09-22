import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: эфемерные медиа — съемка фото, загрузка, размытое превью до разблокировки, таймер

test('chat: ephemeral photo locked preview then unlock', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'ephem-media');
  await loginUI(page, creds);

  await page.getByRole('link', { name: 'Сообщения' }).click();
  await expect(page.getByTestId('chat-page')).toBeVisible();

  // Открыть модалку камеры и сделать фото
  await page.getByTestId('button-ephemeral-capture').click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  // В среде CI камера может отсутствовать — пропускаем тест если нет video
  const hasVideo = await modal.locator('video').isVisible().catch(() => false);
  if (!hasVideo) test.skip();
  await modal.getByTestId('ephemeral-capture-photo').click();

  // Должно появиться сообщение с медиа и размытым оверлеем-замком
  // Ищем сам контейнер эфемерного медиа напрямую (без привязки к последнему сообщению)
  const media = page.getByTestId(/message-.*-ephemeral-media/).first();
  await expect(media).toBeVisible();
  const overlay = media.getByTestId(/ephemeral-lock-overlay$/);
  await expect(overlay).toBeVisible();

  // Разблокировать
  await overlay.click();
  await expect(overlay).toBeHidden();
  // Таймер виден (внутри того же медиа-контейнера)
  await expect(media.getByTestId(/ephemeral-timer$/)).toBeVisible();
});
