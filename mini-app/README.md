# Mini App — клиентская часть (Telegram Mini App)

React-приложение по макету из Figma. Backend — реальный, на Supabase
(см. [`../SETUP.md`](../SETUP.md) в корне репозитория — полная инструкция
по развёртыванию с нуля: своя база, свой бот, свои кошельки).

Без настроенного `.env` (см. `.env.example`) приложение автоматически
откатывается на моковые данные из `mock/data.js` — это только режим для
локальной разработки интерфейса без поднятого backend, в реальном
Telegram-приложении с заполненным `.env` всегда используются настоящие
данные.

## Запуск локально

```bash
npm install
npm run dev
```

Откроется на http://localhost:5173

## Сборка для продакшена

```bash
npm run build
```

Результат — в папке `dist/`. Её содержимое нужно выложить как статику —
подойдёт Netlify/Vercel/Cloudflare Pages (см. `SETUP.md`) или любой
другой веб-сервер (nginx, Caddy, IIS и т.д.).

## Структура проекта

```
src/
  components/     — переиспользуемые UI-компоненты (Header, BottomNav, карточки и т.д.)
  screens/        — экраны, сгруппированные по разделам (products, purchase, balance...)
  mock/data.js    — все тестовые данные. Отсюда всё нужно будет забирать с backend
  context/AppContext.jsx — состояние приложения (баланс, покупки, тосты)
  styles/         — токены дизайна (tokens.css) и стили компонентов (components.css)
```

## Что смоделировано (по всем 34 экранам из Figma)

- **Товары**: Home, Accounts, Solutions (с поиском и фильтром по GEO),
  карточка товара (Account / One-time / Subscription — один адаптивный компонент)
- **Покупка**: Confirmation Sheet → Success / Failed / Insufficient Balance,
  детали покупки (One-time / Account), детали подписки (Active / Expired)
- **Покупки**: список покупок и подписок, с пустыми состояниями
- **Баланс**: пополнение (сумма + способ оплаты) → ожидание платежа → успех/ошибка,
  история операций
- **Рефералы**: ссылка, статистика, список рефералов (+ пустое состояние)
- **Профиль**: главная, условия использования
- **Системные состояния**: Loader (default/compact), Error State, Toast

## Реальный backend

Подключение к Supabase живёт в `src/context/AppContext.jsx` и
`src/supabase/` (`client.js`, `api.js`). Режим переключается автоматически:
если `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` заданы и приложение
открыто внутри Telegram — используются реальные запросы; иначе — моки из
`mock/data.js` (для разработки интерфейса без поднятого backend).

## Telegram Web App

В `index.html` подключён официальный скрипт `telegram-web-app.js`,
в `src/main.jsx` — инициализация (`ready()`, `expand()`).
