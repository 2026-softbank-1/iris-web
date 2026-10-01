import { createContext, useContext, useState, type ReactNode } from 'react';
type Status = 'authenticated' | 'logged-out' | 'onboarding';
type Auth = { status: Status; login: () => void; signup: () => void; logout: () => void; complete: () => void };
const AuthContext = createContext<Auth | null>(null);
const KEY = 'railway-clone-auth';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => {
    try { const value = localStorage.getItem(KEY); return value === 'logged-out' || value === 'onboarding' ? value : 'authenticated'; } catch { return 'authenticated'; }
  });
  const update = (value: Status) => { setStatus(value); try { localStorage.setItem(KEY, value); } catch { /* Storage may be unavailable in private browsing. */ } };
  return <AuthContext.Provider value={{ status, login: () => update('authenticated'), signup: () => update('onboarding'), logout: () => update('logged-out'), complete: () => update('authenticated') }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }
