// AI 진단 화면이 쓰는 순수 함수들. 훅은 useDiagnosis.ts 에 있다.
import type { MessageKey, Vars } from '../i18n';
import { ApiError, describeError } from '../lib/api';
import type { DeploymentStatus as ApiStatus, DeploymentTrigger, DiagnosisChangeDto, DiagnosisDto } from '../lib/endpoints';
import type { Deployment } from './mock';

/** 진행 중인 진단을 다시 받는 주기. 서버 안내는 2~3초다. */
export const DIAGNOSIS_POLL_MS = 2500;
/**
 * 진단이 아직 없을 때 다시 확인하는 주기. 서버가 배포 실패를 확정하면 진단을 스스로 시작하므로(사용자가 누르지 않는다),
 * 실패 직후에 연 화면도 시작된 진단을 알아채야 한다.
 */
export const DIAGNOSIS_IDLE_POLL_MS = 10_000;
/** RUNNING 이 이보다 오래가면 서버가 중간에 죽은 것이다. 다시 시작(POST)하면 서버가 낡은 진단을 닫고 새로 시작한다. */
export const DIAGNOSIS_STALE_MS = 4 * 60_000;
/** 진행 중에 조회가 이만큼 연달아 실패하면 폴링을 멈추고 알린다. */
export const MAX_POLL_FAILURES = 3;

/**
 * iris-was 의 자동 진단은 실패가 확정된 지(updated_at 기준) 이 시간 안인 배포만 시작한다. 그보다 오래된 실패는 진단 행이 없는 채로 남고,
 * 그런 배포만 사용자가 직접 시작한다. 서버 설정과 같아야 한다. 서버·브라우저 시계 차이를 감안해 조금 더 기다린다.
 */
export const AUTO_DIAGNOSIS_WINDOW_MS = 10 * 60_000;
const AUTO_DIAGNOSIS_GRACE_MS = 60_000;

/** 진단이 아직 없는 이 배포를 서버가 곧 자동으로 시작할 것인가. 아니면(오래된 실패, 시각을 모름) 사용자가 직접 시작해야 한다. */
export const isAutoDiagnosisPending = (updatedAt: string | undefined, now = Date.now()) =>
  updatedAt !== undefined && now - Date.parse(updatedAt) <= AUTO_DIAGNOSIS_WINDOW_MS + AUTO_DIAGNOSIS_GRACE_MS;

/**
 * AI 진단을 볼 수 있는 배포인가. 서버가 FAILED·ROLLED_BACK·MANUAL_INTERVENTION 만 진단하고 나머지는 409 DEPLOYMENT_NOT_FAILED 다.
 * 서비스를 내리는 요청(REMOVE)은 빌드·실행 로그가 없는 배포가 아니라서 뺀다. 상태는 toDeployments 가 바꾼 화면 모델의 값이다.
 */
export const canDiagnose = (d: Pick<Deployment, 'status' | 'trigger'>) =>
  d.trigger !== 'REMOVE' && (d.status === 'FAILED' || d.status === 'ROLLED_BACK' || d.status === 'MANUAL_INTERVENTION');

/** 같은 판정을 was 의 배포 요청(서비스 응답의 latestDeployment)으로. 서비스 실패 배너가 이것만 가지고 있다. */
export const canDiagnoseApi = (d: { status: ApiStatus; triggerType: DeploymentTrigger }) =>
  d.triggerType !== 'REMOVE' && (d.status === 'FAILED' || d.status === 'ROLLED_BACK' || d.status === 'MANUAL_INTERVENTION');

/**
 * 진단이 서버에서 멈춘 채 RUNNING 으로 남았는가. 서버 시각(createdAt)과 이 브라우저 시계를 비교하니 시계가 크게 어긋나면 틀릴 수 있다.
 */
export const isStaleRunning = (d: Pick<DiagnosisDto, 'status' | 'createdAt'>, now = Date.now()) =>
  d.status === 'RUNNING' && now - Date.parse(d.createdAt) > DIAGNOSIS_STALE_MS;

/* errors */

/**
 * 진단이 FAILED 일 때 사용자에게 보여줄 안내. 코드를 그대로 노출하지 않고 이유 문장으로 바꾼다.
 * kind 는 다음 행동이다: no-logs 는 로그를 직접 보게 하고, retry 는 다시 시도하게 하고, internal 은 계속되면 알리게 한다.
 */
export type FailureKind = 'no-logs' | 'retry' | 'internal';
const FAILURES: Record<string, { reason: MessageKey; kind: FailureKind }> = {
  DIAGNOSIS_LOGS_UNAVAILABLE: { reason: 'diag.fail.logsUnavailable', kind: 'no-logs' },
  MODEL_TIMEOUT: { reason: 'diag.fail.modelTimeout', kind: 'retry' },
  MODEL_RATE_LIMIT: { reason: 'diag.fail.modelRateLimit', kind: 'retry' },
  BUSY: { reason: 'diag.fail.busy', kind: 'retry' },
  EXTERNAL_ERROR: { reason: 'diag.fail.externalError', kind: 'retry' },
  INVALID_RESPONSE: { reason: 'diag.fail.invalidResponse', kind: 'retry' },
  TIMEOUT: { reason: 'diag.fail.timeout', kind: 'retry' },
  DIAGNOSIS_ABANDONED: { reason: 'diag.fail.abandoned', kind: 'retry' },
  INTERNAL_ERROR: { reason: 'diag.fail.internal', kind: 'internal' },
};
/** 에이전트가 코드를 늘려도 화면이 비지 않게, 모르는 코드는 다시 시도로 안내한다. */
export const describeFailure = (code?: string) => (code && FAILURES[code]) || { reason: 'diag.fail.unknown' as MessageKey, kind: 'retry' as FailureKind };

/** 진단을 시작(POST)하다 실패했을 때의 문장. 모르는 오류는 describeError 가 서버 메시지를 그대로 보여준다. */
export function describeStartError(error: unknown, t: (key: MessageKey, vars?: Vars) => string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'DEPLOYMENT_NOT_FAILED': return t('diag.err.notFailed');
      case 'NOT_CONFIGURED': return t('diag.err.notConfigured');
      case 'DIAGNOSIS_LOGS_UNAVAILABLE': return t(FAILURES.DIAGNOSIS_LOGS_UNAVAILABLE.reason);
      case 'SERVICE_NOT_FOUND':
      case 'DEPLOYMENT_REQUEST_NOT_FOUND': return t('diag.err.notFound');
    }
  }
  return describeError(error);
}

/* labels */

const SUPPORT_KEYS: Record<string, MessageKey> = { direct: 'diag.support.direct', supported: 'diag.support.supported' };
/** 확신 정도의 이름. 서버가 값을 늘려도 화면이 죽지 않게, 모르는 값은 undefined 다(그대로 보여준다). */
export const supportKey = (level: string): MessageKey | undefined => SUPPORT_KEYS[level];

const STAGE_KEYS: Record<string, MessageKey> = { build: 'diag.ev.stage.build', runtime: 'diag.ev.stage.runtime' };
export const stageKey = (stage: string): MessageKey | undefined => STAGE_KEYS[stage];

const KIND_KEYS: Record<string, MessageKey> = { code: 'diag.kind.code', configuration: 'diag.kind.configuration', command: 'diag.kind.command' };
export const changeKindKey = (kind?: string): MessageKey | undefined => (kind ? KIND_KEYS[kind] : undefined);

/* snippet */

const PLACEHOLDER = /(\{\{[^{}]+\}\})/;
/** 수정 예시를 `{{NAME}}` 자리표시자와 나머지 글로 나눈다. 자리표시자 조각만 placeholder 가 true 다. */
export function splitSnippet(snippet: string): { text: string; placeholder: boolean }[] {
  return snippet
    .split(PLACEHOLDER)
    .filter((text) => text !== '')
    .map((text) => ({ text, placeholder: PLACEHOLDER.test(text) }));
}

/** 수정 예시가 채워 써야 하는 템플릿인가. 서버는 항상 template 이라 하지만 자리표시자가 보이면 어느 쪽이든 안내한다. */
export const needsFilling = (change: Pick<DiagnosisChangeDto, 'snippet' | 'snippetKind' | 'placeholders'>) =>
  !!change.snippet && (change.snippetKind === 'template' || (change.placeholders?.length ?? 0) > 0 || PLACEHOLDER.test(change.snippet));

/** 근거 줄의 DOM id. 같은 화면에 진단이 둘 이상 그려져도 겹치지 않게 진단 id 를 붙인다. */
export const evidenceDomId = (diagnosisId: number, evidenceId: string) => `diag-ev-${diagnosisId}-${evidenceId}`;

/** 밀리초를 `m:ss` 로. */
export const formatElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
