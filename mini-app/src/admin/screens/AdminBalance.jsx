import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

// Ручное начисление/списание баланса по Telegram ID — двухшаговый флоу:
// 1) находим пользователя (find-user-by-telegram) и показываем админу,
//    кого он собирается пополнить (имя/username/текущий баланс), чтобы
//    не ошибиться с ID; 2) уже после этого — реальное начисление.
export default function AdminBalance() {
  const navigate = useNavigate();

  const [telegramId, setTelegramId] = useState('');
  const [found, setFound] = useState(null); // { telegramId, username, firstName, balance }
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFound(null);
    if (!telegramId.trim()) return setError('Укажите Telegram ID');

    setSearching(true);
    try {
      const result = await adminApi.findUserByTelegram(telegramId.trim());
      setFound(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleCredit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!found) return;
    const value = Number(amount);
    if (!value) return setError('Укажите ненулевую сумму (можно отрицательную — для списания)');

    setSaving(true);
    try {
      const result = await adminApi.creditBalance(found.telegramId, value, note.trim() || null);
      setSuccess(`Готово. Новый баланс: $${result.balance.toFixed(2)}`);
      setFound((f) => (f ? { ...f, balance: result.balance } : f));
      setAmount('');
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Баланс пользователя" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Баланс пользователя</h1>
      </div>

      <form onSubmit={handleSearch}>
        <h3 className="section__title">Найти пользователя</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            inputMode="numeric"
            placeholder="Telegram ID, например 123456789"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
          />
          <button className="btn btn--secondary" type="submit" disabled={searching}>
            {searching ? '...' : 'Найти'}
          </button>
        </div>
      </form>

      {error && <p className="confirm-sheet__warning" style={{ marginTop: 14 }}>{error}</p>}

      {found && (
        <>
          <div className="detail-list" style={{ marginTop: 20 }}>
            <div className="detail-list__row">
              <span>Telegram ID</span>
              <span>{found.telegramId}</span>
            </div>
            <div className="detail-list__row">
              <span>Имя</span>
              <span>{found.firstName || '—'}</span>
            </div>
            <div className="detail-list__row">
              <span>Username</span>
              <span>{found.username ? `@${found.username}` : '—'}</span>
            </div>
            <div className="detail-list__row">
              <span>Текущий баланс</span>
              <span style={{ fontWeight: 700 }}>${found.balance.toFixed(2)}</span>
            </div>
          </div>

          <form onSubmit={handleCredit}>
            <h3 className="section__title" style={{ marginTop: 20 }}>
              Начислить / списать
            </h3>
            <p className="hint-text" style={{ textAlign: 'left', margin: '0 0 10px' }}>
              Положительное число — начисление, отрицательное — списание. Изменение сразу видно
              пользователю в истории баланса.
            </p>
            <input
              className="text-input"
              type="number"
              step="0.01"
              placeholder="Сумма, например 10 или -5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <input
              className="text-input"
              placeholder="Комментарий (необязательно)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            {success && <p style={{ color: 'var(--success)', textAlign: 'center', fontSize: 13 }}>{success}</p>}
            <button className="btn btn--primary btn--block" type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : 'Применить'}
            </button>
          </form>
        </>
      )}
    </Screen>
  );
}
