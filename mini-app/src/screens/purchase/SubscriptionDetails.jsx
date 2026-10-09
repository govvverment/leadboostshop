import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { LoaderCompact } from '../../components/Loader';
import { useApp } from '../../context/AppContext';

export default function SubscriptionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscriptions, balance, renewSubscription, showToast, getProduct } = useApp();
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const sub = subscriptions.find((s) => s.id === id);
  const liveProduct = sub ? getProduct(sub.productId) : null;

  const copy = (value) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    showToast('Скопировано');
  };

  if (!sub) {
    return (
      <Screen title="Подписка">
        <EmptyState icon="?" title="Подписка не найдена" />
      </Screen>
    );
  }

  const isExpired = sub.status === 'expired';

  const handleRenew = async () => {
    setLoading(true);
    const result = await renewSubscription(sub);
    setLoading(false);
    if (result === 'success') {
      showToast('Подписка продлена');
    } else {
      navigate('/purchase/insufficient', { state: { product: sub, total: sub.price, balance } });
    }
  };

  return (
    <Screen title="Покупка">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Покупка</h1>
      </div>

      <div className="product-detail">
        <div className="product-detail__top">
          <div className="product-detail__icon">
            {liveProduct ? (
              <ProductImage product={liveProduct} size={48} />
            ) : (
              <ProductIcon kind="subscription" size={48} />
            )}
          </div>
          <div className="product-detail__meta">
            <h2 className="product-detail__title">{sub.title}</h2>
            <span className="product-detail__category">Технические решения</span>
            <span className={'status-dot' + (isExpired ? ' status-dot--danger' : ' status-dot--success')}>
              <span className={'dot' + (isExpired ? ' dot--danger' : ' dot--success')} /> {isExpired ? 'Неактивная' : 'Активная'}
            </span>
          </div>
        </div>

        <h3 className="section__title">Характеристики</h3>
        <div className="detail-list">
          <div className="detail-list__row">
            <span>Период</span>
            <span>{sub.periodLabel}</span>
          </div>
          <div className="detail-list__row">
            <span>Тип</span>
            <span>{sub.type}</span>
          </div>
          <div className="detail-list__row">
            <span>Платформа</span>
            <span>{sub.platform}</span>
          </div>
        </div>

        <h3 className="section__title">Подписка</h3>
        <div className="detail-list">
          <div className="detail-list__row">
            <span>Статус</span>
            <span className={isExpired ? 'detail-list__danger' : 'detail-list__success'}>
              {isExpired ? 'Неактивная' : 'Активная'}
            </span>
          </div>
          <div className="detail-list__row">
            <span>{isExpired ? 'Активная до' : 'Активная до'}</span>
            <span>{isExpired ? `Завершилась ${sub.endedAt}` : sub.activeUntil}</span>
          </div>
          <div className="detail-list__row">
            <span>Стоимость</span>
            <span className="detail-list__accent">
              ${sub.price.toFixed(2)} / {sub.period}
            </span>
          </div>
        </div>

        <h3 className="section__title">Доступ к товару</h3>
        {sub.accessLink ? (
          <div className={'detail-list' + (isExpired ? ' detail-list--dim' : '')}>
            <div className="detail-list__row">
              <span>Ссылка</span>
              <button
                className="detail-list__link mono"
                style={{ wordBreak: 'break-all', textAlign: 'right' }}
                disabled={isExpired}
                onClick={() => copy(sub.accessLink)}
              >
                {sub.accessLink}
              </button>
            </div>
            {sub.accessKey && (
              <div className="detail-list__row">
                <span>Доп. инфо</span>
                <span className="mono">
                  {showKey ? sub.accessKey : '••••••••••'}{' '}
                  <button className="eye-toggle" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? '🙈' : '👁'}
                  </button>
                  {showKey && (
                    <button className="detail-list__link" onClick={() => copy(sub.accessKey)}>
                      Копировать
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="hint-text">
            Доступ недоступен — обратитесь в поддержку, если подписка не выдала ссылку.
          </p>
        )}

        {isExpired && (
          <button className="btn btn--primary btn--block" onClick={handleRenew} disabled={loading}>
            {loading ? <LoaderCompact /> : `Продолжить за $${sub.price.toFixed(2)}`}
          </button>
        )}

        {sub.orderNumber && (
          <>
            <h3 className="section__title">Номер заказа</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>Номер</span>
                <button className="detail-list__link mono" onClick={() => copy(sub.orderNumber)}>
                  {sub.orderNumber}
                </button>
              </div>
            </div>
            <p className="hint-text" style={{ textAlign: 'left', marginTop: 8 }}>
              Напишите этот номер менеджеру в личные сообщения — он поможет оформить заказ дальше.
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
