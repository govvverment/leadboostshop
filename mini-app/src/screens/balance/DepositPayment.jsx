import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Screen from '../../components/Screen';
import Icon from '../../components/Icon';
import { useApp } from '../../context/AppContext';

const POLL_INTERVAL_MS = 5000;

export default function DepositPayment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { createDepositRequest, checkDepositRequest, showToast } = useApp();

  const amount = state?.amount ?? 50;
  const network = state?.network ?? 'TRC20';

  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const resolvedRef = useRef(false);

  // Создаём заявку с уникальной суммой один раз при заходе на экран.
  useEffect(() => {
    let cancelled = false;
    createDepositRequest(amount, network)
      .then((r) => {
        if (cancelled) return;
        if (r.error) {
          setError(r.error);
          return;
        }
        setRequest(r);
        setSeconds(Math.max(0, Math.floor((new Date(r.expiresAt).getTime() - Date.now()) / 1000)));
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // QR-код с адресом кошелька — генерируется на лету под конкретную
  // заявку (адрес один и тот же, но так он не хранится статичной
  // картинкой и точно совпадает с тем, что реально настроено).
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    QRCode.toDataURL(request.walletAddress, {
      width: 320,
      margin: 1,
      color: { dark: '#0a0a0f', light: '#ffffff' },
    })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch((err) => console.error('Не удалось сгенерировать QR-код:', err));
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Обратный отсчёт на экране.
  useEffect(() => {
    if (!request) return;
    const tick = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [request]);

  // Периодически спрашиваем backend, не пришёл ли перевод с такой
  // уникальной суммой. Останавливаемся, как только пришёл ответ
  // "подтверждено" или "истекло".
  useEffect(() => {
    if (!request) return;
    let stopped = false;

    const poll = async () => {
      if (resolvedRef.current || stopped) return;
      try {
        const result = await checkDepositRequest(request.requestId);
        if (resolvedRef.current || stopped) return;
        if (result.status === 'confirmed') {
          resolvedRef.current = true;
          showToast('Баланс пополнен');
          navigate('/balance/deposit/success', { replace: true, state: { amount: result.amount ?? amount, network } });
        } else if (result.status === 'expired') {
          resolvedRef.current = true;
          navigate('/balance/deposit/failed', { replace: true, state: { amount, network } });
        }
      } catch (err) {
        console.error('Ошибка проверки платежа:', err);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [request, checkDepositRequest, navigate, showToast, amount, network]);

  // Локальный таймер дошёл до нуля — считаем неудачей и на клиенте
  // (сервер всё равно проверит через expired-статус, это подстраховка).
  useEffect(() => {
    if (request && seconds === 0 && !resolvedRef.current) {
      resolvedRef.current = true;
      navigate('/balance/deposit/failed', { replace: true, state: { amount, network } });
    }
  }, [seconds, request, navigate, amount, network]);

  const copyText = (value) => {
    navigator.clipboard?.writeText(String(value)).catch(() => {});
    showToast('Скопировано');
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const uniqueAmountText = request ? Number(request.uniqueAmount).toFixed(4) : '';

  return (
    <Screen title="Оплата" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Оплата</h1>
      </div>

      {error && <p className="confirm-sheet__warning">{error}</p>}

      {!request && !error ? (
        <p className="hint-text">Создаём заявку на оплату...</p>
      ) : request ? (
        <>
          <div className="pay-summary">
            <span className="pay-summary__label">Отправьте ровно</span>
            <span className="pay-summary__amount">{uniqueAmountText} USDT</span>
            <span className="badge badge--accent">{network}</span>
          </div>

          <p className="hint-text" style={{ textAlign: 'center', margin: '0 0 14px' }}>
            Важно отправить именно эту сумму, до последней цифры — по ней система узнаёт, что
            платёж ваш.
          </p>

          <div className="qr-card">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR-код адреса кошелька" className="qr-card__code" />
            ) : (
              <div className="qr-card__code" aria-hidden="true" />
            )}
            <p className="qr-card__hint">Адрес кошелька ({network})</p>
            <div className="address-row">
              <span className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
                {request.walletAddress}
              </span>
              <button className="address-row__copy" onClick={() => copyText(request.walletAddress)} aria-label="Копировать адрес">
                <Icon name="copy" size={16} />
              </button>
            </div>
          </div>

          <button className="btn btn--ghost btn--block" onClick={() => copyText(uniqueAmountText)}>
            Скопировать сумму {uniqueAmountText}
          </button>

          <div className="waiting-row">
            <span className="waiting-row__icon">◷</span>
            <span>Ожидаем оплату</span>
            <span className="waiting-row__timer">
              {mm}:{ss}
            </span>
          </div>
        </>
      ) : null}
    </Screen>
  );
}
