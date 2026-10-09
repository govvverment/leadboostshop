import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// Общая логика сжатия картинок — используется и при загрузке новой
// картинки (admin-upload), и при фоновой пересжатии уже загруженных
// (admin-products, action 'optimize-images').
//
// НАЙДЕННАЯ ПРИЧИНА "иконки на главном экране не грузятся": формат
// вывода раньше выбирался по исходному MIME-типу файла (PNG -> PNG,
// всё остальное -> JPEG). Из-за этого обычные скриншоты аккаунтов,
// сохранённые как PNG, оставались тяжёлыми (130-280KB) даже после
// "сжатия" — PNG это lossless-формат, для фото/скриншотов с большим
// количеством цветов он сжимает в разы хуже JPEG, а простой ресайз до
// 480px почти не уменьшает вес такого файла. Именно это и было настоящей
// причиной: карточка на главном экране показывает иконку 40-64px, но
// реально качает 130-280KB — на медленной сети это уверенно не
// укладывается в 6-секундный тайм-аут ProductImage/preloadToBlobMap,
// и приложение навсегда откатывается на иконку-заглушку вместо фото.
//
// Теперь формат выбираем по РЕАЛЬНОМУ содержимому картинки: PNG
// оставляем, только если в ней действительно есть прозрачность
// (проверяем альфа-канал после ресайза) — иначе всегда JPEG, независимо
// от того, в каком формате файл был изначально.
export const MAX_DIMENSION = 480;
export const JPEG_QUALITY = 82;

function hasTransparency(image: Image): boolean {
  const bitmap = image.bitmap as Uint8Array;
  for (let i = 3; i < bitmap.length; i += 4) {
    if (bitmap[i] < 255) return true;
  }
  return false;
}

export async function compressImage(
  bytes: Uint8Array,
  originalContentType: string
): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  const image = await Image.decode(bytes);
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
    if (image.width >= image.height) image.resize(MAX_DIMENSION, Image.RESIZE_AUTO);
    else image.resize(Image.RESIZE_AUTO, MAX_DIMENSION);
  }

  const keepPng = originalContentType === 'image/png' && hasTransparency(image);
  if (keepPng) {
    return { bytes: await image.encode(), contentType: 'image/png', ext: 'png' };
  }
  return { bytes: await image.encodeJPEG(JPEG_QUALITY), contentType: 'image/jpeg', ext: 'jpg' };
}
