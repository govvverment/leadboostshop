import { useTelegramUser } from './useTelegramUser';
import { config } from '../config';

// Виден ли пункт "Админ-панель" этому пользователю. Это ТОЛЬКО про
// видимость кнопки в интерфейсе — не про безопасность данных. Реальная
// защита (пароль) идёт на backend, эта проверка лишь прячет кнопку от
// обычных покупателей, чтобы не путать их лишним пунктом меню.
export function useIsAdmin() {
  const tgUser = useTelegramUser();
  if (!tgUser || config.adminTelegramIds.length === 0) return false;
  return config.adminTelegramIds.includes(String(tgUser.id));
}
