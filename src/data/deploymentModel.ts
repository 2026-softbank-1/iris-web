// was 의 배포 요청을 화면 모델(Deployment)로 바꾸는 순수 함수들. 훅은 useDeployments.ts 에 있다.
import type { MessageKey, Vars } from '../i18n';
import type { DeploymentDto, DeploymentStatus as ApiStatus, DeploymentTrigger, FailureCode, LatestDeploymentDto, SessionUser } from '../lib/endpoints';
import type { Deployment, DeploymentStatus, Msg, Service } from './mock';

const LABELS: Record<DeploymentStatus, string> = {
  ACTIVE: 'Active',
  REMOVED: 'Removed',
  TAKEN_DOWN: 'Taken down',
  REMOVING: 'Removing',
  CRASHED: 'Crashed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
  BUILDING: 'Building',
  QUEUED: 'Queued',
  DEPLOYING: 'Deploying',
  ROLLED_BACK: 'Rolled back',
  MANUAL_INTERVENTION: 'Needs attention',
};
export const deploymentLabel = (status: DeploymentStatus) => LABELS[status];

/** was 상태값(SUCCEEDED 등)을 그대로 보여줄 때 쓰는 이름. */
const API_LABELS: Record<ApiStatus, string> = {
  QUEUED: 'Queued',
  BUILDING: 'Building',
  DEPLOYING: 'Deploying',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  ROLLED_BACK: 'Rolled back',
  MANUAL_INTERVENTION: 'Needs attention',
};
export const apiStatusLabel = (status: ApiStatus) => API_LABELS[status];

const VIA: Record<DeploymentTrigger, string> = {
  PUSH: 'GitHub push',
  MANUAL: 'Manual deploy',
  REDEPLOY: 'Redeploy',
  ROLLBACK: 'Rollback',
  CLI: 'CLI',
  RESTART: 'Restart',
  REMOVE: 'Remove',
};

/** 배포가 실패한 이유 문장의 키. 모르는 코드는 undefined 라서 이유 없이 실패했다고만 알린다. */
export function failureKey(code?: FailureCode): MessageKey | undefined {
  switch (code) {
    case 'BUILD_CONFIG_REQUIRED': return 'service.failure.configRequired';
    case 'BUILD_FAILED': return 'service.failure.buildFailed';
    case 'DEPLOY_FAILED': return 'service.failure.deployFailed';
    default: return undefined;
  }
}

/** Msg 를 지금 언어의 문장으로. then 이 있으면 sep(기본 공백)으로 이어 붙인다. 일본어는 `。` 뒤에 공백을 두지 않는다. */
export function renderMsg(t: (key: MessageKey, vars?: Vars) => string, msg: Msg, sep = ' '): string {
  return msg.then ? `${t(msg.key, msg.vars)}${sep}${t(msg.then)}` : t(msg.key, msg.vars);
}

/**
 * 서비스 응답의 latestDeployment 로 서비스 상태를 정한다.
 * 성공·롤백됨은 online(롤백됨은 이전 버전이 계속 서비스한다), 진행 중은 deploying, 실패·수동 개입은 crashed.
 * 서비스를 내리는 요청(REMOVE)은 removeStatusOf 가 따로 정한다.
 */
export function serviceStatusOf(latest: Pick<LatestDeploymentDto, 'status' | 'triggerType' | 'sourceSha' | 'failureCode'> | undefined): Pick<Service, 'state' | 'deploying' | 'crashedBanner' | 'removed' | 'offlineLabel' | 'crashedLabel'> {
  if (!latest) return { state: 'offline' };
  if (latest.triggerType === 'REMOVE') return removeStatusOf(latest.status);
  const sha = latest.sourceSha.slice(0, 7);
  switch (latest.status) {
    case 'SUCCEEDED': return { state: 'online' };
    case 'ROLLED_BACK': return { state: 'online', crashedBanner: { key: 'service.banner.rolledBack', vars: { sha } } };
    case 'QUEUED':
    case 'BUILDING':
    case 'DEPLOYING': return { state: 'offline', deploying: true };
    case 'MANUAL_INTERVENTION': return { state: 'crashed', crashedBanner: { key: 'service.banner.manual', vars: { sha } } };
    case 'FAILED': return { state: 'crashed', crashedBanner: { key: 'service.banner.failed', vars: { sha }, then: failureKey(latest.failureCode) } };
  }
}

/**
 * 서비스를 클러스터에서 내리는 요청(REMOVE)이 가장 최근일 때의 서비스 상태. 앱이 내려간 것은 요청이 성공했을 때뿐이다.
 * 진행 중이면 앱이 아직 떠 있고, FAILED 는 서비스를 건드리기 전에 끝난 것이라 그대로이며, MANUAL_INTERVENTION 은 GitOps 만
 * 바뀌고 서비스 상태를 알 수 없는 것이다(was ADR 0016).
 */
function removeStatusOf(status: ApiStatus): ReturnType<typeof serviceStatusOf> {
  switch (status) {
    case 'SUCCEEDED': return { state: 'offline', removed: true, offlineLabel: 'Service is removed' };
    case 'QUEUED':
    case 'BUILDING':
    case 'DEPLOYING': return { state: 'offline', deploying: true, offlineLabel: 'Removing' };
    case 'FAILED':
    case 'ROLLED_BACK': return { state: 'online', crashedBanner: { key: 'service.dp.removeFailed' } };
    case 'MANUAL_INTERVENTION': return { state: 'crashed', crashedBanner: { key: 'service.dp.removeManual' }, crashedLabel: { key: 'service.canvas.removeAttention' } };
  }
}

const UI_STATUS: Record<ApiStatus, DeploymentStatus> = {
  SUCCEEDED: 'REMOVED', // 가장 최근에 성공한 배포가 아니면 이미 다른 버전으로 대체된 것이다
  QUEUED: 'QUEUED',
  BUILDING: 'BUILDING',
  DEPLOYING: 'DEPLOYING',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  MANUAL_INTERVENTION: 'MANUAL_INTERVENTION',
};

/**
 * 가장 최근에 성공한 요청이 서비스의 지금 모습을 정한다. 그것이 REMOVE 면 서비스가 클러스터에서 내려간 것이라
 * 서비스 중인 배포(Active)가 없다. 이전에 성공한 배포는 모두 대체된 이력이다.
 */
export const isRemoved = (dtos: DeploymentDto[]) => dtos.find((d) => d.status === 'SUCCEEDED')?.triggerType === 'REMOVE';

/** 화면에 보여줄 상태. REMOVE 요청은 서비스 중인 배포도, 대체된 배포도 아니라서 성공해도 늘 "내려감" 이벤트로 보인다. */
function uiStatusOf(dto: DeploymentDto, live: boolean): DeploymentStatus {
  if (dto.triggerType === 'REMOVE') {
    if (dto.status === 'SUCCEEDED') return 'TAKEN_DOWN';
    if (dto.isActive) return 'REMOVING';
  }
  return live ? 'ACTIVE' : UI_STATUS[dto.status];
}

/** was 의 배포 요청 목록(최신순)을 화면 모델로 바꾼다. 가장 최근에 성공한 배포가 현재 서비스 중인 배포(ACTIVE)다. 서비스가 내려갔으면 없다. */
export function toDeployments(dtos: DeploymentDto[], service: Service, me?: SessionUser | null): Deployment[] {
  const liveId = isRemoved(dtos) ? undefined : dtos.find((d) => d.status === 'SUCCEEDED')?.id;
  return dtos.map((dto) => {
    const mine = dto.requestedBy !== undefined && dto.requestedBy === me?.id;
    // was 가 새 트리거를 먼저 내보내도 패널이 비지 않게, 모르는 값은 그대로 보여준다.
    const via = VIA[dto.triggerType] ?? dto.triggerType;
    return {
      id: String(dto.id),
      shortId: String(dto.id),
      status: uiStatusOf(dto, dto.id === liveId),
      message: dto.sourceCommitMessage?.split('\n')[0] || `Commit ${dto.sourceSha.slice(0, 7)}`,
      createdAt: dto.createdAt,
      author: mine && me ? me.login : via,
      authorAvatar: mine && me?.avatarUrl ? me.avatarUrl : '',
      repo: service.repo,
      branch: service.remote?.sourceBranch ?? '',
      commitUrl: `https://github.com/${service.repo}/commit/${dto.sourceSha}`,
      // 아래는 was 가 주지 않는 값이다. 화면에서는 값이 있을 때만 보여준다.
      region: service.region,
      replicas: 0,
      restartPolicy: '',
      maxRetries: 0,
      builder: { name: service.remote?.builder ?? '', version: '' },
      runtimes: [],
      variablesCount: 0,
      buildLogs: [],
      deployLogs: [],
      buildRange: { start: dto.createdAt, end: dto.updatedAt },
      deployRange: { start: dto.createdAt, end: dto.updatedAt },
      sourceSha: dto.sourceSha,
      updatedAt: dto.updatedAt,
      trigger: dto.triggerType,
      via: via.replace('GitHub push', 'GitHub').replace(' deploy', ''),
      failureCode: dto.failureCode,
      requestedBy: dto.requestedBy,
      isActive: dto.isActive,
    };
  });
}

/**
 * Redeploy 를 줄 수 있는 요청인가. REMOVE 요청은 서비스를 내린 것이지 다시 올릴 배포가 아니다(내려간 배포는 그 앞 행에 있다).
 * Rollback 은 성공했다가 대체된 배포(REMOVED)에서만 주니 REMOVE 요청에는 따로 막을 것이 없다.
 */
export const canRedeploy = (d: Pick<Deployment, 'trigger'>) => d.trigger !== 'REMOVE';

/**
 * Restart 를 줄 수 있는 배포인가. 지금 서비스 중인 배포(Active)에만 주고, 진행 중인 배포가 있으면 서버가 409 를 주니 막는다.
 * 서비스가 내려갔으면 Active 가 없으니 어느 행에도 주지 않는다.
 */
export const canRestart = (d: Pick<Deployment, 'status'>, all: Pick<Deployment, 'isActive'>[]) => d.status === 'ACTIVE' && !all.some((x) => x.isActive);

/** Activity 목록의 한 줄에 쓰는 말("서비스 deployment succeeded"). REMOVE 는 배포가 아니라 서비스를 내리는 요청이라 말을 바꾼다. */
export function activityOf(dto: Pick<DeploymentDto, 'status' | 'triggerType' | 'isActive'>): { noun: string; state: string } {
  if (dto.triggerType !== 'REMOVE') return { noun: 'deployment', state: apiStatusLabel(dto.status).toLowerCase() };
  return { noun: 'removal', state: dto.isActive ? 'in progress' : apiStatusLabel(dto.status).toLowerCase() };
}

/** 초를 `m:ss` 로. */
export const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return 'In progress';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
