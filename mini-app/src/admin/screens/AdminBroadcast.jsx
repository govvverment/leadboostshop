import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

// Ручная рассылка от бота — единственный способ уведомить пользователей
// о пополнении товара (никакой автоматики: админ сам решает, когда и
// что отправить). Выбор товара — просто заготовка текста + кнопка на
// его страницу, всё редактируется перед отправкой.
export default function AdminBroadcast() {
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [productId, setProductId] = useState('');
  const [text, setText] = useState('');
  const [buttonLabel, setButtonLabel] = useState('🛍 Открыть магазин');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi
      .getProducts()
      .then((list) => setProducts(list.filter((p) => !p.isArchived)))
      .catch(() => {});
  }, []);

  const applyProductTemplate = (id) => {
    setProductId(id);
    if (!id) return;
    const product = (products || []).find((p) => p.id === id);
    if (!product) return;
    setText(`🔥 «${product.title}» снова в наличии!\n\nУспей забронировать по $${product.price.toFixed(2)}.`);
    setButtonLabel('Открыть товар');
  };

  const handleSend = async () => {
    setError(null);
    setResult(null);
    if (!text.trim()) return setError('Введите текст сообщения');

    const product = productId ? (products || []).find((p) => p.id === productId) : null;
    const confirmed = window.confirm(
      `Отправить это сообщение ВСЕМ пользователям бота${
        product ? ` (с кнопкой на «${product.title}»)` : ''
      }? Действие необратимо.`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const res = await adminApi.broadcast({
        text: text.trim(),
        buttonLabel: buttonLabel.trim() || undefined,
        productId: productId || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Админ-панель" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/admin/products')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Рассылка</h1>
      </div>

      <div className="tab-row">
        <button className="tab" onClick={() => navigate('/admin/products')}>
          Товары
        </button>
        <button className="tab" onClick={() => navigate('/admin/stats')}>
          Статистика
        </button>
        <button className="tab" onClick={() => navigate('/admin/categories')}>
          Категории
        </button>
        <button className="tab is-active">Рассылка</button>
      </div>

      <p className="hint-text" style={{ textAlign: 'left', margin: '0 0 14px' }}>
        Сообщение уйдёт от бота всем зарегистрированным пользователям. Ничего не отправляется
        автоматически — только по кнопке «Отправить всем» ниже.
      </p>

      <label className="admin-field">
        <span className="admin-field__label">Товар (необязательно)</span>
        <select className="text-input" value={productId} onChange={(e) => applyProductTemplate(e.target.value)}>
          <option value="">— не выбран, обычное сообщение —</option>
          {(products || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
          Выбор товара подставит заготовку текста «снова в наличии» и кнопку прямо на его
          страницу — текст можно поправить перед отправкой.
        </span>
      </label>

      <label className="admin-field">
        <span className="admin-field__label">Текст сообщения</span>
        <textarea
          className="text-input"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: 🔥 Новое пополнение! Заходите в магазин."
          style={{ fontFamily: 'inherit' }}
        />
      </label>

      <label className="admin-field">
        <span className="admin-field__label">Текст кнопки под сообщением</span>
        <input
          className="text-input"
          value={buttonLabel}
          onChange={(e) => setButtonLabel(e.target.value)}
          placeholder="Открыть магазин"
        />
        <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
          Кнопка откроет {productId ? 'страницу выбранного товара' : 'магазин'} в мини-приложении. Оставьте поле
          пустым, если кнопка не нужна.
        </span>
      </label>

      {error && <p className="confirm-sheet__warning">{error}</p>}
      {result && (
        <>
          <p className="hint-text" style={{ color: 'var(--success)' }}>
            Готово: доставлено {result.sent} из {result.total}
            {result.failed > 0 && ` (не доставлено: ${result.failed})`}
          </p>
          {result.sampleErrors?.length > 0 && (
            <p className="hint-text" style={{ textAlign: 'left' }}>
              Пример причины недоставки: {result.sampleErrors[0]}
            </p>
          )}
        </>
      )}

      <button className="btn btn--primary btn--block" style={{ marginTop: 10 }} onClick={handleSend} disabled={sending}>
        {sending ? 'Отправка...' : 'Отправить всем'}
      </button>
    </Screen>
  );
}
