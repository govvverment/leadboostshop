import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

const KIND_LABELS = {
  account: 'Аккаунт',
  subscription: 'Подписка',
  'one-time': 'Разовая покупка',
};

// Список заказов от товаров с галочкой "Направлять к менеджеру" —
// сверяем номер заказа (ORD-xxxx), который покупатель называет
// в личке менеджеру, с этим списком.
export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi
      .getOrders()
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Screen title="Заказы" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Заказы к менеджеру</h1>
      </div>

      {error && <p className="confirm-sheet__warning">{error}</p>}

      {!orders ? (
        <p className="hint-text">Загрузка...</p>
      ) : orders.length === 0 ? (
        <p className="hint-text">Пока нет заказов — появятся, когда купят товар с галочкой «Направлять к менеджеру»</p>
      ) : (
        <div className="list">
          {orders.map((o) => (
            <div key={o.id} className="list-row list-row--static">
              <div className="list-row__body">
                <span className="list-row__title" style={{ fontWeight: 700 }}>
                  {o.orderNumber}
                </span>
                <span className="list-row__meta">
                  {o.productTitle} · {KIND_LABELS[o.kind] || o.kind} · ${o.price.toFixed(2)}
                </span>
                <span className="list-row__meta">
                  {o.firstName || 'Без имени'}
                  {o.username ? ` · @${o.username}` : ''} · ID {o.userTelegramId}
                </span>
                <span className="list-row__meta">{new Date(o.createdAt).toLocaleString('ru-RU')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
