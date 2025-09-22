import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

test('main navigation after login', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'nav');
  await loginUI(page, creds);

  // Bottom nav links by aria-label
  const linkHome = page.getByRole('link', { name: 'Главная' });
  const linkMusic = page.getByRole('link', { name: 'Музыка' });
  const linkCreate = page.getByRole('link', { name: 'Добавить' });
  const linkMessages = page.getByRole('link', { name: 'Сообщения' });
  const linkProfile = page.getByRole('link', { name: 'Профиль' });
  const linkSettings = page.getByRole('link', { name: 'Настройки' });

  await expect(linkHome).toBeVisible();
  await expect(linkMusic).toBeVisible();
  await expect(linkCreate).toBeVisible();
  await expect(linkMessages).toBeVisible();
  await expect(linkProfile).toBeVisible();
  await expect(linkSettings).toBeVisible();

  // Music
  await linkMusic.click();
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();

  // Create
  await linkCreate.click();
  await expect(page.getByRole('heading', { name: 'Создать воспоминание' })).toBeVisible();

  // Profile
  await linkProfile.click();
  await expect(page.getByTestId('profile-page')).toBeVisible();

  // Settings
  await linkSettings.click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

  // Messages
  await linkMessages.click();
  await expect(page.getByTestId('chat-page')).toBeVisible();

  // Back Home
  await linkHome.click();
  await expect(page.getByTestId('home-page')).toBeVisible();
});
