import { useLocation, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { openSupportChat } from '../../utils/support';

export function DepositSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const amount = state?.amount ?? 50;
  const network = state?.network ?? 'TRC20';

  return (
    <Screen title="Оплата" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile', { replace: true })} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Оплата</h1>
      </div>

      <div className="pay-summary">
        <span className="pay-summary__label">К оплате</span>
        <span className="pay-summary__amount">{amount} USDT</span>
        <span className="badge badge--accent">{network}</span>
      </div>

      <div className="status-card">
        <div className="sheet-icon sheet-icon--success">✓</div>
        <h2 className="status-card__title">Оплата подтверждена</h2>
        <p className="status-card__subtitle">Баланс успешно пополнен на ${amount}</p>
      </div>

      <div className="banner banner--success">
        <span>✓ Платёж засчитан</span>
        <span>${amount.toFixed(2)}</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={() => navigate('/profile', { replace: true })}>
        Вернуться в профиль
      </button>
    </Screen>
  );
}

export function DepositFailed() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const amount = state?.amount ?? 50;
  const network = state?.network ?? 'TRC20';

  return (
    <Screen title="Оплата" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile', { replace: true })} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Оплата</h1>
      </div>

      <div className="pay-summary">
        <span className="pay-summary__label">К оплате</span>
        <span className="pay-summary__amount">{amount} USDT</span>
        <span className="badge badge--accent">{network}</span>
      </div>

      <div className="status-card">
        <div className="sheet-icon sheet-icon--danger">✕</div>
        <h2 className="status-card__title">Оплата не завершена</h2>
        <p className="status-card__subtitle">
          Время на оплату истекло
          <br />
          Создайте новый платёж для пополнения баланса
        </p>
        <button className="link-button" onClick={openSupportChat}>
          Связаться с поддержкой
        </button>
      </div>

      <div className="banner banner--danger">
        <span>✕ Платёж не зачислен</span>
        <span>Не оплачено</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={() => navigate('/balance/deposit', { replace: true })}>
        Создать новый платёж
      </button>
      <button className="btn btn--secondary btn--block" onClick={() => navigate('/profile', { replace: true })}>
        Вернуться в профиль
      </button>
    </Screen>
  );
}
