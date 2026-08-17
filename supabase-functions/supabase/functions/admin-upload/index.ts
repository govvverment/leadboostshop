import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST multipart/form-data, поле "image" -> { url }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;

    const supabase = supabaseAdmin();
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, await file.arrayBuffer(), { contentType: file.type });

    if (error) return withCors({ error: error.message }, 500);

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return withCors({ url: data.publicUrl });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
