import { supabase } from './client';
import { config } from '../config';

// ============================================================
// Товары — читаются НАПРЯМУЮ из Supabase (не через Edge Function),
// потому что это публичные данные — у таблицы products настроена
// RLS-политика "читать может кто угодно". Никакой проверки Telegram
// тут не нужно, как и не было в старом Express backend.
// ============================================================

function mapProduct(row) {
  return {
    id: row.id,
    category: row.category_id,
    kind: row.kind,
    imageUrl: row.image_url,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    geo: row.geo,
    geoFlag: row.geo_flag,
    platform: row.platform,
    type: row.type,
    network: row.network,
    stock: row.stock,
    license: row.license,
    period: row.period,
    periodLabel: row.period_label,
    salesCount: row.sales_count ?? 0,
  };
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products_with_stock')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapProduct);
}

export async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('id, title, image_url').order('id');
  if (error) throw error;
  return data.map((row) => ({ id: row.id, title: row.title, imageUrl: row.image_url }));
}

// Последние пополнения склада аккаунтов — для "Новостной ленты" на
// главной. Каждая строка = одна пакетная загрузка через админку.
export async function fetchRecentRestocks(limit = 2) {
  const { data, error } = await supabase
    .from('recent_restocks')
    .select('*')
    .order('restocked_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    productId: row.product_id,
    title: row.title,
    imageUrl: row.image_url,
    geo: row.geo,
    geoFlag: row.geo_flag,
    platform: row.platform,
    price: Number(row.price),
    qtyAdded: row.qty_added,
    restockedAt: new Date(row.restocked_at),
  }));
}

// ============================================================
// Всё остальное (личные данные — баланс, покупки, подписки) идёт
// ТОЛЬКО через Edge Functions. Каждый вызов несёт с собой сырую
// initData от Telegram — Edge Function сам проверяет её подлинность
// на своей стороне (см. functions/_shared/telegram.ts).
// ============================================================

async function callFunction(name, body) {
  const res = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.supabaseAnonKey}`, // Supabase требует хоть какой-то ключ на входе шлюза
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Ошибка запроса (${res.status})`);
  return data;
}

export function authenticate(initData, urlRef) {
  return callFunction('auth', { initData, urlRef });
}

export function fetchAccountSnapshot(initData) {
  return callFunction('account', { initData }).then(mapAccountSnapshot);
}

export function purchaseProduct(initData, productId, qty = 1) {
  return callFunction('buy', { initData, productId, qty });
}

export function createDeposit(initData, amount, network) {
  return callFunction('deposit-create', { initData, amount, network });
}

export function checkDeposit(initData, requestId) {
  return callFunction('deposit-check', { initData, requestId });
}

// ------------------------------------------------------------
// Маппинг снимка аккаунта (snake_case из Postgres → camelCase,
// как уже ожидают существующие экраны mini-app)
// ------------------------------------------------------------

function mapPurchase(row) {
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    kind: row.kind,
    geo: row.geo ?? null,
    geoFlag: row.geo_flag ?? null,
    platform: row.platform ?? null,
    type: row.type ?? null,
    license: row.license ?? null,
    qty: row.qty,
    price: Number(row.price),
    date: new Date(row.created_at).toLocaleDateString('ru-RU'),
    time: new Date(row.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    status: row.status,
    // Настоящие логин/пароль со склада (для kind='account'). Если
    // пусто — значит покупка сделана до подключения склада, либо это
    // не аккаунт — экран сам покажет подходящий запасной вариант.
    credentials: Array.isArray(row.credentials) ? row.credentials : null,
  };
}

function mapSubscription(row) {
  const activeUntil = row.active_until ? new Date(row.active_until).toLocaleDateString('ru-RU') : null;
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    platform: row.platform,
    type: row.type,
    period: row.period,
    periodLabel: row.period_label,
    price: Number(row.price),
    status: row.status,
    activeUntil,
    endedAt: activeUntil, // пока нет отдельной логики истечения — та же дата
    accessLink: row.access_link,
    accessKey: row.access_key,
    accessInstructionsUrl: row.access_instructions_url,
  };
}

function mapHistoryEntry(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    meta: row.meta,
    amount: Number(row.amount),
    status: row.status,
    date: new Date(row.created_at),
  };
}

function mapAccountSnapshot(raw) {
  return {
    balance: Number(raw.balance ?? 0),
    purchases: (raw.purchases || []).map(mapPurchase),
    subscriptions: (raw.subscriptions || []).map(mapSubscription),
    balanceHistory: (raw.balanceHistory || []).map(mapHistoryEntry),
    referral: {
      invited: raw.referral?.invited ?? 0,
      earned: Number(raw.referral?.earned ?? 0),
      list: (raw.referral?.list || []).map((r) => ({
        username: r.username ? `@${r.username}` : '—',
        name: r.firstName ?? '',
        earned: Number(r.earned ?? 0),
      })),
    },
  };
}
