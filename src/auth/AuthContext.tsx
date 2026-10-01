import { createContext, useContext, useState, type ReactNode } from 'react';
type Status = 'authenticated' | 'logged-out';
type Auth = { status: Status; login: () => void; logout: () => void };
const AuthContext = createContext<Auth | null>(null);
const KEY = 'likelion-auth';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => {
    try { return localStorage.getItem(KEY) === 'logged-out' ? 'logged-out' : 'authenticated'; } catch { return 'authenticated'; }
  });
  const update = (value: Status) => { setStatus(value); try { localStorage.setItem(KEY, value); } catch { /* Storage may be unavailable in private browsing. */ } };
  return <AuthContext.Provider value={{ status, login: () => update('authenticated'), logout: () => update('logged-out') }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }
