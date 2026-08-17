import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import { useApp } from '../../context/AppContext';

const ICONS = { deposit: '↓', purchase: '🛍', subscription: '</>', referral: '👥' };

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupLabel(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return 'Сегодня';
  if (isSameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// Плоский список от backend (отсортирован по дате) группируем по дню
// прямо здесь — так и в моковом, и в реальном режиме используется один
// и тот же плоский формат, группировка не зависит от источника данных.
function groupByDay(items) {
  const groups = [];
  const byLabel = new Map();
  for (const item of items) {
    const label = groupLabel(new Date(item.date));
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
  const [filter, setFilter] = useState('all');

  const filterEntry = (item) => {
    if (filter === 'all') return true;
    if (filter === 'deposit') return item.type === 'deposit';
    return item.type !== 'deposit';
  };

  const groups = groupByDay(balanceHistory)
    .map((g) => ({ ...g, items: g.items.filter(filterEntry) }))
    .filter((g) => g.items.length > 0);

  return (
    <Screen title="История баланса">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">История баланса</h1>
      </div>

      <div className="filter-row">
        {[
          ['all', 'Все'],
          ['deposit', 'Пополнение'],
          ['purchase', 'Покупки'],
        ].map(([id, label]) => (
          <button key={id} className={'filter-chip' + (filter === id ? ' is-active' : '')} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="⬚" title="История пуста" subtitle="Здесь будут ваши пополнения и списания" />
      ) : (
        groups.map((g) => (
          <div className="history-group" key={g.group}>
            <span className="history-group__label">{g.group}</span>
            <div className="list">
              {g.items.map((h) => (
                <div key={h.id} className="history-row">
                  <span className={'history-row__icon' + (h.amount > 0 ? ' history-row__icon--success' : '')}>
                    {ICONS[h.type] ?? '•'}
                  </span>
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
