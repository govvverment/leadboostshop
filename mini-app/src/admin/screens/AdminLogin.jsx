import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { useAdminAuth } from '../AdminAuthContext';

export default function AdminLogin() {
  const { login, error, loading } = useAdminAuth();
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    await login(password);
  };

  return (
    <Screen title="Админ-панель" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/profile')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Админ-панель</h1>
      </div>

      <form className="sheet" onSubmit={handleSubmit}>
        <h2 className="sheet__title">Вход</h2>
        <p className="sheet__subtitle">Введите пароль администратора</p>

        <input
          type="password"
          className="text-input"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />

        {error && <p className="confirm-sheet__warning" style={{ marginTop: 10 }}>{error}</p>}

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </Screen>
  );
}
