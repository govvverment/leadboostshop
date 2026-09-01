import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import EmptyState from '../../components/EmptyState';
import LetterAvatar from '../../components/LetterAvatar';
import Icon from '../../components/Icon';
import { useApp } from '../../context/AppContext';
import { useTelegramUser } from '../../hooks/useTelegramUser';
import { config } from '../../config';

const REFERRAL_PERCENT = 5; // фиксированный %, см. referral_percent() в SQL

export default function ReferralsHome() {
  const navigate = useNavigate();
  const { showToast, referral } = useApp();
  const tgUser = useTelegramUser();

  // Персональная ссылка собирается прямо на фронтенде из ID текущего
  // пользователя Telegram. Формат — обычный t.me/<бот>?start=... (не
  // Direct Link Mini App ?startapp=): для пользователя, который ни
  // разу не открывал бота, ?startapp= не прокидывает start_param, а
  // классический ?start= работает всегда — бот (bot-webhook) сам
  // отвечает на /start кнопкой "Открыть магазин" с рефералом в URL.
  // Вне Telegram (тест в браузере) показываем ссылку-заглушку с
  // примером ID.
  const myLink = `t.me/${config.botUsername}?start=ref_${tgUser ? tgUser.id : '123456789'}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(myLink).catch(() => {});
    showToast('Скопировано');
  };

  return (
    <Screen title="Рефералы">
      <h1 className="page-title">Рефералы</h1>
      <p className="page-subtitle">Приглашайте друзей и получайте вознаграждение</p>

      <div className="referral-card">
        <span className="referral-card__label">Ваше реферальное вознаграждение</span>
        <span className="referral-card__percent-value">{REFERRAL_PERCENT}%</span>
        <span className="referral-card__percent-note">по покупкам приглашённых пользователей</span>
        <div className="referral-card__link-row">
          <span className="referral-card__link">{myLink}</span>
          <button className="referral-card__copy" onClick={copyLink} aria-label="Копировать">
            <Icon name="copy" size={16} />
          </button>
        </div>
      </div>

      <h3 className="section__title">Статистика</h3>
      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-card__label">Приглашены</span>
          <span className="stat-card__value">{referral.invited}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Заработано</span>
          <span className="stat-card__value stat-card__value--success">${referral.earned.toFixed(2)}</span>
        </div>
      </div>

      <div className="section__head">
        <h3 className="section__title">Ваши рефералы</h3>
        {referral.list.length > 0 && (
          <button className="link-button" onClick={() => navigate('/referrals/all')}>
            Все →
          </button>
        )}
      </div>

      {referral.list.length === 0 ? (
        <EmptyState icon="👥" title="Рефералов пока нет" subtitle="Поделитесь ссылкой, чтобы пригласить друзей" />
      ) : (
        <div className="referral-group">
          {referral.list.slice(0, 2).map((r, i) => (
            <div key={`${r.username}-${i}`} className="referral-group__row">
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
