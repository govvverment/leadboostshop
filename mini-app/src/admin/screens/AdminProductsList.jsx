import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import ProductImage from '../../components/ProductImage';
import { adminApi } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

const KIND_LABELS = {
  account: 'Аккаунт',
  subscription: 'Подписка',
  'one-time': 'Разовая покупка',
};

export default function AdminProductsList() {
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [query, setQuery] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);

  const load = () => {
    adminApi
      .getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  // Пересжатие старых тяжёлых картинок по-прежнему тихо запускается на
  // фоне при каждом заходе в раздел "Товары" (ошибку здесь не показываем
  // специально — это фоновая уборка, а не действие админа). НО раньше
  // это был ЕДИНСТВЕННЫЙ способ её запустить, и результат нигде не было
  // видно — даже если она реально отрабатывала, нельзя было проверить,
  // сколько картинок сжалось, а сколько упало с ошибкой (и с какой).
  // Кнопка ниже — тот же самый action, но с видимым результатом, чтобы
  // можно было убедиться, что бэкенд реально это делает, а не просто
  // "должен".
  useEffect(() => {
    adminApi.optimizeImages().catch(() => {});
  }, []);

  const runOptimizeImages = async () => {
    setOptimizing(true);
    setOptimizeResult(null);
    setError(null);
    try {
      const res = await adminApi.optimizeImages();
      const savedKb = Math.round(((res.bytesBefore ?? 0) - (res.bytesAfter ?? 0)) / 1024);
      setOptimizeResult(
        `Проверено: ${res.total}. Сжато: ${res.optimized}, уже лёгких: ${res.skipped}, ошибок: ${res.failed}` +
          (res.optimized ? `. Экономия: ~${savedKb} КБ` : '')
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const toggleArchive = async (product) => {
    setBusyId(product.id);
    try {
      if (product.isArchived) await adminApi.restoreProduct(product.id);
      else await adminApi.archiveProduct(product.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Полное удаление из БД — не архивация, товар и его склад исчезают
  // безвозвратно. Если товар уже покупали, backend откажет (есть
  // покупки, которые на него ссылаются) — тогда покажем его ответ
  // как обычную ошибку с подсказкой архивировать вместо удаления.
  const deleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Удалить «${product.title}» без возможности восстановления? Весь склад товара будет стёрт.`
    );
    if (!confirmed) return;

    setDeletingId(product.id);
    setError(null);
    try {
      await adminApi.deleteProduct(product.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = (products || []).filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <Screen title="Админ-панель" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Товары</h1>
      </div>

      <div className="tab-row">
        <button className="tab is-active">Товары</button>
        <button className="tab" onClick={() => navigate('/admin/stats')}>
          Статистика
        </button>
        <button className="tab" onClick={() => navigate('/admin/categories')}>
          Категории
        </button>
        <button className="tab" onClick={() => navigate('/admin/broadcast')}>
          Рассылка
        </button>
      </div>

      <div className="search-bar" style={{ marginBottom: 12 }}>
        <span className="search-bar__icon">⌕</span>
        <input
          className="search-bar__input"
          placeholder="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <button className="btn btn--primary btn--block" onClick={() => navigate('/admin/products/new')}>
        + Добавить товар
      </button>
      <div className="admin-quicklinks">
        <button className="btn btn--secondary" onClick={() => navigate('/admin/balance')}>
          💰 Баланс
        </button>
        <button className="btn btn--secondary" onClick={() => navigate('/admin/orders')}>
          📋 Заказы
        </button>
        <button className="btn btn--secondary" onClick={() => navigate('/admin/networks')}>
          🌐 Соцсети
        </button>
      </div>
      <button className="btn btn--secondary btn--block" onClick={runOptimizeImages} disabled={optimizing} style={{ marginTop: 8 }}>
        {optimizing ? 'Сжимаем фото...' : '🖼 Принудительно пересжать все фото'}
      </button>
      {optimizeResult && <p className="hint-text">{optimizeResult}</p>}

      <button className="btn btn--ghost btn--block" onClick={logout}>
        Выйти из админки
      </button>

      {error && <p className="confirm-sheet__warning" style={{ marginTop: 14 }}>{error}</p>}

      <div className="section" style={{ marginTop: 20 }}>
        {!products ? (
          <p className="hint-text">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <p className="hint-text">Товаров не найдено</p>
        ) : (
          <div className="list">
            {filtered.map((p) => (
              <div key={p.id} className={'admin-product-row' + (p.isArchived ? ' admin-product-row--archived' : '')}>
                <div className="admin-product-row__top">
                  <ProductImage product={p} size={40} />
                  <div className="admin-product-row__body">
                    <span className="list-row__title">{p.title}</span>
                    <span className="list-row__meta">
                      {KIND_LABELS[p.kind]} · ${p.price.toFixed(2)}
                      {p.period && `/${p.period}`}
                      {p.kind === 'account' && ` · ${p.stock} шт.${p.manualStock ? ' (вручную)' : ''}`}
                    </span>
                  </div>
                  {p.isArchived && <span className="badge badge--muted">В архиве</span>}
                </div>
                <div className="admin-product-row__actions">
                  {(p.kind === 'one-time' || p.kind === 'subscription' || (p.kind === 'account' && !p.manualStock)) && (
                    <button className="btn btn--secondary btn--sm" onClick={() => navigate(`/admin/products/${p.id}/inventory`)}>
                      {p.kind === 'account' ? 'Аккаунты' : 'Ссылки'}
                    </button>
                  )}
                  <button className="btn btn--secondary btn--sm" onClick={() => navigate(`/admin/products/${p.id}/edit`)}>
                    Изменить
                  </button>
                  <button
                    className={'btn btn--sm ' + (p.isArchived ? 'btn--secondary' : 'btn--danger-outline')}
                    onClick={() => toggleArchive(p)}
                    disabled={busyId === p.id || deletingId === p.id}
                  >
                    {p.isArchived ? 'Вернуть' : 'В архив'}
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => deleteProduct(p)}
                    disabled={busyId === p.id || deletingId === p.id}
                  >
                    {deletingId === p.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
