import dotenv from 'dotenv';

const isTest = process.env.NODE_ENV === 'test';

// В юнит-тестах пропускаем загрузку .env, чтобы не подтягивать реальную БД
if (isTest) {
  if (process.env.DATABASE_URL) delete process.env.DATABASE_URL;
  console.warn('🧪 Tests: skipping .env load; DATABASE_URL disabled');
} else {
  // Загружаем переменные окружения как можно раньше, НЕ перезаписывая уже заданные
  const result = dotenv.config({ override: false });
  const maskUrl = (url?: string) => {
    if (!url) return '❌ Missing';
    try {
      const u = new URL(url);
      const user = u.username ? (u.username.length > 2 ? u.username.slice(0, 2) + '***' : '***') : '';
      const host = u.hostname;
      const db = u.pathname?.slice(1) || '';
      return `${u.protocol}//${user}:${'***'}@${host}/${db}`;
    } catch {
      return (url ?? '').slice(0, 20) + '...';
    }
  };

  if (result.error) {
    // Если .env отсутствует (ENOENT) — не падаем: в проде переменные приходят из окружения платформы
    const code = (result.error as any)?.code;
    if (code === 'ENOENT') {
      console.warn('ℹ️ .env not found; using platform environment variables only');
    } else {
      console.error('❌ Ошибка загрузки .env:', result.error);
    }
  } else {
    console.warn('✅ Переменные окружения загружены из .env');
  }

  console.warn(`📊 DATABASE_URL: ${maskUrl(process.env.DATABASE_URL)}`);
  console.warn(`📊 PORT: ${process.env.PORT || 'Using default'}`);
}

export {};
