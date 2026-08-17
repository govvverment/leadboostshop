-- ============================================================
-- Часть 3: реальный склад аккаунтов (логин/пароль на каждый).
-- Применить в SQL Editor ПОСЛЕ schema.sql, seed.sql, functions.sql, admin.sql
-- ============================================================

-- ------------------------------------------------------------
-- Склад — одна строка = один настоящий аккаунт с доступами
-- ------------------------------------------------------------
create table if not exists account_inventory (
  id           text primary key,
  product_id   text not null references products(id),
  login        text not null,
  password     text not null,
  extra        text, -- необязательное доп. поле (почта восстановления и т.п.)
  status       text not null default 'available', -- available | sold
  purchase_id  text references purchases(id) deferrable initially deferred,
  created_at   timestamptz not null default now(),
  sold_at      timestamptz
);
alter table account_inventory enable row level security;
-- Публичных политик нет — реальные логины/пароли не должны быть видны
-- НИКОМУ напрямую через anon-ключ, только через Edge Function (админке,
-- и то только количество, не сами данные)

-- Снимок выданных покупателю данных прямо в самой покупке — так они
-- останутся доступны покупателю даже если запись на складе потом
-- почему-то изменится
alter table purchases add column if not exists credentials jsonb;

-- ------------------------------------------------------------
-- Публичный вид товаров — остаток для аккаунтов теперь считается
-- ЖИВЫМ (сколько реально свободно на складе), а не ручной цифрой.
-- Именно эту "витрину" должен читать mini-app вместо голой таблицы
-- products.
-- ------------------------------------------------------------
create or replace view products_with_stock as
select
  p.id, p.category_id, p.kind, p.title, p.description, p.image_url, p.price,
  p.geo, p.geo_flag, p.platform, p.type, p.license, p.period, p.period_label,
  p.is_archived, p.created_at,
  case
    when p.kind = 'account' then (
      select count(*)::int from account_inventory ai
      where ai.product_id = p.id and ai.status = 'available'
    )
    else p.stock
  end as stock
from products p
where p.is_archived = false;

grant select on products_with_stock to anon, authenticated;

-- ------------------------------------------------------------
-- Покупка — теперь реально забирает аккаунт со склада (не просто
-- уменьшает цифру), помечает его проданным, и сохраняет доступы
-- прямо в покупку.
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

  if v_product.kind = 'account' then
    select count(*) into v_available from account_inventory
      where product_id = p_product_id and status = 'available';

    if p_qty < 1 or v_available < p_qty then
      return jsonb_build_object('status', 'out_of_stock', 'available', v_available);
    end if;
    v_total := v_product.price * p_qty;
  else
    v_total := v_product.price;
  end if;

  if v_balance < v_total then
    return jsonb_build_object('status', 'insufficient', 'total', v_total, 'balance', v_balance);
  end if;

  update users set balance = balance - v_total where telegram_id = p_telegram_id;

  if v_product.kind = 'account' then
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');

    -- Забираем p_qty свободных аккаунтов со склада. "for update skip
    -- locked" — защита от гонки: если два покупателя одновременно
    -- жмут "Купить", они не получат один и тот же аккаунт дважды.
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
      returning ai.login, ai.password, ai.extra
    )
    select jsonb_agg(jsonb_build_object('login', login, 'password', password, 'extra', extra))
      into v_credentials
    from updated;

    insert into purchases (id, user_id, product_id, title, kind, qty, price, status, credentials)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, p_qty, v_total, 'paid', v_credentials);

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
            v_product.title, p_qty || ' шт.', -v_total, 'success');

  elsif v_product.kind = 'subscription' then
    select * into v_existing_sub from subscriptions
      where user_id = p_telegram_id and product_id = p_product_id
      limit 1;

    if found then
      update subscriptions set status = 'active', active_until = now() + interval '1 month'
      where id = v_existing_sub.id;
    else
      v_sub_id := 's_' || replace(gen_random_uuid()::text, '-', '');
      insert into subscriptions (id, user_id, product_id, title, price, period, period_label, status, active_until, access_link, access_key)
      values (
        v_sub_id, p_telegram_id, p_product_id, v_product.title, v_product.price,
        v_product.period, v_product.period_label, 'active', now() + interval '1 month',
        't.me/' || p_product_id || '_bot',
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
      );
    end if;

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'subscription',
            v_product.title, null, -v_total, 'success');

  else -- one-time
    v_purchase_id := 'p_' || replace(gen_random_uuid()::text, '-', '');
    insert into purchases (id, user_id, product_id, title, kind, price, status)
    values (v_purchase_id, p_telegram_id, p_product_id, v_product.title, v_product.kind, v_total, 'paid');

    insert into balance_history (id, user_id, type, title, meta, amount, status)
    values ('h_' || replace(gen_random_uuid()::text, '-', ''), p_telegram_id, 'purchase',
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
