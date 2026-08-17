import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { password } -> { token }
const SESSION_TTL_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { password } = await req.json();
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');

    if (!adminPassword) return withCors({ error: 'ADMIN_PASSWORD не задан в secrets' }, 500);
    if (password !== adminPassword) return withCors({ error: 'Неверный пароль' }, 401);

    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000).toISOString();

    const supabase = supabaseAdmin();
    const { error } = await supabase.from('admin_sessions').insert({ token, expires_at: expiresAt });
    if (error) return withCors({ error: error.message }, 500);

    return withCors({ token });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
