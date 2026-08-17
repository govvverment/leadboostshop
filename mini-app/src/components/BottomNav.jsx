import { NavLink } from 'react-router-dom';

const ICONS = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.4-4.2 4-6.2 7.5-6.2s6.1 2 7.5 6.2" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 8h11l-1 12h-9l-1-12z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  ),
  purchases: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 4.4v9.2L12 21l-8-4.4V7.4L12 3z" />
      <path d="M4.3 7.6L12 12l7.7-4.4" />
      <path d="M12 12v9" />
    </svg>
  ),
  referrals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3 20c1-3.3 3-5.2 6-5.2s5 1.9 6 5.2" />
      <circle cx="17.2" cy="9" r="2.3" />
      <path d="M15.8 12.1c2.3.3 3.6 1.9 4.2 4" />
    </svg>
  ),
};

const items = [
  { to: '/profile', label: 'Профиль', icon: 'profile' },
  { to: '/products', label: 'Товары', icon: 'products' },
  { to: '/purchases', label: 'Покупки', icon: 'purchases' },
  { to: '/referrals', label: 'Рефералы', icon: 'referrals' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => 'bottom-nav__item' + (isActive ? ' is-active' : '')}
        >
          {({ isActive }) => (
            <>
              <span className="bottom-nav__icon" aria-hidden="true">
                {ICONS[item.icon]}
              </span>
              <span className="bottom-nav__label">{item.label}</span>
              {isActive && <span className="bottom-nav__indicator" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
