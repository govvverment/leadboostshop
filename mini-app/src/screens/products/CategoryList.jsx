import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../../components/Screen';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';

const KIND_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'subscription', label: 'Подписка' },
  { id: 'one-time', label: 'Разово' },
];

export default function CategoryList() {
  const { categoryId } = useParams();
  const { products, categories } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all'); // категории без GEO (решения/подписки)
  const [geoFilter, setGeoFilter] = useState('all'); // категории с GEO (аккаунты)
  const [geoOpen, setGeoOpen] = useState(false);
  const filterBarRef = useRef(null);

  const title = categories.find((c) => c.id === categoryId)?.title ?? 'Товары';
  const items = useMemo(() => products.filter((p) => p.category === categoryId), [categoryId, products]);
  // Категория "про GEO" определяется по факту — есть ли у её товаров
  // заполненное поле GEO, а не по конкретному захардкоженному id.
  // Так это работает для любой новой категории, а не только для двух исходных.
  const hasGeo = useMemo(() => items.some((p) => p.geo), [items]);

  const geoOptions = useMemo(() => {
    if (!hasGeo) return [];
    return Array.from(new Set(items.map((p) => p.geo).filter(Boolean))).sort();
  }, [items, hasGeo]);

  useEffect(() => {
    if (!geoOpen) return;
    const handleOutsideClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) setGeoOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [geoOpen]);

  const filtered = items.filter((p) => {
    const matchesQuery = p.title.toLowerCase().startsWith(query.trim().toLowerCase());
    if (hasGeo) {
      return matchesQuery && (geoFilter === 'all' || p.geo === geoFilter);
    }
    return matchesQuery && (kindFilter === 'all' || p.kind === kindFilter);
  });

  return (
    <Screen title={title}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">{title}</h1>
      </div>

      <div className="search-bar" style={{ marginBottom: 14 }}>
        <span className="search-bar__icon">⌕</span>
        <input
          className="search-bar__input"
          placeholder="Найти товар или решение"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="filter-bar" ref={filterBarRef}>
        {hasGeo ? (
          <div className="filter-row">
            <button className={'filter-chip' + (geoFilter === 'all' ? ' is-active' : '')} onClick={() => setGeoFilter('all')}>
              Все
            </button>
            {geoOptions.length > 0 && (
              <button
                className={'filter-chip' + (geoFilter !== 'all' ? ' is-active' : '')}
                onClick={() => setGeoOpen((v) => !v)}
              >
                {geoFilter === 'all' ? 'GEO' : geoFilter} ⌄
              </button>
            )}
          </div>
        ) : (
          <div className="filter-row">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.id}
                className={'filter-chip' + (kindFilter === f.id ? ' is-active' : '')}
                onClick={() => setKindFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {geoOpen && (
          <div className="filter-dropdown__menu">
            {geoOptions.map((g) => (
              <button
                key={g}
                className={'filter-dropdown__item' + (geoFilter === g ? ' is-active' : '')}
                onClick={() => {
                  setGeoFilter(g);
                  setGeoOpen(false);
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="⌕" title="Ничего не найдено" subtitle="Попробуйте изменить запрос или фильтр" />
      ) : (
        <div className="product-list">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Screen>
  );
}
