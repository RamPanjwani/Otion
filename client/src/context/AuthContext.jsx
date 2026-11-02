import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContextInstance';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem('otion_token');
    localStorage.removeItem('otion_token');
    setUser(null);
  }, []);

  const persistSession = useCallback((payload, remember = true) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('otion_token', payload.token);
    setUser({
      _id: payload._id,
      name: payload.name,
      email: payload.email,
      avatarUrl: payload.avatarUrl,
    });
  }, []);

  const login = useCallback(async (credentials, remember = true) => {
    const { data } = await api.post('/auth/login', credentials);
    persistSession(data, remember);
    return data;
  }, [persistSession]);

  const register = useCallback(async (details) => {
    const { data } = await api.post('/auth/register', details);
    persistSession(data, true);
    return data;
  }, [persistSession]);

  const updateUser = useCallback((patch) => setUser((current) => current ? { ...current, ...patch } : current), []);

  useEffect(() => {
    const hydrate = async () => {
      const token = sessionStorage.getItem('otion_token') || localStorage.getItem('otion_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    hydrate();
    window.addEventListener('otion:unauthorized', logout);
    return () => window.removeEventListener('otion:unauthorized', logout);
  }, [logout]);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser }), [user, loading, login, register, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
