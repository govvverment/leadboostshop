-- ============================================================
-- storeSALE — полная схема базы данных, с нуля.
-- Применять в Supabase → SQL Editor → New query → вставить целиком → Run,
-- в новом, пустом проекте. Дальше применить sql/inventory.sql (если он
-- ещё не слит сюда — здесь уже всё актуальное, включая склад).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Пользователи (создаются автоматически при первом открытии
-- мини-приложения — см. функцию sync_telegram_user ниже)
-- ------------------------------------------------------------
create table if not exists users (
  telegram_id  bigint primary key,
  username     text,
  first_name   text,
  photo_url    text,
  balance      numeric(10,2) not null default 0,
  referred_by  bigint references users(telegram_id),
  created_at   timestamptz not null default now()
);
alter table users enable row level security;
-- Публичных политик нет — доступ только через Edge Functions (service_role).

-- ------------------------------------------------------------
-- Категории — создаются, удаляются (только если пустые — см.
-- delete-category в admin-products) и получают картинку через админку.
-- Стартово — две (Аккаунты / Технические решения), см. seed ниже.
-- ------------------------------------------------------------
create table if not exists categories (
  id         text primary key,
  title      text not null,
  image_url  text
);
alter table categories enable row level security;
create policy "Публичное чтение категорий" on categories for select using (true);

insert into categories (id, title) values
  ('accounts', 'Аккаунты'),
  ('solutions', 'Технические решения')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Товары
-- ------------------------------------------------------------
create table if not exists products (
  id            text primary key,
  category_id   text not null references categories(id),
  kind          text not null, -- account | one-time | subscription
  title         text not null,
  description   text,
  image_url     text,
  price         numeric(10,2) not null,
  geo           text,
  geo_flag      text,
  platform      text,
  type          text,
  network       text, -- соцсеть (Instagram/Telegram/...) для kind='account' — фильтр "Соцсеть" в каталоге
  stock         integer, -- используется только для kind, не завязанных на склад (сейчас — фактически не используется, живой остаток считается из account_inventory)
  license       text,
  period        text,
  period_label  text,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table products enable row level security;
create policy "Публичное чтение активных товаров" on products for select using (is_archived = false);

-- ------------------------------------------------------------
-- Покупки (kind='account' и kind='one-time' — у подписок свой учёт
-- ниже, в subscriptions)
-- ------------------------------------------------------------
create table if not exists purchases (
  id          text primary key,
  user_id     bigint not null references users(telegram_id),
  product_id  text not null references products(id),
  title       text not null,
  kind        text not null,
  qty         integer,
  price       numeric(10,2) not null,
  status      text not null default 'paid',
  file_name   text, -- legacy, не используется в текущей версии
  file_meta   text, -- legacy, не используется в текущей версии
  credentials jsonb, -- снимок выданных логин/пароль или ссылки на момент покупки
  -- Снимок характеристик товара НА МОМЕНТ покупки — намеренно
  -- дублируется из products, а не читается оттуда "живьём": если
  -- товар потом изменится или уйдёт в архив, у уже купленного всё
  -- равно должны остаться правильные GEO/платформа/тип на экране.
  geo         text,
  geo_flag    text,
  platform    text,
  type        text,
  license     text,
  created_at  timestamptz not null default now()
);
alter table purchases enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- Подписки
-- ------------------------------------------------------------
create table if not exists subscriptions (
  id                       text primary key,
  user_id                  bigint not null references users(telegram_id),
  product_id               text not null references products(id),
  title                    text not null,
  price                    numeric(10,2) not null,
  period                   text,
  period_label             text,
  status                   text not null default 'active',
  active_until             timestamptz,
  access_link              text,
  access_key               text,
  access_instructions_url  text,
  platform                 text, -- снимок с товара на момент оформления/продления, см. purchases выше
  type                     text,
  created_at               timestamptz not null default now()
);
alter table subscriptions enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- История баланса (пополнения, покупки, реферальные начисления)
-- ------------------------------------------------------------
create table if not exists balance_history (
  id          text primary key,
  user_id     bigint not null references users(telegram_id),
  type        text not null, -- deposit | purchase | subscription | referral
  title       text not null,
  meta        text,
  amount      numeric(10,2) not null,
  status      text not null default 'success',
  created_at  timestamptz not null default now()
);
alter table balance_history enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- Реферальные начисления (журнал — сколько и с чьей покупки)
-- ------------------------------------------------------------
create table if not exists referral_earnings (
  id                 text primary key,
  referrer_id        bigint not null references users(telegram_id),
  referred_user_id   bigint not null references users(telegram_id),
  purchase_id        text references purchases(id),
  amount             numeric(10,2) not null,
  created_at         timestamptz not null default now()
);
alter table referral_earnings enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- Сессии админки (простой пароль на backend, не связан с users)
-- ------------------------------------------------------------
create table if not exists admin_sessions (
  token       text primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
alter table admin_sessions enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- Склад — одна строка = один настоящий аккаунт (login/password) ИЛИ
-- одна ссылка на скачивание (link, для kind='one-time'/'subscription').
-- Реальные данные НИКОГДА не читаются напрямую через anon-ключ, только
-- через Edge Functions (service_role), и то — покупателю выдаётся
-- ровно его строка, остальным доступа нет вообще.
-- ------------------------------------------------------------
create table if not exists account_inventory (
  id           text primary key,
  product_id   text not null references products(id),
  login        text,
  password     text,
  extra        text, -- необязательное доп. поле (email восстановления / ключ активации)
  link         text, -- для one-time/subscription — ссылка на скачивание
  instructions_url text, -- необязательная ссылка на инструкцию (для one-time/subscription)
  file_path    text, -- путь к .zip-файлу в приватном storage-бакете account-files —
                      -- второй способ выдачи аккаунта (доп. к login/password), 1 zip = 1 аккаунт
  file_name    text, -- оригинальное имя загруженного .zip, для красивого имени при скачивании
  status       text not null default 'available', -- available | sold
  purchase_id  text references purchases(id) deferrable initially deferred,
  created_at   timestamptz not null default now(),
  sold_at      timestamptz
);
alter table account_inventory enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ------------------------------------------------------------
-- Заявки на пополнение баланса (USDT). Уникальная сумма — способ
-- опознать чей платёж, раз в TRC20/ERC20/BEP20 нет поля-комментария.
-- ------------------------------------------------------------
create table if not exists deposit_requests (
  id               text primary key,
  user_id          bigint not null references users(telegram_id),
  requested_amount numeric(10,2) not null,
  unique_amount    numeric(12,6) not null,
  wallet_address   text not null,
  network          text not null default 'TRC20', -- TRC20 | ERC20 | BEP20
  status           text not null default 'pending', -- pending | confirmed | expired
  tx_hash          text unique,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  confirmed_at     timestamptz
);
alter table deposit_requests enable row level security;
-- Публичных политик нет — доступ только через Edge Functions.

-- ============================================================
-- Витрины (публично читаемые VIEW — считают живые данные из
-- закрытых таблиц выше, сами закрытые таблицы напрямую недоступны)
-- ============================================================

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
  end as sales_count
from products p
where p.is_archived = false;

grant select on products_with_stock to anon, authenticated;

create or replace view recent_restocks as
select
  ai.product_id,
  p.title, p.image_url, p.geo, p.geo_flag, p.platform, p.price,
  ai.created_at as restocked_at,
  count(*)::int as qty_added
from account_inventory ai
join products p on p.id = ai.product_id
where p.is_archived = false and p.kind = 'account'
group by ai.product_id, p.title, p.image_url, p.geo, p.geo_flag, p.platform, p.price, ai.created_at
order by ai.created_at desc;

grant select on recent_restocks to anon, authenticated;

-- ============================================================
-- Функции
-- ============================================================

-- Процент реферального вознаграждения — 5% с каждой покупки
-- приглашённого, постоянно (не только с первой).
create or replace function referral_percent() returns numeric
language sql immutable
as $$ select 0.05 $$;

-- Регистрация/обновление пользователя при каждом открытии мини-аппа.
-- Реферал привязывается только при ПЕРВОЙ регистрации.
create or replace function sync_telegram_user(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_photo_url text,
  p_referrer_id bigint default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_exists boolean := false;
begin
  if p_referrer_id is not null and p_referrer_id != p_telegram_id then
    select exists(select 1 from users where telegram_id = p_referrer_id) into v_referrer_exists;
  end if;

  insert into users (telegram_id, username, first_name, photo_url, referred_by)
  values (
    p_telegram_id, p_username, p_first_name, p_photo_url,
    case when v_referrer_exists then p_referrer_id else null end
  )
  on conflict (telegram_id) do update
    set username = excluded.username,
        first_name = excluded.first_name,
        photo_url = excluded.photo_url;
    -- referred_by сознательно не обновляется при повторном заходе
end;
$$;

-- Снимок аккаунта — баланс, покупки, подписки, история, рефералы —
-- для экрана "Профиль" и всех связанных.
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
      select jsonb_agg(row_to_json(h) order by h.created_at desc)
      from balance_history h where h.user_id = p_telegram_id
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

-- Покупка — атомарная транзакция: списание баланса, выдача товара
-- (аккаунт/ссылка со склада), реферальное начисление.
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
    -- filePath/fileName — второй способ выдачи (zip-файл, см. account_inventory.file_path).
    -- У старых/текстовых строк они null и просто не попадают в объект
    -- ниже — существующий формат {login,password,extra} не меняется.
    select jsonb_agg(jsonb_build_object(
      'login', login, 'password', password, 'extra', extra,
      'filePath', file_path, 'fileName', file_name
    ))
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
    -- Забираем свежую свободную строку склада (ссылка + доп.инфо +
    -- инструкция) — при каждой подписке И при каждом продлении.
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

-- Пополнение баланса: создать заявку с уникальной суммой.
create or replace function create_deposit_request(
  p_telegram_id bigint,
  p_amount numeric,
  p_wallet_address text,
  p_network text default 'TRC20'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_unique numeric(12,6);
  v_attempt int := 0;
  v_expires timestamptz;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('error', 'Сумма должна быть положительным числом');
  end if;

  loop
    v_unique := round(p_amount, 2) + (floor(random() * 98 + 1)::numeric / 10000);
    exit when not exists (
      select 1 from deposit_requests
      where unique_amount = v_unique and status = 'pending' and expires_at > now()
    );
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      return jsonb_build_object('error', 'Не удалось подобрать уникальную сумму, попробуйте ещё раз');
    end if;
  end loop;

  v_id := 'd_' || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '15 minutes';

  insert into deposit_requests (id, user_id, requested_amount, unique_amount, wallet_address, network, status, expires_at)
  values (v_id, p_telegram_id, round(p_amount, 2), v_unique, p_wallet_address, p_network, 'pending', v_expires);

  return jsonb_build_object(
    'requestId', v_id,
    'uniqueAmount', v_unique,
    'walletAddress', p_wallet_address,
    'network', p_network,
    'expiresAt', v_expires
  );
end;
$$;

revoke execute on function create_deposit_request from anon, authenticated;

-- Пополнение баланса: подтвердить по найденной в блокчейне транзакции.
create or replace function confirm_deposit(
  p_request_id text,
  p_tx_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req deposit_requests%rowtype;
begin
  select * into v_req from deposit_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_req.status = 'confirmed' then
    return jsonb_build_object('status', 'confirmed', 'amount', v_req.unique_amount);
  end if;

  if v_req.expires_at < now() then
    update deposit_requests set status = 'expired' where id = p_request_id and status = 'pending';
    return jsonb_build_object('status', 'expired');
  end if;

  if exists (select 1 from deposit_requests where tx_hash = p_tx_hash) then
    return jsonb_build_object('status', 'duplicate_tx');
  end if;

  update deposit_requests
  set status = 'confirmed', tx_hash = p_tx_hash, confirmed_at = now()
  where id = p_request_id;

  update users set balance = balance + v_req.unique_amount where telegram_id = v_req.user_id;

  insert into balance_history (id, user_id, type, title, meta, amount, status)
  values ('h_' || replace(gen_random_uuid()::text, '-', ''), v_req.user_id, 'deposit',
          'Пополнение баланса', 'USDT · ' || v_req.network, v_req.unique_amount, 'success');

  return jsonb_build_object('status', 'confirmed', 'amount', v_req.unique_amount);
end;
$$;

revoke execute on function confirm_deposit from anon, authenticated;

-- ============================================================
-- Хранилище картинок товаров и админская статистика
-- ============================================================

-- "public" = true — картинки должны открываться по прямой ссылке
-- кому угодно (это же витрина магазина). Загружать файлы можно
-- только через Edge Function (service_role), обычные посетители —
-- только смотреть.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Публичное чтение картинок товаров"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- "public" = false — это выданные покупателям .zip с данными аккаунтов,
-- никто посторонний не должен иметь к ним доступ по прямой ссылке.
-- Загрузка (админкой) и скачивание (покупателем, только своего файла)
-- идут исключительно через Edge Functions на service_role — публичных
-- policy на этот бакет нет и не должно быть.
insert into storage.buckets (id, name, public)
values ('account-files', 'account-files', false)
on conflict (id) do nothing;

create or replace function admin_stats_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total_users int;
  v_total_orders int;
  v_revenue numeric;
  v_active_subs int;
  v_deposited numeric;
  v_referral_payout numeric;
begin
  select count(*) into v_total_users from users;

  select
    (select count(*) from purchases) + (select count(*) from subscriptions)
  into v_total_orders;

  select
    coalesce((select sum(price) from purchases where status = 'paid'), 0)
    + coalesce((select sum(price) from subscriptions), 0)
  into v_revenue;

  select count(*) into v_active_subs from subscriptions where status = 'active';

  select coalesce(sum(amount), 0) into v_deposited
    from balance_history where type = 'deposit' and status = 'success';

  select coalesce(sum(amount), 0) into v_referral_payout from referral_earnings;

  return jsonb_build_object(
    'totalUsers', v_total_users,
    'totalOrders', v_total_orders,
    'revenue', round(v_revenue, 2),
    'activeSubscriptions', v_active_subs,
    'totalDeposited', round(v_deposited, 2),
    'referralPayout', round(v_referral_payout, 2)
  );
end;
$$;

create or replace function admin_revenue_by_day(p_days int default 14) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'revenue', revenue) order by day), '[]'::jsonb)
  into v_result
  from (
    select date(created_at) as day, sum(price) as revenue
    from (
      select created_at, price from purchases where status = 'paid'
      union all
      select created_at, price from subscriptions
    ) t
    where date(created_at) >= current_date - (p_days || ' days')::interval
    group by day
  ) grouped;

  return v_result;
end;
$$;

create or replace function admin_top_products() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select product_id, title, count(*) as orders, round(sum(price), 2) as revenue
    from (
      select product_id, title, price from purchases where status = 'paid'
      union all
      select product_id, title, price from subscriptions
    ) t
    group by product_id, title
    order by revenue desc
    limit 10
  ) t;
  return v_result;
end;
$$;

create or replace function admin_top_referrers() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select referrer_id, count(distinct referred_user_id) as invited, round(sum(amount), 2) as earned
    from referral_earnings
    group by referrer_id
    order by earned desc
    limit 10
  ) t;
  return v_result;
end;
$$;

revoke execute on function admin_stats_overview from anon, authenticated;
revoke execute on function admin_revenue_by_day from anon, authenticated;
revoke execute on function admin_top_products from anon, authenticated;
revoke execute on function admin_top_referrers from anon, authenticated;
