import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { registerViaApi, loginUI } from './utils';

// Smoke: загрузка аудио — выбираем файл, задаём метаданные, ждём появления в списке, затем удаляем для чистоты

// Генерируем небольшой WAV/PCM в памяти (несколько байт заголовка + тишина)
// Это валидный контейнер для прохождения фильтров accept/mimetype
function makeTinyWavBuffer(): Buffer {
  // Минимальный WAV заголовок (RIFF) с 44 байтами + немного данных
  // Для теста достаточно скелета; браузер не будет воспроизводить, это не требуется
  const header = Buffer.from(
    [
      0x52,0x49,0x46,0x46, 0x24,0x00,0x00,0x00, 0x57,0x41,0x56,0x45, // RIFF .... WAVE
      0x66,0x6d,0x74,0x20, 0x10,0x00,0x00,0x00, 0x01,0x00,0x01,0x00, // fmt  .... .... (PCM, mono)
      0x40,0x1f,0x00,0x00, 0x80,0x3e,0x00,0x00, 0x02,0x00,0x10,0x00, // 8kHz, 16-bit
      0x64,0x61,0x74,0x61, 0x00,0x00,0x00,0x00 // data .... (0 bytes)
    ]
  );
  const data = Buffer.alloc(16, 0);
  return Buffer.concat([header, data]);
}

function listContainer(page: any) {
  return page.getByTestId('music-list');
}

test('music: upload smoke', async ({ page, request }) => {
  const creds = await registerViaApi(request, 'mupl');
  await loginUI(page, creds);

  // Открыть Музыку
  await page.getByRole('link', { name: 'Музыка' }).click();
  await expect(page.getByRole('heading', { name: 'Музыка' })).toBeVisible();

  // Выбрать файл: используем встроенный file chooser, передаём файл из памяти
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Добавить' }).click(),
  ]);
  await chooser.setFiles({
    name: 'tiny.wav',
    mimeType: 'audio/wav',
    buffer: makeTinyWavBuffer(),
  });

  // Должно открыться диалоговое окно "Детали трека"
  await expect(page.getByRole('dialog')).toBeVisible();
  const titleInput = page.locator('#title');
  await expect(titleInput).toBeVisible();
  const unique = `E2E_${Date.now().toString().slice(-6)}`;
  await titleInput.fill(unique);

  // Нажать "Загрузить"
  await page.getByRole('button', { name: 'Загрузить' }).click();

  // Ждём появления списка и строки с новым заголовком
  await expect(listContainer(page)).toBeVisible({ timeout: 15000 });
  await expect(listContainer(page).getByText(unique, { exact: false })).toBeVisible({ timeout: 15000 });

  // Очистка: удалить только что добавленный трек
  const row = listContainer(page)
    .getByTestId(/^music-row-/)
    .filter({ hasText: unique })
    .first();
  await row.getByRole('button', { name: 'Дополнительно' }).click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  await expect(listContainer(page).getByText(unique, { exact: false })).toHaveCount(0);
});
