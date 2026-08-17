import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { initData: string }
// Возвращает { balance, purchases, subscriptions, balanceHistory, referral }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    const result = await verifyTelegramInitData(initData, botToken);
    if (!result.ok) return withCors({ error: result.error }, 401);

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc('get_account_snapshot', {
      p_telegram_id: result.user.id,
    });

    if (error) return withCors({ error: error.message }, 500);
    return withCors(data);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
