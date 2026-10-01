// API 주소. dev 서버는 CORS·쿠키 문제를 피하려고 항상 같은 origin(/api)으로 호출하고,
// vite 프록시(vite.config.ts)가 VITE_API_BASE_URL 로 넘긴다. build 결과물은 이 값으로 직접 호출한다.
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const API_PREFIX = '/api/v1';

export const apiUrl = (path: string) => `${API_BASE_URL}${API_PREFIX}${path}`;

export type SessionUser = { id: number; githubId: number; login: string; avatarUrl?: string };

// was 의 공통 응답 봉투. 성공·실패가 같은 구조이고, 실패 때 code 에 도메인 예외 코드가 온다.
type ApiEnvelope<T> = { success: boolean; code?: string; message?: string; data?: T };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) throw new ApiError(res.status, body?.code ?? 'UNKNOWN', body?.message ?? res.statusText);
  return body.data as T;
}

export const fetchMe = () => request<SessionUser>('/me');
export const requestLogout = () => request<void>('/auth/logout', { method: 'POST' });
/** 브라우저를 통째로 보내는 주소다(GitHub 로 리다이렉트되므로 fetch 가 아니다). */
export const githubLoginUrl = () => apiUrl('/auth/github');
