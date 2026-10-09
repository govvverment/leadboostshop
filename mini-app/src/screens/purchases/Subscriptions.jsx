import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

export default function PurchasesSubscriptions() {
  const navigate = useNavigate();
  const { subscriptions, getProduct } = useApp();
  const { t } = useLocale();

  return (
    <Screen title={t('purchasesList.title')}>
      <h1 className="page-title">{t('purchasesList.title')}</h1>
      <p className="page-subtitle">{t('purchasesList.subtitle')}</p>

      <div className="tab-row">
        <button className="tab" onClick={() => navigate('/purchases')}>
          {t('purchasesList.tabAll')}
        </button>
        <button className="tab is-active">{t('purchasesList.tabSubscriptions')}</button>
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<Icon name="packageBookmark" size={24} />}
          square
          title={t('purchasesList.emptySubsTitle')}
          subtitle={t('purchasesList.emptySubsSubtitle')}
          action={
            <button className="btn btn--primary" onClick={() => navigate('/products/solutions')}>
              {t('purchasesList.goToSolutions')}
            </button>
          }
        />
      ) : (
        <div className="list">
          {subscriptions.map((s) => {
            const liveProduct = getProduct(s.productId);
            return (
            <button key={s.id} className="list-row list-row--tall" onClick={() => navigate(`/subscriptions/${s.id}`)}>
              <div className="list-row__top">
                {liveProduct ? <ProductImage product={liveProduct} /> : <ProductIcon kind="subscription" />}
                <div className="list-row__body">
                  <span className="list-row__title">{s.title}</span>
                  <span className="list-row__meta">{[s.platform, s.type].filter(Boolean).join(' · ')}</span>
                </div>
                <span className="list-row__amount list-row__amount--accent">
                  ${s.price.toFixed(2)}/{s.period}
                </span>
                <span className="list-row__chevron">›</span>
              </div>
              <div className="list-row__bottom">
                <span className="list-row__date">
                  {s.status === 'active'
                    ? t('purchasesList.activeUntil', { date: s.activeUntil })
                    : t('purchasesList.endedAt', { date: s.endedAt })}
                </span>
                <span className={'list-row__status' + (s.status === 'active' ? ' list-row__status--success' : ' list-row__status--danger')}>
                  {s.status === 'active' ? t('purchasesList.active') : t('purchasesList.inactive')}
                </span>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
