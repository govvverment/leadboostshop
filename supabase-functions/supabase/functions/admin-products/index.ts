import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';
import { optimizeImageBacklog } from '../_shared/optimizeBacklog.ts';

// POST { token в заголовке Authorization, action, ...данные }
// action: 'list' | 'create' | 'update' | 'archive' | 'restore' | 'delete' |
//   'list-inventory' | 'bulk-add-inventory' | 'add-file-inventory' |
//   'clear-inventory' | 'delete-inventory-item' | 'optimize-images' |
//   'find-user-by-telegram' | 'credit-balance' | 'list-orders' |
//   'list-networks' | 'create-network' | 'update-network' | 'delete-network' |
//   ...категории

// Пересжатие уже загруженных картинок вынесено в
// _shared/optimizeBacklog.ts — той же функцией теперь пользуется и этот
// action ('optimize-images', срабатывает когда админ открывает раздел
// "Товары"), и новая edge-функция cron-optimize-images (срабатывает САМА,
// по расписанию через pg_cron — см. миграцию *_autonomous_image_
// optimization.sql). Раньше пересжатие полностью зависело от того, что
// кто-то откроет "Товары" в браузере — если этого не происходило, оно
// просто ни разу не срабатывало. Теперь это не единственный путь.

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
    network: row.network,
    stock: row.stock,
    license: row.license,
    period: row.period,
    periodLabel: row.period_label,
    isArchived: Boolean(row.is_archived),
    managerOrder: Boolean(row.manager_order),
    manualStock: Boolean(row.manual_stock),
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

// Общий разбор текста склада — используется и при первичной загрузке
// (create с inventoryText), и при пополнении (bulk-add-inventory), чтобы
// формат строк не мог разойтись между двумя местами.
//
// kind='one-time'/'subscription': ссылка[:ключ доступа[:ссылка на
// инструкцию]] — разделители ищем только после "схема://", чтобы не
// спутать с двоеточиями внутри самих ссылок.
// kind='account': login:password[:доп.инфо] ИЛИ одна голая ссылка —
// тогда аккаунт выдаётся как {link}, а не {login,password}.
function buildInventoryRows(productId: string, kind: string, text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [] as Record<string, unknown>[], error: 'Не найдено ни одной строки' };

  const rows: Record<string, unknown>[] = [];
  if (kind === 'one-time' || kind === 'subscription') {
    for (const line of lines) {
      const schemeMatch = line.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
      const searchFrom = schemeMatch ? schemeMatch[0].length : 0;
      const sepIndex = line.indexOf(':', searchFrom);
      const link = sepIndex === -1 ? line : line.slice(0, sepIndex).trim();
      const rest = sepIndex === -1 ? '' : line.slice(sepIndex + 1).trim();

      // Необязательная ссылка на инструкцию — третье поле, само тоже
      // ссылка. Ищем начало ВТОРОЙ "схема://" в остатке строки, чтобы
      // не спутать с двоеточиями внутри самого ключа.
      const instructionsMatch = rest.match(/[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/);
      const extra = instructionsMatch
        ? rest.slice(0, instructionsMatch.index).replace(/:$/, '').trim() || null
        : rest || null;
      const instructionsUrl = instructionsMatch ? instructionsMatch[0] : null;

      rows.push({
        id: crypto.randomUUID(),
        product_id: productId,
        link,
        extra,
        instructions_url: instructionsUrl,
        status: 'available',
      });
    }
  } else {
    for (const line of lines) {
      // Голая ссылка целиком — один аккаунт-ссылка (см. миграцию
      // account_links). URL сохраняем целиком, не разбирая двоеточия
      // внутри него.
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/.test(line)) {
        rows.push({
          id: crypto.randomUUID(),
          product_id: productId,
          link: line,
          status: 'available',
        });
        continue;
      }

      const parts = line.split(':');
      if (parts.length < 2) {
        return { rows: [], error: `Строка "${line}" — не похожа на ссылку или login:password` };
      }
      const [login, password, ...rest] = parts;
      rows.push({
        id: crypto.randomUUID(),
        product_id: productId,
        login: login.trim(),
        password: password.trim(),
        extra: rest.length ? rest.join(':').trim() : null,
        status: 'available',
      });
    }
  }

  return { rows, error: null as string | null };
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
      // складе, а не ручная (уже устаревшая) цифра из products.stock.
      // Исключение — товары с manual_stock: у них СВОЙ смысл у
      // products.stock (см. миграцию *_manual_account_stock.sql), реального
      // склада может вообще не быть, и живой подсчёт по account_inventory
      // здесь всегда дал бы 0.
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
          const isManualAccount = mapped.kind === 'account' && mapped.manualStock;
          if (!isManualAccount && ['account', 'one-time', 'subscription'].includes(mapped.kind)) {
            mapped.stock = liveStock.get(row.id) ?? 0;
          }
          return mapped;
        })
      );
    }

    if (action === 'create') {
      const error = validateProduct(body);
      if (error) return withCors({ error }, 400);

      const id = body.id || `${body.category}-${crypto.randomUUID().slice(0, 8)}`;
      let inventoryRows: Record<string, unknown>[] = [];

      if (body.inventoryText !== undefined && body.inventoryText !== null && body.inventoryText !== '') {
        if (typeof body.inventoryText !== 'string') {
          return withCors({ error: 'Данные склада должны быть текстом' }, 400);
        }
        const parsed = buildInventoryRows(id, String(body.kind), body.inventoryText);
        if (parsed.error) return withCors({ error: parsed.error }, 400);
        inventoryRows = parsed.rows;
      }

      // Второй способ загрузки начального склада — .zip-файлы (уже
      // загруженные в приватный бакет через admin-upload-account-file,
      // сюда приходят только их пути). Складывается вместе с текстовым
      // способом выше — можно использовать любой из них или оба сразу.
      if (Array.isArray(body.inventoryFiles) && body.inventoryFiles.length > 0) {
        for (const f of body.inventoryFiles) {
          if (!f || typeof f.path !== 'string' || !f.path) continue;
          inventoryRows.push({
            id: crypto.randomUUID(),
            product_id: id,
            file_path: f.path,
            file_name: typeof f.name === 'string' ? f.name : null,
            status: 'available',
          });
        }
      }

      // Автоподхват иконки: если это аккаунт с указанной соцсетью, но без
      // своей картинки — сначала смотрим в справочник networks (там
      // админ явно сохраняет иконку на каждую соцсеть, см. add-network/
      // update-network), а если там иконки ещё нет — как раньше,
      // подбираем картинку с любого уже существующего товара той же
      // соцсети. Обычно фронт (AdminProductForm) уже сам подставляет
      // imageUrl из networks при выборе соцсети — это просто подстраховка
      // на случай прямого вызова API. Явно переданная imageUrl в
      // приоритете и это правило не переопределяет.
      let imageUrl = body.imageUrl ?? null;
      if (!imageUrl && body.kind === 'account' && body.network) {
        const { data: net } = await supabase
          .from('networks')
          .select('icon_url')
          .ilike('title', String(body.network))
          .not('icon_url', 'is', null)
          .maybeSingle();
        if (net?.icon_url) {
          imageUrl = net.icon_url;
        } else {
          const { data: sibling } = await supabase
            .from('products')
            .select('image_url')
            .eq('kind', 'account')
            .eq('network', body.network)
            .not('image_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (sibling?.image_url) imageUrl = sibling.image_url;
        }
      }

      const { error: dbError } = await supabase.from('products').insert({
        id,
        category_id: body.category,
        kind: body.kind,
        title: body.title,
        description: body.description ?? null,
        image_url: imageUrl,
        price: body.price,
        geo: body.geo ?? null,
        geo_flag: body.geoFlag ?? null,
        platform: body.platform ?? null,
        type: body.type ?? null,
        network: body.kind === 'account' ? body.network ?? null : null,
        stock: body.kind === 'account' ? Number(body.stock) || 0 : null,
        license: body.kind === 'one-time' ? body.license ?? null : null,
        period: body.kind === 'subscription' ? body.period ?? 'мес' : null,
        period_label: body.kind === 'subscription' ? body.periodLabel ?? '1 месяц' : null,
        manager_order: Boolean(body.managerOrder),
        manual_stock: body.kind === 'account' ? Boolean(body.manualStock) : false,
      });
      if (dbError) return withCors({ error: dbError.message }, 500);

      if (inventoryRows.length > 0) {
        const { error: inventoryError } = await supabase.from('account_inventory').insert(inventoryRows);
        if (inventoryError) {
          // Не оставляем пустой товар, если его начальный склад
          // не смог записаться.
          await supabase.from('products').delete().eq('id', id);
          return withCors({ error: inventoryError.message }, 500);
        }
      }

      // Товар с ручным складом (manual_stock) создаётся сразу с каким-то
      // количеством — но, в отличие от account_inventory (обычный склад),
      // это НЕ строки в отдельной таблице, а просто число в products.stock.
      // Новостная лента ("recent_restocks") раньше строилась только из
      // account_inventory и такие товары никогда в неё не попадали, даже
      // при создании с полным количеством сразу — пишем явное событие
      // пополнения, чтобы админ и покупатели видели его в ленте.
      if (body.kind === 'account' && Boolean(body.manualStock)) {
        const qty = Number(body.stock) || 0;
        if (qty > 0) {
          await supabase.from('restock_events').insert({ product_id: id, qty_added: qty });
        }
      }

      const { data } = await supabase.from('products').select('*').eq('id', id).single();
      return withCors({ ...mapProduct(data), inventoryAdded: inventoryRows.length }, 201);
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

      const newKind = pick('kind') as string;
      const newManualStock = 'manualStock' in body ? Boolean(body.manualStock) : Boolean((existing as Record<string, unknown>).manual_stock);
      const newStockValue = pick('stock');

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
          network: pick('network'),
          stock: newStockValue,
          license: pick('license'),
          period: pick('period'),
          period_label: pick('periodLabel', 'period_label'),
          manager_order: 'managerOrder' in body ? Boolean(body.managerOrder) : (existing as Record<string, unknown>).manager_order,
          manual_stock: newManualStock,
        })
        .eq('id', body.id);
      if (dbError) return withCors({ error: dbError.message }, 500);

      // Тот же случай, что и при создании (см. комментарий в action
      // 'create') — только тут ещё нужно сравнить со СТАРЫМ количеством:
      // пишем событие в ленту, только если товар реально пополнили
      // (stock вырос), а не просто пересохранили форму или продали пару
      // штук (продажа уменьшает stock через purchase_product() — не
      // отсюда, эта ветка её не видит и под "рост" не попадает).
      if (newKind === 'account' && newManualStock) {
        const oldStock = Number((existing as Record<string, unknown>).stock) || 0;
        const newStock = Number(newStockValue) || 0;
        const delta = newStock - oldStock;
        if (delta > 0) {
          await supabase.from('restock_events').insert({ product_id: body.id, qty_added: delta });
        }
      }

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

    // Безвозвратное удаление товара из БД (не архивация — строка
    // целиком пропадает и из products, и из склада). Сначала чистим
    // account_inventory — эти строки ничего не держат, удаляются всегда.
    // Сам products при этом можно удалить, только если товар НИКОГДА не
    // покупали: purchases/subscriptions ссылаются на products(id) без
    // cascade — и это специально так, чтобы удаление товара не стирало
    // историю покупок и статистику клиентов. Если такие покупки есть,
    // Postgres вернёт foreign_key_violation (23503) — превращаем это в
    // понятное сообщение и предлагаем архивировать вместо удаления.
    if (action === 'delete') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);

      const { error: invError } = await supabase.from('account_inventory').delete().eq('product_id', body.id);
      if (invError) return withCors({ error: invError.message }, 500);

      const { error } = await supabase.from('products').delete().eq('id', body.id);
      if (error) {
        if (error.code === '23503') {
          return withCors(
            {
              error:
                'Этот товар уже покупали — удалить нельзя, иначе пропадёт история покупок клиентов. Используйте архивацию.',
            },
            409
          );
        }
        return withCors({ error: error.message }, 500);
      }
      return withCors({ ok: true });
    }

    // Склад: посмотреть, что уже загружено (аккаунты login:password
    // ИЛИ ссылки для разовых покупок — то и другое живёт в одной
    // таблице account_inventory)
    if (action === 'list-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      const { data, error } = await supabase
        .from('account_inventory')
        .select('id, login, link, extra, instructions_url, file_path, file_name, status, created_at, sold_at')
        .eq('product_id', body.productId)
        .order('created_at', { ascending: false });
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data);
    }

    // Пакетная загрузка. Для товаров kind='account' — по строке на
    // аккаунт (login:password или login:password:доп.инфо). Для
    // kind='one-time'/'subscription' — ссылка[:ключ доступа[:ссылка на
    // инструкцию]] (без разбора по ':', т.к. в самих ссылках двоеточий
    // полно — ищем разделители только после "схема://").
    if (action === 'bulk-add-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      if (!body.text || typeof body.text !== 'string') return withCors({ error: 'Пустой список' }, 400);

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('kind')
        .eq('id', body.productId)
        .single();
      if (productError) return withCors({ error: productError.message }, 500);

      const parsed = buildInventoryRows(body.productId, product.kind, body.text);
      if (parsed.error) return withCors({ error: parsed.error }, 400);
      const rows = parsed.rows;

      const { error } = await supabase.from('account_inventory').insert(rows);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ added: rows.length });
    }

    // Пополнение склада .zip-файлами — второй способ, наравне с
    // bulk-add-inventory (текст). Файлы уже должны быть загружены в
    // приватный бакет account-files через admin-upload-account-file,
    // сюда приходят только их пути — по одному account_inventory на
    // файл (1 zip = 1 единица товара). Доступно для kind='account' И
    // kind='one-time' (категория "Технические решения" идёт по
    // one-time — формат "1 zip = 1 товар = 1 единица склада"), но не
    // для 'subscription' — у подписок другой, накопительный флоу
    // выдачи (см. purchase_product()).
    if (action === 'add-file-inventory') {
      if (!body.productId) return withCors({ error: 'productId обязателен' }, 400);
      if (!Array.isArray(body.files) || body.files.length === 0) {
        return withCors({ error: 'Список файлов пуст' }, 400);
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('kind')
        .eq('id', body.productId)
        .single();
      if (productError) return withCors({ error: productError.message }, 500);
      if (product.kind !== 'account' && product.kind !== 'one-time') {
        return withCors({ error: 'Загрузка .zip доступна только для товаров типа "Аккаунт" и "Разовая покупка"' }, 400);
      }

      const rows = body.files
        .filter((f: unknown): f is { path: string; name?: string } => Boolean((f as { path?: string })?.path))
        .map((f: { path: string; name?: string }) => ({
          id: crypto.randomUUID(),
          product_id: body.productId,
          file_path: f.path,
          file_name: f.name ?? null,
          status: 'available',
        }));
      if (rows.length === 0) return withCors({ error: 'Список файлов пуст' }, 400);

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

    // Удалить ОДНУ конкретную единицу склада (одну строку
    // account_inventory) по id — в отличие от clear-inventory (bulk),
    // здесь можно убрать один конкретный ещё не проданный аккаунт/ссылку/
    // zip, не трогая остальной склад товара. Проданные строки тоже можно
    // удалять (просто чистка истории — сама покупка и её credentials уже
    // сохранены отдельно, в purchases, и не пострадают).
    if (action === 'delete-inventory-item') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);
      const { data, error } = await supabase
        .from('account_inventory')
        .delete()
        .eq('id', body.id)
        .select('id')
        .maybeSingle();
      if (error) return withCors({ error: error.message }, 500);
      if (!data) return withCors({ error: 'Позиция склада не найдена' }, 404);
      return withCors({ ok: true });
    }

    // ------------------------------------------------------------
    // Ручное начисление/списание баланса по Telegram ID — двухшаговый
    // UI в админке: сначала find-user-by-telegram (показать админу, кого
    // он собирается пополнить — имя/username/текущий баланс, чтобы не
    // ошибиться ID), затем credit-balance с уже подтверждённой суммой.
    // ------------------------------------------------------------
    if (action === 'find-user-by-telegram') {
      const telegramId = Number(body.telegramId);
      if (!Number.isFinite(telegramId)) return withCors({ error: 'Некорректный Telegram ID' }, 400);
      const { data, error } = await supabase
        .from('users')
        .select('telegram_id, username, first_name, balance')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) return withCors({ error: error.message }, 500);
      if (!data) return withCors({ error: 'Пользователь с таким Telegram ID не найден' }, 404);
      return withCors({
        telegramId: data.telegram_id,
        username: data.username,
        firstName: data.first_name,
        balance: Number(data.balance),
      });
    }

    if (action === 'credit-balance') {
      const telegramId = Number(body.telegramId);
      const amount = Number(body.amount);
      if (!Number.isFinite(telegramId)) return withCors({ error: 'Некорректный Telegram ID' }, 400);
      if (!Number.isFinite(amount) || amount === 0) return withCors({ error: 'Сумма должна быть ненулевым числом' }, 400);

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (userError) return withCors({ error: userError.message }, 500);
      if (!user) return withCors({ error: 'Пользователь с таким Telegram ID не найден' }, 404);

      const newBalance = Number((Number(user.balance) + amount).toFixed(2));
      const { error: updError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('telegram_id', telegramId);
      if (updError) return withCors({ error: updError.message }, 500);

      const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
      await supabase.from('balance_history').insert({
        id: 'h_' + crypto.randomUUID().replace(/-/g, ''),
        user_id: telegramId,
        type: amount > 0 ? 'admin_credit' : 'admin_debit',
        title: amount > 0 ? 'Начисление администратором' : 'Списание администратором',
        meta: note,
        amount,
        status: 'success',
      });

      return withCors({ ok: true, balance: newBalance });
    }

    // Заказы, направленные на менеджера (товары с галочкой
    // "Направлять к менеджеру") — чтобы админ видел номер заказа и мог
    // сверить его с тем, что покупатель напишет в личку. Берём и из
    // purchases (account/one-time), и из subscriptions (подписки) —
    // в обеих таблицах order_number проставляется одной и той же
    // purchase_product().
    if (action === 'list-orders') {
      const { data: fromPurchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('id, user_id, product_id, title, kind, price, order_number, created_at')
        .not('order_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (purchasesError) return withCors({ error: purchasesError.message }, 500);

      const { data: fromSubs, error: subsError } = await supabase
        .from('subscriptions')
        .select('id, user_id, product_id, title, price, order_number, created_at')
        .not('order_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (subsError) return withCors({ error: subsError.message }, 500);

      const combined = [
        ...(fromPurchases ?? []).map((r) => ({ ...r, source: 'purchase' })),
        ...(fromSubs ?? []).map((r) => ({ ...r, kind: 'subscription', source: 'subscription' })),
      ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

      const userIds = [...new Set(combined.map((r) => r.user_id as number))];
      const { data: users } = userIds.length
        ? await supabase.from('users').select('telegram_id, username, first_name').in('telegram_id', userIds)
        : { data: [] };
      const userMap = new Map((users ?? []).map((u) => [u.telegram_id, u]));

      return withCors(
        combined.map((r) => {
          const u = userMap.get(r.user_id as number);
          return {
            id: r.id,
            orderNumber: r.order_number,
            productTitle: r.title,
            kind: r.kind,
            price: Number(r.price),
            userTelegramId: r.user_id,
            username: u?.username ?? null,
            firstName: u?.first_name ?? null,
            createdAt: r.created_at,
          };
        })
      );
    }

    // Пересжать уже загруженные картинки товаров и категорий — сама
    // логика в _shared/optimizeBacklog.ts (см. комментарий там же и
    // наверху этого файла). Этот action запускается, когда админ
    // открывает раздел "Товары"; та же работа теперь ЕЩЁ и происходит
    // сама по расписанию (cron-optimize-images).
    if (action === 'optimize-images') {
      try {
        const stats = await optimizeImageBacklog(supabase);
        return withCors(stats);
      } catch (err) {
        return withCors({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
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

    // Справочник соцсетей — иконка на каждую, чтобы форма товара могла
    // подставлять её автоматически при выборе соцсети (см. AdminProductForm
    // и автоподхват иконки в create() выше). Тот же CRUD-паттерн, что и
    // у категорий.
    if (action === 'list-networks') {
      const { data, error } = await supabase.from('networks').select('id, title, icon_url').order('title');
      if (error) return withCors({ error: error.message }, 500);
      return withCors(data.map((row: Record<string, unknown>) => ({ id: row.id, title: row.title, iconUrl: row.icon_url })));
    }

    if (action === 'create-network') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return withCors({ error: 'Название соцсети обязательно' }, 400);

      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '') || `net-${crypto.randomUUID().slice(0, 8)}`;

      const { error } = await supabase.from('networks').insert({ id, title, icon_url: body.iconUrl ?? null });
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ id, title, iconUrl: body.iconUrl ?? null }, 201);
    }

    if (action === 'update-network') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);
      const { error } = await supabase.from('networks').update({ icon_url: body.iconUrl ?? null }).eq('id', body.id);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ ok: true });
    }

    if (action === 'delete-network') {
      if (!body.id) return withCors({ error: 'id обязателен' }, 400);
      const { error } = await supabase.from('networks').delete().eq('id', body.id);
      if (error) return withCors({ error: error.message }, 500);
      return withCors({ ok: true });
    }

    return withCors({ error: 'Неизвестное действие' }, 400);
  } catch (err) {
    return withCors({ error: String(err) }, 400);
  }
});
