import { useNavigate } from 'react-router-dom';
import { openSupportChat } from '../utils/support';

export default function Header() {
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <button className="app-header__logo" onClick={() => navigate('/')} aria-label="На главную">
        <img src="/logo.png" alt="LEAD BOOST" className="app-header__logo-img" />
      </button>
      <button className="app-header__support" onClick={openSupportChat}>
        <img src="/icons/support.png" alt="" className="app-header__support-icon-img" />
        Поддержка
      </button>
    </header>
  );
}
