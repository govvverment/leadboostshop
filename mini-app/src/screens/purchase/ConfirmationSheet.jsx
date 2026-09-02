import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Screen from '../../components/Screen';
import SheetOverlay from '../../components/SheetOverlay';
import EmptyState from '../../components/EmptyState';
import ProductImage from '../../components/ProductImage';
import { LoaderCompact } from '../../components/Loader';
import { useApp } from '../../context/AppContext';
import { fetchImageAsBlobUrl } from '../../utils/imagePreload';

export default function ConfirmationSheet() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { balance, buyProduct, showToast, getProduct } = useApp();
  const [loading, setLoading] = useState(false);
  const product = getProduct(id);

  const isAccount = product?.kind === 'account';
  const [qty, setQty] = useState(() => {
    const initial = state?.qty ?? 1;
    return isAccount && product ? Math.max(1, Math.min(initial, product.stock)) : initial;
  });

  // Картинка товара из общего списка (products) грузится обычной сетевой
  // ссылкой — на экране подтверждения это нормально (не гейтится ничем,
  // просто <img>). Но именно ЭТУ же ссылку мы дальше передаём на экран
  // результата покупки (ResultScreen) — а тот открывается сразу следующим
  // шагом, часто раньше, чем сетевой запрос текущего <img> успел
  // завершиться (и раз этот экран закрывается — навигация с replace —
  // запрос вполне может оборваться, не долетев). Поэтому здесь же заранее
  // качаем байты этой картинки в blob:-URL, и как только он готов — им же
  // подменяем imageUrl и на этом экране, и в том, что уйдёт на следующий.
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? null);
  useEffect(() => {
    setImageUrl(product?.imageUrl ?? null);
    if (!product?.imageUrl) return;
    let cancelled = false;
    fetchImageAsBlobUrl(product.imageUrl).then((blobUrl) => {
      if (!cancelled && blobUrl) setImageUrl(blobUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.imageUrl]);

  if (!product) {
    return (
      <Screen title="Подтверждение" withNav={false}>
        <EmptyState icon="?" title="Товар не найден" />
      </Screen>
    );
  }

  const total = isAccount ? +(product.price * qty).toFixed(2) : product.price;
  const remaining = +(balance - total).toFixed(2);
  // То же самое, что уходит и на следующий экран — с уже подменённой (если
  // успела) картинкой на blob:-URL.
  const productForDisplay = { ...product, imageUrl };

  const handleConfirm = async () => {
    setLoading(true);
    const result = await buyProduct(product, qty);
    setLoading(false);

    if (result.status === 'success') {
      showToast('Покупка совершена');
      navigate('/purchase/success', { replace: true, state: { product: productForDisplay, qty, total } });
    } else if (result.status === 'insufficient') {
      navigate('/purchase/insufficient', { replace: true, state: { product: productForDisplay, total, balance } });
    } else if (result.status === 'out_of_stock') {
      showToast('Товар только что раскупили');
      navigate(-1);
    } else {
      navigate('/purchase/failed', { replace: true, state: { product: productForDisplay } });
    }
  };

  return (
    // Пока идёт запрос на покупку — свайп/тап по фону не закрывает
    // шторку (иначе можно случайно уйти со экрана посреди списания
    // средств, а результат придёт «в пустоту»).
    <SheetOverlay onDismiss={loading ? () => {} : undefined}>
      <h1 className="sheet__title">Подтвердить покупку</h1>
      <p className="sheet__subtitle">Проверьте данные перед подтверждением</p>

      <div className="sheet-product">
        <ProductImage product={productForDisplay} />
        <div className="sheet-product__body">
          <span className="sheet-product__title">{product.title}</span>
          <span className="sheet-product__subtitle">
            {(isAccount
              ? [product.geo, product.type]
              : [product.type]
            )
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <span className="sheet-product__price">${product.price.toFixed(2)}</span>
      </div>

      {isAccount && (
        <>
          <div className="qty-row">
            <span>Количество</span>
            <span className="qty-row__available">Доступно: {product.stock}</span>
          </div>
          <div className="qty-control">
            <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          </div>
        </>
      )}

      <div className="detail-list detail-list--flat">
        <div className="detail-list__row">
          <span>Ваш баланс</span>
          <span>${balance.toFixed(2)}</span>
        </div>
        {isAccount && (
          <div className="detail-list__row">
            <span>Цена за 1 шт.</span>
            <span>${product.price.toFixed(2)}</span>
          </div>
        )}
        <div className="detail-list__row">
          <span>Будет списано</span>
          <span className="detail-list__accent">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="sheet-remaining">
        <span>Остаётся на балансе</span>
        <span>${Math.max(remaining, 0).toFixed(2)}</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={handleConfirm} disabled={loading}>
        {loading ? <LoaderCompact /> : `Подтвердить за $${total.toFixed(2)}`}
      </button>
      <button className="btn btn--ghost btn--block" onClick={() => navigate(-1)} disabled={loading}>
        Отменить
      </button>
    </SheetOverlay>
  );
}
