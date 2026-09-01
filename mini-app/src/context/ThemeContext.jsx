import { createContext, useContext, useEffect, useState } from 'react';

// Тема (тёмная/светлая) — отдельный контекст, а не часть AppContext,
// чтобы не тащить сюда баланс/товары и не трогать без необходимости
// большой существующий файл. По умолчанию — тёмная (как было всегда),
// светлая включается только вручную тумблером в хедере и запоминается
// в localStorage, чтобы не сбрасываться при следующем открытии.
const STORAGE_KEY = 'theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // localStorage может быть недоступен (приватный режим и т.п.) —
    // тогда просто всегда стартуем с тёмной темы.
    return 'dark';
  }
}

// Цвет фона под тему — используется и для <meta name="theme-color">,
// и для нативного хедера/фона самого Telegram (если открыто внутри
// Telegram, а не в обычном браузере).
const THEME_BG = { dark: '#090b10', light: '#f5f6fa' };

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // недоступен localStorage — тема просто не переживёт перезаход, не критично
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', THEME_BG[theme]);

    // Внутри настоящего Telegram — подкрашиваем ещё и его собственный
    // хедер/фон, чтобы рамка вокруг приложения тоже переключалась.
    const tg = window.Telegram?.WebApp;
    if (tg?.setHeaderColor) tg.setHeaderColor(THEME_BG[theme]);
    if (tg?.setBackgroundColor) tg.setBackgroundColor(THEME_BG[theme]);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme должен использоваться внутри ThemeProvider');
  return ctx;
}
