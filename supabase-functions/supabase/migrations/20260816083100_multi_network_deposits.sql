-- ============================================================
-- Пополнение теперь в трёх сетях USDT: TRC20 (уже было), ERC20 и
-- BEP20 (обе EVM-совместимые, у обеих один и тот же формат адреса
-- 0x... — используем один кошелёк на обе). Логика уникальной суммы
-- та же, просто нужно помнить, В КАКОЙ сети ждём перевод.
-- ============================================================
alter table deposit_requests add column if not exists network text not null default 'TRC20';

-- Старая сигнатура (3 параметра) заменяется новой (4-й — сеть) —
-- create or replace не подменяет функцию при другом числе аргументов,
-- он бы просто добавил перегрузку, поэтому явно удаляем старую.
drop function if exists create_deposit_request(bigint, numeric, text);

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

  -- Уникальность суммы держим ОБЩЕЙ по всем сетям сразу — так проще
  -- (одна и та же цифра не может ждать перевода одновременно в двух
  -- сетях, меньше шанс перепутать).
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
