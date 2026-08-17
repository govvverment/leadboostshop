-- ============================================================
-- Пополнение баланса через USDT (TRC20). TRC20 не поддерживает memo,
-- поэтому платёж от конкретного пользователя опознаём по УНИКАЛЬНОЙ
-- сумме (например 20.0034 вместо ровных 20) — этот трюк уже
-- обсуждался с пользователем.
-- ============================================================
create table if not exists deposit_requests (
  id               text primary key,
  user_id          bigint not null references users(telegram_id),
  requested_amount numeric(10,2) not null,
  unique_amount    numeric(12,6) not null,
  wallet_address   text not null,
  status           text not null default 'pending', -- pending | confirmed | expired
  tx_hash          text unique,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  confirmed_at     timestamptz
);
alter table deposit_requests enable row level security;
-- Публичных политик нет — доступ только через Edge Functions с service_role.

-- ------------------------------------------------------------
-- Создать заявку на пополнение с уникальной суммой. Проверяем
-- уникальность только среди ДЕЙСТВУЮЩИХ (pending, не истёкших)
-- заявок — после подтверждения/истечения сумма снова свободна.
-- ------------------------------------------------------------
create or replace function create_deposit_request(
  p_telegram_id bigint,
  p_amount numeric,
  p_wallet_address text
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

  insert into deposit_requests (id, user_id, requested_amount, unique_amount, wallet_address, status, expires_at)
  values (v_id, p_telegram_id, round(p_amount, 2), v_unique, p_wallet_address, 'pending', v_expires);

  return jsonb_build_object(
    'requestId', v_id,
    'uniqueAmount', v_unique,
    'walletAddress', p_wallet_address,
    'expiresAt', v_expires
  );
end;
$$;

revoke execute on function create_deposit_request from anon, authenticated;

-- ------------------------------------------------------------
-- Подтвердить пополнение по найденной в блокчейне транзакции.
-- Атомарно: баланс + история + статус заявки. tx_hash уникален
-- на уровне таблицы — та же транзакция не может зачислиться дважды.
-- ------------------------------------------------------------
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
          'Пополнение баланса', 'USDT · TRC20', v_req.unique_amount, 'success');

  return jsonb_build_object('status', 'confirmed', 'amount', v_req.unique_amount);
end;
$$;

revoke execute on function confirm_deposit from anon, authenticated;
