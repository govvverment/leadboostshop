import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

function RowIcon({ productId, kind, getProduct }) {
  const product = getProduct(productId);
  return product ? <ProductImage product={product} /> : <ProductIcon kind={kind} />;
}

export default function PurchasesHome() {
  const navigate = useNavigate();
  const { purchases, subscriptions, getProduct } = useApp();
  const { t } = useLocale();

  const combined = [
    ...purchases.map((p) => ({ ...p, entryType: 'purchase' })),
    ...subscriptions.map((s) => ({ ...s, entryType: 'subscription' })),
  ];

  return (
    <Screen title={t('purchasesList.title')}>
      <h1 className="page-title">{t('purchasesList.title')}</h1>
      <p className="page-subtitle">{t('purchasesList.subtitle')}</p>

      <div className="tab-row">
        <button className="tab is-active">{t('purchasesList.tabAll')}</button>
        <button className="tab" onClick={() => navigate('/purchases/subscriptions')}>
          {t('purchasesList.tabSubscriptions')}
        </button>
      </div>

      {combined.length === 0 ? (
        <EmptyState
          icon={<Icon name="packageBookmark" size={24} />}
          square
          title={t('purchasesList.emptyTitle')}
          subtitle={t('purchasesList.emptySubtitle')}
          action={
            <button className="btn btn--primary" onClick={() => navigate('/products')}>
              {t('purchasesList.goToProducts')}
            </button>
          }
        />
      ) : (
        <div className="list">
          {combined.map((entry) =>
            entry.entryType === 'purchase' ? (
              <button key={entry.id} className="list-row list-row--tall" onClick={() => navigate(`/purchases/${entry.id}`)}>
                <div className="list-row__top">
                  <RowIcon productId={entry.productId} kind={entry.kind} getProduct={getProduct} />
                  <div className="list-row__body">
                    <span className="list-row__title">{entry.title}</span>
                    <span className="list-row__meta">
                      {(entry.kind === 'account'
                        ? [entry.geo, entry.type, entry.qty ? `${entry.qty} ${t('purchasesList.pieces')}` : null]
                        : [entry.type]
                      )
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <span className="list-row__amount">${entry.price.toFixed(2)}</span>
                  <span className="list-row__chevron">›</span>
                </div>
                <div className="list-row__bottom">
                  <span className="list-row__date">
                    {entry.date} · {entry.time}
                  </span>
                  <span className="list-row__status list-row__status--success">{t('purchasesList.paid')}</span>
                </div>
              </button>
            ) : (
              <button
                key={entry.id}
                className="list-row list-row--tall"
                onClick={() => navigate(`/subscriptions/${entry.id}`)}
              >
                <div className="list-row__top">
                  <RowIcon productId={entry.productId} kind="subscription" getProduct={getProduct} />
                  <div className="list-row__body">
                    <span className="list-row__title">{entry.title}</span>
                    <span className="list-row__meta">{[entry.type].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="list-row__amount list-row__amount--accent">
                    ${entry.price.toFixed(2)}/{entry.period}
                  </span>
                  <span className="list-row__chevron">›</span>
                </div>
                <div className="list-row__bottom">
                  <span className="list-row__date">
                    {entry.status === 'active'
                      ? t('purchasesList.activeUntil', { date: entry.activeUntil })
                      : t('purchasesList.endedAt', { date: entry.endedAt })}
                  </span>
                  <span className={'list-row__status' + (entry.status === 'active' ? ' list-row__status--success' : ' list-row__status--danger')}>
                    {entry.status === 'active' ? t('purchasesList.active') : t('purchasesList.inactive')}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </Screen>
  );
}
