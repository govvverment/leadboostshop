# Backend — Supabase (Edge Functions + Postgres)

Полная инструкция по развёртыванию с нуля — в [`../SETUP.md`](../SETUP.md)
в корне репозитория (Supabase-проект, секреты, деплой функций, бот,
хостинг фронтенда — всё по шагам).

## Структура

- `sql/schema.sql` — вся база одним файлом: таблицы, представления,
  RLS-политики, SQL-функции (покупки, депозиты, статистика админки),
  хранилище картинок. Применяется один раз через SQL Editor в новом
  Supabase-проекте.
- `supabase/functions/` — Edge Functions (Deno), деплоятся через
  `supabase functions deploy <имя> --no-verify-jwt`. Список функций и
  что каждая делает — см. `SETUP.md`.
- `supabase/migrations/` — история изменений схемы поверх `schema.sql`
  (нужна только если разворачиваете новую версию поверх уже
  существующей базы; на чистом проекте достаточно `schema.sql`).
- `functions/` — рабочая копия исходников функций для редактирования;
  перед деплоем синхронизируйте изменения в `supabase/functions/`
  (именно оттуда читает Supabase CLI).

## Денежная логика

Все операции с балансом (`purchase_product`, `create_deposit_request`,
`confirm_deposit`) — это атомарные Postgres-функции с `security definer`,
а не JS-логика в Edge Function. Edge Functions только проверяют личность
запроса (подпись Telegram, пароль админки) и вызывают нужную SQL-функцию.
