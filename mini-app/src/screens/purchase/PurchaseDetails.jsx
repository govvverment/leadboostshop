import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import Icon from '../../components/Icon';
import { useApp } from '../../context/AppContext';
import { getTelegramInitData } from '../../hooks/useTelegramUser';
import { config } from '../../config';

export default function PurchaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { purchases, showToast, getProduct } = useApp();
  const purchase = purchases.find((p) => p.id === id);
  const liveProduct = purchase ? getProduct(purchase.productId) : null;
  const [showKey, setShowKey] = useState(false);

  const copy = (value) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    showToast('Скопировано');
  };

  if (!purchase) {
    return (
      <Screen title="Покупка">
        <EmptyState icon="?" title="Покупка не найдена" />
      </Screen>
    );
  }

  const isAccount = purchase.kind === 'account';

  // .filter(Boolean) — если у конкретной покупки нет значения (старые
  // записи до бэкафилла снимка, либо у товара просто не было этого
  // поля), строка не показывается вообще, а не рендерит "null" текстом.
  const specs = (
    isAccount
      ? [
          ['GEO', [purchase.geo, purchase.geoFlag].filter(Boolean).join(' ')],
          ['Тип', purchase.type],
          ['Платформа', purchase.platform],
          ['Количество', purchase.qty ? `${purchase.qty} шт.` : null],
        ]
      : [
          ['Лицензия', purchase.license ?? 'Бессрочная'],
          ['Тип', purchase.type],
          ['Платформа', purchase.platform],
        ]
  ).filter(([, value]) => Boolean(value));

  // Аккаунты выдаются одним .txt-файлом (login:password построчно,
  // тот же формат, что и при загрузке склада в админке) — без
  // построчного списка на экране, только карточка файла + кнопка.
  const fileName = `accounts_${(purchase.date || '').replace(/\./g, '')}_${purchase.qty ?? purchase.credentials?.length ?? ''}.txt`;

  const downloadAsFile = () => {
    if (!purchase.credentials?.length) return;

    // Внутри Telegram обычная ссылка с атрибутом download часто не
    // скачивает файл, а просто открывает его в WebView — у SDK есть
    // отдельный метод именно под это (Bot API 8.0+), но ему нужен
    // настоящий HTTPS-адрес с сервера (blob: он не принимает), поэтому
    // здесь дёргаем свою Edge Function, а не генерируем файл на лету.
    const tgDownload = window.Telegram?.WebApp?.downloadFile;
    if (tgDownload) {
      const initData = getTelegramInitData();
      const fileUrl =
        `${config.supabaseUrl}/functions/v1/download-purchase-file` +
        `?purchaseId=${encodeURIComponent(purchase.id)}&initData=${encodeURIComponent(initData)}`;
      try {
        tgDownload({ url: fileUrl, file_name: fileName }, () => {});
        return;
      } catch {
        // Старый клиент Telegram без этого метода — падаем в обычный способ ниже.
      }
    }

    const lines = purchase.credentials.map((cred) =>
      cred.extra ? `${cred.login}:${cred.password}:${cred.extra}` : `${cred.login}:${cred.password}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Для разовых покупок сейчас ровно одна выданная строка на покупку.
  const oneTimeCred = !isAccount ? purchase.credentials?.[0] : null;

  return (
    <Screen title="Покупка">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Покупка</h1>
      </div>

      <div className="product-detail">
        <div className="product-detail__top">
          <div className="product-detail__icon">
            {liveProduct ? (
              <ProductImage product={liveProduct} size={48} />
            ) : (
              <ProductIcon kind={purchase.kind} size={48} />
            )}
          </div>
          <div className="product-detail__meta">
            <h2 className="product-detail__title">{purchase.title}</h2>
            <span className="product-detail__category">{isAccount ? 'Аккаунты' : 'Технические решения'}</span>
            <span className="status-dot status-dot--success">
              <span className="dot dot--success" /> Оплачено
            </span>
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

        {!isAccount && (
          <>
            <h3 className="section__title">Покупка</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>Статус</span>
                <span className="detail-list__success">Оплачено</span>
              </div>
              <div className="detail-list__row">
                <span>Дата покупки</span>
                <span>{purchase.date}</span>
              </div>
              <div className="detail-list__row">
                <span>Стоимость</span>
                <span>${purchase.price.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {isAccount ? (
          purchase.credentials?.length ? (
            <>
              <h3 className="section__title">Получить товар</h3>
              <div className="file-card">
                <span className="file-card__icon">
                  <Icon name="download" size={20} />
                </span>
                <div className="file-card__body">
                  <span className="file-card__name">{fileName}</span>
                  <span className="file-card__meta">
                    {[`${purchase.credentials.length} аккаунтов`, 'TXT', purchase.geo].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
              <button className="btn btn--primary btn--block" onClick={downloadAsFile}>
                <Icon name="download" size={16} /> Скачать файл
              </button>
              <p className="hint-text" style={{ margin: '8px 0 0' }}>Файл содержит все приобретённые аккаунты</p>
            </>
          ) : (
            <>
              <h3 className="section__title">Получить товар</h3>
              <p className="hint-text">
                Данные для входа недоступны — обратитесь в поддержку, если покупка не выдала доступы.
              </p>
            </>
          )
        ) : (
          <>
            <h3 className="section__title">Доступ к товару</h3>
            {oneTimeCred ? (
              <div className="detail-list">
                <div className="detail-list__row">
                  <span>Файл</span>
                  <a
                    className="detail-list__link detail-list__success access-row__action"
                    href={oneTimeCred.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Загрузить <Icon name="download" className="access-row__icon" />
                  </a>
                </div>
                {oneTimeCred.extra && (
                  <div className="detail-list__row">
                    <span>Ключ доступа</span>
                    <span className="mono access-row__value">
                      {showKey ? oneTimeCred.extra : '••••••••••'}
                      <button className="eye-toggle" onClick={() => setShowKey((v) => !v)} aria-label="Показать/скрыть">
                        <Icon name={showKey ? 'eyeOff' : 'eye'} size={14} />
                      </button>
                      {showKey && (
                        <button className="detail-list__link" onClick={() => copy(oneTimeCred.extra)}>
                          <Icon name="copy" size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {oneTimeCred.instructionsUrl && (
                  <div className="detail-list__row">
                    <span>Инструкция</span>
                    <a
                      className="detail-list__link access-row__action"
                      href={oneTimeCred.instructionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть <Icon name="externalLink" className="access-row__icon" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="hint-text">
                Данные для скачивания недоступны — обратитесь в поддержку, если покупка не выдала доступы.
              </p>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
