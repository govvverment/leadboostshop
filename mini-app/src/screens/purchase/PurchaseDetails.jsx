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
          ['Количество', purchase.qty ? `${purchase.qty} шт.` : null],
        ]
      : [
          ['Лицензия', purchase.license ?? 'Бессрочная'],
          ['Тип', purchase.type],
        ]
  ).filter(([, value]) => Boolean(value));

  // Второй способ выдачи аккаунта — готовый .zip файл (см.
  // account_inventory.file_path), наравне с login:password. В одной
  // покупке может быть смесь того и другого — текстовые строки по-прежнему
  // объединяются в один .txt (ниже), а каждый .zip скачивается отдельно
  // (сохраняем и index в исходном массиве credentials — он же нужен
  // download-account-file, чтобы найти файл на сервере).
  const textCreds = purchase.credentials?.filter((c) => c.login && !c.filePath) ?? [];
  const zipCreds = (purchase.credentials ?? [])
    .map((c, i) => ({ ...c, index: i }))
    .filter((c) => c.filePath);

  // Текстовые аккаунты выдаются одним .txt-файлом (login:password
  // построчно, тот же формат, что и при загрузке склада в админке) —
  // без построчного списка на экране, только карточка файла + кнопка.
  const fileName = `accounts_${(purchase.date || '').replace(/\./g, '')}_${textCreds.length}.txt`;

  const downloadAsFile = () => {
    if (!textCreds.length) return;

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

    const lines = textCreds.map((cred) =>
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

  // .zip одного конкретного аккаунта — та же логика, что и у
  // downloadAsFile (Telegram.WebApp.downloadFile нужен настоящий
  // HTTPS-адрес с заголовками от сервера), только без готового текста —
  // сами байты качаем через fetch и сохраняем как blob:-URL, если
  // системного downloadFile нет (вне Telegram / старый клиент).
  const downloadAccountFile = (cred) => {
    const name = cred.fileName || `account_${cred.index + 1}.zip`;
    const initData = getTelegramInitData();
    const fileUrl =
      `${config.supabaseUrl}/functions/v1/download-account-file` +
      `?purchaseId=${encodeURIComponent(purchase.id)}&index=${cred.index}&initData=${encodeURIComponent(initData)}`;

    const tgDownload = window.Telegram?.WebApp?.downloadFile;
    if (tgDownload) {
      try {
        tgDownload({ url: fileUrl, file_name: name }, () => {});
        return;
      } catch {
        // Старый клиент Telegram без этого метода — падаем в обычный способ ниже.
      }
    }

    fetch(fileUrl)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('download failed'))))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => showToast('Не удалось скачать файл'));
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

              {textCreds.length > 0 && (
                <>
                  <div className="file-card">
                    <span className="file-card__icon">
                      <Icon name="download" size={20} />
                    </span>
                    <div className="file-card__body">
                      <span className="file-card__name">{fileName}</span>
                      <span className="file-card__meta">
                        {[`${textCreds.length} аккаунтов`, 'TXT', purchase.geo].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn--primary btn--block" onClick={downloadAsFile}>
                    <Icon name="download" size={16} /> Скачать файл
                  </button>
                  <p className="hint-text" style={{ margin: '8px 0 0' }}>Файл содержит все приобретённые аккаунты</p>
                </>
              )}

              {zipCreds.length > 0 && (
                <div style={{ marginTop: textCreds.length > 0 ? 16 : 0 }}>
                  {zipCreds.map((cred) => (
                    <div className="file-card" key={cred.index}>
                      <span className="file-card__icon">📦</span>
                      <div className="file-card__body">
                        <span className="file-card__name">{cred.fileName || `account_${cred.index + 1}.zip`}</span>
                        <span className="file-card__meta">ZIP</span>
                      </div>
                      <button
                        type="button"
                        className="detail-list__link"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => downloadAccountFile(cred)}
                      >
                        <Icon name="download" size={14} /> Скачать
                      </button>
                    </div>
                  ))}
                  <p className="hint-text" style={{ margin: '8px 0 0' }}>
                    Каждый аккаунт — отдельный .zip файл, скачивайте по одному
                  </p>
                </div>
              )}
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
