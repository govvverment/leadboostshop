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
        ['GEO', `${purchase.geo} ${purchase.geoFlag}`],
        ['Тип', purchase.type],
        ['Платформа', purchase.platform],
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
          <div className="list">
            {purchase.credentials.map((cred, i) => (
              <div className="detail-list" key={i} style={{ marginBottom: 10 }}>
                {purchase.credentials.length > 1 && (
                  <div className="detail-list__row">
                    <span style={{ fontWeight: 700 }}>{isAccount ? `Аккаунт ${i + 1}` : `Файл ${i + 1}`}</span>
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
                ) : (
                  <>
                    <div className="detail-list__row">
                      <span>Логин</span>
                      <button className="detail-list__link mono" onClick={() => copy(cred.login)}>
                        {cred.login}
                      </button>
                    </div>
                    <div className="detail-list__row">
                      <span>Пароль</span>
                      <button className="detail-list__link mono" onClick={() => copy(cred.password)}>
                        {cred.password}
                      </button>
                    </div>
                    {cred.extra && (
                      <div className="detail-list__row">
                        <span>Доп. инфо</span>
                        <span className="mono">{cred.extra}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
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
