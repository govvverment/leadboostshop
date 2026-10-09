import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  user as mockUser,
  purchases as mockPurchases,
  subscriptions as mockSubscriptions,
  products as mockProducts,
  categories as mockCategories,
  referral as mockReferralStats,
  referralsList as mockReferralsList,
  balanceHistory as mockBalanceHistoryGrouped,
} from '../mock/data';

// Мок "Истории баланса" сгруппирован по дням (для старого демо-UI) —
// приводим к тому же плоскому виду, что отдаёт реальный backend,
// чтобы экран истории группировал одинаково независимо от режима.
const mockBalanceHistory = mockBalanceHistoryGrouped.flatMap((g) =>
  g.items.map((item) => ({ ...item, date: new Date() }))
);
const mockReferral = { invited: mockReferralStats.invited, earned: mockReferralStats.earned, list: mockReferralsList };
// Мок "Новостной ленты" — последние 2 пополнения склада, для дев-режима
// без backend (в реальном режиме приходит из fetchRecentRestocks).
const mockRestocks = mockProducts
  .filter((p) => p.kind === 'account')
  .slice(0, 2)
  .map((p, i) => ({
    productId: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    geo: p.geo,
    geoFlag: p.geoFlag,
    platform: p.platform,
    price: p.price,
    qtyAdded: p.stock,
    restockedAt: new Date(Date.now() - i * 12 * 60 * 1000),
  }));
import { supabase } from '../supabase/client';
import {
  fetchProducts,
  fetchCategories,
  fetchRecentRestocks,
  authenticate,
  fetchAccountSnapshot,
  purchaseProduct,
  createDeposit,
  checkDeposit,
  trackEvent,
} from '../supabase/api';
import { getTelegramInitData, getUrlRefParam } from '../hooks/useTelegramUser';
import Screen from '../components/Screen';
import { LoaderDefault, ErrorState } from '../components/Loader';
import { fetchImageAsBlobUrl } from '../utils/imagePreload';

const AppContext = createContext(null);

// Сама загрузка/кеширование картинок (в память + на диск через Cache
// Storage) — целиком внутри components/ProductImage.jsx, он используется
// для ЛЮБОЙ картинки товара во всём приложении (лента, категории, списки,
// карточка товара), так что подставлять blob-URL в state заранее больше
// не нужно. Единственное, что делает AppContext — заранее ЗАПУСКАЕТ
// загрузку (не дожидаясь и не блокируя ready) для того, что пользователь
// ещё не открыл — списки товаров внутри категорий — чтобы к моменту
// перехода туда байты уже были в кеше. fetchImageAsBlobUrl сама
// дедуплицирует: если ProductImage при реальном рендере запросит ту же
// картинку, второй раз с сети она не уйдёт.
function warmImageCache(items) {
  for (const item of items) {
    if (item?.imageUrl) fetchImageAsBlobUrl(item.imageUrl);
  }
}

export function AppProvider({ children }) {
  // "Реальный" режим включается только если открыто внутри настоящего
  // Telegram (есть initData) И Supabase настроен. null — ещё не
  // определились: скрипт telegram-web-app.js иногда успевает
  // подключиться, но сам initData "долетает" от Telegram чуть позже
  // (доля секунды) — если проверить один раз и сразу поверить в mock,
  // приложение застревает на моках до ручного перезахода. Поэтому
  // пробуем несколько раз с паузой, а не решаем с первой попытки.
  const [real, setReal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // до ~2 секунд ожидания моста Telegram

    const check = () => {
      if (cancelled) return;
      if (Boolean(supabase && getTelegramInitData())) {
        setReal(true);
        return;
      }
      const insideTelegram = Boolean(window.Telegram?.WebApp);
      if (!insideTelegram || attempts >= maxAttempts) {
        setReal(false); // точно не Telegram, либо честно не дождались
        return;
      }
      attempts += 1;
      setTimeout(check, 100);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const [balance, setBalance] = useState(mockUser.balance);
  const [purchases, setPurchases] = useState(mockPurchases);
  const [subscriptions, setSubscriptions] = useState(mockSubscriptions);
  const [products, setProducts] = useState(mockProducts);
  const [categories, setCategories] = useState(mockCategories);
  const [referral, setReferral] = useState(mockReferral);
  const [restocks, setRestocks] = useState(mockRestocks);
  const [balanceHistory, setBalanceHistory] = useState(mockBalanceHistory);
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const getProduct = useCallback((id) => products.find((p) => p.id === id), [products]);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Подтягиваем всё с backend, как только определили режим — только в
  // реальном режиме. В моковом продукты/баланс уже заданы выше из
  // mock/data.js, просто помечаем себя готовыми.
  useEffect(() => {
    if (real === false) {
      setReady(true);
      return;
    }
    if (real !== true) return; // ещё не определились (null) — ждём

    const initData = getTelegramInitData();

    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        await authenticate(initData, getUrlRefParam()); // регистрирует юзера, привязывает реферала (один раз)
        // Открытие мини-аппа — для счётчика "Открытий сегодня" в
        // статистике админки. Не блокирует загрузку и не роняет её при
        // сетевой ошибке — просто лучшая попытка посчитать.
        trackEvent('app_open');
        const [snapshot, freshProducts, freshCategories, freshRestocks] = await Promise.all([
          fetchAccountSnapshot(initData),
          fetchProducts(),
          fetchCategories(),
          fetchRecentRestocks(),
        ]);
        if (cancelled) return;
        setBalance(snapshot.balance);
        setPurchases(snapshot.purchases);
        setSubscriptions(snapshot.subscriptions);
        setReferral(snapshot.referral);
        setBalanceHistory(snapshot.balanceHistory);
        setProducts(freshProducts);
        setCategories(freshCategories);
        setRestocks(freshRestocks);

        // Не блокируем экран загрузки картинками — ProductImage сам
        // покажет скелетон и подставит фото по готовности для того, что
        // реально отрисовано (лента + категории — сразу на этом экране).
        // Здесь только заранее ЗАПУСКАЕМ скачивание товаров, которые
        // пользователь ещё не открыл (списки внутри категорий), чтобы к
        // моменту перехода туда байты уже лежали в кеше.
        if (!cancelled) warmImageCache(freshProducts);
      } catch (err) {
        console.error('Не удалось загрузить данные аккаунта:', err);
        if (!cancelled) setLoadError(err.message || 'Не удалось загрузить данные');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [real, retryKey]);

  // "Наличие в реальном времени" — периодический опрос (не настоящий
  // push/Realtime-подписка, см. обсуждение с пользователем): раз в ~18с
  // тихо перечитываем products_with_stock и обновляем только stock/
  // salesCount по каждому товару, не трогая остальные поля (в частности
  // imageUrl — чтобы не сбрасывать уже подставленные blob-URL и не
  // вызывать повторную "прогрузку" иконок). Работает только в реальном
  // режиме и только после первой успешной загрузки.
  useEffect(() => {
    if (real !== true || !ready) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const fresh = await fetchProducts();
        if (cancelled) return;
        const byId = new Map(fresh.map((p) => [p.id, { stock: p.stock, salesCount: p.salesCount }]));
        setProducts((current) =>
          current.map((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id) } : p))
        );
      } catch {
        // тихо игнорируем — следующий тик попробует снова
      }
    };

    const interval = setInterval(tick, 18000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [real, ready]);

  const refreshAccount = useCallback(async () => {
    if (!real) return;
    const initData = getTelegramInitData();
    const [snapshot, freshProducts] = await Promise.all([fetchAccountSnapshot(initData), fetchProducts()]);
    setBalance(snapshot.balance);
    setPurchases(snapshot.purchases);
    setSubscriptions(snapshot.subscriptions);
    setReferral(snapshot.referral);
    setBalanceHistory(snapshot.balanceHistory);
    setProducts(freshProducts);
    warmImageCache(freshProducts);
  }, [real]);

  // Покупка. В реальном режиме — настоящий запрос к Supabase (Edge
  // Function → атомарная SQL-транзакция). В моковом — прежняя
  // симуляция для тестирования интерфейса без Telegram.
  const buyProduct = useCallback(
    async (product, qty = 1) => {
      if (real) {
        const initData = getTelegramInitData();
        const result = await purchaseProduct(initData, product.id, qty);
        if (result.status === 'success') {
          await refreshAccount();
        }
        // 'not_found' / 'user_not_found' — редкие технические случаи,
        // показываем как обычную неудачную попытку
        if (result.status === 'not_found' || result.status === 'user_not_found') {
          return { status: 'failed' };
        }
        return result;
      }

      // ---- Моковая симуляция (как было раньше) ----
      return new Promise((resolve) => {
        const currentProduct = products.find((p) => p.id === product.id) ?? product;
        const currentStock = currentProduct.kind === 'account' ? currentProduct.stock : Infinity;

        if (currentProduct.kind === 'account' && (currentStock <= 0 || qty > currentStock)) {
          resolve({ status: 'out_of_stock' });
          return;
        }

        const total = +(currentProduct.price * (currentProduct.kind === 'account' ? qty : 1)).toFixed(2);
        setTimeout(() => {
          if (total > balance) {
            resolve({ status: 'insufficient', total });
            return;
          }
          if (Math.random() < 0.08) {
            resolve({ status: 'failed', total });
            return;
          }
          setBalance((b) => +(b - total).toFixed(2));

          if (currentProduct.kind === 'subscription') {
            const periodDate = new Date();
            periodDate.setMonth(periodDate.getMonth() + 1);
            setSubscriptions((prev) => {
              const existing = prev.find((s) => s.productId === currentProduct.id);
              if (existing) {
                return prev.map((s) =>
                  s.id === existing.id
                    ? { ...s, status: 'active', activeUntil: periodDate.toLocaleDateString('ru-RU') }
                    : s
                );
              }
              return [
                {
                  id: 'sub' + Date.now(),
                  productId: currentProduct.id,
                  title: currentProduct.title,
                  platform: currentProduct.platform,
                  type: currentProduct.type,
                  period: currentProduct.period,
                  periodLabel: currentProduct.periodLabel,
                  price: currentProduct.price,
                  status: 'active',
                  activeUntil: periodDate.toLocaleDateString('ru-RU'),
                  accessLink: `t.me/${currentProduct.id}_bot`,
                  accessKey: 'XX-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
                  accessInstructionsUrl: 'https://t.me/leadboost_docs',
                },
                ...prev,
              ];
            });
          } else {
            if (currentProduct.kind === 'account') {
              setProducts((prev) =>
                prev.map((p) => (p.id === currentProduct.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p))
              );
            }
            setPurchases((prev) => [
              {
                id: 'p' + Date.now(),
                productId: currentProduct.id,
                title: currentProduct.title,
                kind: currentProduct.kind,
                geo: currentProduct.geo,
                geoFlag: currentProduct.geoFlag,
                platform: currentProduct.platform,
                type: currentProduct.type,
                license: currentProduct.license,
                qty: currentProduct.kind === 'account' ? qty : undefined,
                price: total,
                date: new Date().toLocaleDateString('ru-RU'),
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                status: 'paid',
                credentials:
                  currentProduct.kind === 'account'
                    ? Array.from({ length: qty }, (_, i) => ({
                        login: `demo_user${i + 1}`,
                        password: 'demoPass' + Math.random().toString(36).slice(2, 8),
                        extra: null,
                      }))
                    : [
                        {
                          link: `https://drive.google.com/file/d/${currentProduct.id}`,
                          extra: 'XX-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
                          instructionsUrl: 'https://t.me/leadboost_docs',
                        },
                      ],
              },
              ...prev,
            ]);
          }
          resolve({ status: 'success', total });
        }, 700);
      });
    },
    [real, balance, products, refreshAccount]
  );

  const renewSubscription = useCallback(
    async (sub) => {
      if (real) {
        const initData = getTelegramInitData();
        const result = await purchaseProduct(initData, sub.productId, 1);
        if (result.status === 'success') {
          await refreshAccount();
          return 'success';
        }
        return result.status === 'insufficient' ? 'insufficient' : 'failed';
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          if (sub.price > balance) {
            resolve('insufficient');
            return;
          }
          setBalance((b) => +(b - sub.price).toFixed(2));
          const periodDate = new Date();
          periodDate.setMonth(periodDate.getMonth() + 1);
          setSubscriptions((prev) =>
            prev.map((s) =>
              s.id === sub.id ? { ...s, status: 'active', activeUntil: periodDate.toLocaleDateString('ru-RU') } : s
            )
          );
          resolve('success');
        }, 700);
      });
    },
    [real, balance, refreshAccount]
  );

  // Пополнение баланса USDT (TRC20). Заявка создаётся с уникальной
  // суммой (нет memo-поля в TRC20 — так опознаём чей это платёж), и
  // экран оплаты периодически спрашивает, не пришёл ли перевод.
  const createDepositRequest = useCallback(
    async (amount, network = 'TRC20') => {
      if (!real) {
        // Мок — без реального ожидания, для тестирования интерфейса.
        return {
          requestId: 'mock',
          uniqueAmount: +(amount + 0.0042).toFixed(4),
          walletAddress: network === 'TRC20' ? 'TXmockWa11etAddressForPreviewOnly01' : '0xMockEvmWalletAddress000001',
          network,
          expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
        };
      }
      const initData = getTelegramInitData();
      return createDeposit(initData, amount, network);
    },
    [real]
  );

  const checkDepositRequest = useCallback(
    async (requestId) => {
      if (!real || requestId === 'mock') {
        // Мок — с какого-то момента "находим" случайный платёж.
        return Math.random() > 0.6 ? { status: 'confirmed', amount: 20 } : { status: 'pending' };
      }
      const initData = getTelegramInitData();
      const result = await checkDeposit(initData, requestId);
      if (result.status === 'confirmed') await refreshAccount();
      return result;
    },
    [real, refreshAccount]
  );

  if (real === true && ready && loadError) {
    return (
      <Screen title="LEAD BOOST" withNav={false} withHeader={false}>
        <ErrorState
          onRetry={() => {
            setReady(false);
            setRetryKey((k) => k + 1);
          }}
        />
      </Screen>
    );
  }

  if (real !== false && !ready) {
    return (
      <Screen title="LEAD BOOST" withNav={false} withHeader={false}>
        <LoaderDefault label="Загружаем ваш магазин..." />
      </Screen>
    );
  }

  return (
    <AppContext.Provider
      value={{
        balance,
        products,
        categories,
        getProduct,
        purchases,
        subscriptions,
        referral,
        balanceHistory,
        restocks,
        buyProduct,
        renewSubscription,
        createDepositRequest,
        checkDepositRequest,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
