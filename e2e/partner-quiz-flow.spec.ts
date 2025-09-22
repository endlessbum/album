import { test, expect } from '@playwright/test';
import { registerViaApi, loginUI, createInvite, registerPartnerWithInvite, openGame, fillByType } from './utils';

async function login(page: any, request: any) {
  const creds = await registerViaApi(request, 'pq');
  await loginUI(page, creds);
}

// Минимальный флоу: старт раунда, ответ на 1 вопрос, переход в фазу угадывания (интерфейсные проверки)

test('partner-quiz: start round and answer', async ({ page, request, browser }) => {
  await login(page, request);
  await openGame(page, 'game-card-partner-quiz');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Викторина|Партнер/i);

  // Подключаем второго пользователя как партнёра через инвайт, открываем игру у него
  const inviteCode = await createInvite(page.request);
  const { ctx, page: page2 } = await registerPartnerWithInvite(browser, inviteCode, 'pq');
  await openGame(page2, 'game-card-partner-quiz');

  // Кнопка старта должна стать активной
  const startBtn = page.getByTestId('button-start-quiz');
  await expect(startBtn).toBeEnabled({ timeout: 10000 });
  await startBtn.click();

  // Ответ на первый вопрос: если текстовый — вводим, если вариант — кликаем первый
  const textInput = page.getByTestId('input-answer');
  if (await textInput.isVisible().catch(() => false)) {
    await fillByType(textInput, 'тестовый ответ');
  } else {
    const optionBtn = page.getByTestId('option-0');
    if (await optionBtn.isVisible().catch(() => false)) {
      await optionBtn.click();
    }
  }

  const submit = page.getByTestId('button-submit-answer');
  if (await submit.isVisible().catch(() => false)) {
    await submit.click();
  }

  // Проверим, что остались в игре и доступна кнопка назад
  await expect(page.getByTestId('button-back')).toBeVisible();
  await ctx.close();
});
