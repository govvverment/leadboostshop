-- Картинка категории (для карточек "Аккаунты"/"Технические решения" на главной)
alter table categories add column if not exists image_url text;
