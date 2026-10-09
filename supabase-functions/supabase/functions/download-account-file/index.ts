import { verifyTelegramInitData } from '../_shared/telegram.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

// GET ?purchaseId=...&index=...&initData=...
// Отдаёт .zip-файл ОДНОГО купленного аккаунта (см. account_inventory
// .file_path — второй, доп. к login/password, способ выдачи: 1 zip =
// 1 аккаунт) как настоящее вложение (Content-Disposition: attachment) —
// та же причина, что и у download-purchase-file: Telegram.WebApp
// .downloadFile() требует реальный HTTPS-адрес (не blob:) с этими
// заголовками, присланными сервером.
//
// index — позиция нужного элемента в purchase.credentials (при qty>1
// у одной покупки может быть несколько аккаунтов, каждый скачивается
// СВОИМ отдельным .zip, без объединения в один архив). file_path
// специально не принимается от клиента — снимок покупки (credentials)
// перечитывается на сервере и путь берётся из него же, чтобы нельзя
// было подставить чужой путь.

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
  const indexParam = url.searchParams.get('index');
  const initData = url.searchParams.get('initData') ?? '';

  if (!purchaseId) return new Response('purchaseId обязателен', { status: 400, headers: CORS_HEADERS });
  const index = Number(indexParam ?? '0');
  if (!Number.isInteger(index) || index < 0) {
    return new Response('index обязателен', { status: 400, headers: CORS_HEADERS });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
  const result = await verifyTelegramInitData(initData, botToken);
  if (!result.ok) return new Response(result.error, { status: 401, headers: CORS_HEADERS });

  const supabase = supabaseAdmin();
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('id, user_id, kind, credentials')
    .eq('id', purchaseId)
    .eq('user_id', result.user.id) // своя покупка и только своя
    .single();

  const allowedKinds = purchase?.kind === 'account' || purchase?.kind === 'one-time';
  if (error || !purchase || !allowedKinds || !Array.isArray(purchase.credentials)) {
    return new Response('Покупка не найдена', { status: 404, headers: CORS_HEADERS });
  }

  const cred = purchase.credentials[index] as { filePath?: string; fileName?: string } | undefined;
  if (!cred?.filePath) {
    return new Response('Файл не найден', { status: 404, headers: CORS_HEADERS });
  }

  const { data: blob, error: dlError } = await supabase.storage.from('account-files').download(cred.filePath);
  if (dlError || !blob) {
    return new Response('Не удалось получить файл', { status: 500, headers: CORS_HEADERS });
  }

  const fileName = sanitizeFileName(cred.fileName || `account_${index + 1}.zip`);

  return new Response(blob, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
