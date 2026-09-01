import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

// GET ?purchaseId=...&initData=...
// Отдаёт .txt со всеми выданными аккаунтами покупки как настоящее
// вложение (Content-Disposition: attachment) — специально для
// Telegram.WebApp.downloadFile(), которому нужен реальный HTTPS-адрес
// (не blob:), плюс сервер обязан прислать эти заголовки сам, иначе
// скачивание внутри Telegram просто открывает файл вместо сохранения.
// См. https://core.telegram.org/bots/webapps#initializing-mini-apps
//
// initData передаётся в query, а не в заголовке — сам системный
// загрузчик Telegram делает обычный GET и не умеет прикладывать
// Authorization, так что подпись проверяем по строке из URL.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://web.telegram.org',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const purchaseId = url.searchParams.get('purchaseId');
  const initData = url.searchParams.get('initData') ?? '';

  if (!purchaseId) return new Response('purchaseId обязателен', { status: 400, headers: CORS_HEADERS });

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
  const result = await verifyTelegramInitData(initData, botToken);
  if (!result.ok) return new Response(result.error, { status: 401, headers: CORS_HEADERS });

  const supabase = supabaseAdmin();
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('id, user_id, title, kind, qty, credentials, created_at')
    .eq('id', purchaseId)
    .eq('user_id', result.user.id) // своя покупка и только своя
    .single();

  if (error || !purchase || purchase.kind !== 'account' || !Array.isArray(purchase.credentials)) {
    return new Response('Покупка не найдена', { status: 404, headers: CORS_HEADERS });
  }

  const lines = purchase.credentials.map((cred: { login: string; password: string; extra?: string | null }) =>
    cred.extra ? `${cred.login}:${cred.password}:${cred.extra}` : `${cred.login}:${cred.password}`
  );
  const dateStr = new Date(purchase.created_at).toLocaleDateString('ru-RU').replace(/\./g, '');
  const fileName = sanitizeFileName(`accounts_${dateStr}_${purchase.qty ?? purchase.credentials.length}.txt`);

  return new Response(lines.join('\n'), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
