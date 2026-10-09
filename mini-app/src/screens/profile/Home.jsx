import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import Icon from '../../components/Icon';
import { user as mockUser } from '../../mock/data';
import { useApp } from '../../context/AppContext';
import { useTelegramUser } from '../../hooks/useTelegramUser';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { openSupportChat } from '../../utils/support';
import { trackEvent } from '../../supabase/api';

export default function ProfileHome() {
  const navigate = useNavigate();
  const { balance } = useApp();
  const tgUser = useTelegramUser();
  const isAdmin = useIsAdmin();

  // Если приложение открыто внутри Telegram — берём реальные данные пользователя.
  // Если нет (например, тестируем в обычном браузере) — используем моковые.
  const displayName = tgUser?.firstName ?? mockUser.name;
  const username = tgUser?.username ?? mockUser.username;
  const telegramId = tgUser?.id ?? mockUser.telegramId;
  const photoUrl = tgUser?.photoUrl;

  const menu = [
    { icon: 'history', label: 'История баланса', to: '/balance/history' },
    { icon: 'headset', label: 'Поддержка', onClick: openSupportChat },
    { icon: 'document', label: 'Условия и политика', to: '/profile/terms' },
  ];

  return (
    <Screen title="Профиль">
      <h1 className="page-title">Профиль</h1>

      <div className="profile-card">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="profile-card__avatar-img" />
        ) : (
          <div className="profile-card__avatar">◔</div>
        )}
        <div className="profile-card__info">
          <span className="profile-card__name">{displayName}</span>
          <span className="profile-card__username">{username}</span>
          <span className="profile-card__id">ID: {telegramId}</span>
        </div>
      </div>

      <div className="balance-card">
        <span className="balance-card__label">Баланс</span>
        <span className="balance-card__amount">${balance.toFixed(2)}</span>
        <button
          className="btn btn--primary btn--block"
          onClick={() => {
            trackEvent('topup_click');
            navigate('/balance/deposit');
          }}
        >
          + Пополнить баланс
        </button>
      </div>

      <div className="menu-list">
        {menu.map((item) => (
          <button key={item.label} className="menu-row" onClick={item.onClick ?? (() => navigate(item.to))}>
            <span className="menu-row__icon">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="menu-row__label">{item.label}</span>
            <span className="menu-row__chevron">›</span>
          </button>
        ))}

        {/* Виден только тому Telegram-аккаунту, ID которого указан в
            VITE_ADMIN_TELEGRAM_IDS. Реальная защита данных — пароль
            на backend, это лишь скрывает пункт от обычных покупателей. */}
        {isAdmin && (
          <button className="menu-row" onClick={() => navigate('/admin/products')}>
            <span className="menu-row__icon">
              <Icon name="gear" size={18} />
            </span>
            <span className="menu-row__label">Админ-панель</span>
            <span className="menu-row__chevron">›</span>
          </button>
        )}
      </div>
    </Screen>
  );
}
