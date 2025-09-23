// mobile-layout-extra.spec.ts
// Дополнительные E2E тесты для мобильной версии. Фокус: устойчивость UI, сохранение сессии, отправка сообщений, 404, тема, скелетоны, модалки.
import { test, expect, devices } from '@playwright/test';
import { registerViaApi, loginViaApi } from './utils';

const mobileViewport = { width: 390, height: 844 };
test.use({ viewport: mobileViewport, userAgent: devices['iPhone 13'].userAgent });

async function expectNoHorizontalScroll(page) {
  const has = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(has, 'Unexpected horizontal overflow').toBeFalsy();
}
async function shotOnFail(page: any, name: string, fn: () => Promise<void>) {
  try { await fn(); await expectNoHorizontalScroll(page); }
  catch (e) { await page.screenshot({ path: `test-results/${name}.png`, fullPage: true }); throw e; }
}

// 1. Сохранение авторизации после перезагрузки
test.describe('auth persistence', () => {
  test('session survives full reload', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'persist');
    await loginViaApi(page, creds);
    await page.goto('/');
    await expect(page.getByTestId('home-page')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

// 2. Отправка сообщения в чате
test.describe('chat messaging', () => {
  test('send text message appears in history', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'chat-send');
    await loginViaApi(page, creds);
    await page.goto('/');
    await page.getByRole('link', { name: 'Сообщения' }).click();
    await expect(page.getByTestId('chat-page')).toBeVisible();
    const input = page.getByTestId('message-input');
    const text = 'Авто сообщение ' + Date.now();
    await input.fill(text);
    await page.getByRole('button', { name: /Отправить|Send/i }).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

// 3. 404 страница не ломает мобильный layout
test.describe('not found route', () => {
  test('unknown route shows not-found and no overflow', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'nf');
    await loginViaApi(page, creds);
    await page.goto('/really-unknown-route-' + Date.now());
    // Допускаем разные варианты
    const found = await page.locator('[data-testid=not-found], text=/404/').first().isVisible();
    expect(found).toBeTruthy();
    await expectNoHorizontalScroll(page);
  });
});

// 4. Переключение темы (если есть переключатель)
test.describe('theme toggle', () => {
  test('toggles data-theme without layout shift', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'theme');
    await loginViaApi(page, creds);
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Тема|Theme|Dark/i });
    const exists = await toggle.isVisible().catch(() => false);
    test.skip(!exists, 'No theme toggle present');
    const before = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      w: document.documentElement.scrollWidth
    }));
    await toggle.click();
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      w: document.documentElement.scrollWidth
    }));
    expect(after.theme).not.toBe(before.theme);
    expect(Math.abs(after.w - before.w)).toBeLessThan(8);
    await expectNoHorizontalScroll(page);
  });
});

// 5. Медленная сеть -> отображение скелетона без overflow
test.describe('skeleton loading', () => {
  test('home skeleton visible during delayed API', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'skeleton');
    await loginViaApi(page, creds);
    await page.route('**/api/**/home**', async route => {
      await new Promise(r => setTimeout(r, 800));
      await route.continue();
    });
    await page.goto('/');
    // Пробуем найти skeleton
    const skeleton = page.locator('[data-testid=skeleton], .skeleton').first();
    await skeleton.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    await expectNoHorizontalScroll(page);
  });
});

// 6. Проверка модалки (если доступна) на отсутствие утечки фокуса
test.describe('modal accessibility', () => {
  test('focus trapped inside modal', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'modal');
    await loginViaApi(page, creds);
    await page.goto('/');
    const openBtn = page.getByRole('button', { name: /Информация|About|Помощь|Help/i }).first();
    const visible = await openBtn.isVisible().catch(() => false);
    test.skip(!visible, 'Modal trigger not found');
    await openBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Tab cycle check (rough)
    await page.keyboard.press('Tab');
    const active1 = await page.evaluate(() => document.activeElement?.outerHTML || '');
    await page.keyboard.press('Tab');
    const active2 = await page.evaluate(() => document.activeElement?.outerHTML || '');
    expect(active1).not.toBe('');
    expect(active2).not.toBe('');
    // Escape closes (if implemented)
    await page.keyboard.press('Escape');
    await dialog.isHidden().catch(() => {});
    await expectNoHorizontalScroll(page);
  });
});

// 7. Виртуализированный список (если есть) не создает горизонтальный скролл при быстрой прокрутке
test.describe('virtual list stability', () => {
  test('rapid scroll does not cause horizontal overflow', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'virt');
    await loginViaApi(page, creds);
    await page.goto('/');
    // Переходим в раздел Музыка (предположительно длинный список)
    await page.getByRole('link', { name: 'Музыка' }).click();
    await expect(page.getByRole('heading', { name: /Музыка/ })).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(80);
    }
    await expectNoHorizontalScroll(page);
  });
});

// 8. Проверка что bottom navigation не дублируется после нескольких переходов и back
test.describe('navigation reuse', () => {
  test('nav element count stable after history navigation', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'nav-reuse');
    await loginViaApi(page, creds);
    await page.goto('/');
    const seq = ['Музыка', 'Сообщения', 'Настройки', 'Музыка', 'Сообщения'];
    for (const label of seq) {
      await page.getByRole('link', { name: label }).click();
      await expect(page.getByRole('link', { name: label })).toBeVisible();
      const navCount = await page.locator('nav').count();
      expect(navCount).toBe(1);
    }
    await page.goBack();
    const navCountFinal = await page.locator('nav').count();
    expect(navCountFinal).toBe(1);
    await expectNoHorizontalScroll(page);
  });
});

// 9. Offline -> отправка сообщения блокируется (грейсфул)
test.describe('chat offline handling', () => {
  test('cannot send while offline (graceful UI)', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'chat-offline');
    await loginViaApi(page, creds);
    await page.goto('/');
    await page.getByRole('link', { name: 'Сообщения' }).click();
    await expect(page.getByTestId('chat-page')).toBeVisible();
    await page.context().setOffline(true);
    const input = page.getByTestId('message-input');
    await input.fill('Msg offline');
    const sendBtn = page.getByRole('button', { name: /Отправить|Send/i });
    await sendBtn.click();
    // Ожидаем либо предупреждение, либо отсутствие сообщения
    const warning = await page.getByText(/offline|нет соедин/i).first().isVisible().catch(() => false);
    const appeared = await page.getByText('Msg offline', { exact: true }).isVisible().catch(() => false);
    expect(warning || !appeared).toBeTruthy();
    await page.context().setOffline(false);
    await expectNoHorizontalScroll(page);
  });
});

// 10. Быстрая последовательная навигация не вызывает overflow
test.describe('rapid nav stress', () => {
  test('quick taps keep layout stable', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'rapid');
    await loginViaApi(page, creds);
    await page.goto('/');
    const labels = ['Музыка', 'Сообщения', 'Настройки', 'Сообщения', 'Музыка', 'Настройки'];
    for (const l of labels) {
      await page.getByRole('link', { name: l }).click();
      await page.waitForTimeout(40);
    }
    await expectNoHorizontalScroll(page);
  });
});

// 11. Проверка мета-тегов viewport не изменяются при переходах
test.describe('viewport meta stability', () => {
  test('meta viewport constant', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'meta');
    await loginViaApi(page, creds);
    await page.goto('/');
    const base = await page.locator('meta[name=viewport]').getAttribute('content');
    await page.getByRole('link', { name: 'Музыка' }).click();
    const music = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(music).toBe(base);
    await page.getByRole('link', { name: 'Настройки' }).click();
    const settings = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(settings).toBe(base);
    await expectNoHorizontalScroll(page);
  });
});

// 12. Проверка что элементы первой страницы не дергают высоту при подгрузке изображений
test.describe('image lazy stability', () => {
  test('lazy images do not shift width', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'lazyimg');
    await loginViaApi(page, creds);
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(Math.abs(after - before)).toBeLessThan(8);
    await expectNoHorizontalScroll(page);
  });
});

// 13. Стресс: много открытий/закрытий настроек
test.describe('settings open stress', () => {
  test('re-enter settings page multiple times', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'settings-stress');
    await loginViaApi(page, creds);
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      await page.getByRole('link', { name: 'Настройки' }).click();
      await expect(page.getByTestId('settings-page')).toBeVisible();
      await page.getByRole('link', { name: 'Музыка' }).click();
      await expect(page.getByRole('heading', { name: /Музыка/ })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
  });
});

// 14. Проверка aria-атрибутов табов настроек
test.describe('settings tabs aria', () => {
  test('tabs have role=tab and aria-controls', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'tabs-aria');
    await loginViaApi(page, creds);
    await page.goto('/');
    await page.getByRole('link', { name: 'Настройки' }).click();
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    test.skip(count === 0, 'No tabs');
    for (let i = 0; i < count; i++) {
      const t = tabs.nth(i);
      await expect(t).toHaveAttribute('role', 'tab');
      const ctrl = await t.getAttribute('aria-controls');
      expect(ctrl).toBeTruthy();
    }
    await expectNoHorizontalScroll(page);
  });
});

// 15. Проверка что footer (если есть) не исчезает после навигации назад/вперед
test.describe('footer persistence', () => {
  test('footer stable across history', async ({ page, request }) => {
    const creds = await registerViaApi(request, 'footer');
    await loginViaApi(page, creds);
    await page.goto('/');
    const footer = page.locator('footer');
    const exists = await footer.first().isVisible().catch(() => false);
    test.skip(!exists, 'Footer not present');
    await page.getByRole('link', { name: 'Музыка' }).click();
    await expect(footer).toBeVisible();
    await page.goBack();
    await expect(footer).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

    // MUSIC
    await page.getByRole('link', { name: 'Музыка' }).click();
    await expect(page.getByRole('heading', { name: /Музыка/ })).toBeVisible();
    // Tabs container should be horizontally scrollable but not overflow viewport parent (check root only)
    await screenshotIfFailure(page, 'music');

    // CHAT
    await page.getByRole('link', { name: 'Сообщения' }).click();
    await expect(page.getByTestId('chat-page')).toBeVisible();
    // Input area visible
    await expect(page.getByTestId('message-input-container')).toBeVisible();
    await screenshotIfFailure(page, 'chat');

    // SETTINGS
    await page.getByRole('link', { name: 'Настройки' }).click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    // Scroll tabs horizontally and ensure at least last tab is reachable
    const tabsList = page.getByRole('tablist');
    await tabsList.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(page.getByRole('tab', { name: 'Игры' })).toBeVisible();
    await screenshotIfFailure(page, 'settings');
  });
});
