-- Миграция: фото товара в "Истории баланса".
-- 1) Добавляем product_id в balance_history.
-- 2) purchase_product() теперь записывает product_id в каждую запись истории.
-- 3) get_account_snapshot() подтягивает image_url товара в поле imageUrl.
--
-- Старые записи (до миграции) останутся с product_id = null — для них
-- просто не будет фото (фронтенд это уже умеет: падает обратно на иконку).

alter table balance_history add column if not exists product_id text references products(id);

-- ------------------------------------------------------------
-- purchase_product — та же логика, только в каждый insert into
-- balance_history добавлен product_id = p_product_id.
-- ------------------------------------------------------------
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
      returning ai.login, ai.password, ai.extra, ai.file_path, ai.file_name
    )
    select jsonb_agg(jsonb_build_object(
      'login', login, 'password', password, 'extra', extra,
      'filePath', file_path, 'fileName', file_name
    ))
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, qty, price, status, credentials, geo, geo_flag, platform, type)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, p_qty, v_total, 'paid', v_credentials,
            v_product.geo, v_product.geo_flag, v_product.platform, v_product.type);

    insert into balance_history (id, user_id, type, title, meta, amount, status, product_id)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, p_qty || ' шт.', -v_total, 'success', p_product_id);

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

    insert into balance_history (id, user_id, type, title, meta, amount, status, product_id)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, null, -v_total, 'success', p_product_id);

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

    insert into balance_history (id, user_id, type, title, meta, amount, status, product_id)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'subscription',
            v_product.title, null, -v_total, 'success', p_product_id);

  end if;

  if v_referred_by is not null then
    v_referral_amount := round(v_total * referral_percent(), 2);
    if v_referral_amount > 0 then
      update users set balance = balance + v_referral_amount where telegram_id = v_referred_by;
      insert into referral_earnings (id, referrer_id, referred_user_id, purchase_id, amount)
      values ('r_' || replace(gen_random_uuid()::text, '-', ''), v_referred_by, p_telegram_id, v_purchase_id, v_referral_amount);
      insert into balance_history (id, user_id, type, title, meta, amount, status, product_id)
      values ('h_' || replace(gen_random_uuid()::text, '-', ''), v_referred_by, 'referral',
              'Реферальное вознаграждение', v_product.title, v_referral_amount, 'success', p_product_id);
    end if;
  end if;

  return jsonb_build_object('status', 'success', 'total', v_total);
end;
$$;

revoke execute on function purchase_product from anon, authenticated;

-- ------------------------------------------------------------
-- get_account_snapshot — тот же JSON, но balanceHistory теперь
-- содержит imageUrl (фото товара, left join — чтобы старые записи
-- без product_id и пополнения баланса не выпадали из списка).
-- ------------------------------------------------------------
create or replace function get_account_snapshot(p_telegram_id bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'balance', (select balance from users where telegram_id = p_telegram_id),
    'purchases', coalesce((
      select jsonb_agg(row_to_json(p) order by p.created_at desc)
      from purchases p where p.user_id = p_telegram_id
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(row_to_json(s) order by s.created_at desc)
      from subscriptions s where s.user_id = p_telegram_id
    ), '[]'::jsonb),
    'balanceHistory', coalesce((
      select jsonb_agg(
        (to_jsonb(h) || jsonb_build_object('imageUrl', pr.image_url))
        order by h.created_at desc
      )
      from balance_history h
      left join products pr on pr.id = h.product_id
      where h.user_id = p_telegram_id
      limit 50
    ), '[]'::jsonb),
    'referral', jsonb_build_object(
      'invited', (select count(*) from users where referred_by = p_telegram_id),
      'earned', coalesce((select sum(amount) from referral_earnings where referrer_id = p_telegram_id), 0),
      'list', coalesce((
        select jsonb_agg(jsonb_build_object(
          'username', u.username, 'firstName', u.first_name,
          'earned', coalesce((select sum(amount) from referral_earnings re where re.referrer_id = p_telegram_id and re.referred_user_id = u.telegram_id), 0)
        ))
        from users u where u.referred_by = p_telegram_id
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;
