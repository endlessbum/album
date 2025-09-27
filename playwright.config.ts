import { defineConfig } from '@playwright/test';

// Use a dedicated env var for e2e to avoid picking production APP_ORIGIN
// Default to 5000 to avoid clashing with any existing local dev server
const E2E_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: 'e2e',
  // В CI даём 1 ретрай для редких флаки-кейсов, локально — без ретраев
  retries: process.env.CI ? 1 : 0,
  // Генерируем HTML-отчет в CI и локально (не открываем автоматически в CI)
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE,
    // Сохраняем трейс при падении для последующей диагностики в артефактах CI
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev:run',
    port: Number(new URL(E2E_BASE).port || 5000),
    // Всегда поднимаем отдельный dev-сервер для e2e, чтобы гарантировать нужные ENV (без 429)
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'development',
      // Force in-memory storage for safe, isolated e2e runs
      DATABASE_URL: '',
      // Disable rate limiting to avoid 429 in parallel tests
      RATE_LIMIT_DISABLED: '1',
      // Привязываем порт dev-сервера к PLAYWRIGHT_BASE_URL
      PORT: String(Number(new URL(E2E_BASE).port || 5000)),
    },
  },
});
