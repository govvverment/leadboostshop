// Кеш байтов картинок товаров — два уровня:
//  1) resolvedCache — готовые blob-URL в памяти, на время жизни текущего
//     документа (мгновенный синхронный доступ, см. getCachedBlobUrl).
//  2) Cache Storage (`caches.*`, тот же API, что у service worker'ов) — на
//     диске, под origin'ом приложения. Переживает закрытие мини-аппы
//     (Telegram на мобильных обычно уничтожает WebView при закрытии —
//     именно поэтому одного memory-кеша недостаточно: "каждый раз заново"
//     у пользователя означало именно это).
//
// ВАЖНО (почему это НЕ единственный способ показать картинку, см.
// ProductImage.jsx): у ручного fetch() нет собственного тайм-аута — если
// сеть "подвисает" (не ошибка и не успех, просто тишина — такое бывает в
// некоторых Telegram WebView), промис не резолвится НИКОГДА, и всё, что
// на него подписано, зависает молча. Раньше это и давало "иногда работает,
// иногда как хочет": когда подвисал ручной fetch, картинка не показывалась
// вообще, хотя обычный <img> с тем же URL спокойно либо загрузился бы, либо
// получил бы честную ошибку от браузера. Поэтому здесь — всегда с
// AbortController по таймауту, а в ProductImage.jsx это дополнение к
// нативному <img>, а не замена ему.
const CACHE_STORAGE_NAME = 'product-images-v1';
const FETCH_TIMEOUT_MS = 10000;

function hasCacheStorage() {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

async function readFromDiskCache(url) {
  if (!hasCacheStorage()) return null;
  try {
    const cache = await caches.open(CACHE_STORAGE_NAME);
    const match = await cache.match(url);
    return match ? await match.blob() : null;
  } catch {
    return null; // квота, приватный режим и т.п. — просто работаем без диска
  }
}

async function writeToDiskCache(url, response) {
  if (!hasCacheStorage()) return;
  try {
    const cache = await caches.open(CACHE_STORAGE_NAME);
    await cache.put(url, response);
  } catch {
    // не критично — просто не закешируется на диск в этот раз
  }
}

// Готовые blob-URL, синхронно, на время жизни текущего документа.
const resolvedCache = new Map();
// Промисы ещё не завершённых загрузок — чтобы одну и ту же картинку,
// запрошенную одновременно из разных мест (фоновый прогрев в AppContext +
// сам ProductImage при рендере), не качать дважды параллельно.
const pendingCache = new Map();

// Синхронный доступ к уже готовому blob-URL — для мгновенной подстановки
// при самом первом рендере, без "иконка → скачалось → фото".
export function getCachedBlobUrl(url) {
  return url ? resolvedCache.get(url) ?? null : null;
}

export function fetchImageAsBlobUrl(url) {
  if (!url) return Promise.resolve(null);
  if (resolvedCache.has(url)) return Promise.resolve(resolvedCache.get(url));
  if (pendingCache.has(url)) return pendingCache.get(url);

  const promise = (async () => {
    // Сначала диск — если там уже есть байты, это локальное чтение, сети
    // вообще не касаемся.
    const diskBlob = await readFromDiskCache(url);
    if (diskBlob) {
      const blobUrl = URL.createObjectURL(diskBlob);
      resolvedCache.set(url, blobUrl);
      return blobUrl;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      // cache.put() должен получить "непрочитанный" Response — клонируем
      // до того, как читаем байты через .blob() ниже. Не ждём запись на
      // диск (не блокируем возврат ради этого).
      writeToDiskCache(url, res.clone());
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      resolvedCache.set(url, blobUrl);
      return blobUrl;
    } catch {
      // сеть/CORS/таймаут — молча сдаёмся, вызывающий код (ProductImage)
      // сам покажет обычную сетевую ссылку или заглушку.
      return null;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    pendingCache.delete(url);
  });

  pendingCache.set(url, promise);
  return promise;
}
