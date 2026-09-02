// Иконки соцсетей для фильтра "Соцсеть" в категории "Аккаунты"
// (CategoryList.jsx). Нарисованы в том же стиле, что и остальная
// иконография приложения (см. ProductIcon.jsx, Header.jsx) — линии на
// currentColor, без зашитых брендовых цветов, чтобы сама иконка
// красилась через var(--text-secondary)/var(--accent) и одинаково
// хорошо смотрелась в тёмной и светлой теме.
const ICONS = {
  telegram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2.5 2.5 10l6.8 2.4" />
      <path d="M21.5 2.5 15 21.5l-5.7-9.1" />
      <path d="M21.5 2.5 9.3 12.4" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.3" cy="6.7" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.9 8.3h-1.4c-1 0-1.7.7-1.7 1.7V11H14l-.4 2.4h-2.8V20" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12.3c0-.6-.1-1.2-.2-1.8H12v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.6Z" />
      <path d="M12 21c2.4 0 4.5-.8 5.9-2.1l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z" />
      <path d="M7 13.9a5.4 5.4 0 0 1 0-3.8V7.8H4a9 9 0 0 0 0 8.4Z" />
      <path d="M12 6.4c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.4 3.8 14.4 3 12 3a9 9 0 0 0-8 4.8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.3 21 7.5 17A8.5 8.5 0 1 1 11 20.5Z" />
      <path d="M9.2 9.9c0-.6.5-1.2 1.1-1.2h.5c.3 0 .6.2.7.5l.6 1.5c.1.3.1.6-.1.8l-.7.7c.6 1.1 1.5 2 2.6 2.6l.7-.7c.2-.2.5-.2.8-.1l1.5.6c.3.1.5.4.5.7v.5c0 .6-.6 1.1-1.2 1.1-3.2 0-6.5-3.3-6.5-6.5Z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3v11.6a3.4 3.4 0 1 1-2.8-3.4" />
      <path d="M13.5 3c.4 2.3 2.2 4 4.5 4.3" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 4.5 19.5 19.5" />
      <path d="M19.5 4.5 4.5 19.5" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8.2c3.3-1.5 6.7-1.5 10 0" />
      <rect x="3.5" y="8.8" width="17" height="9.4" rx="4.7" />
      <circle cx="9.3" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Заглушка для соцсети, не входящей в список выше — платформа всё
  // равно фильтруется (по названию в подписи), просто без узнаваемого
  // логотипа.
  generic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.4 3.7 5.5 3.7 9s-1.3 6.6-3.7 9c-2.4-2.4-3.7-5.5-3.7-9s1.3-6.6 3.7-9Z" />
    </svg>
  ),
};

const MATCHERS = [
  { key: 'telegram', test: /telegram|телеграм|\btg\b/i },
  { key: 'instagram', test: /instagram|инстаграм|\bins?ta\b|\big\b/i },
  { key: 'facebook', test: /facebook|фейсбук|\bfb\b/i },
  { key: 'google', test: /google|гугл|gmail/i },
  { key: 'whatsapp', test: /whatsapp|ватсап|\bwa\b/i },
  { key: 'tiktok', test: /tik.?tok|тикток/i },
  { key: 'twitter', test: /twitter|твиттер|\bx\b/i },
  { key: 'discord', test: /discord|дискорд/i },
];

// Подбирает готовую иконку по названию соцсети (пришедшему из товара как
// свободный текст, например "Instagram" или "Telegram Premium") — по
// ключевому слову, без учёта регистра. Не нашли совпадение — универсальная
// заглушка, фильтр по названию при этом всё равно продолжает работать.
export function matchPlatformIconKey(platform) {
  if (!platform) return 'generic';
  const found = MATCHERS.find((m) => m.test.test(platform));
  return found ? found.key : 'generic';
}

export default function PlatformIcon({ platform, size = 24 }) {
  const key = matchPlatformIconKey(platform);
  return (
    <span className="platform-icon" style={{ width: size, height: size }} aria-hidden="true">
      {ICONS[key]}
    </span>
  );
}
