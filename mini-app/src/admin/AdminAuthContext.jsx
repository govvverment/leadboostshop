import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { adminApi, getAdminToken, setAdminToken } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(!!getAdminToken());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (password) => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await adminApi.login(password);
      setAdminToken(token);
      setIsAuthed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAdminToken(null);
    setIsAuthed(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setIsAuthed(false);
    window.addEventListener('admin:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isAuthed, login, logout, error, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
