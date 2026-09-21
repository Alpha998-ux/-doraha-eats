'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

type Ctx = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('doraha_admin_token') : null;
    if (!token) { setLoading(false); if (pathname !== '/login') router.replace('/login'); return; }
    api<{ user: AdminUser }>('/auth/me')
      .then(({ user }) => {
        if (user.role !== 'ADMIN') { setToken(null); router.replace('/login'); return; }
        setUser(user);
      })
      .catch(() => { setToken(null); router.replace('/login'); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ user: AdminUser; token: string }>('/auth/login', {
      method: 'POST', body: { email, password },
    });
    if (res.user.role !== 'ADMIN') throw new Error('This account is not an admin account.');
    setToken(res.token);
    setUser(res.user);
    router.replace('/');
  }

  function logout() {
    setToken(null);
    setUser(null);
    router.replace('/login');
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
