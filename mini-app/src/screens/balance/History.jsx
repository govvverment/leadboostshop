import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import ProductImage from '../../components/ProductImage';
import { useApp } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';
import { LOCALE_DATE_TAG } from '../../i18n/translations';

const ICONS = { deposit: 'download', purchase: 'bag', subscription: 'code', referral: 'people' };

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupLabel(date, t, dateTag) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return t('history.today');
  if (isSameDay(date, yesterday)) return t('history.yesterday');
  return date.toLocaleDateString(dateTag, { day: 'numeric', month: 'long' });
}

// Плоский список от backend (отсортирован по дате) группируем по дню
// прямо здесь — так и в моковом, и в реальном режиме используется один
// и тот же плоский формат, группировка не зависит от источника данных.
function groupByDay(items, t, dateTag) {
  const groups = [];
  const byLabel = new Map();
  for (const item of items) {
    const label = groupLabel(new Date(item.date), t, dateTag);
    if (!byLabel.has(label)) {
      const group = { group: label, items: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    byLabel.get(label).items.push(item);
  }
  return groups;
}

export default function BalanceHistory() {
  const navigate = useNavigate();
  const { balanceHistory } = useApp();
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState('all');

  const filterEntry = (item) => {
    if (filter === 'all') return true;
    if (filter === 'deposit') return item.type === 'deposit';
    return item.type !== 'deposit';
  };

  const groups = groupByDay(balanceHistory, t, LOCALE_DATE_TAG[locale])
    .map((g) => ({ ...g, items: g.items.filter(filterEntry) }))
    .filter((g) => g.items.length > 0);

  return (
    <Screen title={t('history.title')}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          ‹
        </button>
        <h1 className="page-head__title">{t('history.title')}</h1>
      </div>

      <div className="filter-row">
        {[
          ['all', t('history.filterAll')],
          ['deposit', t('history.filterDeposit')],
          ['purchase', t('history.filterPurchase')],
        ].map(([id, label]) => (
          <button key={id} className={'filter-chip' + (filter === id ? ' is-active' : '')} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="⬚" title={t('history.emptyTitle')} subtitle={t('history.emptySubtitle')} />
      ) : (
        groups.map((g) => (
          <div className="history-group" key={g.group}>
            <span className="history-group__label">{g.group}</span>
            <div className="list">
              {g.items.map((h) => (
                <div key={h.id} className="history-row">
                  {h.imageUrl ? (
                    <span className="history-row__icon history-row__icon--photo">
                      <ProductImage product={{ imageUrl: h.imageUrl, kind: 'account' }} size={34} />
                    </span>
                  ) : (
                    <span className={'history-row__icon' + (h.amount > 0 ? ' history-row__icon--success' : '')}>
                      <Icon name={ICONS[h.type] ?? 'bag'} size={16} />
                    </span>
                  )}
                  <div className="list-row__body">
                    <span className="list-row__title">{h.title}</span>
                    <span className="list-row__meta">{h.meta}</span>
                  </div>
                  <span className={'list-row__amount' + (h.amount > 0 ? ' list-row__amount--positive' : '')}>
                    {h.amount > 0 ? '+' : '−'}${Math.abs(h.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
