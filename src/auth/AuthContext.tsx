import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, setUnauthorizedHandler } from '../lib/api';
import { fetchMe, githubLoginUrl, requestLogout, type SessionUser } from '../lib/endpoints';

type Status = 'loading' | 'authenticated' | 'logged-out';
type Auth = {
  status: Status;
  user: SessionUser | null;
  /** 세션 확인에 실패한 이유. 미로그인(401)은 오류가 아니라서 담지 않는다. */
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 세션은 HttpOnly 쿠키라 화면에서는 직접 볼 수 없다. 시작할 때 /me 로 확인한다.
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (!(e instanceof ApiError && e.status === 401)) setError("Couldn't reach the server. Check that the API is running.");
        setStatus('logged-out');
      });
    return () => { cancelled = true; };
  }, []);

  // 세션이 중간에 만료돼 API 가 401 을 주면 로그인 화면으로 보낸다.
  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); setStatus('logged-out'); });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(() => window.location.assign(githubLoginUrl()), []);
  const logout = useCallback(async () => {
    try { await requestLogout(); } catch { /* 요청이 실패해도 화면은 로그아웃으로 바꾼다. 쿠키는 HttpOnly 라 여기서 지울 수 없다. */ }
    setUser(null);
    setStatus('logged-out');
  }, []);

  const value = useMemo(() => ({ status, user, error, login, logout }), [status, user, error, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }

/** 로그인이 끝난 화면(RequireAuth 아래)에서 쓴다. */
export function useSessionUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error('Authenticated user required');
  return user;
}
