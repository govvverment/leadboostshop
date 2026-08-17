# Развёртывание с нуля

Это инструкция для того, кто получил исходники этого магазина и хочет
запустить его на СВОЁМ Supabase-проекте, СВОЁМ Telegram-боте и СВОИХ
кошельках — без каких-либо остаточных данных предыдущего владельца.

Всего понадобится:
- аккаунт [supabase.com](https://supabase.com) (бесплатного тарифа достаточно)
- Node.js 18+ и npm
- аккаунт в Telegram + бот, созданный через [@BotFather](https://t.me/BotFather)
- аккаунт на [Netlify](https://netlify.com) (или любой другой статический хостинг —
  Vercel, Cloudflare Pages и т.д., принцип тот же)
- свои крипто-кошельки (TRC20 / при желании ERC20 и BEP20) для приёма USDT
- API-ключ [TronGrid](https://www.trongrid.io/) (бесплатно) — для проверки TRC20-платежей
- при желании: API-ключ [Etherscan](https://etherscan.io/apis) — он же используется
  для ERC20 и BEP20 (Multichain API V2 одним ключом покрывает и Ethereum, и BSC)

Время: 30–60 минут, если всё под рукой.

---

## 1. Supabase — новый проект и база данных

1. [supabase.com](https://supabase.com/dashboard) → **New project**. Задайте
   название, пароль базы (сохраните — понадобится редко, но пригодится) и регион
   (лучше ближе к вашей аудитории).
2. Дождитесь, пока проект поднимется (1–2 минуты).
3. Откройте **SQL Editor → New query**, вставьте туда содержимое файла
   [`supabase-functions/sql/schema.sql`](supabase-functions/sql/schema.sql) целиком
   и нажмите **Run**. Это создаст все таблицы, представления, функции, политики
   безопасности (RLS) и хранилище для картинок товаров — за один проход.
4. Проверьте: **Table Editor** должен показать таблицы `users`, `categories`,
   `products`, `purchases`, `subscriptions`, `account_inventory`,
   `deposit_requests` и другие — итого 10 таблиц.
5. Зайдите в **Settings → API** и запишите себе:
   - **Project URL** (вида `https://xxxxxxxx.supabase.co`)
   - **anon public** ключ (это НЕ секрет, его можно класть в код фронтенда)
   - **service_role** ключ — это уже секрет, он нужен только backend'у, но
     Edge Functions на Supabase получают его автоматически, вручную никуда
     вписывать не надо.
   - **Project Reference** — это часть адреса между `https://` и `.supabase.co`
     (например, из `https://xxxxxxxx.supabase.co` — это `xxxxxxxx`). Дальше по
     тексту — `<PROJECT_REF>`.

---

## 2. Telegram-бот

1. Напишите [@BotFather](https://t.me/BotFather) → `/newbot`, придумайте имя и
   username (должен заканчиваться на `bot`, например `myshop_store_bot`).
   Сохраните **токен** — он выглядит как `123456789:AAExampleTokenValue`.
   Дальше по тексту — `<BOT_TOKEN>`.
2. Тому же @BotFather → `/newapp`, выберите своего бота, задайте:
   - название и описание Mini App
   - иконку (512×512, будет видна в разных местах Telegram)
   - **Short name** — короткое имя без пробелов, например `shop`. Дальше по
     тексту — `<APP_SHORTNAME>`. Ссылка на URL приложения на этом шаге ещё не
     нужна — впишете её позже, когда сайт уже будет задеплоен (шаг 6).
3. Тому же @BotFather → `/setmenubutton` → выберите бота → пришлите текст
   кнопки (например «🛍 Магазин») и **тот же URL**, что и в `/newapp`
   (заполните после шага 6, менюкнопку можно поменять в любой момент).

---

## 3. Supabase CLI — деплой Edge Functions

Всё серверное (проверка Telegram, покупки, приём платежей, админка) — это
Edge Functions, лежат в `supabase-functions/supabase/functions/`.

```bash
npm install -g supabase
supabase --version
```

Из папки `supabase-functions`:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

### 3.1 Секреты

Прежде чем деплоить функции, нужно задать переменные окружения, которые
они читают (`Deno.env.get(...)`). Ни одна из них не хранится в коде —
задаются один раз командой `supabase secrets set`:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<BOT_TOKEN>

# Придумайте свою длинную случайную строку (например, сгенерируйте
# через `openssl rand -hex 32`) — Telegram будет присылать её в заголовке
# каждого вызова вебхука, так вы отличаете настоящие запросы от Telegram
# от случайных попаданий на этот же URL.
supabase secrets set TELEGRAM_WEBHOOK_SECRET=<ваша_случайная_строка>

# Пароль для входа в админ-панель (её открывает Профиль → Админ-панель
# в самом мини-аппе). Тоже придумайте сами, желательно длинный.
supabase secrets set ADMIN_PASSWORD=<ваш_пароль_админки>

# URL самого мини-аппа после деплоя (шаг 6) — впишите сюда уже сейчас,
# заранее решив, на каком поддомене Netlify (или своём домене) он будет
# висеть, например https://my-shop.netlify.app (без слэша на конце).
supabase secrets set MINI_APP_URL=<ваш_URL_приложения>

# Публичный адрес самой этой Edge Function (bot-webhook) в Supabase —
# собирается по шаблону ниже, PROJECT_REF — тот же, что и в link выше.
supabase secrets set BOT_WEBHOOK_URL=https://<PROJECT_REF>.supabase.co/functions/v1/bot-webhook

# Кошелёк TRC20 (Tron) для приёма USDT-депозитов.
supabase secrets set TRON_WALLET_ADDRESS=<ваш_TRC20_адрес>

# API-ключ TronGrid (регистрация на trongrid.io, бесплатно) — нужен,
# чтобы Edge Function могла проверять входящие транзакции по блокчейну.
supabase secrets set TRONGRID_API_KEY=<ваш_ключ_TronGrid>

# --- Необязательно, только если хотите ERC20/BEP20 в дополнение к TRC20 ---
supabase secrets set EVM_WALLET_ADDRESS=<ваш_EVM_адрес_0x...>
supabase secrets set ETHERSCAN_API_KEY=<ваш_ключ_Etherscan>
```

> Про `EVM_WALLET_ADDRESS`/`ETHERSCAN_API_KEY`: один Etherscan-ключ (Multichain
> API V2) покрывает и Ethereum (ERC20), и BSC (BEP20) — отдельный ключ для
> BscScan заводить не нужно. Если сеть ERC20/BEP20 пока не нужна — просто
> пропустите эти два секрета, TRC20 будет работать независимо от них.

### 3.2 Деплой функций

```bash
supabase functions deploy auth --no-verify-jwt
supabase functions deploy account --no-verify-jwt
supabase functions deploy buy --no-verify-jwt
supabase functions deploy deposit-create --no-verify-jwt
supabase functions deploy deposit-check --no-verify-jwt
supabase functions deploy admin-login --no-verify-jwt
supabase functions deploy admin-products --no-verify-jwt
supabase functions deploy admin-stats --no-verify-jwt
supabase functions deploy admin-upload --no-verify-jwt
supabase functions deploy bot-webhook --no-verify-jwt
```

`--no-verify-jwt` обязателен — эти функции проверяют личность
пользователя по подписи Telegram (`initData`), а не через встроенную
авторизацию Supabase, поэтому автоматическая JWT-проверка тут будет
только мешать.

### 3.3 Регистрация вебхука бота

Откройте в браузере (просто перейдите по ссылке, GET-запрос):
```
https://<PROJECT_REF>.supabase.co/functions/v1/bot-webhook
```
В ответ придёт JSON вида `{"ok":true,"result":true,...}` — это значит,
Telegram принял регистрацию вебхука. Проверить текущее состояние в любой
момент можно так:
```
https://<PROJECT_REF>.supabase.co/functions/v1/bot-webhook?info=1
```

Этот вебхук нужен ТОЛЬКО для одного случая: когда новый пользователь
впервые нажимает "Start" по реферальной ссылке — Telegram в этом случае не
всегда прокидывает параметр внутрь мини-аппа напрямую, поэтому бот сам
отвечает кнопкой с уже вшитой реферальной меткой в URL.

---

## 4. Frontend (mini-app)

```bash
cd mini-app
npm install
cp .env.example .env
```

Откройте `.env` и заполните своими значениями (описание каждого поля есть
прямо в `.env.example`):

```
VITE_USE_MOCK=false
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<ваш_anon_ключ_из_шага_1>
VITE_ADMIN_TELEGRAM_IDS=<ваш_telegram_id>
VITE_BOT_USERNAME=<username_бота_без_@>
VITE_BOT_APP_SHORTNAME=<APP_SHORTNAME_из_шага_2>
VITE_SUPPORT_URL=https://t.me/<ваш_саппорт_или_личный_username>
```

Свой Telegram ID (для `VITE_ADMIN_TELEGRAM_IDS`) можно узнать у бота
[@userinfobot](https://t.me/userinfobot). Несколько ID — через запятую,
без пробелов.

Локальная проверка:
```bash
npm run dev
```
Откроется на `http://localhost:5173` в обычном браузерном режиме — без
Telegram приложение само переключится на моковые данные, это нормально
(так задумано для разработки — реальные данные появятся только внутри
самого Telegram, см. шаг 6).

Сборка для продакшена:
```bash
npm run build
```
Результат — в папке `dist/`.

---

## 5. Деплой на Netlify

```bash
npx netlify-cli login
npx netlify-cli sites:create
```
Задайте имя сайта — от него будет зависеть URL вида
`https://<имя>.netlify.app` (или подключите свой домен позже в настройках
сайта на Netlify).

```bash
npx netlify-cli deploy --prod --dir=dist
```

Если после деплоя сайт отдаёт ошибку доступа (login redirect) — зайдите в
настройки сайта на Netlify и убедитесь, что **Site protection / SSO** для
этого сайта выключен (это настройка команды/аккаунта, иногда включена по
умолчанию и блокирует публичный доступ).

**Важно:** URL, который вы получили на этом шаге, должен совпадать с тем,
что вы вписали в `MINI_APP_URL` на шаге 3.1 — если название сайта
получилось другим, обновите секрет:
```bash
supabase secrets set MINI_APP_URL=https://<реальный_url>.netlify.app
```
и передеплойте `bot-webhook` (`supabase functions deploy bot-webhook --no-verify-jwt`).

---

## 6. Финальная привязка бота

Вернитесь к [@BotFather](https://t.me/BotFather):
- `/setmenubutton` → выбрать бота → указать URL из шага 5
- `/newapp` (если ещё не завершали) или отредактировать существующее
  приложение → указать тот же URL

Готовая реферальная ссылка для приглашений имеет вид:
```
https://t.me/<username_бота>/<APP_SHORTNAME>?startapp=ref_<telegram_id_приглашающего>
```

---

## 7. Проверка, что всё работает

Пройдите вживую в Telegram (не в браузере — часть логики завязана на
Telegram WebApp SDK, в браузере это только черновой режим):

1. Откройте бота, нажмите на кнопку меню — приложение должно открыться и
   показать каталог (пустой — товаров ещё нет, это нормально).
2. Профиль → Админ-панель (кнопка видна только вашему Telegram ID из
   `VITE_ADMIN_TELEGRAM_IDS`) → войдите паролем из `ADMIN_PASSWORD`.
3. Добавьте тестовый товар типа "Аккаунт", загрузите в него склад
   (можно списком `login:password`, можно .txt-файлом).
4. С другого Telegram-аккаунта (или через "Пополнить баланс" на своём)
   проверьте пополнение через USDT TRC20 — по шагам инструкция в
   отдельном файле USAGE.md (готовится отдельно, без личных данных).
5. Купите тестовый товар с баланса — убедитесь, что списание прошло и
   пришли настоящие данные аккаунта, а не заглушка.
6. Проверьте реферальную ссылку — зайдите по ней вторым аккаунтом,
   купите что-нибудь, убедитесь, что первому аккаунту начислился %.

---

## Частые проблемы

- **"Invalid API Key" от Etherscan.** Известная особенность самого
  Etherscan — иногда свежесозданный ключ активируется не сразу и может не
  заработать даже после подтверждения почты. Если столкнётесь — TRC20 при
  этом продолжит работать независимо, ERC20/BEP20 можно включить позже,
  когда ключ заработает (никаких изменений в коде для этого не требуется,
  только секреты `EVM_WALLET_ADDRESS`/`ETHERSCAN_API_KEY`).
- **Приложение показывает моковые (не настоящие) данные в самом Telegram.**
  Значит `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` не заданы или
  неверны в `.env` — проверьте, что при сборке (`npm run build`) файл
  `.env` реально существует и заполнен (переменные Vite "зашиваются" в
  сборку на этом шаге, редактирование `.env` после `npm run build`
  ни на что не повлияет, нужно пересобрать).
- **Функция деплоится, но падает при вызове.** Проверьте, что все секреты
  из шага 3.1 заданы — посмотреть список (без значений) можно командой
  `supabase secrets list`.
