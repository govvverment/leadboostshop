import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

// Webhook для самого Telegram-бота (не Mini App). Нужен ТОЛЬКО для
// одной вещи: когда пользователь впервые нажимает "Start" по
// реферальной ссылке (t.me/bot?start=ref_123), обычная Direct Link
// Mini App (?startapp=) в этом случае НЕ передаёт start_param — это
// особенность Telegram, если бот ни разу не был запущен пользователем.
// Поэтому бот сам отвечает кнопкой "Открыть магазин", в URL которой
// реферальный параметр уже вшит как обычный ?ref=... — Telegram
// сохраняет query-строку web_app-кнопки и отдаёт её в window.location
// внутри Mini App, это не зависит от капризов start_param.

// Плюс вторая вещь, добавленная позже: отслеживание блокировки бота
// пользователем — Telegram сам присылает сюда my_chat_member-апдейт,
// когда пользователь блокирует/разблокирует бота (в приватном чате
// статус самого бота меняется на 'kicked' / обратно на 'member'). Это
// приходит по умолчанию, без явной настройки allowed_updates в
// setWebhook. См. также admin-stats action 'refresh-blocked' — ручной
// пересчёт по кнопке в админке, бэкафилл для случаев, которые вебхук
// мог пропустить.

// Оба значения — свои для каждого развёртывания, задаются как секреты
// (см. supabase secrets set MINI_APP_URL=... / BOT_WEBHOOK_URL=...),
// а не хардкодятся в коде.
const MINI_APP_URL = Deno.env.get('MINI_APP_URL')!;

Deno.serve(async (req) => {
  // GET — разовая самонастройка / диагностика.
  //   ?info=1 — посмотреть текущее состояние вебхука у Telegram
  //   (без параметра) — заново зарегистрировать этот URL как webhook
  if (req.method === 'GET') {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const url = new URL(req.url);

    if (url.searchParams.get('info') === '1') {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const json = await resp.json();
      return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } });
    }

    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
    const webhookUrl = Deno.env.get('BOT_WEBHOOK_URL')!;
    const setWebhookUrl =
      `https://api.telegram.org/bot${botToken}/setWebhook` +
      `?url=${encodeURIComponent(webhookUrl)}&secret_token=${secret}`;
    const resp = await fetch(setWebhookUrl);
    const json = await resp.json();
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } });
  }

  // Проверяем, что запрос реально от Telegram (секрет, который Telegram
  // прикладывает в заголовок ко всем вызовам вебхука после setWebhook).
  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretHeader !== Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const update = await req.json();

    // my_chat_member — статус самого бота в приватном чате поменялся:
    // 'kicked' = пользователь заблокировал бота, 'member' = открыл/
    // разблокировал заново. Другие статусы ('left' и т.п.) в приватных
    // чатах с ботом практически не встречаются — не трогаем флаг.
    const myChatMember = update.my_chat_member;
    if (myChatMember?.chat?.type === 'private') {
      const newStatus: string | undefined = myChatMember.new_chat_member?.status;
      const userId = myChatMember.chat.id;
      if (userId && (newStatus === 'kicked' || newStatus === 'member')) {
        const supabase = supabaseAdmin();
        await supabase
          .from('users')
          .update({ bot_blocked: newStatus === 'kicked', bot_blocked_checked_at: new Date().toISOString() })
          .eq('telegram_id', userId);
      }
      return new Response('ok');
    }

    const message = update.message;
    const text: string | undefined = message?.text;
    const chatId = message?.chat?.id;

    if (typeof text === 'string' && text.startsWith('/start') && chatId) {
      const payload = text.slice(6).trim(); // всё после "/start "
      const url = payload ? `${MINI_APP_URL}/?ref=${encodeURIComponent(payload)}` : MINI_APP_URL;

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Добро пожаловать в LEAD BOOST 🚀\n\nНажмите кнопку ниже, чтобы открыть магазин.',
          reply_markup: {
            inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url } }]],
          },
        }),
      });
    }

    return new Response('ok');
  } catch (err) {
    console.error('[bot-webhook] error:', err);
    return new Response('ok'); // всегда 200 — иначе Telegram будет долбить ретраями
  }
});
