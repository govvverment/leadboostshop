import { useParams, useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import ProductIcon from '../../components/ProductIcon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';

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

  // Все выданные данные одним .txt-файлом — удобно, когда куплено
  // сразу много аккаунтов и копировать каждый по отдельности неудобно.
  // Формат строк тот же, что и при загрузке склада в админке
  // (login:password[:допинфо]), так и для ссылок.
  const downloadAsFile = () => {
    if (!purchase?.credentials?.length) return;
    const lines = purchase.credentials.map((cred) =>
      cred.link
        ? cred.extra
          ? `${cred.link}:${cred.extra}`
          : cred.link
        : cred.extra
          ? `${cred.login}:${cred.password}:${cred.extra}`
          : `${cred.login}:${cred.password}`
    );
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

        <h3 className="section__title">{isAccount ? 'Получить товар' : 'Ссылка на скачивание'}</h3>

        {purchase.credentials?.length ? (
          <>
            <button className="btn btn--secondary btn--block" style={{ marginBottom: 12 }} onClick={downloadAsFile}>
              📄 Скачать файлом
            </button>
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
      </div>
    </Screen>
  );
}
