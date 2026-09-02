import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { corsHeaders, withCors } from '../_shared/cors.ts';
import { requireAdminSession } from '../_shared/adminAuth.ts';

// POST { token в заголовке Authorization, action, ...данные }
// action: 'list' | 'create' | 'update' | 'archive' | 'restore' | 'delete' |
//   'list-inventory' | 'bulk-add-inventory' | 'add-file-inventory' |
//   'clear-inventory' | 'optimize-images' | ...категории

// Та же логика сжатия, что и в admin-upload — но применяется задним
// числом к уже загруженным картинкам. Сжатие при загрузке (admin-upload)
// работает только для НОВЫХ файлов; товары/категории, картинки которых
// были загружены до появления этой логики, остались большими и поэтому
// заметно медленнее грузятся в приложении (в частности — иконки в
// "Новостной ленте"). 'optimize-images' один раз проходит по всем уже
// сохранённым картинкам и пересжимает те, что того стоят.
const MAX_DIMENSION = 480;
const JPEG_QUALITY = 82;
// Файлы легче этого порога уже не переживём — трогать их незачем.
const OPTIMIZE_SKIP_UNDER_BYTES = 60 * 1024;

async function recompress(
  bytes: Uint8Array,
  contentTypeHint: string
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const image = await Image.decode(bytes);
    let resized = false;
    if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
      if (image.width >= image.height) image.resize(MAX_DIMENSION, Image.RESIZE_AUTO);
      else image.resize(Image.RESIZE_AUTO, MAX_DIMENSION);
      resized = true;
    }
    const isPng = contentTypeHint === 'image/png';
    const outBytes = isPng ? await image.encode() : await image.encodeJPEG(JPEG_QUALITY);
    // Не изменили размеры и пересжатая версия не легче оригинала —
    // пересжимать не имело смысла, оставляем как есть.
    if (!resized && outBytes.length >= bytes.length) return null;
    return { bytes: outBytes, contentType: isPng ? 'image/png' : 'image/jpeg', ext: isPng ? 'png' : 'jpg' };
  } catch {
    return null; // битый/нераспознанный формат — не трогаем
  }
}

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
      // своей картинки — берём картинку с любого уже существующего товара
      // той же соцсети (обычно это и есть логотип соцсети, один раз
      // загруженный админом вручную). Экономит повторную загрузку одной и
      // той же картинки на каждый новый аккаунт этой соцсети — иконка
      // "наследуется" автоматически. Явно переданная imageUrl (например,
      // при редактировании с уже загруженным фото) в приоритете и это
      // правило не переопределяет.
      let imageUrl = body.imageUrl ?? null;
      if (!imageUrl && body.kind === 'account' && body.network) {
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
        stock: body.kind === 'account' ? body.stock ?? 0 : null,
        license: body.kind === 'one-time' ? body.license ?? null : null,
        period: body.kind === 'subscription' ? body.period ?? 'мес' : null,
        period_label: body.kind === 'subscription' ? body.periodLabel ?? '1 месяц' : null,
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
    // файл (1 zip = 1 аккаунт). Доступно только для kind='account'.
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
      if (product.kind !== 'account') {
        return withCors({ error: 'Загрузка .zip доступна только для товаров типа "Аккаунт"' }, 400);
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

    // Пересжать уже загруженные картинки товаров и категорий (см.
    // комментарий у recompress() наверху файла). Идём по каждой ссылке
    // последовательно: скачиваем, при необходимости сжимаем, заливаем
    // как новый файл в тот же bucket и переключаем image_url в БД на
    // него. Старый файл в Storage не трогаем (не критично место, зато
    // исключён риск сломать что-то, что на него ещё смотрит).
    if (action === 'optimize-images') {
      const { data: prods, error: prodsError } = await supabase.from('products').select('id, image_url');
      if (prodsError) return withCors({ error: prodsError.message }, 500);
      const { data: cats, error: catsError } = await supabase.from('categories').select('id, image_url');
      if (catsError) return withCors({ error: catsError.message }, 500);

      const targets: { table: 'products' | 'categories'; id: string; url: string }[] = [];
      for (const p of prods ?? []) if (p.image_url) targets.push({ table: 'products', id: p.id, url: p.image_url });
      for (const c of cats ?? []) if (c.image_url) targets.push({ table: 'categories', id: c.id, url: c.image_url });

      let optimized = 0;
      let skipped = 0;
      let failed = 0;
      let bytesBefore = 0;
      let bytesAfter = 0;

      for (const t of targets) {
        try {
          const res = await fetch(t.url);
          if (!res.ok) {
            failed++;
            continue;
          }
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const original = new Uint8Array(await res.arrayBuffer());
          if (original.length <= OPTIMIZE_SKIP_UNDER_BYTES) {
            skipped++;
            continue;
          }

          const result = await recompress(original, contentType);
          if (!result) {
            skipped++;
            continue;
          }

          const path = `${crypto.randomUUID()}.${result.ext}`;
          const { error: upErr } = await supabase.storage
            .from('product-images')
            .upload(path, result.bytes, { contentType: result.contentType, cacheControl: '31536000' });
          if (upErr) {
            failed++;
            continue;
          }

          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          const { error: dbErr } = await supabase.from(t.table).update({ image_url: pub.publicUrl }).eq('id', t.id);
          if (dbErr) {
            failed++;
            continue;
          }

          bytesBefore += original.length;
          bytesAfter += result.bytes.length;
          optimized++;
        } catch {
          failed++;
        }
      }

      return withCors({ total: targets.length, optimized, skipped, failed, bytesBefore, bytesAfter });
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
