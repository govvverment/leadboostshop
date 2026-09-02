import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

export default function AdminInventory() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  // .zip-файлы (второй способ пополнения склада, наравне с текстом выше) —
  // один zip = один аккаунт. Можно выбрать сразу несколько файлов.
  const [zipFiles, setZipFiles] = useState([]);
  const [zipSaving, setZipSaving] = useState(false);

  const load = () => {
    adminApi
      .getInventory(id)
      .then(setItems)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);
  useEffect(() => {
    adminApi
      .getProducts()
      .then((products) => setProduct(products.find((p) => p.id === id) ?? null))
      .catch(() => {});
  }, [id]);

  const isLink = product?.kind === 'one-time' || product?.kind === 'subscription';
  const noun = isLink ? 'ссылок' : 'аккаунтов';

  const available = (items || []).filter((i) => i.status === 'available').length;
  const sold = (items || []).filter((i) => i.status === 'sold').length;

  const [clearing, setClearing] = useState(false);

  const handleClear = async (mode) => {
    if (mode === 'all' && !window.confirm(`Удалить ВСЕ ${noun} этого товара, включая ещё не выданные? Это необратимо.`)) {
      return;
    }
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminApi.clearInventory(id, mode);
      setSuccess(`Удалено: ${result.removed}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // чтобы можно было выбрать тот же файл повторно
    if (!files.length) return;
    setError(null);
    Promise.all(files.map((file) => file.text()))
      .then((contents) => {
        const fileText = contents.map((content) => content.trim()).filter(Boolean).join('\n');
        setText((prev) => (prev.trim() ? `${prev.trim()}\n${fileText}` : fileText));
      })
      .catch(() => setError('Не удалось прочитать один из файлов'));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!text.trim()) return setError('Вставьте хотя бы одну строку');

    setSaving(true);
    try {
      const result = await adminApi.bulkAddInventory(id, text);
      setSuccess(`Добавлено ${noun}: ${result.added}`);
      setText('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleZipSelect = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setZipFiles((prev) => [...prev, ...files]);
  };

  const removeZipFile = (index) => {
    setZipFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleZipUpload = async () => {
    setError(null);
    setSuccess(null);
    if (!zipFiles.length) return setError('Выберите хотя бы один .zip файл');

    setZipSaving(true);
    try {
      const { files } = await adminApi.uploadAccountFiles(zipFiles);
      const result = await adminApi.addFileInventory(id, files);
      setSuccess(`Добавлено аккаунтов: ${result.added}`);
      setZipFiles([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setZipSaving(false);
    }
  };

  return (
    <Screen title={isLink ? 'Склад ссылок' : 'Склад аккаунтов'} withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate(-1)} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">{isLink ? 'Склад ссылок' : 'Склад аккаунтов'}</h1>
      </div>

      <div className="admin-stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="admin-stat-box">
          <span className="admin-stat-box__label">Свободно</span>
          <span className="admin-stat-box__value">{items ? available : '—'}</span>
        </div>
        <div className="admin-stat-box">
          <span className="admin-stat-box__label">Продано</span>
          <span className="admin-stat-box__value">{items ? sold : '—'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '0 0 20px' }}>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ flex: 1 }}
          disabled={clearing || sold === 0}
          onClick={() => handleClear('sold')}
        >
          Удалить проданные
        </button>
        <button
          type="button"
          className="btn btn--danger-outline btn--sm"
          style={{ flex: 1 }}
          disabled={clearing || (items || []).length === 0}
          onClick={() => handleClear('all')}
        >
          Очистить всё
        </button>
      </div>

      <form onSubmit={handleUpload}>
        <h3 className="section__title">Добавить {noun}</h3>
        <p className="hint-text" style={{ textAlign: 'left', margin: '0 0 10px' }}>
          {isLink ? (
            <>
              По одной ссылке на строку — каждая выдаётся ровно одному покупателю (для подписки —
              при каждой оплате/продлении берётся новая) и больше никому не показывается. Через
              двоеточие можно добавить ключ доступа, а через ещё одно — ссылку на инструкцию (обе
              части необязательные):{' '}
              <code style={{ color: 'var(--accent)' }}>https://файл...:KEY-1234:https://инструкция...</code>
            </>
          ) : (
            <>
              По одному аккаунту на строку: отдельная ссылка или данные в формате{' '}
              <code style={{ color: 'var(--accent)' }}>логин:пароль</code> (можно добавить ещё одно
              поле через двоеточие — например email восстановления). Каждый URL считается одним
              отдельным аккаунтом.
            </>
          )}
        </p>

        <textarea
          className="text-input"
          rows={8}
          placeholder={
            isLink
              ? 'https://drive.google.com/file/d/xxxxx\nhttps://mega.nz/file/yyyyy:KEY-1234:https://docs.google.com/instructions'
              : 'https://example.com/account/xxxxx\nuser1:pass123\nuser2:pass456:backup@mail.com'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />

        <label className="btn btn--secondary btn--block" style={{ margin: '10px 0 0', textAlign: 'center' }}>
          📄 Загрузить из .txt файлов
          <input type="file" accept=".txt,text/plain" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
        </label>
        <p className="hint-text" style={{ textAlign: 'left', margin: '6px 0 0' }}>
          Содержимое файла добавится к тому, что уже есть в поле выше (те же строки, тот же формат).
        </p>

        {error && <p className="confirm-sheet__warning">{error}</p>}
        {success && <p style={{ color: 'var(--success)', textAlign: 'center', fontSize: 13 }}>{success}</p>}

        <button className="btn btn--primary btn--block" type="submit" disabled={saving}>
          {saving ? 'Загрузка...' : 'Добавить в склад'}
        </button>
      </form>

      {!isLink && (
        <div style={{ marginTop: 24 }}>
          <h3 className="section__title">Добавить .zip-файлами</h3>
          <p className="hint-text" style={{ textAlign: 'left', margin: '0 0 10px' }}>
            Второй способ, отдельно от текста выше — один .zip файл = один аккаунт. Можно
            выбрать сразу несколько.
          </p>

          <label className="btn btn--secondary btn--block" style={{ textAlign: 'center' }}>
            📦 Выбрать ZIP-файлы
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              multiple
              onChange={handleZipSelect}
              style={{ display: 'none' }}
            />
          </label>

          {zipFiles.length > 0 && (
            <div className="list" style={{ marginTop: 8 }}>
              {zipFiles.map((file, i) => (
                <div key={`${file.name}-${i}`} className="file-card" style={{ marginBottom: 6 }}>
                  <span className="file-card__icon">📦</span>
                  <div className="file-card__body">
                    <span className="file-card__name">{file.name}</span>
                    <span className="file-card__meta">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button
                    type="button"
                    className="detail-list__link"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => removeZipFile(i)}
                  >
                    Убрать
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn--primary btn--block"
            style={{ marginTop: 10 }}
            disabled={zipSaving || zipFiles.length === 0}
            onClick={handleZipUpload}
          >
            {zipSaving ? 'Загрузка...' : 'Добавить в склад'}
          </button>
        </div>
      )}

      <h3 className="section__title" style={{ marginTop: 24 }}>
        Что уже загружено
      </h3>
      {!items ? (
        <p className="hint-text">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="hint-text">Пока пусто — добавьте {noun} формой выше</p>
      ) : (
        <div className="list">
          {items.map((item) => (
            <div key={item.id} className="list-row list-row--static">
              <div className="list-row__body">
                <span className="list-row__title" style={item.link ? { wordBreak: 'break-all' } : undefined}>
                  {item.file_path ? `📦 ${item.file_name || 'account.zip'}` : item.link || item.login}
                </span>
                <span className="list-row__meta">
                  {item.extra ? `${item.extra} · ` : ''}
                  {item.instructions_url ? 'есть инструкция · ' : ''}
                  {item.status === 'sold' ? `Продан ${new Date(item.sold_at).toLocaleDateString('ru-RU')}` : 'Свободен'}
                </span>
              </div>
              <span className={'badge' + (item.status === 'sold' ? ' badge--muted' : ' badge--success')}>
                {item.status === 'sold' ? 'Продан' : 'Свободен'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
