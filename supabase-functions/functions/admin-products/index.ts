import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST { token в заголовке Authorization, action, ...данные }
// action: 'list' | 'create' | 'update' | 'archive' | 'restore'

function mapProduct(row: Record<string, unknown>) {
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
    stock: row.stock,
    license: row.license,
    period: row.period,
    periodLabel: row.period_label,
    isArchived: Boolean(row.is_archived),
  };
}

const REQUIRED_FIELDS = ['title', 'price', 'category', 'kind'];

function validateProduct(body: Record<string, unknown>): string | null {
  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Поле "${field}" обязательно`;
    }
  }
  if (typeof body.price !== 'number' || body.price <= 0) {
    return 'Цена должна быть положительным числом';
  }
  // Остаток аккаунтов теперь считается по реальному складу
  // (account_inventory), а не задаётся вручную при создании товара —
  // требование про stock больше не нужно.
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authCheck = await requireAdminSession(req);
  if (!authCheck.ok) return withCors({ error: authCheck.error }, authCheck.status);

  const supabase = supabaseAdmin();

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'list') {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) return withCors({ error: error.message }, 500);

      // Живой остаток аккаунтов — реальное количество свободных на
      // складе, а не ручная (уже устаревшая) цифра из products.stock
      const { data: counts } = await supabase
        .from('account_inventory')
        .select('product_id')
        .eq('status', 'available');
      const liveStock = new Map<string, number>();
      for (const row of counts ?? []) {
        liveStock.set(row.product_id, (liveStock.get(row.product_id) ?? 0) + 1);
      }

      return withCors(
        data.map((row) => {
          const mapped = mapProduct(row);
          if (['account', 'one-time', 'subscription'].includes(mapped.kind)) mapped.stock = liveStock.get(row.id) ?? 0;
          return mapped;
        })
      );
    }

    if (action === 'create') {
      const error = validateProduct(body);
      if (error) return withCors({ error }, 400);

      const id = body.id || `${body.category}-${crypto.randomUUID().slice(0, 8)}`;

      const { error: dbError } = await supabase.from('products').insert({
        id,
        category_id: body.category,
        kind: body.kind,
        title: body.title,
        description: body.description ?? null,
        image_url: body.imageUrl ?? null,
        price: body.price,
        geo: body.geo ?? null,
        geo_flag: body.geoFlag ?? null,
        platform: body.platform ?? null,
        type: body.type ?? null,
        stock: body.kind === 'account' ? body.stock ?? 0 : null,
        license: body.kind === 'one-time' ? body.license ?? null : null,
        period: body.kind === 'subscription' ? body.period ?? 'мес' : null,
        period_label: body.kind === 'subscription' ? body.periodLabel ?? '1 месяц' : null,
      });
      if (dbError) return withCors({ error: dbError.message }, 500);

      const { data } = await supabase.from('products').select('*').eq('id', id).single();
      return withCors(mapProduct(data), 201);
    }

    if (action === 'update') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);

      const { data: existing } = await supabase.from('products').select('*').eq('id', body.id).single();
      if (!existing) return withCors({ error: 'Товар не найден' }, 404);

      const validationTarget = { ...mapProduct(existing), ...body };
      const error = validateProduct(validationTarget);
      if (error) return withCors({ error }, 400);

      // "in body" — а не "??" — чтобы явный null от формы (при смене
      // типа товара) реально сохранялся, а не откатывался к старому
      // значению (см. историю этого бага на Express-версии)
      const pick = (key: string, dbKey?: string) =>
        key in body ? body[key] : (existing as Record<string, unknown>)[dbKey ?? key];

      const { error: dbError } = await supabase
        .from('products')
        .update({
          category_id: pick('category', 'category_id'),
          kind: pick('kind'),
          title: pick('title'),
          description: pick('description'),
          image_url: pick('imageUrl', 'image_url'),
          price: pick('price'),
          geo: pick('geo'),
          geo_flag: pick('geoFlag', 'geo_flag'),
          platform: pick('platform'),
          type: pick('type'),
          stock: pick('stock'),
          license: pick('license'),
          period: pick('period'),
          period_label: pick('periodLabel', 'period_label'),
        })
        .eq('id', body.id);
      if (dbError) return withCors({ error: dbError.message }, 500);

      const { data } = await supabase.from('products').select('*').eq('id', body.id).single();
      return withCors(mapProduct(data));
    }

    if (action === 'archive' || action === 'restore') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);
      const { error } = await supabase
        .from('products')
        .update({ is_archived: action === 'archive' })
        .eq('id', body.id);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ ok: true });
    }

    // Склад: посмотреть, что уже загружено (аккаунты login:password
    // ИЛИ ссылки для разовых покупок — то и другое живёт в одной
    // таблице account_inventory)
    if (action === 'list-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      const { data, error } = await supabase
        .from('account_inventory')
        .select('id, login, link, extra, status, created_at, sold_at')
        .eq('product_id', body.productId)
        .order('created_at', { ascending: false });
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    // Пакетная загрузка. Для товаров kind='account' — по строке на
    // аккаунт (login:password или login:password:доп.инфо). Для
    // kind='one-time' — по строке на ссылку скачивания (без разбора
    // по ':', т.к. в самой ссылке двоеточий полно).
    if (action === 'bulk-add-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      if (!body.text || typeof body.text !== 'string') return withCors({ error: 'Пустой список' }, 400);

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('kind')
        .eq('id', body.productId)
        .single();
      if (productError) return withCors({ error: productError.message }, 500);

      const lines = body.text
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) return withCors({ error: 'Не найдено ни одной строки' }, 400);

      const rows = [];
      if (product.kind === 'one-time' || product.kind === 'subscription') {
        // Ссылка + необязательная доп.инфо после ":" — колонки в самом
        // URL (https://...) не путаем со split(':'), ищем разделитель
        // только ПОСЛЕ "схема://".
        for (const line of lines) {
          const schemeMatch = line.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
          const searchFrom = schemeMatch ? schemeMatch[0].length : 0;
          const sepIndex = line.indexOf(':', searchFrom);
          const link = sepIndex === -1 ? line : line.slice(0, sepIndex).trim();
          const extra = sepIndex === -1 ? null : line.slice(sepIndex + 1).trim() || null;
          rows.push({
            id: crypto.randomUUID(),
            product_id: body.productId,
            link,
            extra,
            status: 'available',
          });
        }
      } else {
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length < 2) {
            return withCors({ error: `Строка "${line}" — не похожа на login:password` }, 400);
          }
          const [login, password, ...rest] = parts;
          rows.push({
            id: crypto.randomUUID(),
            product_id: body.productId,
            login: login.trim(),
            password: password.trim(),
            extra: rest.length ? rest.join(':').trim() : null,
            status: 'available',
          });
        }
      }

      const { error } = await supabase.from('account_inventory').insert(rows);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ added: rows.length });
    }

    // Очистка склада: mode='sold' — только уже выданные (безопасно,
    // на доступный остаток не влияет), mode='all' — весь склад товара
    // целиком, включая ещё не выданное (для сброса тестовых данных).
    if (action === 'clear-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      const mode = body.mode === 'all' ? 'all' : 'sold';

      let query = supabase.from('account_inventory').delete({ count: 'exact' }).eq('product_id', body.productId);
      if (mode === 'sold') query = query.eq('status', 'sold');

      const { count, error } = await query;
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ removed: count ?? 0 });
    }

    // Категории — картинка для карточки на главной. Создаются и
    // удаляются через админку (удаление — только если в категории
    // не осталось товаров, чтобы не оставлять товары без категории).
    if (action === 'list-categories') {
      const { data, error } = await supabase.from('categories').select('id, title, image_url').order('id');
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data.map((row: Record<string, unknown>) => ({ id: row.id, title: row.title, imageUrl: row.image_url })));
    }

    if (action === 'create-category') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return withCors({ error: 'Название категории обязательно' }, 400);

      const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
      const { error } = await supabase
        .from('categories')
        .insert({ id, title, image_url: body.imageUrl ?? null });
      if (error) return withCors({ error: error.message }, 500);

      return withCors({ id, title, imageUrl: body.imageUrl ?? null }, 201);
    }

    if (action === 'update-category') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);
      const { error } = await supabase
        .from('categories')
        .update({ image_url: body.imageUrl ?? null })
        .eq('id', body.id);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ ok: true });
    }

    if (action === 'delete-category') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);

      const { count, error: countError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', body.id);
      if (countError) return withCors({ error: countError.message }, 500);
      if ((count ?? 0) > 0) {
        return withCors({ error: `В категории есть товары (${count}) — сначала перенесите или удалите их` }, 400);
      }

      const { error } = await supabase.from('categories').delete().eq('id', body.id);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ ok: true });
    }

    return withCors({ error: 'Неизвестное действие' }, 400);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
