import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST multipart/form-data, поле "files" (можно несколько раз — один
// запрос сразу на несколько .zip) -> { files: [{ path, name }] }
//
// В отличие от admin-upload (картинки, публичный бакет product-images,
// со сжатием) — здесь просто заливаем .zip как есть в ПРИВАТНЫЙ бакет
// account-files. Ни сжимать, ни превью показывать не нужно: это готовые
// файлы с данными аккаунта (1 zip = 1 аккаунт), которые потом целиком
// уходят покупателю через download-account-file.

const MAX_SIZE = 50 * 1024 * 1024; // 50MB на файл — с запасом под медиа внутри архива

function isZipFile(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith('.zip');
  // Браузеры по-разному определяют MIME для .zip (application/zip,
  // application/x-zip-compressed, а иногда и вовсе пусто) — надёжнее
  // всего просто проверить расширение, тип используем только как
  // дополнительную подсказку, а не жёсткое требование.
  return nameOk;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  try {
    const formData = await req.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);

    if (files.length === 0) return withCors({ error: 'Файлы не получены' }, 400);

    for (const file of files) {
      if (!isZipFile(file)) return withCors({ error: `Файл "${file.name}" — не .zip` }, 400);
      if (file.size > MAX_SIZE) return withCors({ error: `Файл "${file.name}" слишком большой (максимум 50MB)` }, 400);
    }

    const supabase = supabaseAdmin();
    const uploaded: { path: string; name: string }[] = [];

    for (const file of files) {
      const path = `${crypto.randomUUID()}.zip`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error } = await supabase.storage
        .from('account-files')
        .upload(path, bytes, { contentType: 'application/zip', cacheControl: '3600' });
      if (error) return withCors({ error: `Не удалось загрузить "${file.name}": ${error.message}` }, 500);
      uploaded.push({ path, name: file.name });
    }

    return withCors({ files: uploaded });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
