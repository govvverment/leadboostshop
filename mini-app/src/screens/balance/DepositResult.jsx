import { useLocation, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { openSupportChat } from '../../utils/support';
import { useLocale } from '../../context/LocaleContext';

export function DepositSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useLocale();
  const amount = state?.amount ?? 50;
  const network = state?.network ?? 'TRC20';

  return (
    <Screen title={t('depositResult.title')} withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile', { replace: true })} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('depositResult.title')}</h1>
      </div>

      <div className="pay-summary">
        <span className="pay-summary__label">{t('depositResult.toPay')}</span>
        <span className="pay-summary__amount">{amount} USDT</span>
        <span className="badge badge--accent">{network}</span>
      </div>

      <div className="status-card">
        <div className="sheet-icon sheet-icon--success">✓</div>
        <h2 className="status-card__title">{t('depositResult.paymentConfirmedTitle')}</h2>
        <p className="status-card__subtitle">{t('depositResult.balanceToppedUp', { amount })}</p>
      </div>

      <div className="banner banner--success">
        <span>{t('depositResult.paymentAccepted')}</span>
        <span>${amount.toFixed(2)}</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={() => navigate('/profile', { replace: true })}>
        {t('depositResult.backToProfile')}
      </button>
    </Screen>
  );
}

export function DepositFailed() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useLocale();
  const amount = state?.amount ?? 50;
  const network = state?.network ?? 'TRC20';

  return (
    <Screen title={t('depositResult.title')} withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile', { replace: true })} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('depositResult.title')}</h1>
      </div>

      <div className="pay-summary">
        <span className="pay-summary__label">{t('depositResult.toPay')}</span>
        <span className="pay-summary__amount">{amount} USDT</span>
        <span className="badge badge--accent">{network}</span>
      </div>

      <div className="status-card">
        <div className="sheet-icon sheet-icon--danger">✕</div>
        <h2 className="status-card__title">{t('depositResult.paymentFailedTitle')}</h2>
        <p className="status-card__subtitle">
          {t('depositResult.timeExpired')}
          <br />
          {t('depositResult.createNewPaymentHint')}
        </p>
        <button className="link-button" onClick={openSupportChat}>
          {t('depositResult.contactSupport')}
        </button>
      </div>

      <div className="banner banner--danger">
        <span>{t('depositResult.paymentNotAccepted')}</span>
        <span>{t('depositResult.notPaid')}</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={() => navigate('/balance/deposit', { replace: true })}>
        {t('depositResult.createNewPaymentButton')}
      </button>
      <button className="btn btn--secondary btn--block" onClick={() => navigate('/profile', { replace: true })}>
        {t('depositResult.backToProfile')}
      </button>
    </Screen>
  );
}
