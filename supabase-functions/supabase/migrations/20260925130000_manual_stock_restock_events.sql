-- Новостная лента ("recent_restocks") раньше строилась ИСКЛЮЧИТЕЛЬНО
-- из account_inventory (см. миграцию 20260815161654_recent_restocks.sql)
-- — группировкой реальных строк склада по времени пакетной загрузки.
-- Для товаров с manual_stock (см. 20260924131603_manual_account_stock.sql)
-- никакого account_inventory не создаётся вообще — остаток это просто
-- число в products.stock, которое админ вводит руками. Поэтому такие
-- товары никогда не попадали в новостную ленту, даже при создании с
-- ненулевым количеством — баг, который заметил админ.
--
-- Отдельный журнал именно для этого случая — insert делает admin-products
-- (см. index.ts, action 'create' и 'update') при создании товара с
-- manual_stock и ненулевым stock, а также при любом ручном УВЕЛИЧЕНИИ
-- stock у уже существующего manual_stock-товара (уменьшение — это
-- покупка, через purchase_product(), сюда не относится и туда не пишет).
create table if not exists restock_events (
  id          bigint generated always as identity primary key,
  product_id  text not null references products(id) on delete cascade,
  qty_added   int not null,
  created_at  timestamptz not null default now()
);

-- recent_restocks — теперь объединение двух источников: старого
-- (account_inventory, для обычного склада) и нового (restock_events,
-- только для manual_stock). Список колонок должен совпадать в обеих
-- половинах UNION ALL — porядок и имена как в исходном view.
create or replace view recent_restocks as
select * from (
  select
    ai.product_id,
    p.title, p.image_url, p.geo, p.geo_flag, p.platform, p.price,
    ai.created_at as restocked_at,
    count(*)::int as qty_added
  from account_inventory ai
  join products p on p.id = ai.product_id
  where p.is_archived = false and p.kind = 'account'
  group by ai.product_id, p.title, p.image_url, p.geo, p.geo_flag, p.platform, p.price, ai.created_at

  union all

  select
    re.product_id,
    p.title, p.image_url, p.geo, p.geo_flag, p.platform, p.price,
    re.created_at as restocked_at,
    re.qty_added
  from restock_events re
  join products p on p.id = re.product_id
  where p.is_archived = false and p.kind = 'account' and p.manual_stock = true
) combined
order by restocked_at desc;

grant select on recent_restocks to anon, authenticated;
