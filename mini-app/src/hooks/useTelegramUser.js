// Читает данные текущего пользователя, которые Telegram передаёт
// Mini App'у автоматически при открытии — включая photo_url (аватар).
//
// ВАЖНО про безопасность: initDataUnsafe называется "unsafe" не просто так —
// эти данные можно подделать на клиенте, поэтому для действий, где важна
// подлинность (начисление денег, авторизация и т.п.), backend должен отдельно
// проверить подпись initData (raw-строку) через HMAC-SHA256 с секретным
// токеном бота. Для отображения аватара/имени в интерфейсе — как здесь —
// это не требуется, риска нет: мы просто показываем то, что прислал Telegram.
//
// За пределами Telegram (например, при тесте в обычном браузере) этого
// объекта не будет — тогда просто возвращаем null и используем заглушку.

export function useTelegramUser() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  if (!tgUser) return null;

  return {
    id: tgUser.id,
    firstName: tgUser.first_name,
    username: tgUser.username ? `@${tgUser.username}` : null,
    photoUrl: tgUser.photo_url || null, // может отсутствовать — не у всех есть открытое фото
  };
}

// Сырая, неразобранная строка initData — та самая, что нужно
// отправлять на backend для реальной проверки подписи. В отличие от
// initDataUnsafe (объект выше), это именно ПОДПИСАННЫЕ Telegram'ом
// данные — их нельзя подделать в браузере, не зная секретный токен
// бота. Вне Telegram (обычный браузер) — пустая строка.
export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData || '';
}

// Запасной источник реферала. Telegram's start_param (?startapp=)
// надёжно долетает только если пользователь уже хоть раз открывал
// бота — для совсем новых он теряется. Поэтому бот (bot-webhook) сам
// присылает кнопку "Открыть магазин" с рефералом прямо в URL
// (?ref=ref_123) — обычный query-параметр, Telegram его сохраняет
// при открытии Mini App через такую кнопку.
export function getUrlRefParam() {
  return new URLSearchParams(window.location.search).get('ref') || '';
}
