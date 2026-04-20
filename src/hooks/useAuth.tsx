'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin } from '@/lib/api';

interface AuthCtx {
  token: string | null;
  admin: any | null;
  signIn: (email: string, pw: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('pf_token');
    const a = localStorage.getItem('pf_admin');
    if (t) { setToken(t); setAdmin(a ? JSON.parse(a) : null); }
  }, []);

  async function signIn(email: string, pw: string) {
    const res = await apiLogin(email, pw);
    setToken(res.token);
    setAdmin(res.admin);
    localStorage.setItem('pf_token', res.token);
    localStorage.setItem('pf_admin', JSON.stringify(res.admin));
  }

  function signOut() {
    setToken(null); setAdmin(null);
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_admin');
  }

  return <Ctx.Provider value={{ token, admin, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
