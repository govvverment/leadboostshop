// Проверка подлинности данных от Telegram Mini App.
//
// Как это работает: когда mini-app открывается внутри Telegram,
// он получает строку initData — набор полей (id пользователя, имя,
// время открытия и т.д.) плюс "hash" — подпись, посчитанную
// Telegram'ом с помощью секретного токена бота. Проверив эту подпись
// теми же вычислениями на своём сервере, мы можем быть уверены, что
// данные пришли реально от Telegram, а не подделаны в браузере.
//
// Официальный алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

const encoder = new TextEncoder();

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message) as BufferSource);
  return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}

// Максимальный "возраст" initData, после которого её больше не
// принимаем (защита от повторного использования старой, перехваченной
// когда-то строки). Telegram обновляет initData при каждом открытии
// mini-app, так что 24 часа — с запасом.
const MAX_AGE_SECONDS = 24 * 60 * 60;

export async function verifyTelegramInitData(
  initData: string,
  botToken: string
): Promise<{ ok: true; user: TelegramUser; startParam?: string } | { ok: false; error: string }> {
  if (!initData) return { ok: false, error: 'initData отсутствует' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'Нет поля hash' };
  params.delete('hash');

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return { ok: false, error: 'initData устарела' };
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const computedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));

  if (computedHash !== hash) {
    return { ok: false, error: 'Неверная подпись' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, error: 'Нет данных пользователя' };

  const user = JSON.parse(userRaw) as TelegramUser;
  const startParam = params.get('start_param') || undefined;

  return { ok: true, user, startParam };
}
