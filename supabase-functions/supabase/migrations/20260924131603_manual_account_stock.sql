-- Ручное количество для товаров-аккаунтов (без реального склада) —
-- нужно для позиций, которые админ хочет выдавать сам, лично, в личных
-- сообщениях, а не через login/password/zip на складе. Раньше остаток
-- для kind='account' СТРОГО считался по реальным строкам в
-- account_inventory — продать товар без реального склада было нельзя
-- в принципе. Теперь у товара есть флажок manual_stock: если он включён,
-- products.stock — это просто число, которое вводит админ руками, и
-- именно оно и уменьшается при покупке (никакого account_inventory).
-- Покупатель в этом случае не получает login/password — вместо этого (и
-- только в этом случае) ему ВСЕГДА выдаётся номер заказа и просьба
-- написать менеджеру (тот же механизм order_number, что и manager_order),
-- независимо от того, включена ли галочка "Заказ через менеджера" сама
-- по себе — раз выдачи нет, направление к менеджеру обязательно.

alter table products add column if not exists manual_stock boolean not null default false;

-- products_with_stock — переопределяем ещё раз, добавляя manual_stock
-- САМЫМ ПОСЛЕДНИМ в списке select (см. объяснение про CREATE OR REPLACE
-- VIEW и порядок колонок в 20260825120000_add_account_network.sql).
create or replace view products_with_stock as
select
  p.id, p.category_id, p.kind, p.title, p.description, p.image_url, p.price,
  p.geo, p.geo_flag, p.platform, p.type, p.license, p.period, p.period_label,
  p.is_archived, p.created_at,
  case
    when p.kind = 'account' and p.manual_stock then p.stock
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
  p.manager_order,
  p.manual_stock
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

  if v_product.kind = 'account' and v_product.manual_stock then
    -- Ручной склад: количество — просто число в products.stock, никакого
    -- account_inventory для этого товара может вообще не быть.
    v_available := v_product.stock;
    if p_qty < 1 or v_available < p_qty then
      return jsonb_build_object('status', 'out_of_stock', 'available', v_available);
    end if;
    v_total := v_product.price * p_qty;
  elsif v_product.kind in ('account', 'one-time', 'subscription') then
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

  -- Номер заказа для товаров с галочкой "Направлять к менеджеру" — а
  -- также ВСЕГДА для ручного склада (там просто нет реальной выдачи,
  -- значит менеджер обязателен, даже если галочку забыли поставить).
  if v_product.manager_order or v_product.manual_stock then
    v_order_number := 'ORD-' || nextval('order_number_seq')::text;
  end if;

  if v_product.kind = 'account' and v_product.manual_stock then
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');

    -- Атомарно уменьшаем ручной счётчик прямо тут же, с проверкой в
    -- WHERE — защита от гонки при одновременных покупках (у настоящего
    -- склада её роль играет "for update skip locked" ниже по функции).
    -- Если кто-то успел раньше и товара уже не хватает — честно
    -- возвращаем деньги и статус "нет в наличии", а не создаём покупку
    -- без реальной выдачи.
    update products set stock = stock - p_qty
      where id = p_product_id and stock >= p_qty;
    if not found then
      update users set balance = balance + v_total where telegram_id = p_telegram_id;
      return jsonb_build_object('status', 'out_of_stock', 'available', 0);
    end if;

    insert into purchases (id, user_id, product_id, title, kind, qty, price, status, credentials, geo, geo_flag, platform, type, order_number)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, p_qty, v_total, 'paid', null,
            v_product.geo, v_product.geo_flag, v_product.platform, v_product.type, v_order_number);

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, p_qty || ' шт.', -v_total, 'success');

  elsif v_product.kind = 'account' then
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
