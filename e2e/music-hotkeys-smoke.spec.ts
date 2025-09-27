import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerViaApi, loginUI } from './utils';

// Smoke: мини-плеер — проверяем базовые хоткеи (Space/←/→/↑/↓/M/N/P)
// Используем реальную загрузку короткого аудио и плейлист на странице Музыка

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Возьмём существующий короткий mp3 из public/uploads/audios (если нет, тест просто проверит UI без воспроизведения)
const FALLBACK_URL = '/uploads/audios/audio_1758373369802_3f1972e00e7aaddd89ef47faa4b7be8a.mp3';

async function ensureOneTrack(page: any) {
  // Переходим в Музыку и кликаем Play по первой строке, если есть
  const rows = page.getByTestId(/^music-row-/);
  const count = await rows.count().catch(() => 0);
  if (count > 0) {
    await rows.first().getByRole('button', { name: /Воспроизвести|Пауза/ }).click();
    return true;
  }
  return false;
}

test('music: hotkeys smoke', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'music');
  await loginUI(page, creds);

  // Открыть Музыку
  await page.getByRole('link', { name: 'Музыка' }).click();
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();

  // Убедиться, что есть хотя бы один трек и нажать Play
  const hadTrack = await ensureOneTrack(page);
  if (!hadTrack) {
    // Фолбэк: откроем прямой URL аудио — это не интегрирует в плеер, но позволит проверить хоткеи без ошибок
    await page.goto(FALLBACK_URL);
    await page.goBack();
  }

  // Проверим базовые хоткеи — ошибок быть не должно
  await page.keyboard.press('Space'); // play/pause
  await page.keyboard.press('ArrowLeft'); // seek backward
  await page.keyboard.press('ArrowRight'); // seek forward
  await page.keyboard.press('ArrowUp'); // volume up
  await page.keyboard.press('ArrowDown'); // volume down
  await page.keyboard.press('KeyM'); // mute
  await page.keyboard.press('KeyN'); // next
  await page.keyboard.press('KeyP'); // prev

  // UI остаётся отзывчивым
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();
});
