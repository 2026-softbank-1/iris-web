import type { ITheme } from '@xterm/xterm';
import type { MessageKey } from '../i18n';
import { ApiError } from '../lib/api';
import type { ConsolePodDto, ConsoleUnavailableReason } from '../lib/endpoints';

/** 입력이 없어도 25초마다 ping 을 보낸다. ALB idle timeout(60초)보다 짧아야 연결이 끊기지 않는다. */
export const PING_INTERVAL_MS = 25_000;
/** WebSocket 을 연 뒤 ready 프레임이 이 시간 안에 오지 않으면 연결 실패로 본다. */
export const READY_TIMEOUT_MS = 15_000;

/* ------------------------------------------------------------------ */
/* WebSocket 프레임                                                      */
/* ------------------------------------------------------------------ */

/** 클라이언트 → Gateway. 모든 프레임은 JSON 텍스트 프레임이고, 인증은 연결 뒤 첫 프레임(auth)이다. */
export type ConsoleClientFrame =
  | { type: 'auth'; token: string; cols: number; rows: number }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' };

/** Gateway → 클라이언트. error 를 보낸 뒤에는 Gateway 가 소켓을 닫는다. */
export type ConsoleServerFrame =
  | { type: 'ready'; pod: string; shell?: string }
  | { type: 'output'; data: string }
  | { type: 'pong' }
  | { type: 'exit'; code?: number }
  | { type: 'error'; code: string; message?: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Gateway 프레임을 읽는다. 모르는 type 이나 모양이 어긋난 프레임은 null 로 버려서, 서버가 프레임을 늘려도 화면이 죽지 않게 한다. */
export function parseServerFrame(raw: unknown): ConsoleServerFrame | null {
  if (typeof raw !== 'string') return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  switch (v.type) {
    case 'ready':
      return typeof v.pod === 'string' ? { type: 'ready', pod: v.pod, shell: typeof v.shell === 'string' ? v.shell : undefined } : null;
    case 'output':
      return typeof v.data === 'string' ? { type: 'output', data: v.data } : null;
    case 'pong':
      return { type: 'pong' };
    case 'exit':
      return { type: 'exit', code: typeof v.code === 'number' ? v.code : undefined };
    case 'error':
      return typeof v.code === 'string' ? { type: 'error', code: v.code, message: typeof v.message === 'string' ? v.message : undefined } : null;
    default:
      return null;
  }
}

/** `{wsUrl}/v1/exec?pod=` 주소. wsUrl 은 `/v1/…` 접두가 없는 base 라서 끝의 `/` 만 정리한다. */
export const execUrl = (wsUrl: string, pod: string) => `${wsUrl.replace(/\/+$/, '')}/v1/exec?pod=${encodeURIComponent(pod)}`;

/* ------------------------------------------------------------------ */
/* 연결 상태                                                             */
/* ------------------------------------------------------------------ */

/** 연결이 끝난 이유. error.code 는 Gateway 의 코드이거나 화면이 직접 붙인 GATEWAY_UNREACHABLE·CONNECT_TIMEOUT 이다. */
export type ConsoleEnd = { kind: 'exit'; code?: number } | { kind: 'error'; code: string; message?: string } | { kind: 'closed' };

export type ConsoleConn =
  /** 아직 Pod 를 고르지 않았다. */
  | { kind: 'idle' }
  | { kind: 'connecting'; pod: string }
  | { kind: 'connected'; pod: string; shell?: string }
  | { kind: 'ended'; pod: string; end: ConsoleEnd };

/** Gateway 의 error.code → 안내 문구. 목록에 없는 코드는 서버가 준 message 를 그대로 보여준다. */
export const CONSOLE_ERROR_KEYS: Record<string, MessageKey> = {
  UNAUTHORIZED: 'service.console.err.UNAUTHORIZED',
  TOKEN_EXPIRED: 'service.console.err.TOKEN_EXPIRED',
  TOKEN_REUSED: 'service.console.err.TOKEN_REUSED',
  POD_NOT_FOUND: 'service.console.err.POD_NOT_FOUND',
  POD_NOT_READY: 'service.console.err.POD_NOT_READY',
  SHELL_NOT_FOUND: 'service.console.err.SHELL_NOT_FOUND',
  SESSION_LIMIT_EXCEEDED: 'service.console.err.SESSION_LIMIT_EXCEEDED',
  IDLE_TIMEOUT: 'service.console.err.IDLE_TIMEOUT',
  MAX_DURATION_EXCEEDED: 'service.console.err.MAX_DURATION_EXCEEDED',
  CLUSTER_UNAVAILABLE: 'service.console.err.CLUSTER_UNAVAILABLE',
  INTERNAL_ERROR: 'service.console.err.INTERNAL_ERROR',
  GATEWAY_UNREACHABLE: 'service.console.err.GATEWAY_UNREACHABLE',
  CONNECT_TIMEOUT: 'service.console.err.CONNECT_TIMEOUT',
  API_UNREACHABLE: 'service.console.err.API_UNREACHABLE',
};

/** 화면이 보여줄 실패. code 가 CONSOLE_ERROR_KEYS 에 있으면 번역 문구를, 없으면 서버가 준 message 를 쓴다. */
export type ConsoleFailure = { code: string; message?: string };

/**
 * Control API 또는 Gateway 요청이 던진 오류를 화면용 실패로 바꾼다.
 * ApiError 가 아닌 것(fetch 의 네트워크·CORS 오류)은 어느 서버에 닿지 못했는지로 가른다.
 */
export function consoleFailureOf(error: unknown, source: 'api' | 'gateway'): ConsoleFailure {
  if (error instanceof ApiError) return { code: error.code, message: error.message };
  return { code: source === 'api' ? 'API_UNREACHABLE' : 'GATEWAY_UNREACHABLE' };
}

/** 연결이 끝났을 때 사용자에게 줄 수 있는 다음 행동. Pod 가 사라졌거나 아직 준비 중이면 목록을 새로 받고, 셸이 없으면 다시 해도 소용없다. */
export type EndAction = 'reconnect' | 'refresh' | 'none';

export function endAction(end: ConsoleEnd): EndAction {
  if (end.kind !== 'error') return 'reconnect';
  switch (end.code) {
    case 'POD_NOT_FOUND':
    case 'POD_NOT_READY':
      return 'refresh';
    case 'SHELL_NOT_FOUND':
      return 'none';
    default:
      return 'reconnect';
  }
}

/** 서버 쪽 시간 제한으로 끝났는지. 오류가 아니라 안내로 보인다. */
export const isTimeoutEnd = (end: ConsoleEnd) => end.kind === 'error' && (end.code === 'IDLE_TIMEOUT' || end.code === 'MAX_DURATION_EXCEEDED');

/* ------------------------------------------------------------------ */
/* 콘솔을 열 수 없는 경우                                                   */
/* ------------------------------------------------------------------ */

export const UNAVAILABLE_KEYS: Record<ConsoleUnavailableReason, MessageKey> = {
  NO_RUNNING_DEPLOYMENT: 'service.console.unavailableSub',
  TARGET_NOT_SUPPORTED: 'service.console.unavailableOnprem',
  NOT_CONFIGURED: 'service.console.unavailableNotConfigured',
};

/** 서버가 모르는 사유를 보내면 일반 안내로 보인다. */
export const unavailableKey = (reason?: string): MessageKey => UNAVAILABLE_KEYS[reason as ConsoleUnavailableReason] ?? 'service.console.unavailableUnknown';

/** 세션 발급이 "콘솔을 지금 열 수 없다"는 뜻으로 실패했으면 그 사유. 그 밖의 오류(네트워크·500 등)는 null 이다. */
export function unavailableReasonOf(error: unknown): ConsoleUnavailableReason | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'NO_RUNNING_DEPLOYMENT') return 'NO_RUNNING_DEPLOYMENT';
  if (error.code === 'CONSOLE_TARGET_NOT_SUPPORTED') return 'TARGET_NOT_SUPPORTED';
  if (error.code === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
  return null;
}

/* ------------------------------------------------------------------ */
/* Pod                                                                  */
/* ------------------------------------------------------------------ */

/** 이 Pod 에 바로 연결할 수 있는지. */
export const isPodConnectable = (pod: ConsolePodDto) => pod.ready && pod.phase === 'Running';

/** 목록이 하나뿐이고 준비됐으면 고르지 않고 바로 연결한다. */
export const autoConnectPod = (pods: ConsolePodDto[]): ConsolePodDto | null => (pods.length === 1 && isPodConnectable(pods[0]) ? pods[0] : null);

/* ------------------------------------------------------------------ */
/* 터미널 색                                                              */
/* ------------------------------------------------------------------ */

type Ansi = Pick<
  ITheme,
  'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite'
>;

// 배경(--bg-2)이 라이트·다크로 바뀌어도 ls --color·git·npm 출력이 읽히도록 ANSI 16색을 테마별로 따로 둔다.
const ANSI_LIGHT: Ansi = {
  black: '#191f28',
  red: '#d22030',
  green: '#0a8f56',
  yellow: '#9a6b00',
  blue: '#1b64da',
  magenta: '#7a4fc9',
  cyan: '#0b7f8f',
  white: '#6b7684',
  brightBlack: '#4e5968',
  brightRed: '#e42939',
  brightGreen: '#03b26c',
  brightYellow: '#b58100',
  brightBlue: '#3182f6',
  brightMagenta: '#8a63d2',
  brightCyan: '#12a3b4',
  brightWhite: '#191f28',
};

const ANSI_DARK: Ansi = {
  black: '#57524b',
  red: '#f06a6a',
  green: '#72c09c',
  yellow: '#ffc266',
  blue: '#6aa6ff',
  magenta: '#c39bf0',
  cyan: '#5ccfe6',
  white: '#a8a29a',
  brightBlack: '#8c867d',
  brightRed: '#ff8a8a',
  brightGreen: '#8fd9b4',
  brightYellow: '#ffd899',
  brightBlue: '#8fbfff',
  brightMagenta: '#d8b6ff',
  brightCyan: '#8be3f2',
  brightWhite: '#ffffff',
};

/** 앱의 색 토큰(`--bg-2`·`--fg`…)을 읽어 만든 터미널 테마. 테마가 바뀌면 다시 호출한다. */
export function terminalTheme(root: HTMLElement): ITheme {
  const style = getComputedStyle(root);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const dark = root.dataset.theme === 'dark';
  return {
    background: token('--bg-2', dark ? '#1a1814' : '#f9fafb'),
    foreground: token('--fg', dark ? '#ffffff' : '#191f28'),
    cursor: token('--fg', dark ? '#ffffff' : '#191f28'),
    cursorAccent: token('--bg-2', dark ? '#1a1814' : '#f9fafb'),
    selectionBackground: dark ? 'rgba(255, 164, 27, 0.35)' : 'rgba(255, 164, 27, 0.32)',
    ...(dark ? ANSI_DARK : ANSI_LIGHT),
  };
}
