import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

export default function ProductsHome() {
  const navigate = useNavigate();
  const { products, categories, restocks } = useApp();
  const { t, plural } = useLocale();

  function timeAgo(date) {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t('home.justNow');
    if (minutes < 60) return t('home.timeAgoTemplate', { n: minutes, word: plural(minutes, 'home.minutesWords') });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('home.timeAgoTemplate', { n: hours, word: plural(hours, 'home.hoursWords') });
    const days = Math.floor(hours / 24);
    return t('home.timeAgoTemplate', { n: days, word: plural(days, 'home.daysWords') });
  }

  return (
    <Screen title={t('home.title')}>
      {restocks.length > 0 && (
        <div className="section">
          <h2 className="section__title">{t('home.news')}</h2>
          <div className="news-list">
            {restocks.map((r, i) => (
              <button
                key={`${r.productId}-${i}`}
                className="news-item"
                onClick={() => navigate(`/product/${r.productId}`)}
              >
                <ProductImage product={{ imageUrl: r.imageUrl, kind: 'account' }} size={40} />
                <div className="news-item__body">
                  <span className="news-item__title">{r.title}</span>
                  <span className="news-item__meta">
                    {[r.geo, t('home.restockedTemplate', { time: timeAgo(r.restockedAt) })].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="news-item__delta">+{r.qtyAdded} {t('home.pieces')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section__title">{t('home.categories')}</h2>
        <div className="category-grid">
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            const wordsKey = `home.categoryWords.${c.id}`;
            return (
              <button key={c.id} className="category-card" onClick={() => navigate(`/products/${c.id}`)}>
                <span className="category-card__icon">
                  <ProductImage
                    product={{ imageUrl: c.imageUrl, kind: c.id === 'accounts' ? 'account' : 'solution' }}
                  />
                </span>
                <span className="category-card__title">{c.title.split(' ').join('\n')}</span>
                <span className="category-card__count">
                  {count} {plural(count, wordsKey) || plural(count, 'home.categoryWords.default')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}
