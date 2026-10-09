import { compressImage } from './imageCompress.ts';

// Общая логика "пересжать уже загруженные картинки товаров/категорий" —
// раньше жила только внутри admin-products (action 'optimize-images') и
// запускалась ТОЛЬКО когда админ реально открывал раздел "Товары" в
// браузере (см. useEffect в AdminProductsList.jsx). Это и есть настоящая
// причина, почему картинки оставались тяжёлыми даже после того, как сама
// логика сжатия была исправлена: если никто не зашёл в "Товары" после
// деплоя — оптимизация просто ни разу не срабатывала, это не было
// "автономным" процессом никогда, несмотря на комментарий "тихо
// запускается сама".
//
// Теперь эта же функция дополнительно вызывается по расписанию из
// Postgres (pg_cron, см. миграцию *_autonomous_image_optimization.sql) —
// той же самой edge-функцией cron-optimize-images, без какого-либо
// участия админа. Так картинка станет лёгкой сама, максимум через
// CRON_INTERVAL_MINUTES после загрузки, даже если админ ни разу не
// зайдёт в раздел "Товары".
const BUCKET = 'product-images';
const OPTIMIZE_SKIP_UNDER_BYTES = 60 * 1024;

export interface OptimizeStats {
  total: number;
  optimized: number;
  skipped: number;
  failed: number;
  bytesBefore: number;
  bytesAfter: number;
}

export async function optimizeImageBacklog(
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<OptimizeStats> {
  const { data: prods, error: prodsError } = await supabase.from('products').select('id, image_url');
  if (prodsError) throw new Error(prodsError.message);
  const { data: cats, error: catsError } = await supabase.from('categories').select('id, image_url');
  if (catsError) throw new Error(catsError.message);

  const targets: { table: 'products' | 'categories'; id: string; url: string }[] = [];
  for (const p of prods ?? []) if (p.image_url) targets.push({ table: 'products', id: p.id, url: p.image_url });
  for (const c of cats ?? []) if (c.image_url) targets.push({ table: 'categories', id: c.id, url: c.image_url });

  let optimized = 0;
  let skipped = 0;
  let failed = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const t of targets) {
    try {
      const res = await fetch(t.url);
      if (!res.ok) {
        failed++;
        continue;
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const original = new Uint8Array(await res.arrayBuffer());
      if (original.length <= OPTIMIZE_SKIP_UNDER_BYTES) {
        skipped++;
        continue;
      }

      let result;
      try {
        result = await compressImage(original, contentType);
      } catch {
        result = null;
      }
      // Пересжатая версия не легче оригинала — пересжимать не было смысла
      // (уже лёгкая картинка, или битый/нераспознанный формат).
      if (!result || result.bytes.length >= original.length) {
        skipped++;
        continue;
      }

      const path = `${crypto.randomUUID()}.${result.ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, result.bytes, { contentType: result.contentType, cacheControl: '31536000' });
      if (upErr) {
        failed++;
        continue;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: dbErr } = await supabase.from(t.table).update({ image_url: pub.publicUrl }).eq('id', t.id);
      if (dbErr) {
        failed++;
        continue;
      }

      bytesBefore += original.length;
      bytesAfter += result.bytes.length;
      optimized++;
    } catch {
      failed++;
    }
  }

  return { total: targets.length, optimized, skipped, failed, bytesBefore, bytesAfter };
}
