-- Автономная фоновая оптимизация картинок товаров/категорий — БЕЗ
-- участия админа.
--
-- Реальная причина, почему предыдущие исправления (сама логика сжатия
-- в _shared/imageCompress.ts, отдельная функция _shared/optimizeBacklog.ts)
-- не убрали проблему на главном экране: пересжатие старых уже
-- загруженных картинок запускалось ТОЛЬКО когда админ САМ открывал
-- раздел "Товары" в браузере (см. useEffect в AdminProductsList.jsx) —
-- то есть по факту никогда не было автономным, что бы ни говорил старый
-- комментарий в коде "тихо запускается сама". Если после деплоя никто
-- не зашёл в "Товары" — задача просто ни разу не выполнялась, и все
-- тяжёлые картинки (130-280KB PNG) оставались как были.
--
-- Теперь Postgres сам, по расписанию, стучится в новую edge-функцию
-- cron-optimize-images (делает ровно то же самое пересжатие) — без
-- браузера, без админа, без какого-либо участия человека. Любая новая
-- тяжёлая картинка будет автоматически пережата максимум в течение 15
-- минут после появления.
--
-- pg_cron и pg_net у Supabase-проектов обычно можно включить своей же
-- ролью, без полного superuser. Если CREATE EXTENSION ниже всё же
-- откажет с ошибкой прав — включите оба расширения вручную один раз:
-- Dashboard -> Database -> Extensions -> найти "pg_cron" и "pg_net" ->
-- Enable, и запустите эту миграцию (`supabase db push`) заново.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- cron.schedule с именованным job идемпотентен — повторный запуск этой
-- миграции просто обновит существующее расписание, а не создаст дубль.
--
-- X-Cron-Secret — это НЕ пароль админки, отдельное внутреннее значение
-- только для этого автоматического вызова (сгенерировано случайно).
-- Нужно один раз (перед первым деплоем cron-optimize-images) задать его
-- как секрет проекта тем же значением:
--   supabase secrets set CRON_SECRET=43cYJpXZyE2A-0_o3Qd4ObScwYDkyEWGcpk2wODIPJk
select cron.schedule(
  'optimize-images-autonomous',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://ogbibqhqkahuqgipteex.supabase.co/functions/v1/cron-optimize-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '43cYJpXZyE2A-0_o3Qd4ObScwYDkyEWGcpk2wODIPJk'
    ),
    body := '{}'::jsonb
  );
  $$
);
