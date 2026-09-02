import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../../components/Screen';
import { adminApi } from '../api';
import { geoToFlag } from '../../utils/geo';

const emptyForm = {
  title: '',
  category: '',
  kind: 'account',
  price: '',
  description: '',
  imageUrl: '',
  geo: '',
  geoFlag: '',
  platform: '',
  type: '',
  network: '',
  stock: '',
  license: '',
  period: 'мес',
  periodLabel: '1 месяц',
};

function Field({ label, children }) {
  return (
    <label className="admin-field">
      <span className="admin-field__label">{label}</span>
      {children}
    </label>
  );
}

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState(null);
  const [inventoryFiles, setInventoryFiles] = useState([]);
  const [inventoryText, setInventoryText] = useState('');
  // .zip-файлы аккаунтов (второй способ, наравне с TXT выше) — один
  // zip = один аккаунт. Сами File-объекты храним до сабмита, заливаем
  // на сервер (uploadAccountFiles) только когда форма реально отправлена.
  const [inventoryZipFiles, setInventoryZipFiles] = useState([]);
  const [uploadingZip, setUploadingZip] = useState(false);

  useEffect(() => {
    adminApi
      .getCategories()
      .then((cats) => {
        setCategories(cats);
        // Для нового товара сразу подставляем первую категорию из
        // списка — иначе форма отправится с пустой категорией.
        if (!isEdit) {
          setForm((f) => (f.category ? f : { ...f, category: cats[0]?.id ?? '' }));
        }
      })
      .catch((err) => setError(err.message));
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    adminApi
      .getProducts()
      .then((products) => {
        const found = products.find((p) => p.id === id);
        if (!found) throw new Error('Товар не найден');
        const normalized = Object.fromEntries(
          Object.entries(found).map(([key, value]) => [key, value === null ? '' : value])
        );
        setForm({ ...emptyForm, ...normalized, price: String(found.price), stock: found.stock ?? '' });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await adminApi.uploadImage(file);
      update('imageUrl', url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleInventoryFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    setError(null);
    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      setInventoryFiles(files.map((file) => file.name));
      setInventoryText(contents.map((content) => content.trim()).filter(Boolean).join('\n'));
    } catch {
      setInventoryFiles([]);
      setInventoryText('');
      setError('Не удалось прочитать один из TXT-файлов');
    }
  };

  // multiple на <input type="file"> и так даёт выделение сразу нескольких
  // файлов в системном диалоге (на ПК — Ctrl/Shift+клик, на телефоне —
  // зависит от системного пикера) — отдельного кода под "ПК-версию" не
  // нужно, само работает одинаково везде.
  const handleZipFilesSelect = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setInventoryZipFiles((prev) => [...prev, ...files]);
  };

  const removeZipFile = (index) => {
    setInventoryZipFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError('Укажите название товара');
    if (!form.price || Number(form.price) <= 0) return setError('Укажите цену больше нуля');

    const payload = {
      title: form.title.trim(),
      category: form.category,
      kind: form.kind,
      price: Number(form.price),
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      geo: form.kind === 'account' ? form.geo : null,
      geoFlag: form.kind === 'account' ? geoToFlag(form.geo) : null,
      platform: form.platform || null,
      type: form.type || null,
      network: form.kind === 'account' ? form.network || null : null,
      stock: form.kind === 'account' ? Number(form.stock) : null,
      license: form.kind === 'one-time' ? form.license : null,
      period: form.kind === 'subscription' ? form.period : null,
      periodLabel: form.kind === 'subscription' ? form.periodLabel : null,
      ...(!isEdit && inventoryText.trim() ? { inventoryText: inventoryText.trim() } : {}),
    };

    setSaving(true);
    try {
      // .zip-склад грузим первым — если загрузка сорвётся, товар вообще
      // не создаётся (иначе можно было бы получить товар без склада и
      // потерянные где-то файлы).
      if (!isEdit && inventoryZipFiles.length > 0) {
        setUploadingZip(true);
        const { files } = await adminApi.uploadAccountFiles(inventoryZipFiles);
        setUploadingZip(false);
        payload.inventoryFiles = files;
      }
      if (isEdit) await adminApi.updateProduct(id, payload);
      else await adminApi.createProduct(payload);
      navigate('/admin/products');
    } catch (err) {
      setUploadingZip(false);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Товар" withNav={false}>
        <p className="hint-text">Загрузка...</p>
      </Screen>
    );
  }

  return (
    <Screen title="Товар" withNav={false}>
      <div className="page-head">
        <button className="page-head__back" onClick={() => navigate('/admin/products')} aria-label="Назад">
          ‹
        </button>
        <h1 className="page-head__title">{isEdit ? 'Изменить товар' : 'Новый товар'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <p className="confirm-sheet__warning">{error}</p>}

        <Field label="Категория">
          <select className="text-input" value={form.category} onChange={(e) => update('category', e.target.value)}>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Тип товара">
          <select className="text-input" value={form.kind} onChange={(e) => update('kind', e.target.value)}>
            <option value="account">Аккаунт</option>
            <option value="one-time">Разовая покупка</option>
            <option value="subscription">Подписка</option>
          </select>
        </Field>

        <Field label="Название">
          <input className="text-input" value={form.title} onChange={(e) => update('title', e.target.value)} />
        </Field>

        <Field label="Описание">
          <textarea
            className="text-input"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>

        <Field label="Цена, $">
          <input
            className="text-input"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
          />
        </Field>

        {(form.kind === 'account' || form.kind === 'one-time' || form.kind === 'subscription') && (
          <div className="hint-text" style={{ textAlign: 'left', margin: '0 0 14px' }}>
            Остаток теперь считается автоматически по загруженным {form.kind === 'account' ? 'аккаунтам' : 'ссылкам'}.
            {isEdit && (
              <>
                {' '}
                Сейчас доступно: <b>{form.stock}</b> шт.
                {' — '}
                <button
                  type="button"
                  className="detail-list__link"
                  style={{ display: 'inline' }}
                  onClick={() => navigate(`/admin/products/${id}/inventory`)}
                >
                  управлять складом
                </button>
              </>
            )}
            {!isEdit &&
              ` Данные из TXT-файлов можно загрузить ниже — они сразу попадут на склад.`}
          </div>
        )}

        {!isEdit && (
          <Field label={form.kind === 'account' ? 'Данные аккаунтов (.txt)' : 'Данные ссылок (.txt)'}>
            <label className="btn btn--secondary btn--block" style={{ textAlign: 'center' }}>
              📄 Выбрать TXT-файлы
              <input
                type="file"
                accept=".txt,text/plain"
                multiple
                onChange={handleInventoryFiles}
                style={{ display: 'none' }}
              />
            </label>
            <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
              {inventoryFiles.length
                ? `Выбрано файлов: ${inventoryFiles.length} (${inventoryFiles.join(', ')})`
                : form.kind === 'account'
                  ? 'Можно выбрать несколько файлов. Один аккаунт на строку: ссылка или логин:пароль[:доп. инфо].'
                  : 'Можно выбрать несколько файлов. Одна ссылка на строку.'}
            </span>
          </Field>
        )}

        {!isEdit && form.kind === 'account' && (
          <Field label="Данные аккаунтов (.zip)">
            <label className="btn btn--secondary btn--block" style={{ textAlign: 'center' }}>
              📦 Выбрать ZIP-файлы
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                multiple
                onChange={handleZipFilesSelect}
                style={{ display: 'none' }}
              />
            </label>
            <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
              Второй способ, вместе с TXT выше или вместо него — можно выбрать сразу
              несколько файлов. Один .zip = один аккаунт.
            </span>
            {inventoryZipFiles.length > 0 && (
              <div className="list" style={{ marginTop: 8 }}>
                {inventoryZipFiles.map((file, i) => (
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
          </Field>
        )}

        {form.kind === 'subscription' && (
          <Field label="Период (текстом)">
            <input
              className="text-input"
              value={form.periodLabel}
              onChange={(e) => update('periodLabel', e.target.value)}
              placeholder="1 месяц"
            />
          </Field>
        )}

        {form.kind === 'account' && (
          <Field label="GEO">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                className="text-input"
                value={form.geo}
                onChange={(e) => update('geo', e.target.value)}
                placeholder="Germany"
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 24, lineHeight: 1, minWidth: 30, textAlign: 'center' }}>
                {geoToFlag(form.geo) || '—'}
              </span>
            </div>
            <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
              Флаг подставится сам по названию страны (по-русски или по-английски). Если страна не
              распознана — просто сохранится без флага.
            </span>
          </Field>
        )}

        {form.kind === 'account' && (
          <Field label="Соцсеть">
            <input
              className="text-input"
              value={form.network}
              onChange={(e) => update('network', e.target.value)}
              placeholder="Instagram"
            />
            <span className="hint-text" style={{ textAlign: 'left', display: 'block', marginTop: 6 }}>
              Показывается отдельным фильтром в каталоге (наравне с GEO). Заполняйте одинаково
              для одной и той же соцсети — например, всегда «Instagram», а не иногда «instagram».
            </span>
          </Field>
        )}

        <Field label="Тип">
          <input className="text-input" value={form.type} onChange={(e) => update('type', e.target.value)} placeholder="Autorer" />
        </Field>

        {form.kind === 'one-time' && (
          <Field label="Лицензия">
            <input className="text-input" value={form.license} onChange={(e) => update('license', e.target.value)} placeholder="Бессрочная" />
          </Field>
        )}

        <Field label="Изображение">
          <div className="admin-image-upload">
            <label className="admin-image-upload__box" aria-label="Загрузить картинку">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="admin-image-upload__preview" />
              ) : (
                <span className="admin-image-upload__placeholder">＋</span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploading} />
            </label>
            {uploading && <span className="hint-text">Загрузка...</span>}
          </div>
        </Field>

        <button className="btn btn--primary btn--block" type="submit" disabled={saving || uploading}>
          {uploadingZip
            ? 'Загрузка ZIP-файлов...'
            : saving
              ? 'Сохранение...'
              : uploading
                ? 'Дождитесь загрузки фото...'
                : isEdit
                  ? 'Сохранить изменения'
                  : 'Добавить товар'}
        </button>
        <button className="btn btn--ghost btn--block" type="button" onClick={() => navigate('/admin/products')}>
          Отмена
        </button>
      </form>
    </Screen>
  );
}
