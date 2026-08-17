// Все данные здесь имитируют то, что в реальном приложении должно приходить с backend.
// Тексты, суммы и товары взяты из реального Figma-макета (LEAD BOOST).

export const user = {
  name: 'Yaroslav',
  username: '@username',
  telegramId: '123456789',
  balance: 128.4,
};

export const categories = [
  { id: 'accounts', title: 'Аккаунты', icon: 'account', count: '128 товаров' },
  { id: 'solutions', title: 'Технические решения', icon: 'solution', count: '64 решения' },
];

export const products = [
  {
    id: 'acc-instagram',
    category: 'accounts',
    kind: 'account',
    imageUrl: 'https://placehold.co/200x200/171a23/5440aa?text=IG', // демо — админка подставит реальное фото
    title: 'Instagram Autorer',
    geo: 'Germany',
    geoFlag: '🇩🇪',
    platform: 'Android',
    type: 'Autorer',
    price: 5.5,
    stock: 24,
    description: 'Аккаунт Instagram, готовый к использованию. Данные для входа будут доступны сразу после покупки.',
  },
  {
    id: 'acc-facebook',
    category: 'accounts',
    kind: 'account',
    imageUrl: null, // ссылка придёт из админ-панели; пока нет — показываем иконку-заглушку
    title: 'Facebook Accounts',
    geo: 'USA',
    geoFlag: '🇺🇸',
    platform: 'Aged',
    type: 'Aged',
    price: 8.0,
    stock: 8,
    description: 'Прогретый аккаунт Facebook. Данные для входа будут доступны сразу после покупки.',
  },
  {
    id: 'acc-tiktok',
    category: 'accounts',
    kind: 'account',
    imageUrl: null, // ссылка придёт из админ-панели; пока нет — показываем иконку-заглушку
    title: 'TikTok Accounts',
    geo: 'UK',
    geoFlag: '🇬🇧',
    platform: 'Autorer',
    type: 'Autorer',
    price: 4.2,
    stock: 12,
    description: 'Аккаунт TikTok, готовый к использованию. Данные для входа будут доступны сразу после покупки.',
  },
  {
    id: 'sol-automation',
    category: 'solutions',
    kind: 'subscription',
    imageUrl: null, // ссылка придёт из админ-панели; пока нет — показываем иконку-заглушку
    title: 'Automation Tool',
    platform: 'Telegram',
    type: 'Automation',
    price: 20,
    period: 'мес',
    periodLabel: '1 месяц',
    description: 'Инструмент для автоматизации работы в Telegram. Доступ активируется сразу же после покупки и действует в течение выбранного периода.',
  },
  {
    id: 'sol-parser',
    category: 'solutions',
    kind: 'one-time',
    imageUrl: null, // ссылка придёт из админ-панели; пока нет — показываем иконку-заглушку
    title: 'Parser Pro',
    platform: 'Windows',
    type: 'Desktop',
    license: 'Бессрочная',
    price: 49.0,
    description: 'Инструмент для автоматизированной обработки и сбора данных. После покупки пользователь получает файл программы и руководство по использованию.',
  },
  {
    id: 'sol-crm',
    category: 'solutions',
    kind: 'subscription',
    imageUrl: null, // ссылка придёт из админ-панели; пока нет — показываем иконку-заглушку
    title: 'CRM Connector',
    platform: 'API',
    type: 'Integration',
    price: 35,
    period: 'мес',
    periodLabel: '1 месяц',
    description: 'Интеграция для подключения CRM к вашим рабочим процессам. Доступ активируется сразу после покупки.',
  },
];

// ===== Покупки / подписки пользователя =====

export const purchases = [
  {
    id: 'p1',
    productId: 'acc-instagram',
    title: 'Instagram Autorer',
    kind: 'account',
    geo: 'Germany',
    geoFlag: '🇩🇪',
    platform: 'Android',
    type: 'Autorer',
    qty: 5,
    price: 27.5,
    date: '10.08.2026',
    time: '09:32',
    status: 'paid',
    credentials: [
      { login: 'demo_user1', password: 'demoPass123', extra: null },
      { login: 'demo_user2', password: 'demoPass456', extra: null },
    ],
  },
];

export const subscriptions = [
  {
    id: 's1',
    productId: 'sol-automation',
    title: 'Automation Tool',
    platform: 'Telegram',
    type: 'Automation',
    period: 'мес',
    periodLabel: '1 месяц',
    price: 20,
    status: 'active',
    activeUntil: '10.09.2026',
    accessLink: 't.me/automation_tool_bot',
    accessKey: 'AT-92XK-7QLM',
  },
  {
    id: 's2',
    productId: 'sol-crm',
    title: 'CRM Connector',
    platform: 'API',
    type: 'Integration',
    period: 'мес',
    periodLabel: '1 месяц',
    price: 35,
    status: 'expired',
    endedAt: '02.08.2026',
    accessLink: 't.me/crm_connector_bot',
    accessKey: 'CC-11AZ-40PP',
  },
];

// ===== Баланс =====

export const depositPresets = [25, 50, 100, 250];

export const depositCurrency = { id: 'usdt', title: 'USDT', subtitle: 'Tether' };
export const depositNetworks = ['TRC20', 'ERC20']; // BEP20 временно скрыт, см. Deposit.jsx

export const balanceHistory = [
  {
    group: 'Сегодня',
    items: [
      { id: 'h1', type: 'deposit', title: 'Пополнение баланса', meta: 'USDT · TRC20 · 10:42', amount: 50, status: 'success' },
      { id: 'h2', type: 'purchase', title: 'Instagram Autorer', meta: 'Покупка · 09:32 · 5 шт.', amount: -27.5, status: 'success' },
    ],
  },
  {
    group: 'Вчера',
    items: [
      { id: 'h3', type: 'subscription', title: 'Automation Tool', meta: 'Подписка · 18:24', amount: -20, status: 'success' },
    ],
  },
];

// ===== Рефералы =====

export const referral = {
  percent: 5,
  link: 't.me/leadboost_bot?start=123456',
  invited: 24,
  earned: 86.4,
};

export const referralsList = [
  { id: 'r1', username: '@alex_dev', name: 'Alex', earned: 12.4 },
  { id: 'r2', username: '@max_web', name: 'Max', earned: 8.2 },
  { id: 'r3', username: '@daniel589', name: 'Daniel', earned: 6.8 },
  { id: 'r4', username: '@ann_hr', name: 'Anna', earned: 4.5 },
  { id: 'r5', username: '@mystery.n', name: 'Nick', earned: 3.2 },
];

// ===== Условия и политика (реальный текст из макета) =====

export const terms = {
  updatedAt: '10.08.2026',
  sections: [
    {
      title: '1. Условия использования',
      body: `Используя сервис LeadBoost, пользователь соглашается с этими условиями и правилами работы платформы.

Сервис предоставляет доступ к цифровым товарам, аккаунтам, техническим решениям и другим цифровым продуктам, представленным в каталоге.

Пользователь самостоятельно отвечает за выбор продукта, правильность вводимых данных и последующее использование приобретённых материалов. Перед покупкой рекомендуем проверить характеристики, описание, тип продукта и другие указанные параметры.

Запрещается использовать сервис или приобретённые продукты для действий, нарушающих применимое законодательство или права третьих лиц.`,
    },
    {
      title: '2. Оплата и покупки',
      body: `Покупки совершаются за счёт средств, доступных на внутреннем балансе пользователя.

Перед подтверждением покупки пользователь видит название товара и его актуальную стоимость. После подтверждения соответствующая сумма списывается с баланса.

Пополнение баланса может производиться доступными в сервисе способами оплаты. Зачисление средств производится после получения необходимого подтверждения платежа.

Приобретённые продукты и информация о совершённых покупках доступны в разделе «Покупки».`,
    },
    {
      title: '3. Подписки',
      body: `Некоторые технические решения предоставляются по модели подписки на указанный период.

Срок действия и стоимость подписки отображаются на странице продукта перед оформлением покупки.

После завершения оплаченного периода доступ к продукту или отдельным его функциям может быть приостановлен. Для восстановления доступа пользователь может продлить подписку по актуальной на момент продления стоимости.

Если иное прямо не указано при оформлении, продление подписки не производится автоматически.`,
    },
    {
      title: '4. Возврат средств',
      body: `Цифровые товары считаются предоставленными после открытия пользователю доступа к данным, файлам, ключам, ссылкам или другому цифровому содержимому продукта.

Возможность возврата средств рассматривается индивидуально и зависит от типа продукта, факта его получения и обстоятельств конкретной покупки.

Если пользователь получил некорректный товар или доступ к приобретённому продукту не работает на момент его выдачи, необходимо обратиться в службу поддержки и предоставить информацию о соответствующей покупке.

Сам факт того, что продукт больше не нужен пользователю или был приобретён ошибочно, не гарантирует возврат средств.`,
    },
    {
      title: '5. Политика конфиденциальности',
      body: `Для работы сервиса могут обрабатываться данные, полученные через Telegram, в частности, Telegram ID, имя, username и другая техническая информация, необходимая для работы Mini App.

Также сервис может хранить информацию о балансе, покупках, платежах, активных подписках, использованных реферальных ссылках и других операциях внутри платформы.

Эти данные используются для работы сервиса, обработки платежей, предоставления приобретённых продуктов и поддержки пользователей.

Пользователь не должен передавать третьим лицам пароли, ключи доступа и другие конфиденциальные данные, полученные после покупки.`,
    },
    {
      title: '6. Поддержка',
      body: `Если возникли вопросы о покупке, платеже, подписке или работе сервиса, пользователь может обратиться в службу поддержки.

Для более быстрого решения вопроса рекомендуется указать название продукта, дату покупки и кратко описать проблему.

Обращения рассматриваются в порядке их поступления. Время ответа может зависеть от количества активных обращений и сложности вопроса.

Продолжая использовать сервис, вы подтверждаете, что ознакомились с этими условиями.`,
    },
  ],
};
