import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

test('chat empty state and input focus', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'chat');
  await loginUI(page, creds);

  // Navigate to Messages via bottom nav
  await page.getByRole('link', { name: 'Сообщения' }).click();
  await expect(page.getByTestId('chat-page')).toBeVisible();

  // Empty state or messages container visible
  const empty = page.getByTestId('empty-chat-state');
  const hasEmpty = await empty.isVisible().catch(() => false);
  if (!hasEmpty) {
    await expect(page.getByTestId('messages-container')).toBeVisible();
  }

  // Focus message input and type some text, ensure send stays disabled when empty, enabled when text
  const input = page.getByTestId('input-message');
  await input.focus();
  await input.fill('Привет!');
  const sendBtn = page.getByTestId('button-send-message');
  await expect(sendBtn).toBeEnabled();
  // Clear text -> disabled
  await input.fill('');
  await expect(sendBtn).toBeDisabled();
});
