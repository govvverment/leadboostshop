import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { openSupportChat } from '../utils/support';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { LOCALES, LOCALE_LABELS, LOCALE_NAMES } from '../i18n/translations';
import SheetOverlay from './SheetOverlay';
import logo from '../assets/logo.png';

// logo импортируется как модуль (а не лежит в public/ и не грузится
// отдельным HTTP-запросом по строковому пути) — Vite сам вшивает такие
// маленькие файлы (меньше 4кб) прямо в JS-бандл как base64, поэтому он
// появляется мгновенно вместе с остальной вёрсткой, без отдельного
// сетевого запроса и характерного "мигания" пустого места. Сам файл —
// белый рисунок на прозрачном фоне (был сделан под тёмную тему), в
// светлой теме инвертируем его цветом через CSS (см. components.css) —
// иконку поддержки, наоборот, теперь рисуем инлайн-SVG на currentColor,
// чтобы не зависеть от заранее "прошитого" в PNG цвета вообще.
function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.4" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.4" />
    </svg>
  );
}

// Тумблер тёмная/светлая тема — просто переключатель, без подписей.
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      className={'theme-toggle' + (isLight ? ' is-light' : '')}
      role="switch"
      aria-checked={isLight}
      aria-label={t('header.lightTheme')}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__thumb" />
    </button>
  );
}

// Переключатель языка — компактная кнопка с кодом текущего языка (RU/UA/EN),
// по размеру и форме симметричная тумблеру темы рядом. Раньше тут сразу
// показывались все три варианта в ряд — это "плавало": при переключении
// активный пункт менял ширину/вес шрифта и сдвигал соседние кнопки хедера.
// Теперь виден только текущий язык, а выбор — во всплывающей снизу шторке
// (тот же компонент, что и везде в приложении для шторок/фильтров), так
// хедер всегда остаётся одной и той же фиксированной ширины.
function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="locale-toggle"
        aria-label={t('header.language')}
        onClick={() => setOpen(true)}
      >
        {LOCALE_LABELS[locale]}
      </button>

      {open && (
        <SheetOverlay onDismiss={() => setOpen(false)}>
          <h2 className="sheet__title">{t('header.language')}</h2>
          <div className="filter-sheet__list">
            {LOCALES.map((code) => (
              <button
                key={code}
                className={'filter-sheet__item' + (locale === code ? ' is-active' : '')}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                {LOCALE_NAMES[code]}
              </button>
            ))}
          </div>
        </SheetOverlay>
      )}
    </>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { t } = useLocale();
  return (
    <header className="app-header">
      <button className="app-header__logo" onClick={() => navigate('/')} aria-label={t('header.home')}>
        <img src={logo} alt="LEAD BOOST" className="app-header__logo-img" />
      </button>
      <div className="app-header__right">
        <LocaleToggle />
        <ThemeToggle />
        <button className="app-header__support" onClick={openSupportChat}>
          <span className="app-header__support-icon" aria-hidden="true">
            <SupportIcon />
          </span>
          <span className="app-header__support-label">{t('header.support')}</span>
        </button>
      </div>
    </header>
  );
}
