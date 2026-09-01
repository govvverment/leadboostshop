import { useNavigate, useLocation } from 'react-router-dom';
import ProductImage from '../../components/ProductImage';
import SheetOverlay from '../../components/SheetOverlay';

export default function ResultScreen({ type }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const product = state?.product;
  const qty = state?.qty;
  const total = state?.total;
  const balance = state?.balance;
  const shortfall = Math.max(0, (total ?? product?.price ?? 0) - (balance ?? 0));

  const config = {
    success: {
      icon: '✓',
      tone: 'success',
      title: 'Покупка успешная',
      subtitle:
        product?.kind === 'account'
          ? `${qty ?? 1} ${qty === 1 ? 'аккаунт' : 'аккаунтов'} добавлены в ваши покупки`
          : 'Товар добавлен в ваши покупки',
      primary: { label: 'Открыть покупку', onClick: () => navigate('/purchases', { replace: true }) },
      secondary: { label: 'Продолжить покупки', onClick: () => navigate('/products', { replace: true }) },
    },
    failed: {
      icon: '!',
      tone: 'danger',
      title: 'Не удалось выполнить покупку',
      subtitle: 'Произошла ошибка. Попробуйте повторить покупку.',
      primary: { label: 'Повторить покупку', onClick: () => navigate(-1) },
      secondary: { label: 'Отменить', onClick: () => navigate('/products', { replace: true }) },
    },
    insufficient: {
      icon: '!',
      tone: 'danger',
      title: 'Недостаточно средств',
      subtitle: 'На балансе недостаточно средств для этой покупки',
      primary: { label: 'Пополнить баланс', onClick: () => navigate('/balance/deposit', { replace: true }) },
      secondary: { label: 'Отменить', onClick: () => navigate('/products', { replace: true }) },
    },
  }[type];

  return (
    <SheetOverlay className="sheet--center">
      <div className={`sheet-icon sheet-icon--${config.tone}`}>{config.icon}</div>
      <h1 className="sheet__title">{config.title}</h1>
      <p className="sheet__subtitle">{config.subtitle}</p>

      {product && (
        <div className="sheet-product">
          <ProductImage product={product} />
          <div className="sheet-product__body">
            <span className="sheet-product__title">{product.title}</span>
            <span className="sheet-product__subtitle">
              {(product.kind === 'account'
                ? [product.geoFlag, product.geo, product.platform]
                : [product.platform, product.type]
              )
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <span className="sheet-product__price">
            {qty ? `${qty} шт.` : ''}
            <br />${(total ?? product.price).toFixed(2)}
          </span>
        </div>
      )}

      {type === 'insufficient' && product && (
        <div className="detail-list detail-list--flat">
          {balance != null && (
            <div className="detail-list__row">
              <span>Ваш баланс</span>
              <span>${balance.toFixed(2)}</span>
            </div>
          )}
          <div className="detail-list__row">
            <span>Не хватает</span>
            <span className="detail-list__danger">${shortfall.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button className="btn btn--primary btn--block" onClick={config.primary.onClick}>
        {config.primary.label}
      </button>
      <button className="btn btn--ghost btn--block" onClick={config.secondary.onClick}>
        {config.secondary.label}
      </button>
    </SheetOverlay>
  );
}
