import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import LetterAvatar from '../../components/LetterAvatar';
import { useApp } from '../../context/AppContext';

export default function ReferralsAll() {
  const navigate = useNavigate();
  const { referral } = useApp();

  return (
    <Screen title="Ваши рефералы">
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Ваши рефералы</h1>
      </div>

      <div className="referral-summary-row">
        <span>{referral.list.length} реферала</span>
        <span className="referral-summary-row__amount">${referral.earned.toFixed(2)}</span>
      </div>

      <h3 className="section__title">Все рефералы</h3>

      {referral.list.length === 0 ? (
        <EmptyState icon="👥" title="Рефералов пока нет" subtitle="Поделитесь ссылкой, чтобы пригласить друзей" />
      ) : (
        <div className="list">
          {referral.list.map((r, i) => (
            <div key={`${r.username}-${i}`} className="list-row list-row--static">
              <LetterAvatar name={r.username} />
              <div className="list-row__body">
                <span className="list-row__title">{r.username}</span>
                <span className="list-row__meta">{r.name}</span>
              </div>
              <span className="list-row__amount list-row__amount--positive">+${r.earned.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
