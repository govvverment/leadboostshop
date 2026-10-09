import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { LoaderCompact } from '../../components/Loader';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

export default function SubscriptionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscriptions, balance, renewSubscription, showToast, getProduct } = useApp();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const sub = subscriptions.find((s) => s.id === id);
  const liveProduct = sub ? getProduct(sub.productId) : null;

  const copy = (value) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    showToast(t('common.copied'));
  };

  if (!sub) {
    return (
      <Screen title={t('subscriptionDetails.notFoundTitle')}>
        <EmptyState icon="?" title={t('subscriptionDetails.notFound')} />
      </Screen>
    );
  }

  const isExpired = sub.status === 'expired';

  const handleRenew = async () => {
    setLoading(true);
    const result = await renewSubscription(sub);
    setLoading(false);
    if (result === 'success') {
      showToast(t('subscriptionDetails.toastRenewed'));
    } else {
      navigate('/purchase/insufficient', { state: { product: sub, total: sub.price, balance } });
    }
  };

  return (
    <Screen title={t('subscriptionDetails.title')}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('subscriptionDetails.title')}</h1>
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
            <span className="product-detail__category">{t('subscriptionDetails.solutions')}</span>
            <span className={'status-dot' + (isExpired ? ' status-dot--danger' : ' status-dot--success')}>
              <span className={'dot' + (isExpired ? ' dot--danger' : ' dot--success')} /> {isExpired ? t('subscriptionDetails.inactive') : t('subscriptionDetails.active')}
            </span>
          </div>
        </div>

        <h3 className="section__title">{t('subscriptionDetails.specs')}</h3>
        <div className="detail-list">
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.period')}</span>
            <span>{sub.periodLabel}</span>
          </div>
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.type')}</span>
            <span>{sub.type}</span>
          </div>
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.platform')}</span>
            <span>{sub.platform}</span>
          </div>
        </div>

        <h3 className="section__title">{t('subscriptionDetails.subscriptionSection')}</h3>
        <div className="detail-list">
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.status')}</span>
            <span className={isExpired ? 'detail-list__danger' : 'detail-list__success'}>
              {isExpired ? t('subscriptionDetails.inactive') : t('subscriptionDetails.active')}
            </span>
          </div>
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.activeUntilLabel')}</span>
            <span>{isExpired ? t('subscriptionDetails.endedAt', { date: sub.endedAt }) : sub.activeUntil}</span>
          </div>
          <div className="detail-list__row">
            <span>{t('subscriptionDetails.cost')}</span>
            <span className="detail-list__accent">
              ${sub.price.toFixed(2)} / {sub.period}
            </span>
          </div>
        </div>

        <h3 className="section__title">{t('subscriptionDetails.accessSection')}</h3>
        {sub.accessLink ? (
          <div className={'detail-list' + (isExpired ? ' detail-list--dim' : '')}>
            <div className="detail-list__row">
              <span>{t('subscriptionDetails.link')}</span>
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
                <span>{t('subscriptionDetails.extraInfo')}</span>
                <span className="mono">
                  {showKey ? sub.accessKey : '••••••••••'}{' '}
                  <button className="eye-toggle" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? '🙈' : '👁'}
                  </button>
                  {showKey && (
                    <button className="detail-list__link" onClick={() => copy(sub.accessKey)}>
                      {t('subscriptionDetails.copyButton')}
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="hint-text">{t('subscriptionDetails.noAccess')}</p>
        )}

        {isExpired && (
          <button className="btn btn--primary btn--block" onClick={handleRenew} disabled={loading}>
            {loading ? <LoaderCompact /> : t('subscriptionDetails.continueFor', { price: sub.price.toFixed(2) })}
          </button>
        )}

        {sub.orderNumber && (
          <>
            <h3 className="section__title">{t('subscriptionDetails.orderNumberTitle')}</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>{t('subscriptionDetails.orderNumberLabel')}</span>
                <button className="detail-list__link mono" onClick={() => copy(sub.orderNumber)}>
                  {sub.orderNumber}
                </button>
              </div>
            </div>
            <p className="hint-text" style={{ textAlign: 'left', marginTop: 8 }}>
              {t('subscriptionDetails.orderNumberHint')}
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
