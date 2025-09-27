import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI } from './utils';

// Smoke: эфемерные сообщения — включить режим, отправить текст, увидеть таймер/пометку

test('chat: send ephemeral text message', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'ephem');
  await loginUI(page, creds);

  // В сообщения
  await page.getByRole('link', { name: 'Сообщения' }).click();
  await expect(page.getByTestId('chat-page')).toBeVisible();

  // Включить эфемерный режим
  await page.getByTestId('button-ephemeral-mode').click();
  // Убедимся, что режим точно включился по плейсхолдеру
  await expect(page.getByTestId('input-message')).toHaveAttribute(
    'placeholder',
    /исчезнет через 2 мин/i,
    { timeout: 5000 }
  );

  // Ввести текст и отправить
  const input = page.getByTestId('input-message');
  await input.fill('Эфемерный привет');
  await page.getByTestId('button-send-message').click();

  // Проверяем, что сообщение появилось в списке
  // Ищем внутри контейнера сообщений и исключаем всплывающий таймер '-ephemeral-timer'
  const messagesContainer = page.getByTestId('messages-container');
  const lastMessage = messagesContainer.locator('[data-testid^="message-"]:not([data-testid$="-ephemeral-timer"])').last();
  await expect(lastMessage).toBeVisible({ timeout: 10000 });
  await expect(lastMessage).toContainText('Эфемерный привет');
});
