import { useState, useEffect } from 'react';
import ProductIcon from './ProductIcon';
import { fetchImageAsBlobUrl, getCachedBlobUrl } from '../utils/imagePreload';

// Подстраховка на случай, если ни onLoad, ни onError у <img> вообще не
// срабатывают (встречается в некоторых Telegram WebView — например, когда
// сетевой запрос к внешнему домену просто "подвисает", ни успехом, ни
// ошибкой) — без этого скелетон-заглушка может остаться висеть навсегда.
// По истечении тайм-аута показываем иконку-заглушку ПОВЕРХ (оверлей), не
// размонтируя сам <img> — см. комментарий ниже.
const LOAD_TIMEOUT_MS = 6000;

// Показывает фото товара. Пока грузится — скелетон-заглушка, если ссылки
// нет вообще или она битая — иконка-плашка (ProductIcon).
//
// Единственное место во всём приложении, которое реально показывает фото
// товара (лента, категории, списки, карточка товара, чек покупки) —
// поэтому вся логика загрузки/кеширования картинки здесь, одна на всех:
//
//  1. Если байты уже есть в памяти ИЛИ на диске (Cache Storage, переживает
//     закрытие мини-аппы) — показываем мгновенно, без сети вообще.
//  2. Если нет — сразу показываем обычной сетевой ссылкой через нативный
//     <img> (он сам разруливает сеть и не "виснет" навечно, в отличие от
//     ручного fetch() без таймаута — именно это раньше давало "иногда
//     работает, иногда как хочет"). Параллельно, в фоне, пытаемся
//     закешировать байты через fetchImageAsBlobUrl — он теперь с
//     собственным таймаутом (см. imagePreload.js), так что зависнуть
//     насовсем не может. Если он успевает раньше/вместо <img> — подменяем
//     src на blob: картинка гарантированно в кеше, следующий показ (в
//     этой же сессии ИЛИ после полного перезахода в приложение) будет
//     мгновенным, без сети.
//  3. 'timeout' — отдельный статус: <img> остаётся смонтированным (чтобы
//     не оборвать уже идущую загрузку), сверху просто показывается иконка.
//     Если картинка всё же догрузится — onLoad уберёт иконку и покажет
//     настоящее фото, без перезахода на экран.
//  4. 'error' — по-настоящему битая ссылка (onError) — ждать повторных
//     попыток бессмысленно, остаёмся на иконке.
export default function ProductImage({ product, size = 40 }) {
  const originalUrl = product.imageUrl || null;
  const [src, setSrc] = useState(() => (originalUrl ? getCachedBlobUrl(originalUrl) || originalUrl : null));
  const [status, setStatus] = useState(() => {
    if (!originalUrl) return 'empty';
    return getCachedBlobUrl(originalUrl) ? 'loaded' : 'loading';
  });

  useEffect(() => {
    if (!originalUrl) {
      setStatus('empty');
      setSrc(null);
      return undefined;
    }

    const cachedBlob = getCachedBlobUrl(originalUrl);
    if (cachedBlob) {
      setSrc(cachedBlob);
      setStatus('loaded');
      return undefined;
    }

    // В кеше нет — сразу сетевой ссылкой, не ждём ничего.
    setSrc(originalUrl);
    setStatus('loading');

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setStatus((current) => (current === 'loading' ? 'timeout' : current));
    }, LOAD_TIMEOUT_MS);

    // Фоновая закачка-в-кеш — не блокирует показ, просто подменяет src,
    // когда (и если) будет готово.
    fetchImageAsBlobUrl(originalUrl).then((blobUrl) => {
      if (cancelled || !blobUrl) return;
      setSrc(blobUrl);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [originalUrl]);

  if (status === 'empty' || status === 'error') {
    return <ProductIcon kind={product.kind} size={size} />;
  }

  return (
    <span className="product-image" style={{ width: size, height: size }}>
      {status === 'loading' && <span className="product-image__skeleton" />}
      {status === 'timeout' && (
        <span className="product-image__fallback">
          <ProductIcon kind={product.kind} size={size} />
        </span>
      )}
      <img
        src={src}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="product-image__img"
        style={{ opacity: status === 'loaded' ? 1 : 0 }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus((current) => (current === 'loaded' ? current : 'error'))}
      />
    </span>
  );
}
