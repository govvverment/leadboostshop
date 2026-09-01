import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const CATEGORY_COUNT_WORDS = {
  accounts: ['товар', 'товара', 'товаров'],
  solutions: ['решение', 'решения', 'решений'],
};

function timeAgo(date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} ${pluralize(minutes, 'мин.', 'мин.', 'мин.')} назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.floor(hours / 24);
  return `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
}

export default function ProductsHome() {
  const navigate = useNavigate();
  const { products, categories, restocks } = useApp();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeout = useRef(null);

  const showDropdown = isFocused && query.trim().length > 0;
  const results = showDropdown
    ? products.filter((p) => p.title.toLowerCase().startsWith(query.trim().toLowerCase())).slice(0, 8)
    : [];

  const goToProduct = (id) => {
    setQuery('');
    setIsFocused(false);
    navigate(`/product/${id}`);
  };

  const handleBlur = () => {
    // Небольшая задержка, чтобы клик по результату успел сработать
    // до того, как список подсказок скроется по потере фокуса.
    blurTimeout.current = setTimeout(() => setIsFocused(false), 150);
  };

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setIsFocused(true);
  };

  return (
    <Screen title="Товары">
      <div className="search-wrap">
        <div className="search-bar">
          <span className="search-bar__icon">⌕</span>
          <input
            className="search-bar__input"
            placeholder="Найти товар или решение"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {query && (
            <button
              className="search-bar__clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery('')}
              aria-label="Очистить"
            >
              ✕
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="search-dropdown">
            {results.length === 0 ? (
              <div className="search-dropdown__empty">Ничего не найдено</div>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  className="search-dropdown__item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToProduct(p.id)}
                >
                  <ProductImage product={p} size={32} />
                  <span className="search-dropdown__title">{p.title}</span>
                  <span className="search-dropdown__price">${p.price.toFixed(2)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {restocks.length > 0 && (
        <div className="section">
          <h2 className="section__title">Новостная лента</h2>
          <div className="news-list">
            {restocks.map((r, i) => (
              <button
                key={`${r.productId}-${i}`}
                className="news-item"
                onClick={() => navigate(`/product/${r.productId}`)}
              >
                <ProductImage product={{ imageUrl: r.imageUrl, kind: 'account' }} size={40} />
                <div className="news-item__body">
                  <span className="news-item__title">{r.title}</span>
                  <span className="news-item__meta">
                    {[r.geo, `Пополнено ${timeAgo(r.restockedAt)}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="news-item__delta">+{r.qtyAdded} шт.</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section__title">Категории</h2>
        <div className="category-grid">
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            const words = CATEGORY_COUNT_WORDS[c.id] ?? ['товар', 'товара', 'товаров'];
            return (
              <button key={c.id} className="category-card" onClick={() => navigate(`/products/${c.id}`)}>
                <span className="category-card__icon">
                  <ProductImage
                    product={{ imageUrl: c.imageUrl, kind: c.id === 'accounts' ? 'account' : 'solution' }}
                  />
                </span>
                <span className="category-card__title">{c.title.split(' ').join('\n')}</span>
                <span className="category-card__count">
                  {count} {pluralize(count, ...words)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}
