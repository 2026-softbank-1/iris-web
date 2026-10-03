// API 주소. dev 서버는 CORS·쿠키 문제를 피하려고 항상 같은 origin(/api)으로 호출하고,
// vite 프록시(vite.config.ts)가 VITE_API_BASE_URL 로 넘긴다. build 결과물은 이 값으로 직접 호출한다.
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const API_PREFIX = '/api/v1';

export const apiUrl = (path: string) => `${API_BASE_URL}${API_PREFIX}${path}`;

// was 의 공통 응답 봉투. 성공·실패가 같은 구조이고, 실패 때 code 에 도메인 예외 코드가 온다.
type ApiEnvelope<T> = { success: boolean; code?: string; message?: string; data?: T; details?: ErrorDetail[] };
export type ErrorDetail = { field: string; reason: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 세션이 만료되면 어떤 API 든 401 을 돌려준다. 인증 상태를 쥔 쪽(AuthProvider)이 여기에 등록한다.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => { onUnauthorized = handler; };
// 401 이 정상 응답인 경로(로그인 여부 확인·로그아웃)는 핸들러를 부르지 않는다.
const EXPECTS_UNAUTHORIZED = new Set(['/me', '/auth/logout']);

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  headers?: Record<string, string>;
  /** 요청을 중간에 취소한다. 취소되면 fetch 가 AbortError 로 reject 한다. */
  signal?: AbortSignal;
};

export async function request<T>(path: string, { method = 'GET', query, json, headers, signal }: RequestOptions = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== '') params.set(key, String(value));
  const qs = params.size > 0 ? `?${params}` : '';
  const res = await fetch(apiUrl(`${path}${qs}`), {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(json !== undefined && { 'Content-Type': 'application/json' }), ...headers },
    body: json === undefined ? undefined : JSON.stringify(json),
    signal,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) {
    if (res.status === 401 && !EXPECTS_UNAUTHORIZED.has(path)) onUnauthorized?.();
    throw new ApiError(res.status, body?.code ?? 'UNKNOWN', body?.message ?? res.statusText, body?.details);
  }
  return body.data as T;
}

/** 화면에 보여줄 오류 문장. 코드가 정해진 오류는 풀어서 쓰고, 나머지는 서버 메시지를 쓴다. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Couldn't reach the server. Check that the API is running.";
  switch (error.code) {
    case 'PROJECT_NAME_CONFLICT': return 'A project with this name already exists.';
    case 'SERVICE_NAME_CONFLICT': return 'A service with this name already exists in this project.';
    case 'REPOSITORY_NOT_ACCESSIBLE': return 'This repository is not accessible. Install the GitHub App and grant it access.';
    case 'DEPLOYMENT_IN_PROGRESS': return 'A deployment is already in progress for this service.';
    case 'NO_SUCCEEDED_DEPLOYMENT': return 'Deploy this service successfully at least once before changing its scale.';
    case 'DEPLOYMENT_REQUEST_NOT_FOUND': return 'That deployment no longer exists.';
    case 'NOT_CONFIGURED': return 'The server is missing configuration for this feature.';
    case 'EXTERNAL_ERROR': return 'GitHub request failed. Try again in a moment.';
    case 'VALIDATION_ERROR': return error.details.map((d) => `${d.field}: ${d.reason}`).join(' · ') || 'Invalid input.';
    case 'INVALID_INPUT': return error.message.charAt(0).toUpperCase() + error.message.slice(1) + '.';
    default: return error.message;
  }
}
