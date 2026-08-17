import { config } from '../config';

// Открывает чат поддержки. Внутри Telegram — через официальный метод
// WebApp SDK (обычный window.open может не сработать в WebView).
// Вне Telegram (тест в браузере) — просто открываем ссылку в новой вкладке.
export function openSupportChat() {
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(config.supportUrl);
  } else {
    window.open(config.supportUrl, '_blank', 'noopener');
  }
}
