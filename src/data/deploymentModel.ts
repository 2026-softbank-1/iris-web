// was 의 배포 요청을 화면 모델(Deployment)로 바꾸는 순수 함수들. 훅은 useDeployments.ts 에 있다.
import type { DeploymentDto, DeploymentStatus as ApiStatus, DeploymentTrigger, FailureCode, SessionUser } from '../lib/endpoints';
import type { Deployment, DeploymentStatus, Service } from './mock';

const LABELS: Record<DeploymentStatus, string> = {
  ACTIVE: 'Active',
  REMOVED: 'Removed',
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

const VIA: Record<DeploymentTrigger, string> = { PUSH: 'GitHub push', MANUAL: 'Manual deploy', REDEPLOY: 'Redeploy', ROLLBACK: 'Rollback', CLI: 'CLI' };

export function failureText(code?: FailureCode): string | undefined {
  switch (code) {
    case 'BUILD_CONFIG_REQUIRED': return 'Build configuration is required. Choose a builder in Settings.';
    case 'BUILD_FAILED': return 'The build failed.';
    case 'DEPLOY_FAILED': return 'The deployment failed to start.';
    default: return undefined;
  }
}

/**
 * 서비스 응답의 latestDeployment 로 서비스 상태를 정한다.
 * 성공·롤백됨은 online(롤백됨은 이전 버전이 계속 서비스한다), 진행 중은 deploying, 실패·수동 개입은 crashed.
 */
export function serviceStatusOf(latest: { status: ApiStatus; sourceSha: string; failureCode?: FailureCode } | undefined): Pick<Service, 'state' | 'deploying' | 'crashedBanner'> {
  if (!latest) return { state: 'offline' };
  const sha = latest.sourceSha.slice(0, 7);
  switch (latest.status) {
    case 'SUCCEEDED': return { state: 'online' };
    case 'ROLLED_BACK': return { state: 'online', crashedBanner: `Deployment ${sha} failed and was rolled back to the previous version.` };
    case 'QUEUED':
    case 'BUILDING':
    case 'DEPLOYING': return { state: 'offline', deploying: true };
    case 'MANUAL_INTERVENTION': return { state: 'crashed', crashedBanner: `Deployment ${sha} needs manual intervention.` };
    case 'FAILED': return { state: 'crashed', crashedBanner: `Deployment ${sha} failed. ${failureText(latest.failureCode) ?? ''}`.trim() };
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

/** was 의 배포 요청 목록(최신순)을 화면 모델로 바꾼다. 가장 최근에 성공한 배포가 현재 서비스 중인 배포(ACTIVE)다. */
export function toDeployments(dtos: DeploymentDto[], service: Service, me?: SessionUser | null): Deployment[] {
  const liveId = dtos.find((d) => d.status === 'SUCCEEDED')?.id;
  return dtos.map((dto) => {
    const mine = dto.requestedBy !== undefined && dto.requestedBy === me?.id;
    const via = VIA[dto.triggerType];
    return {
      id: String(dto.id),
      shortId: String(dto.id),
      status: dto.id === liveId ? 'ACTIVE' : UI_STATUS[dto.status],
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
      trigger: dto.triggerType,
      via: via.replace('GitHub push', 'GitHub').replace(' deploy', ''),
      failureCode: dto.failureCode,
      requestedBy: dto.requestedBy,
      isActive: dto.isActive,
    };
  });
}

/** 초를 `m:ss` 로. */
export const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return 'In progress';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
