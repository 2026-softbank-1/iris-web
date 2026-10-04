import type { MessageKey } from '../i18n';
import { ApiError } from '../lib/api';
import type { OnpremServerDto, OnpremServerStatus, TargetDto } from '../lib/endpoints';

/** 서버가 아직 연결을 기다리는 중이다(명령 실행 전이거나 연결 확인 중). */
export const isServerConnecting = (status: OnpremServerStatus) => status === 'PENDING' || status === 'REGISTERING';

/** 등록 토큰 유효 기간. 토큰을 발급(재발급)하면 서버가 PENDING 이 되므로, 만료 시각에서 이만큼 빼면 PENDING 이 된 시각이다. */
const REGISTRATION_TTL_MS = 24 * 60 * 60_000;
/** 한 상태에서 연결을 기다리며 상태를 다시 받는 최대 시간. 서버는 15분 안에 연결되지 않으면 FAILED 로 바꾼다. */
export const SERVER_POLL_LIMIT_MS = 20 * 60_000;

/** PENDING 인데 등록 토큰이 만료됐다. 명령을 다시 받아야 하고, 그때까지 상태가 바뀌지 않는다. */
export const isRegistrationExpired = (server: OnpremServerDto, now = Date.now()) =>
  server.status === 'PENDING' && !!server.registrationExpiresAt && Date.parse(server.registrationExpiresAt) <= now;

/**
 * 이 서버의 상태를 계속 다시 받아야 하는지. 연결을 기다리는 중이고 토큰이 살아 있으며, 지금 상태가 된 지 20분이 안 됐을 때만이다.
 * 지금 상태가 된 시각은 PENDING 이면 토큰 발급 시각이고, REGISTERING 은 응답에 시각이 없어 화면이 그 상태를 처음 본 시각(observedAt)이다.
 * resumedAt 은 사용자가 다시 확인을 누른 시각으로, 그때부터 20분을 다시 센다.
 */
export function shouldPollServer(server: OnpremServerDto, observedAt: number, now = Date.now(), resumedAt = 0): boolean {
  // 연결이 끊긴 서버도 저절로 다시 연결되므로 같은 기한 동안 다시 받아 배포 버튼이 풀리게 한다.
  if (!(isServerConnecting(server.status) || server.status === 'DISCONNECTED') || isRegistrationExpired(server, now)) return false;
  const since = server.status === 'PENDING' && server.registrationExpiresAt ? Date.parse(server.registrationExpiresAt) - REGISTRATION_TTL_MS : observedAt;
  return now - Math.max(since, resumedAt) < SERVER_POLL_LIMIT_MS;
}

export const SERVER_STATUS_LABEL: Record<OnpremServerStatus, MessageKey> = {
  PENDING: 'servers.status.PENDING',
  REGISTERING: 'servers.status.REGISTERING',
  CONNECTED: 'servers.status.CONNECTED',
  FAILED: 'servers.status.FAILED',
  DISCONNECTED: 'servers.status.DISCONNECTED',
};

// 서버 등록·관리 API 의 오류 중 화면 문구가 따로 있는 것. 나머지는 describeError 로 보여 준다.
const SERVER_ERROR_MESSAGE: Record<string, MessageKey> = {
  ONPREM_SERVER_NAME_CONFLICT: 'servers.nameConflict',
  ONPREM_SERVER_LIMIT_EXCEEDED: 'servers.limitExceeded',
  ONPREM_SERVER_IN_USE: 'servers.inUse',
  NOT_CONFIGURED: 'servers.notConfigured',
};
/** 서버 API 오류의 번역 문구 키. 따로 정한 문구가 없으면 null 이다. */
export const serverErrorMessage = (error: unknown): MessageKey | null =>
  (error instanceof ApiError && SERVER_ERROR_MESSAGE[error.code]) || null;

/**
 * 화면에 보일 타깃 이름. 내 서버 타깃은 `onprem-{serverKey}` 대신 사용자가 붙인 서버 이름이다.
 * 타깃 응답의 onpremServerName 을 쓰고, 그 필드가 없는 was 에서는 서버 목록에서 찾는다.
 */
export function targetLabel(target: TargetDto, servers: OnpremServerDto[]): string {
  if (target.onpremServerId == null) return target.name;
  return target.onpremServerName ?? servers.find((server) => server.id === target.onpremServerId)?.name ?? target.name;
}
