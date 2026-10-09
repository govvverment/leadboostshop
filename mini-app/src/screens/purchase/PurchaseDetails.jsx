import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { config } from '../../config';
import { getTelegramInitData } from '../../hooks/useTelegramUser';

export default function PurchaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { purchases, showToast, getProduct } = useApp();
  const purchase = purchases.find((p) => p.id === id);
  const liveProduct = purchase ? getProduct(purchase.productId) : null;

  const copy = (value) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    showToast('Скопировано');
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
      <Screen title="Покупка">
        <EmptyState icon="?" title="Покупка не найдена" />
      </Screen>
    );
  }

  const isAccount = purchase.kind === 'account';

  const specs = isAccount
    ? [
        ['GEO', purchase.geo],
        ['Тип', purchase.type],
        ['Количество', `${purchase.qty} шт.`],
      ]
    : [
        ['Лицензия', purchase.license ?? 'Бессрочная'],
        ['Тип', purchase.type],
        ['Платформа', purchase.platform],
      ];

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

        {/* Заголовок и блок "нет данных" нужны, только если реально ожидалась
            автоматическая выдача (логин/пароль/ссылка/zip). Для товаров с
            ручным количеством (см. AdminProductForm — "Ручное количество")
            credentials всегда пустые и это НЕ ошибка — покупатель просто
            получает номер заказа ниже, отдельно объяснять "недоступны"
            тут не нужно, это бы выглядело как что-то сломалось. */}
        {(purchase.credentials?.length > 0 || !purchase.orderNumber) && (
          <>
            <h3 className="section__title">{isAccount ? 'Получить товар' : 'Ссылка на скачивание'}</h3>

            {purchase.credentials?.length ? (
              <>
                {purchase.credentials.some((cred) => !cred.filePath) && (
                  <button className="btn btn--secondary btn--block" style={{ marginBottom: 12 }} onClick={downloadAsFile}>
                    📄 Скачать файлом
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
                          📦 Скачать {purchase.credentials.length > 1 ? `.zip №${i + 1}` : '.zip'}
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
                            <span style={{ fontWeight: 700 }}>{`Файл ${i + 1}`}</span>
                            <span />
                          </div>
                        )}
                        {cred.link ? (
                          <div className="detail-list__row">
                            <span>Ссылка</span>
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
                Данные {isAccount ? 'для входа' : 'для скачивания'} недоступны — обратитесь в поддержку, если покупка не
                выдала доступы.
              </p>
            )}
          </>
        )}

        {purchase.orderNumber && (
          <>
            <h3 className="section__title">Номер заказа</h3>
            <div className="detail-list">
              <div className="detail-list__row">
                <span>Номер</span>
                <button className="detail-list__link mono" onClick={() => copy(purchase.orderNumber)}>
                  {purchase.orderNumber}
                </button>
              </div>
            </div>
            <p className="hint-text" style={{ textAlign: 'left', marginTop: 8 }}>
              Напишите этот номер менеджеру в личные сообщения — он поможет оформить заказ дальше.
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
