-- ВАЖНО: этот файл не из официального архива обновления 24.08.2026 —
-- он написан отдельно, чтобы починить конфликт между вашей уже
-- работающей кастомизацией и этим обновлением.
--
-- У вас в проекте уже стояла миграция 20260820133000_account_links.sql,
-- которая научила purchase_product() для kind='account' отдавать
-- покупателю { link } вместо { login, password, extra }, если конкретная
-- строка склада была добавлена как одна ссылка (а не login:password).
-- Это активно используется — buildInventoryRows на бэкенде
-- (admin-products/index.ts) и сейчас продолжает поддерживать ввод
-- аккаунта одной ссылкой.
--
-- Архив обновления 24.08.2026 (файлы 20260823091200_access_instructions.sql
-- и 20260824070000_purchase_snapshot_fields.sql) был подготовлен от более
-- ранней версии purchase_product() — той, что была ДО account_links —
-- и полностью её перезаписывает (create or replace function). Если
-- применить эти два файла как есть, "ссылочные" аккаунты (kind='account'
-- со строкой-ссылкой на складе) после покупки начнут отдавать
-- пустые login/password вместо ссылки — то есть реальную регрессию
-- для уже работающего у вас магазина.
--
-- Этот файл — третий шаг: примените его СРАЗУ ПОСЛЕ двух миграций
-- из архива. Он ещё раз переопределяет purchase_product(), на этот раз
-- объединяя обе фичи: снимок GEO/платформы/типа/лицензии на момент
-- покупки + ссылку на инструкцию (из архива) И поддержку аккаунта-ссылки
-- (ваша кастомизация). Ничего в схеме не меняет, только функцию.

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

  if v_product.kind = 'account' then
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');

    -- Строка склада для account может быть либо login/password[/extra],
    -- либо одной ссылкой (link) — так добавлено в admin-products/index.ts.
    -- Отдаём покупателю то, что реально было на складе.
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
      returning ai.login, ai.password, ai.extra, ai.link
    )
    select jsonb_agg(
      case
        when link is not null then jsonb_build_object('link', link)
        else jsonb_build_object('login', login, 'password', password, 'extra', extra)
      end
    )
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, qty, price, status, credentials, geo, geo_flag, platform, type)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, p_qty, v_total, 'paid', v_credentials,
            v_product.geo, v_product.geo_flag, v_product.platform, v_product.type);

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
      returning ai.link, ai.extra, ai.instructions_url
    )
    select jsonb_agg(jsonb_build_object('link', link, 'extra', extra, 'instructionsUrl', instructions_url))
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, price, status, credentials, platform, type, license)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, v_total, 'paid', v_credentials,
            v_product.platform, v_product.type, v_product.license);

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
          platform = v_product.platform, type = v_product.type
      where id = v_existing_sub.id;
    else
      v_sub_id := 's_' || replace(gen_random_uuid()::text, '-', '');
      insert into subscriptions (id, user_id, product_id, title, price, period, period_label, status, active_until, access_link, access_key, access_instructions_url, platform, type)
      values (
        v_sub_id, p_telegram_id, p_product_id, v_product.title, v_product.price,
        v_product.period, v_product.period_label, 'active', now() + interval '1 month',
        v_link,
        coalesce(v_extra, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
        v_instructions_url, v_product.platform, v_product.type
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

  return jsonb_build_object('status', 'success', 'total', v_total);
end;
$$;

revoke execute on function purchase_product from anon, authenticated;
