-- ============================================================
-- "Новостная лента" на главной — уведомления о реальных пополнениях
-- склада аккаунтов. Каждая пакетная загрузка через админку (bulk-add-
-- inventory) вставляет все строки одним INSERT — а значит все они
-- получают одинаковый now() как created_at. Группируя по
-- (product_id, created_at) получаем ровно "события пополнения" —
-- без отдельной таблицы-журнала, чисто из уже существующих данных.
-- Публично безопасно: колонки login/password/link НЕ выбираются.
-- ============================================================
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
