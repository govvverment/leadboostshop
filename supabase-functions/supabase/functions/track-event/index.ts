import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { type: 'app_open' | 'topup_click' }
//
// Лёгкий, без-авторизационный счётчик для двух цифр в "Статистике"
// (см. admin-stats: action 'today-events') — сознательно НЕ проверяем
// Telegram initData и не требуем токен, чтобы не тормозить основной
// флоу (вызывается "выстрелил и забыл" из mini-app, ответ фронтом не
// ждётся). Возможность немного накрутить счётчик спамом сюда — не
// критичный риск для внутреннего аналитического числа в админке.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type } = await req.json();
    if (type !== 'app_open' && type !== 'topup_click') {
      return withCors({ error: 'Неизвестный тип события' }, 400);
    }

    const supabase = supabaseAdmin();
    await supabase.from('app_events').insert({ event_type: type });

    return withCors({ ok: true });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
