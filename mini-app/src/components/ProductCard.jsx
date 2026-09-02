import { useNavigate } from 'react-router-dom';
import ProductImage from './ProductImage';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const isAccount = product.kind === 'account';
  const outOfStock = isAccount && product.stock <= 0;

  return (
    <button
      className={'product-row' + (outOfStock ? ' product-row--disabled' : '')}
      onClick={() => !outOfStock && navigate(`/product/${product.id}`)}
      disabled={outOfStock}
    >
      <div className="product-row__icon">
        <ProductImage product={product} size={48} />
      </div>

      <div className="product-row__body">
        <span className="product-row__title">{product.title}</span>

        {isAccount ? (
          <>
            <span className="product-row__subtitle">
              {[product.geo, product.type].filter(Boolean).join(' · ')}
            </span>
            {outOfStock ? (
              <span className="badge badge--muted">Нет в наличии</span>
            ) : (
              <span className="product-row__stock">
                <span className="dot dot--success" /> {product.stock} шт.
              </span>
            )}
          </>
        ) : (
          <>
            <span className="product-row__subtitle">
              {[product.type].filter(Boolean).join(' · ')}
            </span>
            <span className={'badge' + (product.kind === 'subscription' ? ' badge--accent' : ' badge--success')}>
              {product.kind === 'subscription' ? 'Подписка' : 'Разовая покупка'}
            </span>
          </>
        )}
      </div>

      <div className="product-row__price">
        <span className={'product-row__amount' + (product.kind === 'subscription' ? ' product-row__amount--accent' : '')}>
          ${product.price.toFixed(2)}
          {product.period && <span className="product-row__period"> / {product.period}</span>}
        </span>
        <span className="product-row__chevron">›</span>
      </div>
    </button>
  );
}
