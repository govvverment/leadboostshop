import { NavLink } from 'react-router-dom';

// Иконки сверены пиксель-в-пиксель с макетом (Bottom Navigation.png
// из архива дизайна).
const ICONS = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9.8" r="2.6" />
      <path d="M7.4 17.3c1-1.6 2.6-2.4 4.6-2.4s3.6.8 4.6 2.4" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8.2V6.5a3 3 0 0 1 6 0V8.2" />
      <rect x="5.5" y="8.2" width="13" height="11.8" rx="1.2" />
    </svg>
  ),
  purchases: (
    // Проверено по чёткому референсу от заказчика: круга НЕТ вообще,
    // просто галочка вплотную к нижне-правому углу куба, потолще
    // обычных линий.
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.3 3l7.2 4v8L11.3 19l-7.2-4V7l7.2-4z" />
      <path d="M4.1 7l7.2 4 7.2-4" />
      <path d="M11.3 11v8" />
      <path d="M15.5 15.8l1.6 1.6 3-3.4" strokeWidth="2.2" />
    </svg>
  ),
};

const items = [
  { to: '/profile', label: 'Профиль', icon: 'profile' },
  { to: '/products', label: 'Товары', icon: 'products' },
  { to: '/purchases', label: 'Покупки', icon: 'purchases' },
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
