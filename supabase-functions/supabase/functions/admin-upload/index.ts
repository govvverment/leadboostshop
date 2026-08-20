import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST multipart/form-data, поле "image" -> { url }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Иконки категорий и фото товаров в приложении показываются максимум
// ~48-64px (см. ProductImage.jsx), поэтому нет смысла хранить и грузить
// оригиналы в несколько мегабайт — именно из-за них картинки долго
// грузились. Сжимаем один раз при загрузке — дальше приложение отдаёт уже
// лёгкий файл, быстро в любой сети.
const MAX_DIMENSION = 480;
const JPEG_QUALITY = 82;

async function compress(file: File): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  try {
    const image = await Image.decode(new Uint8Array(await file.arrayBuffer()));
    if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
      if (image.width >= image.height) image.resize(MAX_DIMENSION, Image.RESIZE_AUTO);
      else image.resize(Image.RESIZE_AUTO, MAX_DIMENSION);
    }
    // PNG сохраняем как PNG (может быть прозрачность), остальное — в JPEG,
    // он даёт заметно меньший размер файла для обычных фото.
    if (file.type === 'image/png') {
      return { bytes: await image.encode(), contentType: 'image/png', ext: 'png' };
    }
    return { bytes: await image.encodeJPEG(JPEG_QUALITY), contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    // Не смогли распознать/сжать (редкий/битый формат) — грузим как есть,
    // лучше оригинал, чем ошибка загрузки.
    return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type, ext: file.name.split('.').pop() || 'jpg' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  try {
    const formData = await req.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) return withCors({ error: 'Файл не получен' }, 400);
    if (!ALLOWED_TYPES.includes(file.type)) return withCors({ error: 'Разрешены только JPG, PNG или WebP' }, 400);
    if (file.size > MAX_SIZE) return withCors({ error: 'Файл слишком большой (максимум 5MB)' }, 400);

    const { bytes, contentType, ext } = await compress(file);
    const path = `${crypto.randomUUID()}.${ext}`;

    const supabase = supabaseAdmin();
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, bytes, {
        contentType,
        // Картинка одна и та же на своём URL всегда — пусть телефон и
        // Telegram кешируют её на год, а не качают заново на каждый показ.
        cacheControl: '31536000',
      });

    if (error) return withCors({ error: error.message }, 500);

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return withCors({ url: data.publicUrl });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
