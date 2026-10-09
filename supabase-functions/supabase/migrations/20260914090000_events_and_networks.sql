-- Правки shop (14.09.2026), часть 2:
--
-- 1) Лёгкий счётчик событий для новых цифр в "Статистике" — "Открытий
--    магазина сегодня" и "Нажатий «Пополнить» сегодня". Пишется через
--    отдельную edge-функцию track-event сервис-ролью — RLS включён, но
--    без единой публичной политики, так что напрямую ни anon, ни
--    authenticated ничего с этой таблицей сделать не может.
create table if not exists app_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('app_open', 'topup_click')),
  created_at timestamptz not null default now()
);
alter table app_events enable row level security;
create index if not exists app_events_type_created_idx on app_events (event_type, created_at);

-- 2) Справочник соцсетей с картинкой-иконкой — вместо того, чтобы
--    "угадывать" иконку по случайному предыдущему товару той же
--    соцсети (как было раньше), теперь при выборе соцсети в форме
--    товара админка явно подставляет картинку из этой таблицы. Читать
--    может кто угодно (иконки публичные, нужны на фронте), писать —
--    только через admin-products (сервис-роль).
create table if not exists networks (
  id text primary key,
  title text not null,
  icon_url text,
  created_at timestamptz not null default now()
);
alter table networks enable row level security;
grant select on networks to anon, authenticated;

insert into networks (id, title) values
  ('instagram', 'Instagram'),
  ('facebook', 'Facebook'),
  ('tiktok', 'TikTok'),
  ('telegram', 'Telegram')
on conflict (id) do nothing;
