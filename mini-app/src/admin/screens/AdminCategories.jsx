import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';

export default function AdminCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    adminApi
      .getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleUpload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    setError(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      await adminApi.updateCategory(id, url);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return setError('Укажите название категории');
    setCreating(true);
    setError(null);
    try {
      await adminApi.createCategory(newTitle.trim());
      setNewTitle('');
      setAdding(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Удалить категорию «${c.title}»? Можно только если в ней нет товаров.`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      await adminApi.deleteCategory(c.id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen title="Категории" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/admin/products')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">Категории</h1>
      </div>

      {error && <p className="confirm-sheet__warning">{error}</p>}

      {!categories ? (
        <p className="hint-text">Загрузка...</p>
      ) : (
        <div className="list">
          {categories.map((c) => (
            <div key={c.id} className="list-row list-row--static" style={{ alignItems: 'center' }}>
              <div className="admin-image-upload">
                <label className="admin-image-upload__box" aria-label="Загрузить картинку">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="admin-image-upload__preview" />
                  ) : (
                    <span className="admin-image-upload__placeholder">＋</span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingId === c.id}
                    onChange={(e) => handleUpload(c.id, e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="list-row__body">
                <span className="list-row__title">{c.title}</span>
                {uploadingId === c.id && <span className="hint-text">Загрузка...</span>}
              </div>
              <button
                className="btn btn--danger-outline btn--sm"
                type="button"
                disabled={busyId === c.id}
                onClick={() => handleDelete(c)}
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
            <span className="admin-field__label">Название категории</span>
            <input
              className="text-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например, Игры"
              autoFocus
            />
          </label>
          <button className="btn btn--primary btn--block" type="submit" disabled={creating}>
            {creating ? 'Создание...' : 'Создать категорию'}
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
          + Добавить категорию
        </button>
      )}
    </Screen>
  );
}
