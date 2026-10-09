import { createContext, useContext, useState } from 'react';
import { translations, LOCALES, DEFAULT_LOCALE, pluralize as pluralizeHelper } from '../i18n/translations';

// Язык интерфейса — отдельный контекст (по аналогии с ThemeContext), чтобы
// не трогать большой AppContext. По умолчанию — русский, выбор запоминается
// в localStorage и переживает перезаход в приложение.
const STORAGE_KEY = 'locale';
const LocaleContext = createContext(null);

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // localStorage может быть недоступен (приватный режим и т.п.) —
    // тогда просто всегда стартуем с русского.
    return DEFAULT_LOCALE;
  }
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  const setLocale = (next) => {
    if (!LOCALES.includes(next) || next === locale) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // недоступен localStorage — выбор языка просто не переживёт перезаход, не критично
    }
  };

  // t('home.title') — простой поиск строки по пути; если в текущем языке
  // ключа нет (экран ещё не переведён на этот язык), падаем обратно на
  // русский, а не показываем пустоту/ключ пользователю.
  const t = (key, params) => {
    let value = getByPath(translations[locale], key);
    if (value === undefined) value = getByPath(translations[DEFAULT_LOCALE], key);
    if (value === undefined) return key;
    if (typeof value === 'string' && params) {
      return Object.keys(params).reduce(
        (str, p) => str.replace(new RegExp(`{{${p}}}`, 'g'), params[p]),
        value
      );
    }
    return value;
  };

  // plural(5, 'home.minutesWords') — достаёт массив словоформ по ключу и
  // склоняет число по правилам текущего языка (см. i18n/translations.js).
  const plural = (n, key) => {
    const forms = getByPath(translations[locale], key) ?? getByPath(translations[DEFAULT_LOCALE], key);
    return pluralizeHelper(locale, n, forms);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, plural }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale должен использоваться внутри LocaleProvider');
  return ctx;
}
