// 배포 상세의 로그 탭(Build·Deploy·Network)이 쓰는 순수 함수들. 훅은 useDeploymentLogs.ts 에 있다.
import type { MessageKey, Vars } from '../i18n';
import { ApiError } from '../lib/api';
import type { BuildLogEntryDto, LogEntryDto } from '../lib/endpoints';
import { detectLevel, groupLines, nsToMs } from './logLines';
import type { LogLevel, LogLine } from './mock';

/** 한 번에 받는 줄 수. 서버 상한(1000)이다. */
export const LOG_LIMIT = 1000;

/** Unix 나노초 문자열을 ISO 시각으로(표는 이 값을 GMT+9 로 바꿔 보여 준다). */
export const nsToIso = (ns: string) => new Date(nsToMs(ns)).toISOString();

/** 빌드 로그 한 줄. CodeBuild 가 찍은 그대로라서 단계(step)로 나누지 않고 메시지를 모두 보여 준다. */
export const buildLogLine = (entry: BuildLogEntryDto): LogLine => ({ ts: nsToIso(entry.timestampNs), message: entry.message, level: detectLevel(entry.message) });

/** 빌드 로그를 파일로 내려받을 때의 본문. 받아 둔 줄 전부를 한 줄에 하나씩 쓴다. */
export const logsText = (lines: Pick<LogLine, 'message'>[]) => `${lines.map((l) => l.message).join('\n')}\n`;

/**
 * 배포 로그(앱 컨테이너)를 표의 행으로. 서버가 시간 오름차순으로 주니 그대로 이어 붙이고,
 * 스택 트레이스처럼 이어지는 줄은 같은 pod 의 앞 줄에 묶는다. pod 이 둘 이상일 때만 어느 pod 의 줄인지 속성으로 붙인다.
 */
export function deployLogLines(entries: LogEntryDto[]): LogLine[] {
  const manyPods = new Set(entries.map((e) => e.pod)).size > 1;
  return groupLines(
    entries.map((e) => ({
      ts: nsToIso(e.timestampNs),
      message: e.message,
      level: detectLevel(e.message),
      attrs: manyPods ? [{ key: 'pod', value: e.pod }] : undefined,
      ns: e.timestampNs,
      stream: e.pod,
    })),
  );
}

/** 바이트를 읽기 쉽게. 1024 단위. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** ALB 가 서비스에 요청을 보내고 응답 헤더를 받기까지의 시간. 없으면 측정되지 않은 것이다. */
export function formatResponseTime(seconds?: number): string {
  if (seconds === undefined) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(2)} s`;
}

/** 상태 코드가 표에서 어떤 색으로 보일지. 서비스 로그의 레벨 막대와 같은 말을 쓴다(5xx 는 에러, 4xx 는 경고). */
export const statusLevel = (status: number): LogLevel => (status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info');

/**
 * 로그 탭에 보여줄 오류 문장. 서버가 준 코드만 풀고 모르는 오류는 서버 메시지 대신 일반 문구로 둔다(로그 저장소의 오류 문구는 길고 내부 정보를 담을 수 있다).
 */
export function describeLogsError(error: unknown, t: (key: MessageKey, vars?: Vars) => string): string {
  // 응답을 받지 못했다(연결 끊김 등).
  if (!(error instanceof ApiError)) return t('service.dp.logs.err.network');
  switch (error.code) {
    case 'SERVICE_NOT_FOUND':
    case 'DEPLOYMENT_REQUEST_NOT_FOUND': return t('service.dp.logs.err.notFound');
    case 'NOT_CONFIGURED': return t('service.dp.logs.err.notConfigured');
    case 'EXTERNAL_ERROR': return t('service.dp.logs.err.external');
    case 'INVALID_INPUT':
    case 'VALIDATION_ERROR': return t('service.dp.logs.err.invalid');
  }
  return t('service.dp.logs.err.server');
}
