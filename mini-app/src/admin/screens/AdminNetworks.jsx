import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

// Справочник соцсетей с иконкой на каждую — используется в форме товара
// (AdminProductForm): при выборе соцсети её картинка подставляется
// автоматически, без необходимости заново грузить логотип на каждый
// новый аккаунт. Сейчас 4 соцсети, список рассчитан на рост до ~20 —
// поэтому отдельный экран-справочник, а не поле внутри формы товара.
export default function AdminNetworks() {
  const navigate = useNavigate();
  const [networks, setNetworks] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    adminApi
      .getNetworks()
      .then(setNetworks)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleUpload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    setError(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      await adminApi.updateNetwork(id, url);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return setError('Укажите название соцсети');
    setCreating(true);
    setError(null);
    try {
      await adminApi.createNetwork(newTitle.trim());
      setNewTitle('');
      setAdding(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (n) => {
    if (!window.confirm(`Удалить соцсеть «${n.title}» из справочника? На уже созданных товарах ничего не изменится.`)) return;
    setBusyId(n.id);
    setError(null);
    try {
      await adminApi.deleteNetwork(n.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen title="Соцсети" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/admin/products')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Соцсети</h1>
      </div>

      <p className="hint-text" style={{ textAlign: 'left', margin: '0 0 14px' }}>
        Иконка отсюда сама подставится в форме товара, как только вы выберете эту соцсеть —
        загружать логотип на каждый новый аккаунт вручную больше не нужно.
      </p>

      {error && <p className="confirm-sheet__warning">{error}</p>}

      {!networks ? (
        <p className="hint-text">Загрузка...</p>
      ) : (
        <div className="list">
          {networks.map((n) => (
            <div key={n.id} className="list-row list-row--static" style={{ alignItems: 'center' }}>
              <div className="admin-image-upload">
                <label className="admin-image-upload__box" aria-label="Загрузить иконку">
                  {n.iconUrl ? (
                    <img src={n.iconUrl} alt="" className="admin-image-upload__preview" />
                  ) : (
                    <span className="admin-image-upload__placeholder">＋</span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingId === n.id}
                    onChange={(e) => handleUpload(n.id, e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="list-row__body">
                <span className="list-row__title">{n.title}</span>
                {uploadingId === n.id && <span className="hint-text">Загрузка...</span>}
              </div>
              <button
                className="btn btn--danger-outline btn--sm"
                type="button"
                disabled={busyId === n.id}
                onClick={() => handleDelete(n)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
          <label className="admin-field">
            <span className="admin-field__label">Название соцсети</span>
            <input
              className="text-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например, Twitter"
              autoFocus
            />
          </label>
          <button className="btn btn--primary btn--block" type="submit" disabled={creating}>
            {creating ? 'Создание...' : 'Добавить соцсеть'}
          </button>
          <button
            className="btn btn--ghost btn--block"
            type="button"
            onClick={() => {
              setAdding(false);
              setNewTitle('');
              setError(null);
            }}
          >
            Отмена
          </button>
        </form>
      ) : (
        <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={() => setAdding(true)}>
          + Добавить соцсеть
        </button>
      )}
    </Screen>
  );
}
