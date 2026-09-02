import { useState, useEffect } from 'react';
import ProductIcon from './ProductIcon';

// Показывает фото товара, если у него есть imageUrl (придёт с backend/из
// админ-панели). Пока фото грузится — показывает скелетон-заглушку.
// Если ссылки нет вообще, или картинка не загрузилась (битая ссылка,
// файл удалили и т.п.) — аккуратно откатывается на иконку-плашку
// (ProductIcon), чтобы карточка никогда не выглядела "сломанной".
export default function ProductImage({ product, size = 40 }) {
  const [status, setStatus] = useState(product.imageUrl ? 'loading' : 'empty');

  // Если товар в списке поменялся (другой imageUrl) — сбрасываем статус
  useEffect(() => {
    setStatus(product.imageUrl ? 'loading' : 'empty');
  }, [product.imageUrl]);

  if (status === 'empty' || status === 'error') {
    return <ProductIcon kind={product.kind} size={size} />;
  }

  return (
    <span className="product-image" style={{ width: size, height: size }}>
      {status === 'loading' && <span className="product-image__skeleton" />}
      <img
        src={product.imageUrl}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="product-image__img"
        style={{ opacity: status === 'loaded' ? 1 : 0 }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </span>
  );
}
