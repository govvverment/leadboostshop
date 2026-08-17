import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST { token в заголовке, action, days? }
// action: 'overview' | 'revenue-by-day' | 'top-products' | 'top-referrers'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  const supabase = supabaseAdmin();

  try {
    const { action, days } = await req.json();

    if (action === 'overview') {
      const { data, error } = await supabase.rpc('admin_stats_overview');
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    if (action === 'revenue-by-day') {
      const { data, error } = await supabase.rpc('admin_revenue_by_day', { p_days: days ?? 14 });
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    if (action === 'top-products') {
      const { data, error } = await supabase.rpc('admin_top_products');
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    if (action === 'top-referrers') {
      const { data, error } = await supabase.rpc('admin_top_referrers');
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    return withCors({ error: 'Неизвестное действие' }, 400);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
