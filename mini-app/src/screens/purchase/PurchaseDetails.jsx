import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import { config } from '../../config';
import { getTelegramInitData } from '../../hooks/useTelegramUser';

export default function PurchaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { purchases, showToast, getProduct } = useApp();
  const { t } = useLocale();
  const purchase = purchases.find((p) => p.id === id);
  const liveProduct = purchase ? getProduct(purchase.productId) : null;

  const copy = (value) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    showToast(t('common.copied'));
  };

  // .zip-файл конкретной единицы товара (см. account_inventory.file_path)
  // — качаем через download-account-file, а не отдаём blob-ссылку
  // напрямую: Telegram.WebApp.downloadFile() требует настоящий HTTPS-адрес
  // с заголовком Content-Disposition, присланным сервером.
  const downloadZip = (index) => {
    if (!purchase) return;
    const initData = getTelegramInitData();
    const url = `${config.supabaseUrl}/functions/v1/download-account-file?purchaseId=${encodeURIComponent(
      purchase.id
    )}&index=${index}&initData=${encodeURIComponent(initData)}`;
    const fileName = purchase.credentials?.[index]?.fileName || 'account.zip';

    if (window.Telegram?.WebApp?.downloadFile) {
      window.Telegram.WebApp.downloadFile({ url, file_name: fileName }, () => {});
    } else {
      window.open(url, '_blank');
    }
  };

  // Все выданные данные одним .txt-файлом — удобно, когда куплено
  // сразу много аккаунтов и копировать каждый по отдельности неудобно.
  // Формат строк тот же, что и при загрузке склада в админке
  // (login:password[:допинфо]), так и для ссылок.
  const downloadAsFile = () => {
    if (!purchase?.credentials?.length) return;
    // .zip-креды сюда не попадают — у них своя кнопка "Скачать .zip"
    // ниже (нужен настоящий бинарный файл, а не строка в .txt).
    const lines = purchase.credentials
      .filter((cred) => !cred.filePath)
      .map((cred) =>
        cred.link
          ? cred.extra
            ? `${cred.link}:${cred.extra}`
            : cred.link
          : cred.extra
            ? `${cred.login}:${cred.password}:${cred.extra}`
            : `${cred.login}:${cred.password}`
      );
    if (lines.length === 0) return;
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (purchase.title || 'purchase').replace(/[^\wа-яА-ЯёЁ -]/g, '').trim().replace(/\s+/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle || 'purchase'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!purchase) {
    return (
      <Screen title={t('purchaseDetails.title')}>
        <EmptyState icon="?" title={t('purchaseDetails.notFound')} />
      </Screen>
    );
  }

  const isAccount = purchase.kind === 'account';

  const specs = isAccount
    ? [
        [t('purchaseDetails.geo'), purchase.geo],
        [t('purchaseDetails.type'), purchase.type],
        [t('purchaseDetails.quantity'), `${purchase.qty} ${t('purchaseDetails.pieces')}`],
      ]
    : [
        [t('purchaseDetails.license'), purchase.license ?? t('purchaseDetails.unlimited')],
        [t('purchaseDetails.type'), purchase.type],
        [t('purchaseDetails.platform'), purchase.platform],
      ];

  return (
    <Screen title={t('purchaseDetails.title')}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('purchaseDetails.title')}</h1>
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
            <span className="product-detail__category">{isAccount ? t('purchaseDetails.accounts') : t('purchaseDetails.solutions')}</span>
            <span className="status-dot status-dot--success">
              <span className="dot dot--success" /> {t('purchaseDetails.paid')}
            </span>
          </div>
        </div>

        <h3 className="section__title">{t('purchaseDetails.specs')}</h3>
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
            <h3 className="section__title">{t('purchaseDetails.purchaseSection')}</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>{t('purchaseDetails.status')}</span>
                <span className="detail-list__success">{t('purchaseDetails.paid')}</span>
              </div>
              <div className="detail-list__row">
                <span>{t('purchaseDetails.purchaseDate')}</span>
                <span>{purchase.date}</span>
              </div>
              <div className="detail-list__row">
                <span>{t('purchaseDetails.cost')}</span>
                <span>${purchase.price.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* Заголовок и блок "нет данных" нужны, только если реально ожидалась
            автоматическая выдача (логин/пароль/ссылка/zip). Для товаров с
            ручным количеством (см. AdminProductForm — "Ручное количество")
            credentials всегда пустые и это НЕ ошибка — покупатель просто
            получает номер заказа ниже, отдельно объяснять "недоступны"
            тут не нужно, это бы выглядело как что-то сломалось. */}
        {(purchase.credentials?.length > 0 || !purchase.orderNumber) && (
          <>
            <h3 className="section__title">{isAccount ? t('purchaseDetails.getProductAccount') : t('purchaseDetails.getProductLink')}</h3>

            {purchase.credentials?.length ? (
              <>
                {purchase.credentials.some((cred) => !cred.filePath) && (
                  <button className="btn btn--secondary btn--block" style={{ marginBottom: 12 }} onClick={downloadAsFile}>
                    {t('purchaseDetails.downloadAsFile')}
                  </button>
                )}
                {purchase.credentials.some((cred) => cred.filePath) && (
                  <div className="list" style={{ marginBottom: 12 }}>
                    {purchase.credentials.map((cred, i) =>
                      cred.filePath ? (
                        <button
                          key={i}
                          type="button"
                          className="btn btn--secondary btn--block"
                          style={{ marginBottom: 8 }}
                          onClick={() => downloadZip(i)}
                        >
                          {purchase.credentials.length > 1
                            ? t('purchaseDetails.downloadZipNumbered', { n: i + 1 })
                            : t('purchaseDetails.downloadZip')}
                        </button>
                      ) : null
                    )}
                  </div>
                )}
                {!isAccount && (
                  <div className="list">
                    {purchase.credentials.map((cred, i) => (
                      <div className="detail-list" key={i} style={{ marginBottom: 10 }}>
                        {purchase.credentials.length > 1 && (
                          <div className="detail-list__row">
                            <span style={{ fontWeight: 700 }}>{t('purchaseDetails.fileNumbered', { n: i + 1 })}</span>
                            <span />
                          </div>
                        )}
                        {cred.link ? (
                          <div className="detail-list__row">
                            <span>{t('purchaseDetails.link')}</span>
                            <button
                              className="detail-list__link mono"
                              style={{ wordBreak: 'break-all', textAlign: 'right' }}
                              onClick={() => copy(cred.link)}
                            >
                              {cred.link}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="hint-text">
                {isAccount ? t('purchaseDetails.noDataLogin') : t('purchaseDetails.noDataDownload')}
              </p>
            )}
          </>
        )}

        {purchase.orderNumber && (
          <>
            <h3 className="section__title">{t('purchaseDetails.orderNumberTitle')}</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>{t('purchaseDetails.orderNumberLabel')}</span>
                <button className="detail-list__link mono" onClick={() => copy(purchase.orderNumber)}>
                  {purchase.orderNumber}
                </button>
              </div>
            </div>
            <p className="hint-text" style={{ textAlign: 'left', marginTop: 8 }}>
              {t('purchaseDetails.orderNumberHint')}
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
