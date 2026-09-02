// Скачивает картинку как blob и возвращает локальный blob:-URL, вместо
// обычной сетевой ссылки. Раньше картинки "прогревались" через
// `new Image(); img.src = url` в расчёте на то, что браузер потом отдаст
// тот же адрес из HTTP-кеша для настоящего <img> на экране — на вебе
// работает, но в WebView Telegram-приложения не подтвердилось: кеш между
// отдельным прогревочным объектом (или между двумя разными экранами,
// когда первый успевает размонтироваться раньше, чем скачивание
// завершилось) — не переиспользуется. Blob-URL этой проблемы не имеет:
// байты один раз реально скачиваются и лежат в памяти, а `<img src>`
// на них — это уже не сетевой запрос, а мгновенное чтение из памяти.
export function fetchImageAsBlobUrl(url) {
  return fetch(url)
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => (blob ? URL.createObjectURL(blob) : null))
    .catch(() => null);
}

// 4с оказалось мало для старых, ещё не сжатых картинок (загруженных до
// того, как появилось автосжатие при загрузке/кнопка "Оптимизировать все
// фото") — на реальной мобильной сети такая картинка не успевала
// скачаться, таймаут срезал ожидание, и юзер снова видел старое
// поведение (долгую подгрузку по сетевой ссылке). Подняли до 6с как
// более честный запас — но это именно смягчение симптома: единственный
// настоящий способ убрать задержку до нуля — сжать сам файл (см. кнопку
// "Оптимизировать все фото" в админке).
const DEFAULT_TIMEOUT_MS = 6000;

// Пакетная версия — для случаев, когда нужно дождаться сразу нескольких
// картинок (например, всё, что видно на главной), но не держать экран
// вечно, если что-то одно тормозит или отсутствует. Возвращает
// Map<оригинальный URL, blob-URL> — только для тех, что успели.
export async function preloadToBlobMap(urls, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const map = new Map();
  if (unique.length === 0) return map;

  let timedOut = false;
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });

  await Promise.race([
    Promise.all(
      unique.map(async (url) => {
        const blobUrl = await fetchImageAsBlobUrl(url);
        if (blobUrl && !timedOut) map.set(url, blobUrl);
      })
    ),
    timeout,
  ]);

  return map;
}
