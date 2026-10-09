import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProduct } = useApp();
  const { t } = useLocale();
  const product = getProduct(id);
  const [qty, setQty] = useState(1);

  // Если остаток изменился (например, купили в другой вкладке) и текущее
  // выбранное количество стало больше, чем реально осталось — подрезаем.
  useEffect(() => {
    if (product?.kind === 'account' && qty > product.stock) {
      setQty(Math.max(1, product.stock));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.stock]);

  if (!product) {
    return (
      <Screen title={t('product.title')}>
        <EmptyState icon="?" title={t('product.notFound')} />
      </Screen>
    );
  }

  const isAccount = product.kind === 'account';
  const isSubscription = product.kind === 'subscription';
  // Живой склад (account_inventory) теперь у всех трёх типов, не
  // только у аккаунтов — остаток может закончиться и у разовых
  // покупок, и у подписок.
  const outOfStock = product.stock <= 0;
  const total = isAccount ? +(product.price * qty).toFixed(2) : product.price;

  const specs = (
    isAccount
      ? [
          [t('product.geo'), [product.geo, product.geoFlag].filter(Boolean).join(' ')],
          [t('product.type'), product.type],
        ]
      : isSubscription
      ? [
          [t('product.period'), product.periodLabel],
          [t('product.type'), product.type],
        ]
      : [
          [t('product.license'), product.license],
          [t('product.type'), product.type],
        ]
  ).filter(([, value]) => Boolean(value));

  return (
    <Screen title={t('product.title')}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label={t('product.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('product.title')}</h1>
      </div>

      <div className="product-detail">
        <div className="product-detail__top">
          <div className="product-detail__icon">
            <ProductImage product={product} size={48} />
          </div>
          <div className="product-detail__meta">
            <h2 className="product-detail__title">{product.title}</h2>
            <span className="product-detail__category">{isAccount ? t('product.accounts') : t('product.solutions')}</span>
            {isAccount ? (
              outOfStock ? (
                <span className="product-detail__stock product-detail__stock--danger">
                  <span className="dot dot--danger" /> {t('product.outOfStock')}
                </span>
              ) : (
                <span className="product-detail__stock">
                  <span className="dot dot--success" /> {t('product.inStock')} · {product.stock} {t('product.pieces')}
                </span>
              )
            ) : (
              <span className={'badge' + (isSubscription ? ' badge--accent' : ' badge--success')}>
                {isSubscription ? t('product.subscription') : t('product.oneTime')}
              </span>
            )}
          </div>
        </div>

        <h3 className="section__title">{t('product.specs')}</h3>
        <div className="detail-list">
          {specs.map(([label, value]) => (
            <div className="detail-list__row" key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <h3 className="section__title">{t('product.description')}</h3>
        <p className="product-detail__description">{product.description}</p>

        {isAccount && !outOfStock && (
          <>
            <div className="qty-row">
              <span className="section__title" style={{ marginBottom: 0 }}>
                {t('product.quantity')}
              </span>
              <span className="qty-row__available">{t('product.available')}: {product.stock}</span>
            </div>
            <div className="qty-control">
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            </div>
          </>
        )}

        <div className="price-box">
          {isAccount ? (
            <>
              <div className="price-box__row">
                <span>{t('product.pricePerUnit')}</span>
                <span className="price-box__accent">${product.price.toFixed(2)}</span>
              </div>
              <div className="price-box__row">
                <span>{t('product.total')}</span>
                <span className="price-box__accent">${total.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="price-box__row price-box__row--big">
              <div className="price-box__label-col">
                <span>{isSubscription ? t('product.subscription') : t('product.oneTime')}</span>
                <span className="price-box__sublabel">
                  {isSubscription ? t('product.accessFor', { period: product.periodLabel }) : t('product.unlimitedAccess')}
                </span>
              </div>
              <span className={isSubscription ? 'price-box__accent price-box__accent--purple' : 'price-box__accent'}>
                ${product.price.toFixed(2)}
                {product.period && <span className="price-box__period"> / {product.period}</span>}
              </span>
            </div>
          )}
        </div>

        <button
          className="btn btn--primary btn--block"
          disabled={outOfStock}
          onClick={() => navigate(`/purchase/confirm/${product.id}`, { state: { qty } })}
        >
          {outOfStock && t('product.outOfStock')}
          {!outOfStock && isAccount && t('product.buyQty', { qty, total: total.toFixed(2) })}
          {!outOfStock && product.kind === 'one-time' && t('product.buyOneTime', { price: product.price.toFixed(2) })}
          {!outOfStock && isSubscription && t('product.subscribeFor', { price: product.price.toFixed(2) })}
        </button>
      </div>
    </Screen>
  );
}
