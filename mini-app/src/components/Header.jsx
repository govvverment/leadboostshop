import { useNavigate } from 'react-router-dom';
import { openSupportChat } from '../utils/support';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/logo.png';
import supportIcon from '../assets/icons/support.png';

// logo/support-иконка импортируются как модули (а не лежат в public/ и
// не грузятся отдельным HTTP-запросом по строковому пути) — Vite сам
// вшивает такие маленькие файлы (оба меньше 4кб) прямо в JS-бандл как
// base64, поэтому они появляются мгновенно вместе с остальной вёрсткой,
// без отдельного сетевого запроса и характерного "мигания" пустого места.

// Тумблер тёмная/светлая тема — просто переключатель, без подписей.
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      className={'theme-toggle' + (isLight ? ' is-light' : '')}
      role="switch"
      aria-checked={isLight}
      aria-label="Светлая тема"
      onClick={toggleTheme}
    >
      <span className="theme-toggle__thumb" />
    </button>
  );
}

export default function Header() {
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <button className="app-header__logo" onClick={() => navigate('/')} aria-label="На главную">
        <img src={logo} alt="LEAD BOOST" className="app-header__logo-img" />
      </button>
      <div className="app-header__right">
        <ThemeToggle />
        <button className="app-header__support" onClick={openSupportChat}>
          <img src={supportIcon} alt="" className="app-header__support-icon-img" />
          Поддержка
        </button>
      </div>
    </header>
  );
}
