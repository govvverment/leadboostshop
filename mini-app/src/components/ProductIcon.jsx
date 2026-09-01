// Заглушка-иконка для товара/категории без своей загруженной картинки
// (в частности — иконки категорий "Аккаунты"/"Технические решения",
// пока для них не залили фото через админку). Раньше это была готовая
// PNG-картинка с зашитым внутри тёмным фоном — на светлой теме смотрелась
// инородным тёмным пятном. Теперь это инлайн-SVG на currentColor поверх
// фона var(--accent-soft) — фиолетовый акцент, который сам подстраивается
// под тему (см. ThemeContext/tokens.css), как и остальная иконография.
const ICONS = {
  account: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c1-3.6 3-5.6 5.5-5.6 1 0 1.9.3 2.7.8" />
      <path d="M14.5 13.7l2 2 3.5-4" />
    </svg>
  ),
  solution: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8l-4 4 4 4" />
      <path d="M15 8l4 4-4 4" />
    </svg>
  ),
};

export default function ProductIcon({ kind, size = 40 }) {
  const variant = kind === 'account' ? 'account' : 'solution';
  return (
    <span className="product-icon" style={{ width: size, height: size }} aria-hidden="true">
      {ICONS[variant]}
    </span>
  );
}
