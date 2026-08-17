-- ============================================================
-- Полный сброс тестовых данных перед реальным запуском.
-- Порядок удаления — от "листьев" зависимостей к "корню", чтобы не
-- упереться во внешние ключи. admin_sessions НЕ трогаем — это токены
-- входа в саму админку, не связаны с Telegram-пользователями.
-- ============================================================
delete from referral_earnings;
delete from balance_history;
delete from account_inventory;
delete from subscriptions;
delete from purchases;
delete from products;
delete from users;
