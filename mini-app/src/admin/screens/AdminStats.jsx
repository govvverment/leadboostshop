import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

// Только цифры, без графиков — по просьбе: график выручки за 14 дней
// убрали целиком, остались только карточки-числа (плюс два новых:
// открытия и клики "Пополнить" за сегодня) и текстовые топ-списки
// (это не графики, просто отсортированные числа).
const CARDS = [
  { key: 'revenue', label: 'Выручка', format: (v) => `$${v.toFixed(2)}` },
  { key: 'totalOrders', label: 'Заказов', format: (v) => v },
  { key: 'totalUsers', label: 'Пользователей', format: (v) => v },
  { key: 'activeSubscriptions', label: 'Активных подписок', format: (v) => v },
  { key: 'totalDeposited', label: 'Пополнено', format: (v) => `$${v.toFixed(2)}` },
  { key: 'referralPayout', label: 'Выплачено рефералам', format: (v) => `$${v.toFixed(2)}` },
];

export default function AdminStats() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [todayEvents, setTodayEvents] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [topReferrers, setTopReferrers] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshHint, setRefreshHint] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.getOverview(), adminApi.getTodayEvents(), adminApi.getTopProducts(), adminApi.getTopReferrers()])
      .then(([ov, events, products, referrers]) => {
        setOverview(ov);
        setTodayEvents(events);
        setTopProducts(products);
        setTopReferrers(referrers);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Кол-во заблокировавших бота обновляется автоматически "живьём" (см.
  // bot-webhook), но это не покрывает тех, кто заблокировал бота ещё до
  // включения отслеживания — по кнопке ниже проходим по всем
  // пользователям через Bot API и пересчитываем заново.
  const refreshBlocked = async () => {
    setRefreshing(true);
    setRefreshHint(null);
    setError(null);
    try {
      const res = await adminApi.refreshBlockedUsers();
      setOverview((prev) => (prev ? { ...prev, blockedUsers: res.blocked } : prev));
      setRefreshHint(
        `Проверено ${res.total}: заблокировали ${res.blocked}, активны ${res.active}` +
          (res.unknown ? `, не удалось проверить ${res.unknown}` : '')
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen title="Админ-панель" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/admin/products')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Статистика</h1>
      </div>

      <div className="tab-row">
        <button className="tab" onClick={() => navigate('/admin/products')}>
          Товары
        </button>
        <button className="tab is-active">Статистика</button>
        <button className="tab" onClick={() => navigate('/admin/categories')}>
          Категории
        </button>
        <button className="tab" onClick={() => navigate('/admin/broadcast')}>
          Рассылка
        </button>
      </div>

      {error && <p className="confirm-sheet__warning">{error}</p>}

      {!overview ? (
        <p className="hint-text">Загрузка...</p>
      ) : (
        <>
          <div className="admin-stat-grid">
            {CARDS.map((c) => (
              <div className="admin-stat-box" key={c.key}>
                <span className="admin-stat-box__label">{c.label}</span>
                <span className="admin-stat-box__value">{c.format(overview[c.key])}</span>
              </div>
            ))}
            <div className="admin-stat-box">
              <span className="admin-stat-box__label">Открытий сегодня</span>
              <span className="admin-stat-box__value">{todayEvents ? todayEvents.appOpensToday : '—'}</span>
            </div>
            <div className="admin-stat-box">
              <span className="admin-stat-box__label">«Пополнить» сегодня</span>
              <span className="admin-stat-box__value">{todayEvents ? todayEvents.topupClicksToday : '—'}</span>
            </div>
            <div className="admin-stat-box">
              <span className="admin-stat-box__label">Заблокировали бота</span>
              <span className="admin-stat-box__value">{overview.blockedUsers ?? 0}</span>
            </div>
          </div>

          <button className="btn btn--secondary btn--block" onClick={refreshBlocked} disabled={refreshing} style={{ marginBottom: 8 }}>
            {refreshing ? 'Проверяем...' : '🔄 Обновить кол-во заблокировавших'}
          </button>
          {refreshHint && <p className="hint-text" style={{ marginBottom: 20 }}>{refreshHint}</p>}

          <h3 className="section__title">Топ товаров</h3>
          {!topProducts || topProducts.length === 0 ? (
            <p className="hint-text">Пока нет продаж</p>
          ) : (
            <div className="list">
              {topProducts.map((p) => (
                <div key={p.product_id} className="list-row list-row--static">
                  <div className="list-row__body">
                    <span className="list-row__title">{p.title}</span>
                    <span className="list-row__meta">{p.orders} заказ.</span>
                  </div>
                  <span className="list-row__amount">${p.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="section__title">Топ рефереров</h3>
          {!topReferrers || topReferrers.length === 0 ? (
            <p className="hint-text">Пока нет начислений за рефералов</p>
          ) : (
            <div className="list">
              {topReferrers.map((r) => (
                <div key={r.referrer_id} className="list-row list-row--static">
                  <div className="list-row__body">
                    <span className="list-row__title">ID {r.referrer_id}</span>
                    <span className="list-row__meta">{r.invited} приглашено</span>
                  </div>
                  <span className="list-row__amount list-row__amount--positive">${r.earned.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}
