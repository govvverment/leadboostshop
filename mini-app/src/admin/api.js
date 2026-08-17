// ============================================================
// Слой работы с данными для админки, встроенной в mini-app.
//
// Раньше ходил на Express-backend, теперь — на Supabase Edge
// Functions. Сигнатуры функций (что принимают, что возвращают)
// НЕ поменялись — экраны админки (screens/*) продолжают работать
// без единой правки.
// ============================================================

import { config } from '../config';

const TOKEN_KEY = 'admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function callFunction(name, body, { isFormData = false } = {}) {
  const token = getAdminToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new AdminApiError('Не удалось подключиться к серверу', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ответ без тела — нормально для некоторых запросов
  }

  if (!res.ok) {
    if (res.status === 401) {
      setAdminToken(null);
      window.dispatchEvent(new Event('admin:unauthorized'));
    }
    throw new AdminApiError(data?.error || `Ошибка запроса (${res.status})`, res.status);
  }

  return data;
}

export const adminApi = {
  login: (password) => callFunction('admin-login', { password }),

  getProducts: () => callFunction('admin-products', { action: 'list' }),
  createProduct: (payload) => callFunction('admin-products', { action: 'create', ...payload }),
  updateProduct: (id, payload) => callFunction('admin-products', { action: 'update', id, ...payload }),
  archiveProduct: (id) => callFunction('admin-products', { action: 'archive', id }),
  restoreProduct: (id) => callFunction('admin-products', { action: 'restore', id }),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return callFunction('admin-upload', form, { isFormData: true });
  },

  getOverview: () => callFunction('admin-stats', { action: 'overview' }),
  getRevenueByDay: (days = 14) => callFunction('admin-stats', { action: 'revenue-by-day', days }),
  getTopProducts: () => callFunction('admin-stats', { action: 'top-products' }),
  getTopReferrers: () => callFunction('admin-stats', { action: 'top-referrers' }),

  getInventory: (productId) => callFunction('admin-products', { action: 'list-inventory', productId }),
  bulkAddInventory: (productId, text) =>
    callFunction('admin-products', { action: 'bulk-add-inventory', productId, text }),

  clearInventory: (productId, mode) => callFunction('admin-products', { action: 'clear-inventory', productId, mode }),

  getCategories: () => callFunction('admin-products', { action: 'list-categories' }),
  createCategory: (title) => callFunction('admin-products', { action: 'create-category', title }),
  updateCategory: (id, imageUrl) => callFunction('admin-products', { action: 'update-category', id, imageUrl }),
  deleteCategory: (id) => callFunction('admin-products', { action: 'delete-category', id }),
};

export { AdminApiError };
