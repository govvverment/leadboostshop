import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST { token в заголовке Authorization, action: 'send', text, buttonLabel?, productId? }
//
// Ручная рассылка от имени бота всем зарегистрированным пользователям
// (users.telegram_id). Ничего не отправляется автоматически — это
// инструмент, которым явно пользуется админ (в том числе для
// уведомления "товар снова в наличии": админ сам выбирает товар в
// форме на фронте, оттуда сюда приходит уже готовый text + productId).
//
// buttonLabel задан -> добавляем одну inline-кнопку с web_app-ссылкой:
// на конкретный товар (если передан productId) или просто в магазин.
//
// Шлём пачками с паузой между ними — у Telegram негласный лимит
// ~30 сообщений/сек в разные чаты, с запасом берём меньше. При очень
// большой базе пользователей это может занять время, сравнимое с
// лимитом выполнения Edge Function — для типичного размера магазина
// (сотни-тысячи пользователей) укладывается с запасом.
const MINI_APP_URL = Deno.env.get('MINI_APP_URL')!;
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

async function sendOne(
  botToken: string,
  chatId: number,
  text: string,
  button?: { label: string; url: string }
): Promise<boolean> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (button) {
    body.reply_markup = { inline_keyboard: [[{ text: button.label, web_app: { url: button.url } }]] };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Частая причина неуспеха — пользователь заблокировал бота (403) или
    // деактивировал аккаунт: это не ошибка на нашей стороне, просто
    // считаем как "не доставлено" и идём дальше, не прерывая рассылку.
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  try {
    const body = await req.json();
    if (body.action !== 'send') return withCors({ error: 'Неизвестное действие' }, 400);

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return withCors({ error: 'Текст сообщения обязателен' }, 400);

    let button: { label: string; url: string } | undefined;
    if (typeof body.buttonLabel === 'string' && body.buttonLabel.trim()) {
      const url = body.productId
        ? `${MINI_APP_URL}/product/${encodeURIComponent(String(body.productId))}`
        : MINI_APP_URL;
      button = { label: body.buttonLabel.trim(), url };
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = supabaseAdmin();
    const { data: users, error } = await supabase.from('users').select('telegram_id');
    if (error) return withCors({ error: error.message }, 500);

    const ids = (users ?? []).map((u: { telegram_id: number }) => u.telegram_id);
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((id) => sendOne(botToken, id, text, button)));
      for (const ok of results) {
        if (ok) sent++;
        else failed++;
      }
      if (i + BATCH_SIZE < ids.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return withCors({ total: ids.length, sent, failed });
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
