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

// Стрелочка для чипов-дропдаунов (GEO / Тип) — раньше был символ "⌄",
// но в разных шрифтах/платформах у него разная высота и он "плыл"
// относительно текста. SVG-иконка всегда выравнивается одинаково.
function ChevronIcon() {
  return (
    <svg
      className="filter-chip__chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function CategoryList() {
  const { categoryId } = useParams();
  const { products, categories } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all'); // категории без GEO (решения/подписки)
  const [geoFilter, setGeoFilter] = useState('all'); // категории с GEO (аккаунты)
  const [networkFilter, setNetworkFilter] = useState('all'); // соцсеть (Instagram/Facebook/...)
  const [typeFilter, setTypeFilter] = useState('all'); // тип аккаунта (Autorer/Aged/...)
  const [openFilter, setOpenFilter] = useState(null); // null | 'geo' | 'network' | 'type' — какой дропдаун открыт
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

  const networkOptions = useMemo(() => {
    if (!hasGeo) return [];
    return Array.from(new Set(items.map((p) => p.network).filter(Boolean))).sort();
  }, [items, hasGeo]);

  const typeOptions = useMemo(() => {
    if (!hasGeo) return [];
    return Array.from(new Set(items.map((p) => p.type).filter(Boolean))).sort();
  }, [items, hasGeo]);

  useEffect(() => {
    if (!openFilter) return;
    const handleOutsideClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) setOpenFilter(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openFilter]);

  const filtered = items.filter((p) => {
    const matchesQuery = p.title.toLowerCase().startsWith(query.trim().toLowerCase());
    if (hasGeo) {
      return (
        matchesQuery &&
        (geoFilter === 'all' || p.geo === geoFilter) &&
        (networkFilter === 'all' || p.network === networkFilter) &&
        (typeFilter === 'all' || p.type === typeFilter)
      );
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
            <button
              className={
                'filter-chip' +
                (geoFilter === 'all' && networkFilter === 'all' && typeFilter === 'all' ? ' is-active' : '')
              }
              onClick={() => {
                setGeoFilter('all');
                setNetworkFilter('all');
                setTypeFilter('all');
                setOpenFilter(null);
              }}
            >
              Все
            </button>

            {geoOptions.length > 0 && (
              <div className="filter-dropdown">
                <button
                  className={'filter-chip filter-chip--icon' + (geoFilter !== 'all' ? ' is-active' : '')}
                  onClick={() => setOpenFilter((v) => (v === 'geo' ? null : 'geo'))}
                >
                  <span>{geoFilter === 'all' ? 'GEO' : geoFilter}</span>
                  <ChevronIcon />
                </button>
                {openFilter === 'geo' && (
                  <div className="filter-dropdown__menu">
                    {geoOptions.map((g) => (
                      <button
                        key={g}
                        className={'filter-dropdown__item' + (geoFilter === g ? ' is-active' : '')}
                        onClick={() => {
                          setGeoFilter(g);
                          setOpenFilter(null);
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {networkOptions.length > 0 && (
              <div className="filter-dropdown">
                <button
                  className={'filter-chip filter-chip--icon' + (networkFilter !== 'all' ? ' is-active' : '')}
                  onClick={() => setOpenFilter((v) => (v === 'network' ? null : 'network'))}
                >
                  <span>{networkFilter === 'all' ? 'Соцсеть' : networkFilter}</span>
                  <ChevronIcon />
                </button>
                {openFilter === 'network' && (
                  <div className="filter-dropdown__menu">
                    {networkOptions.map((n) => (
                      <button
                        key={n}
                        className={'filter-dropdown__item' + (networkFilter === n ? ' is-active' : '')}
                        onClick={() => {
                          setNetworkFilter(n);
                          setOpenFilter(null);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {typeOptions.length > 0 && (
              <div className="filter-dropdown">
                <button
                  className={'filter-chip filter-chip--icon' + (typeFilter !== 'all' ? ' is-active' : '')}
                  onClick={() => setOpenFilter((v) => (v === 'type' ? null : 'type'))}
                >
                  <span>{typeFilter === 'all' ? 'Тип аккаунта' : typeFilter}</span>
                  <ChevronIcon />
                </button>
                {openFilter === 'type' && (
                  <div className="filter-dropdown__menu">
                    {typeOptions.map((t) => (
                      <button
                        key={t}
                        className={'filter-dropdown__item' + (typeFilter === t ? ' is-active' : '')}
                        onClick={() => {
                          setTypeFilter(t);
                          setOpenFilter(null);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
