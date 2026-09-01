-- Отдельное поле "Соцсеть" для товаров-аккаунтов (Instagram/Facebook/TikTok
-- и т.п.) — отдельно от "Платформа" (Android/iOS/...) и "Тип"
-- (Aged/Autorer/...), которые остаются как есть и никуда не переносятся.
-- Используется для нового третьего фильтра в каталоге (наравне с GEO),
-- только в категориях, где у товаров вообще заполнено GEO (т.е. на
-- практике — только в "Аккаунтах"), см. CategoryList.jsx.
alter table products add column if not exists network text;

-- products_with_stock — публичная витрина (её и только её читает магазин
-- напрямую, см. mini-app/src/supabase/api.js: fetchProducts()). Вьюха
-- собрана с явным списком колонок (не select *), поэтому новое поле само
-- по себе через неё не пройдёт — переопределяем вьюху целиком, один в
-- один как в 20260815144956_subscription_links.sql, с p.network.
--
-- ВАЖНО: PostgreSQL допускает CREATE OR REPLACE VIEW, только если все уже
-- существующие колонки сохраняют своё имя и порядковую позицию — новую
-- колонку можно только ДОБАВИТЬ САМОЙ ПОСЛЕДНЕЙ в списке select. Поэтому
-- p.network стоит здесь в самом конце (после sales_count), а не рядом с
-- geo/platform/type, где он был в первой версии этой миграции — там он
-- сдвигал "license" на позицию, где раньше был "type", и ровно это Postgres
-- и не разрешает (ошибка 42P16: "cannot change name of view column").
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
  p.network
from products p
where p.is_archived = false;

grant select on products_with_stock to anon, authenticated;
