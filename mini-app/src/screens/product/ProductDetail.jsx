import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProduct } = useApp();
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
      <Screen title="Товар">
        <EmptyState icon="?" title="Товар не найден" />
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
          ['GEO', [product.geo, product.geoFlag].filter(Boolean).join(' ')],
          ['Тип', product.type],
          ['Платформа', product.platform],
        ]
      : isSubscription
      ? [
          ['Период', product.periodLabel],
          ['Тип', product.type],
          ['Платформа', product.platform],
        ]
      : [
          ['Лицензия', product.license],
          ['Тип', product.type],
          ['Платформа', product.platform],
        ]
  ).filter(([, value]) => Boolean(value));

  return (
    <Screen title="Товар">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Товар</h1>
      </div>

      <div className="product-detail">
        <div className="product-detail__top">
          <div className="product-detail__icon">
            <ProductImage product={product} size={48} />
          </div>
          <div className="product-detail__meta">
            <h2 className="product-detail__title">{product.title}</h2>
            <span className="product-detail__category">{isAccount ? 'Аккаунты' : 'Технические решения'}</span>
            {isAccount ? (
              outOfStock ? (
                <span className="product-detail__stock product-detail__stock--danger">
                  <span className="dot dot--danger" /> Нет в наличии
                </span>
              ) : (
                <span className="product-detail__stock">
                  <span className="dot dot--success" /> В наличии · {product.stock} шт.
                </span>
              )
            ) : (
              <span className={'badge' + (isSubscription ? ' badge--accent' : ' badge--success')}>
                {isSubscription ? 'Подписка' : 'Разовая покупка'}
              </span>
            )}
          </div>
        </div>

        <h3 className="section__title">Характеристики</h3>
        <div className="detail-list">
          {specs.map(([label, value]) => (
            <div className="detail-list__row" key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <h3 className="section__title">Описание</h3>
        <p className="product-detail__description">{product.description}</p>

        {isAccount && !outOfStock && (
          <>
            <div className="qty-row">
              <span className="section__title" style={{ marginBottom: 0 }}>
                Количество
              </span>
              <span className="qty-row__available">Доступно: {product.stock}</span>
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
                <span>Цена за 1 шт.</span>
                <span className="price-box__accent">${product.price.toFixed(2)}</span>
              </div>
              <div className="price-box__row">
                <span>Итого</span>
                <span className="price-box__accent">${total.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="price-box__row price-box__row--big">
              <div className="price-box__label-col">
                <span>{isSubscription ? 'Подписка' : 'Разовая покупка'}</span>
                <span className="price-box__sublabel">
                  {isSubscription ? `Доступ на ${product.periodLabel}` : 'Бессрочный доступ'}
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
          {outOfStock && 'Нет в наличии'}
          {!outOfStock && isAccount && `Купить ${qty} за $${total.toFixed(2)}`}
          {!outOfStock && product.kind === 'one-time' && `Купить за $${product.price.toFixed(2)}`}
          {!outOfStock && isSubscription && `Оформить подписку за $${product.price.toFixed(2)}`}
        </button>
      </div>
    </Screen>
  );
}
