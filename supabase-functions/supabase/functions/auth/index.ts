import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';

// POST { initData: string, urlRef?: string }
// Вызывается mini-app'ом при каждом открытии. Проверяет подпись
// Telegram, создаёт пользователя при первом заходе (с привязкой
// реферала), обновляет имя/фото при повторных заходах. Возвращает
// базовый профиль.
//
// Источник реферала — сначала пробуем Telegram-овский start_param
// (?startapp=), но он надёжно долетает только если пользователь уже
// открывал бота раньше. Для совсем новых пользователей запасной
// вариант — urlRef: обычный ?ref=... в URL, который подставляет наш
// bot-webhook в кнопку "Открыть магазин" (см. functions/bot-webhook).

function extractReferrerId(raw: string | undefined | null): number | null {
  if (!raw?.startsWith('ref_')) return null;
  const parsed = Number(raw.slice(4));
  return Number.isInteger(parsed) ? parsed : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData, urlRef } = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    const result = await verifyTelegramInitData(initData, botToken);
    if (!result.ok) return withCors({ error: result.error }, 401);

    const { user, startParam } = result;
    const referrerId = extractReferrerId(startParam) ?? extractReferrerId(urlRef);

    const supabase = supabaseAdmin();
    const { error } = await supabase.rpc('sync_telegram_user', {
      p_telegram_id: user.id,
      p_username: user.username ?? null,
      p_first_name: user.first_name ?? null,
      p_photo_url: user.photo_url ?? null,
      p_referrer_id: referrerId,
    });

    if (error) return withCors({ error: error.message }, 500);

    return withCors({
      telegramId: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      photoUrl: user.photo_url ?? null,
    });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
