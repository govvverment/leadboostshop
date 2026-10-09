import { useNavigate, useLocation } from 'react-router-dom';
import ProductImage from '../../components/ProductImage';
import SheetOverlay from '../../components/SheetOverlay';
import { trackEvent } from '../../supabase/api';
import { useLocale } from '../../context/LocaleContext';

export default function ResultScreen({ type }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useLocale();
  const product = state?.product;
  const qty = state?.qty;
  const total = state?.total;
  const balance = state?.balance;
  const shortfall = Math.max(0, (total ?? product?.price ?? 0) - (balance ?? 0));

  const accountWords = t('result.accountWords');
  const accountWord = (qty ?? 1) === 1 ? accountWords[0] : accountWords[1];

  const config = {
    success: {
      icon: '✓',
      tone: 'success',
      title: t('result.successTitle'),
      subtitle:
        product?.kind === 'account'
          ? t('result.successSubtitleAccount', { qty: qty ?? 1, word: accountWord })
          : t('result.successSubtitleOther'),
      primary: { label: t('result.openPurchase'), onClick: () => navigate('/purchases', { replace: true }) },
      secondary: { label: t('result.continueShopping'), onClick: () => navigate('/products', { replace: true }) },
    },
    failed: {
      icon: '!',
      tone: 'danger',
      title: t('result.failedTitle'),
      subtitle: t('result.failedSubtitle'),
      primary: { label: t('result.retryPurchase'), onClick: () => navigate(-1) },
      secondary: { label: t('result.cancel'), onClick: () => navigate('/products', { replace: true }) },
    },
    insufficient: {
      icon: '!',
      tone: 'danger',
      title: t('result.insufficientTitle'),
      subtitle: t('result.insufficientSubtitle'),
      primary: {
        label: t('result.topUp'),
        onClick: () => {
          trackEvent('topup_click');
          navigate('/balance/deposit', { replace: true });
        },
      },
      secondary: { label: t('result.cancel'), onClick: () => navigate('/products', { replace: true }) },
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
                ? [product.geo, product.type]
                : [product.type]
              )
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <span className="sheet-product__price">
            {qty ? `${qty} ${t('result.pieces')}` : ''}
            <br />${(total ?? product.price).toFixed(2)}
          </span>
        </div>
      )}

      {type === 'insufficient' && product && (
        <div className="detail-list detail-list--flat">
          {balance != null && (
            <div className="detail-list__row">
              <span>{t('result.yourBalance')}</span>
              <span>${balance.toFixed(2)}</span>
            </div>
          )}
          <div className="detail-list__row">
            <span>{t('result.shortfall')}</span>
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
