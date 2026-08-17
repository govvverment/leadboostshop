// Единая точка чтения переменных окружения.
// Все обращения к import.meta.env лучше делать только здесь,
// чтобы не растаскивать по компонентам и легко было найти при аудите.

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  paymentPublicKey: import.meta.env.VITE_PAYMENT_PUBLIC_KEY || '',
  useMock: import.meta.env.VITE_USE_MOCK !== 'false', // по умолчанию true, пока нет backend

  // Supabase — реальный backend товаров/покупок/баланса.
  // anon-ключ НЕ секретный, его можно спокойно класть во фронтенд —
  // так и задумано в Supabase, все ограничения на его стороне (RLS).
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // Telegram ID администратора (или несколько через запятую) — только
  // этому пользователю будет виден пункт "Админ-панель" в профиле.
  // Сама защита данных всё равно идёт через пароль на backend — это
  // просто чтобы обычные покупатели даже не видели кнопку.
  adminTelegramIds: (import.meta.env.VITE_ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  // Username бота (без @) и short name Mini App (задан в BotFather
  // через /newapp) — вместе дают реферальную ссылку вида
  // t.me/<botUsername>/<botAppShortName>?startapp=ref_<id>. Обычная
  // Menu Button не прокидывает start_param, а Direct Link Mini App —
  // прокидывает, поэтому для рефералки нужен именно такой формат.
  botUsername: import.meta.env.VITE_BOT_USERNAME || '',
  botAppShortName: import.meta.env.VITE_BOT_APP_SHORTNAME || 'shop',

  // Ссылка на чат поддержки (открывается из кнопки "Поддержка" везде в приложении).
  supportUrl: import.meta.env.VITE_SUPPORT_URL || '',
};
