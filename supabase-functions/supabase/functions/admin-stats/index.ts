import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST { token в заголовке, action, days? }
// action: 'overview' | 'revenue-by-day' | 'top-products' | 'top-referrers' | 'today-events' | 'refresh-blocked'

// Пачками, с паузой между ними — тот же принцип, что и в admin-broadcast:
// getChatMember тоже расходует общий лимит запросов к Bot API, и на
// большой базе пользователей лучше не бить по нему одной очередью разом.
const CHECK_BATCH_SIZE = 20;
const CHECK_BATCH_DELAY_MS = 500;

// Реальная проверка "жив ли бот у этого пользователя" — без отправки
// сообщения (в отличие от рассылки). getChatMember для приватного чата,
// где user_id — это ID самого бота: если пользователь заблокировал бота,
// Telegram возвращает статус 'kicked', иначе — 'member'.
async function checkBlocked(botToken: string, botId: number, telegramId: number): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${telegramId}&user_id=${botId}`
    );
    const data = await res.json();
    if (!data?.ok) return null; // пользователь недоступен/чат не найден и т.п. — не трогаем флаг
    return data.result?.status === 'kicked';
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  const supabase = supabaseAdmin();

  try {
    const { action, days } = await req.json();

    if (action === 'overview') {
      const [{ data, error }, blockedRes] = await Promise.all([
        supabase.rpc('admin_stats_overview'),
        supabase.from('users').select('telegram_id', { count: 'exact', head: true }).eq('bot_blocked', true),
      ]);
      if (error) return withCors({ error: error.message }, 500);
      if (blockedRes.error) return withCors({ error: blockedRes.error.message }, 500);
      return withCors({ ...data, blockedUsers: blockedRes.count ?? 0 });
    }

    // Ручной пересчёт "кто заблокировал бота" — по кнопке в админке.
    // Дополняет автоматическое обновление через my_chat_member в
    // bot-webhook (см. там): нужен как бэкафилл для пользователей,
    // заблокировавших бота ещё до появления этого отслеживания, и как
    // подстраховка на случай пропущенных вебхуков.
    if (action === 'refresh-blocked') {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = await meRes.json();
      if (!me?.ok) return withCors({ error: 'Не удалось получить данные бота из Telegram' }, 500);
      const botId = me.result.id;

      const { data: users, error: usersError } = await supabase.from('users').select('telegram_id');
      if (usersError) return withCors({ error: usersError.message }, 500);

      const ids = (users ?? []).map((u: { telegram_id: number }) => u.telegram_id);
      const blockedIds: number[] = [];
      const activeIds: number[] = [];
      let unknown = 0;

      for (let i = 0; i < ids.length; i += CHECK_BATCH_SIZE) {
        const batch = ids.slice(i, i + CHECK_BATCH_SIZE);
        const results = await Promise.all(batch.map((id) => checkBlocked(botToken, botId, id)));
        results.forEach((blocked, idx) => {
          if (blocked === true) blockedIds.push(batch[idx]);
          else if (blocked === false) activeIds.push(batch[idx]);
          else unknown++;
        });
        if (i + CHECK_BATCH_SIZE < ids.length) {
          await new Promise((resolve) => setTimeout(resolve, CHECK_BATCH_DELAY_MS));
        }
      }

      const now = new Date().toISOString();
      if (blockedIds.length) {
        const { error: err1 } = await supabase
          .from('users')
          .update({ bot_blocked: true, bot_blocked_checked_at: now })
          .in('telegram_id', blockedIds);
        if (err1) return withCors({ error: err1.message }, 500);
      }
      if (activeIds.length) {
        const { error: err2 } = await supabase
          .from('users')
          .update({ bot_blocked: false, bot_blocked_checked_at: now })
          .in('telegram_id', activeIds);
        if (err2) return withCors({ error: err2.message }, 500);
      }

      return withCors({ total: ids.length, blocked: blockedIds.length, active: activeIds.length, unknown });
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

    // "Открытий сегодня" / "Нажатий «Пополнить» сегодня" — считаем по
    // app_events (см. track-event). "Сегодня" — по UTC-суткам сервера,
    // без привязки к часовому поясу конкретного админа.
    if (action === 'today-events') {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const since = startOfDay.toISOString();

      const [opens, topups] = await Promise.all([
        supabase.from('app_events').select('id', { count: 'exact', head: true }).eq('event_type', 'app_open').gte('created_at', since),
        supabase.from('app_events').select('id', { count: 'exact', head: true }).eq('event_type', 'topup_click').gte('created_at', since),
      ]);
      if (opens.error) return withCors({ error: opens.error.message }, 500);
      if (topups.error) return withCors({ error: topups.error.message }, 500);

      return withCors({ appOpensToday: opens.count ?? 0, topupClicksToday: topups.count ?? 0 });
    }

    return withCors({ error: 'Неизвестное действие' }, 400);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
