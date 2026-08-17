import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { initData: string, productId: string, qty?: number }
// Возвращает { status: 'success'|'insufficient'|'out_of_stock'|'not_found', ... }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData, productId, qty } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    const result = await verifyTelegramInitData(initData, botToken);
    if (!result.ok) return withCors({ error: result.error }, 401);

    if (!productId) return withCors({ error: 'productId обязателен' }, 400);

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc('purchase_product', {
      p_telegram_id: result.user.id,
      p_product_id: productId,
      p_qty: qty ?? 1,
    });

    if (error) return withCors({ error: error.message }, 500);
    return withCors(data);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
