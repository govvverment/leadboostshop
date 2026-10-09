-- Правки shop (12.09.2026), пакет из нескольких фич:
--
-- 1) Склад .zip-файлами (1 zip = 1 единица) — уже был реализован раньше
--    (admin-upload-account-file, download-account-file, account_inventory
--    .file_path/.file_name), НО purchase_product() ни разу не был обновлён,
--    чтобы реально отдавать file_path/file_name покупателю: при покупке
--    строки склада с file_path (а не login/password/link) функция ниже
--    возвращала пустой jsonb-объект в credentials, а download-account-file
--    соответственно никогда не находил нужный файл. Чиним это здесь —
--    заодно снимаем ограничение "только kind='account'" и для
--    kind='one-time' (по этому пути идёт категория "Технические решения"),
--    см. также admin-products/index.ts (add-file-inventory) и
--    download-account-file/index.ts, где то же ограничение снято отдельно.
--
-- 2) Заказ с направлением к менеджеру: у товара новый флажок
--    manager_order — если включён, при покупке (kind IN ('account',
--    'one-time','subscription')) вместе со списанием баланса как обычно
--    генерируется уникальный номер заказа (order_number), который видно
--    и админу (в списке заказов), и самому покупателю (в деталях покупки/
--    подписки) — с инструкцией писать этот номер менеджеру в личку.

alter table products add column if not exists manager_order boolean not null default false;
alter table purchases add column if not exists order_number text;
alter table subscriptions add column if not exists order_number text;

create sequence if not exists order_number_seq start 1000;

-- products_with_stock — переопределяем ещё раз, добавляя manager_order
-- САМЫМ ПОСЛЕДНИМ в списке select (см. подробное объяснение про
-- CREATE OR REPLACE VIEW и порядок колонок в 20260825120000_add_account_network.sql
-- — тут та же причина, тот же приём).
create or replace view products_with_stock as
select
  p.id, p.category_id, p.kind, p.title, p.description, p.image_url, p.price,
  p.geo, p.geo_flag, p.platform, p.type, p.license, p.period, p.period_label,
  p.is_archived, p.created_at,
  case
    when p.kind in ('account', 'one-time', 'subscription') then (
      select count(*)::int from account_inventory ai
      where ai.product_id = p.id and ai.status = 'available'
    )
    else p.stock
  end as stock,
  case
    when p.kind = 'subscription' then (
      select count(*)::int from subscriptions s where s.product_id = p.id
    )
    when p.kind = 'account' then (
      select coalesce(sum(pu.qty), 0)::int from purchases pu where pu.product_id = p.id
    )
    else (
      select count(*)::int from purchases pu where pu.product_id = p.id
    )
  end as sales_count,
  p.network,
  p.manager_order
from products p
where p.is_archived = false;

grant select on products_with_stock to anon, authenticated;

create or replace function purchase_product(
  p_telegram_id bigint,
  p_product_id text,
  p_qty integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products%rowtype;
  v_balance numeric(10,2);
  v_total numeric(10,2);
  v_referred_by bigint;
  v_referral_amount numeric(10,2);
  v_purchase_id text;
  v_sub_id text;
  v_existing_sub subscriptions%rowtype;
  v_available int;
  v_credentials jsonb;
  v_link text;
  v_extra text;
  v_instructions_url text;
  v_file_path text;
  v_file_name text;
  v_order_number text;
begin
  select * into v_product from products where id = p_product_id and is_archived = false;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select balance, referred_by into v_balance, v_referred_by
  from users where telegram_id = p_telegram_id;
  if not found then
    return jsonb_build_object('status', 'user_not_found');
  end if;

  if v_product.kind in ('account', 'one-time', 'subscription') then
    select count(*) into v_available from account_inventory
      where product_id = p_product_id and status = 'available';

    if p_qty < 1 or v_available < p_qty then
      return jsonb_build_object('status', 'out_of_stock', 'available', v_available);
    end if;
    v_total := v_product.price * (case when v_product.kind = 'account' then p_qty else 1 end);
  else
    v_total := v_product.price;
  end if;

  if v_balance < v_total then
    return jsonb_build_object('status', 'insufficient', 'total', v_total, 'balance', v_balance);
  end if;

  update users set balance = balance - v_total where telegram_id = p_telegram_id;

  -- Номер заказа для товаров с галочкой "Направлять к менеджеру" —
  -- генерируется независимо от kind, баланс списывается как обычно
  -- (это просто доп. маркер + инструкция покупателю, не отдельный флоу).
  if v_product.manager_order then
    v_order_number := 'ORD-' || nextval('order_number_seq')::text;
  end if;

  if v_product.kind = 'account' then
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');

    -- Строка склада для account может быть: file_path (.zip, 1 zip = 1
    -- аккаунт), одной ссылкой (link), либо login/password[/extra] —
    -- отдаём покупателю ровно то, что реально было на складе.
    with picked as (
      select id from account_inventory
      where product_id = p_product_id and status = 'available'
      order by created_at
      limit p_qty
      for update skip locked
    ),
    updated as (
      update account_inventory ai
      set status = 'sold', purchase_id = v_purchase_id, sold_at = now()
      from picked
      where ai.id = picked.id
      returning ai.login, ai.password, ai.extra, ai.link, ai.file_path, ai.file_name
    )
    select jsonb_agg(
      case
        when file_path is not null then jsonb_build_object('filePath', file_path, 'fileName', file_name)
        when link is not null then jsonb_build_object('link', link)
        else jsonb_build_object('login', login, 'password', password, 'extra', extra)
      end
    )
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, qty, price, status, credentials, geo, geo_flag, platform, type, order_number)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, p_qty, v_total, 'paid', v_credentials,
            v_product.geo, v_product.geo_flag, v_product.platform, v_product.type, v_order_number);

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, p_qty || ' шт.', -v_total, 'success');

  elsif v_product.kind = 'one-time' then
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');

    with picked as (
      select id from account_inventory
      where product_id = p_product_id and status = 'available'
      order by created_at
      limit 1
      for update skip locked
    ),
    updated as (
      update account_inventory ai
      set status = 'sold', purchase_id = v_purchase_id, sold_at = now()
      from picked
      where ai.id = picked.id
      returning ai.link, ai.extra, ai.instructions_url, ai.file_path, ai.file_name
    )
    select jsonb_agg(
      case
        when file_path is not null then jsonb_build_object('filePath', file_path, 'fileName', file_name, 'extra', extra, 'instructionsUrl', instructions_url)
        else jsonb_build_object('link', link, 'extra', extra, 'instructionsUrl', instructions_url)
      end
    )
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, price, status, credentials, platform, type, license, order_number)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, v_total, 'paid', v_credentials,
            v_product.platform, v_product.type, v_product.license, v_order_number);

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, null, -v_total, 'success');

  elsif v_product.kind = 'subscription' then
    with picked as (
      select id from account_inventory
      where product_id = p_product_id and status = 'available'
      order by created_at
      limit 1
      for update skip locked
    ),
    updated as (
      update account_inventory ai
      set status = 'sold', sold_at = now()
      from picked
      where ai.id = picked.id
      returning ai.link, ai.extra, ai.instructions_url
    )
    select link, extra, instructions_url into v_link, v_extra, v_instructions_url from updated;

    select * into v_existing_sub from subscriptions
      where user_id = p_telegram_id and product_id = p_product_id
      limit 1;

    if found then
      update subscriptions
      set status = 'active', active_until = now() + interval '1 month',
          access_link = v_link, access_key = coalesce(v_extra, access_key),
          access_instructions_url = coalesce(v_instructions_url, access_instructions_url),
          platform = v_product.platform, type = v_product.type,
          order_number = coalesce(v_order_number, order_number)
      where id = v_existing_sub.id;
    else
      v_sub_id := 's_' || replace(gen_random_uuid()::text, '-', '');
      insert into subscriptions (id, user_id, product_id, title, price, period, period_label, status, active_until, access_link, access_key, access_instructions_url, platform, type, order_number)
      values (
        v_sub_id, p_telegram_id, p_product_id, v_product.title, v_product.price,
        v_product.period, v_product.period_label, 'active', now() + interval '1 month',
        v_link,
        coalesce(v_extra, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
        v_instructions_url, v_product.platform, v_product.type, v_order_number
      );
    end if;

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'subscription',
            v_product.title, null, -v_total, 'success');

  end if;

  if v_referred_by is not null then
    v_referral_amount := round(v_total * referral_percent(), 2);
    if v_referral_amount > 0 then
      update users set balance = balance + v_referral_amount where telegram_id = v_referred_by;
      insert into referral_earnings (id, referrer_id, referred_user_id, purchase_id, amount)
      values ('r_' || replace(gen_random_uuid()::text, '-', ''), v_referred_by, p_telegram_id, v_purchase_id, v_referral_amount);
      insert into balance_history (id, user_id, type, title, meta, amount, status)
      values ('h_' || replace(gen_random_uuid()::text, '-', ''), v_referred_by, 'referral',
              'Реферальное вознаграждение', v_product.title, v_referral_amount, 'success');
    end if;
  end if;

  return jsonb_build_object('status', 'success', 'total', v_total, 'orderNumber', v_order_number);
end;
$$;

revoke execute on function purchase_product from anon, authenticated;
