-- ============================================================
-- Реальная "популярность" товара для главной страницы (вместо
-- жёстко зашитого списка ID в mini-app). Считаем по факту продаж:
--  - account: сумма купленного количества (qty) из purchases
--  - one-time: количество строк в purchases
--  - subscription: количество подписчиков (строк в subscriptions —
--    продление не создаёт новую строку, так что это именно число
--    подписчиков, а не количество продлений)
-- ============================================================
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
