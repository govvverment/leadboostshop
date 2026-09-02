import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

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
  const [revenueByDay, setRevenueByDay] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [topReferrers, setTopReferrers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      adminApi.getOverview(),
      adminApi.getRevenueByDay(14),
      adminApi.getTopProducts(),
      adminApi.getTopReferrers(),
    ])
      .then(([ov, rev, products, referrers]) => {
        setOverview(ov);
        setRevenueByDay(rev);
        setTopProducts(products);
        setTopReferrers(referrers);
      })
      .catch((err) => setError(err.message));
  }, []);

  const maxRevenue = Math.max(1, ...(revenueByDay || []).map((d) => d.revenue));

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
          </div>

          <h3 className="section__title">Выручка за 14 дней</h3>
          {!revenueByDay || revenueByDay.length === 0 ? (
            <p className="hint-text">Пока нет данных о продажах</p>
          ) : (
            <div className="admin-bar-chart">
              {revenueByDay.map((d) => (
                <div className="admin-bar-chart__col" key={d.day} title={`${d.day}: $${d.revenue.toFixed(2)}`}>
                  <div className="admin-bar-chart__bar" style={{ height: `${(d.revenue / maxRevenue) * 100}%` }} />
                  <span className="admin-bar-chart__label">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}

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
