import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../../components/Screen';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import SheetOverlay from '../../components/SheetOverlay';
import PlatformIcon from '../../components/PlatformIcon';
import { useApp } from '../../context/AppContext';

const KIND_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'subscription', label: 'Подписка' },
  { id: 'one-time', label: 'Разово' },
];

// Стрелочка для чипов-фильтров (GEO / Тип) — раньше был символ "⌄",
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

const FILTER_LABELS = { geo: 'GEO', type: 'Тип аккаунта' };

export default function CategoryList() {
  const { categoryId } = useParams();
  const { products, categories } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all'); // категории без GEO (решения/подписки)
  const [geoFilter, setGeoFilter] = useState('all'); // категории с GEO (аккаунты)
  const [typeFilter, setTypeFilter] = useState('all'); // тип аккаунта (Autorer/Aged/...)
  const [platformFilter, setPlatformFilter] = useState('all'); // соцсеть (Telegram/Instagram/...)
  // null | 'geo' | 'type' — какой выбор сейчас открыт снизу шторкой.
  // Раньше варианты выбора показывались в мини-дропдауне прямо под чипом
  // (position: absolute), и на практике это "плыло": меню могло оказаться
  // под карточками товаров (недостаточный стек относительно остального
  // контента экрана), а сама строка фильтров была горизонтально
  // скроллируемой — из-за этого строка визуально "ездила". Теперь выбор —
  // обычная нижняя шторка (тот же компонент, что и на экране подтверждения
  // покупки), она всегда поверх всего экрана и не зависит от скролла.
  const [openFilter, setOpenFilter] = useState(null);
  // "Соцсеть" — отдельная "полка" с иконками, которая выезжает прямо под
  // строкой фильтров (обычный элемент в потоке документа, а не оверлей) —
  // именно поэтому она не может "наехать" на карточки под ней или
  // перекрыться чем-то ещё, в отличие от старых абсолютно
  // спозиционированных дропдаунов.
  const [socialOpen, setSocialOpen] = useState(false);

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

  const typeOptions = useMemo(() => {
    if (!hasGeo) return [];
    return Array.from(new Set(items.map((p) => p.type).filter(Boolean))).sort();
  }, [items, hasGeo]);

  // "Соцсеть" — поле products.network (заполняется в админке отдельным
  // полем с таким же названием у товаров kind='account'; см. AdminProductForm.jsx).
  // Не путать с products.platform — это другое, самостоятельное поле
  // ("Android" и т.п.), используется отдельно.
  const platformOptions = useMemo(() => {
    if (!hasGeo) return [];
    return Array.from(new Set(items.map((p) => p.network).filter(Boolean))).sort();
  }, [items, hasGeo]);

  // Иконка в фильтре — не нарисованный логотип, а фото уже загруженного
  // товара этой же соцсети (первое найденное с картинкой). Такая
  // картинка обычно и есть логотип соцсети — админ либо один раз грузит
  // её сам, либо, начиная с этого обновления, она сама "наследуется" при
  // добавлении новых товаров той же соцсети (см. admin-products: create).
  // Если фото ни у одного товара соцсети ещё нет — используем заглушку
  // (PlatformIcon) чтобы кнопка не осталась пустой.
  const platformImages = useMemo(() => {
    const map = new Map();
    for (const p of items) {
      if (p.network && p.imageUrl && !map.has(p.network)) map.set(p.network, p.imageUrl);
    }
    return map;
  }, [items]);

  const filtered = items.filter((p) => {
    const matchesQuery = p.title.toLowerCase().startsWith(query.trim().toLowerCase());
    if (hasGeo) {
      return (
        matchesQuery &&
        (geoFilter === 'all' || p.geo === geoFilter) &&
        (typeFilter === 'all' || p.type === typeFilter) &&
        (platformFilter === 'all' || p.network === platformFilter)
      );
    }
    return matchesQuery && (kindFilter === 'all' || p.kind === kindFilter);
  });

  const allActive = geoFilter === 'all' && typeFilter === 'all' && platformFilter === 'all';
  const resetAll = () => {
    setGeoFilter('all');
    setTypeFilter('all');
    setPlatformFilter('all');
    setSocialOpen(false);
  };

  const openSheet = (dimension) => {
    setSocialOpen(false);
    setOpenFilter(dimension);
  };

  const activeValue = openFilter === 'geo' ? geoFilter : typeFilter;
  const activeOptions = openFilter === 'geo' ? geoOptions : typeOptions;
  const selectValue = (value) => {
    if (openFilter === 'geo') setGeoFilter(value);
    else setTypeFilter(value);
    setOpenFilter(null);
  };

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

      <div className="filter-bar">
        {hasGeo ? (
          <>
            <div className="filter-row">
              <button className={'filter-chip' + (allActive ? ' is-active' : '')} onClick={resetAll}>
                Все
              </button>

              {geoOptions.length > 0 && (
                <button
                  className={'filter-chip filter-chip--icon' + (geoFilter !== 'all' ? ' is-active' : '')}
                  onClick={() => openSheet('geo')}
                >
                  <span>{geoFilter === 'all' ? 'GEO' : geoFilter}</span>
                  <ChevronIcon />
                </button>
              )}

              {typeOptions.length > 0 && (
                <button
                  className={'filter-chip filter-chip--icon' + (typeFilter !== 'all' ? ' is-active' : '')}
                  onClick={() => openSheet('type')}
                >
                  <span>{typeFilter === 'all' ? 'Тип аккаунта' : typeFilter}</span>
                  <ChevronIcon />
                </button>
              )}

              {platformOptions.length > 0 && (
                <button
                  className={'filter-chip filter-chip--icon' + (platformFilter !== 'all' || socialOpen ? ' is-active' : '')}
                  onClick={() => {
                    setOpenFilter(null);
                    setSocialOpen((v) => !v);
                  }}
                >
                  <span>{platformFilter === 'all' ? 'Соцсеть' : platformFilter}</span>
                  <ChevronIcon />
                </button>
              )}
            </div>

            {socialOpen && (
              <div className="social-shelf">
                <button
                  className={'social-shelf__item social-shelf__item--all' + (platformFilter === 'all' ? ' is-active' : '')}
                  onClick={() => setPlatformFilter('all')}
                  aria-label="Все соцсети"
                  title="Все"
                >
                  Все
                </button>
                {platformOptions.map((opt) => (
                  <button
                    key={opt}
                    className={'social-shelf__item' + (platformFilter === opt ? ' is-active' : '')}
                    onClick={() => setPlatformFilter(opt)}
                    aria-label={opt}
                    title={opt}
                  >
                    {platformImages.has(opt) ? (
                      <img src={platformImages.get(opt)} alt="" className="social-shelf__photo" />
                    ) : (
                      <PlatformIcon platform={opt} size={30} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
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

      {openFilter && (
        <SheetOverlay onDismiss={() => setOpenFilter(null)}>
          <h2 className="sheet__title">{FILTER_LABELS[openFilter]}</h2>
          <div className="filter-sheet__list">
            <button
              className={'filter-sheet__item' + (activeValue === 'all' ? ' is-active' : '')}
              onClick={() => selectValue('all')}
            >
              Все
            </button>
            {activeOptions.map((opt) => (
              <button
                key={opt}
                className={'filter-sheet__item' + (activeValue === opt ? ' is-active' : '')}
                onClick={() => selectValue(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </SheetOverlay>
      )}
    </Screen>
  );
}
