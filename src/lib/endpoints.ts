// was(Control API) 엔드포인트와 요청·응답 타입. 필드는 서버 JSON 그대로(camelCase)다.
// 값이 null 인 필드는 서버가 응답에서 빼므로 모두 optional 이다.
import { apiUrl, request } from './api';

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export type SessionUser = { id: number; githubId: number; login: string; avatarUrl?: string };

export type ProjectDto = {
  id: number;
  name: string;
  description?: string;
  serviceCount: number;
  onlineServiceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Builder = 'dockerfile' | 'railpack';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'DEPLOYING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK' | 'MANUAL_INTERVENTION';
/**
 * 배포 요청을 만든 방식. was 가 값을 늘려 갈 수 있으니 화면은 모르는 값이 와도 죽지 않아야 한다(deploymentModel 의 VIA 참고).
 * 웹이 직접 요청하는 것은 MANUAL·REDEPLOY·ROLLBACK 뿐이다(DeploymentCreate).
 */
export type DeploymentTrigger = 'MANUAL' | 'PUSH' | 'CLI' | 'REDEPLOY' | 'ROLLBACK' | 'RESTART' | 'REMOVE';
export type FailureCode = 'BUILD_CONFIG_REQUIRED' | 'BUILD_FAILED' | 'DEPLOY_FAILED';

/** 서비스 응답에 붙는 가장 최근 배포 요청. */
export type LatestDeploymentDto = {
  id: number;
  status: DeploymentStatus;
  triggerType: DeploymentTrigger;
  sourceSha: string;
  sourceCommitMessage?: string;
  failureCode?: FailureCode;
  createdAt: string;
  updatedAt: string;
};
export type DeploymentDto = LatestDeploymentDto & {
  serviceId: number;
  /** 요청한 사용자 id. 푸시 웹훅이 만든 요청에는 없다. */
  requestedBy?: number;
  /** 다른 배포를 원본으로 삼은 요청(재배포·롤백 등)의 원본 배포 id. 화면에서는 아직 쓰지 않는다. */
  sourceDeploymentId?: number;
  /** QUEUED·BUILDING·DEPLOYING 이면 진행 중이다. */
  isActive: boolean;
};
export type DeploymentStageDto = { status: DeploymentStatus; startedAt: string; finishedAt?: string; durationSeconds?: number };
export type DeploymentHistoryDto = { fromStatus?: DeploymentStatus; toStatus: DeploymentStatus; failureCode?: FailureCode; createdAt: string };
export type DeploymentDetailDto = DeploymentDto & { stages: DeploymentStageDto[]; history: DeploymentHistoryDto[] };
export type DeploymentCreate = {
  triggerType: 'MANUAL' | 'REDEPLOY' | 'ROLLBACK';
  /** REDEPLOY·ROLLBACK 에서 필수. ROLLBACK 은 SUCCEEDED 인 배포여야 한다. */
  sourceDeploymentId?: number;
  /** MANUAL 에서만 쓴다. 없으면 서버가 브랜치의 최신 커밋을 읽는다. */
  sourceSha?: string;
};

export type ServiceDto = {
  id: number;
  projectId: number;
  name: string;
  sourceRepositoryUrl: string;
  sourceBranch: string;
  rootDirectory?: string;
  isAutoDeploy: boolean;
  builder?: Builder;
  dockerfilePath?: string;
  platform: string;
  port?: number;
  buildCommand?: string;
  startCommand?: string;
  targetIds: number[];
  /** 가장 최근 배포 요청. 배포한 적이 없으면 없다. */
  latestDeployment?: LatestDeploymentDto;
  createdAt: string;
  updatedAt: string;
};

/**
 * 서비스가 한 타깃에서 열리는 공개 주소. 서비스가 연결한 타깃마다 한 건이다.
 * 도메인 규칙이 없는 타깃(local)은 host·url 이 없다.
 */
export type ServiceDomainDto = {
  targetId: number;
  targetName: string;
  targetKind: string;
  /** `{서비스 이름}-{서비스 id}.{타깃 접미사}`. */
  host?: string;
  /** `https://{host}`. */
  url?: string;
  /** 그 타깃에 배포가 성공한 적이 있다. 그 전에는 주소가 있어도 앱이 응답하지 않는다(503). */
  isConnected: boolean;
};

export type TargetDto = { id: number; name: string; kind: string; region?: string; domainSuffix?: string };
/** was 에 로컬 타깃(LOCAL)으로 배포하는 구현이 아직 없다. 화면에는 보여주되 고를 수 없게 한다. */
export const isTargetSupported = (target: TargetDto) => target.kind !== 'LOCAL';
export type InstallationDto = { installationId: number; accountLogin: string; accountType: string };
export type RepositoryDto = { fullName: string; url: string; defaultBranch: string; isPrivate: boolean; installationId: number };
export type BranchDto = { name: string; isDefault: boolean };

export type ProjectCreate = { name: string; description?: string };
// PATCH 는 보낸 키만 바꾼다. null 을 보내면 값을 비운다(비울 수 없는 필드는 서버가 거부한다).
export type ProjectUpdate = { name?: string; description?: string | null };
export type ServiceCreate = {
  repositoryUrl: string;
  name?: string;
  branch?: string;
  rootDirectory?: string;
  isAutoDeploy?: boolean;
  targetIds?: number[];
};
export type ServiceUpdate = {
  name?: string;
  sourceBranch?: string;
  rootDirectory?: string | null;
  isAutoDeploy?: boolean;
  builder?: Builder | null;
  dockerfilePath?: string | null;
  port?: number | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  targetIds?: number[];
};

/* auth */
export const fetchMe = () => request<SessionUser>('/me');
export const requestLogout = () => request<void>('/auth/logout', { method: 'POST' });
/** 브라우저를 통째로 보내는 주소다(GitHub 로 리다이렉트되므로 fetch 가 아니다). */
export const githubLoginUrl = () => apiUrl('/auth/github');
/** GitHub App 설치 페이지로 가는 주소. 설치를 마치면 로그인 콜백으로 돌아온다. */
export const githubInstallUrl = () => apiUrl('/github/install');

/* projects */
const MAX_PAGE_SIZE = 100;
/** 프로젝트 전체. 서버가 페이지 단위라 끝까지 이어서 받는다. */
export async function listProjects(): Promise<ProjectDto[]> {
  const all: ProjectDto[] = [];
  for (let page = 0; ; page++) {
    const res = await request<Page<ProjectDto>>('/projects', { query: { page, size: MAX_PAGE_SIZE } });
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) return all;
  }
}
export const createProject = (json: ProjectCreate) => request<ProjectDto>('/projects', { method: 'POST', json });
export const getProject = (id: number | string) => request<ProjectDto>(`/projects/${id}`);
export const updateProject = (id: number | string, json: ProjectUpdate) => request<ProjectDto>(`/projects/${id}`, { method: 'PATCH', json });
export const deleteProject = (id: number | string) => request<void>(`/projects/${id}`, { method: 'DELETE' });

/* services */
export const listServices = (projectId: number | string) => request<ServiceDto[]>(`/projects/${projectId}/services`);
export const createService = (projectId: number | string, json: ServiceCreate) =>
  request<ServiceDto>(`/projects/${projectId}/services`, { method: 'POST', json });
export const getService = (id: number | string) => request<ServiceDto>(`/services/${id}`);
export const updateService = (id: number | string, json: ServiceUpdate) => request<ServiceDto>(`/services/${id}`, { method: 'PATCH', json });
export const deleteService = (id: number | string) => request<void>(`/services/${id}`, { method: 'DELETE' });
export const listServiceDomains = (serviceId: number | string) => request<ServiceDomainDto[]>(`/services/${serviceId}/domains`);

/* deployments */
export const isDeploymentInProgress = (status: DeploymentStatus) => status === 'QUEUED' || status === 'BUILDING' || status === 'DEPLOYING';
export const listDeployments = (serviceId: number | string, page = 0, size = 20) =>
  request<Page<DeploymentDto>>(`/services/${serviceId}/deployments`, { query: { page, size } });
/** idempotencyKey 가 같으면 서버가 새로 만들지 않고 처음 만든 요청을 돌려준다(더블 클릭·재시도 대비). */
export const createDeployment = (serviceId: number | string, json: DeploymentCreate, idempotencyKey?: string) =>
  request<DeploymentDto>(`/services/${serviceId}/deployments`, { method: 'POST', json, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });
export const getDeployment = (serviceId: number | string, deploymentId: number | string) =>
  request<DeploymentDetailDto>(`/services/${serviceId}/deployments/${deploymentId}`);

/* logs */
/** 런타임 로그 한 줄. timestampNs 는 Unix 나노초이고, number 로는 정밀도가 모자라서 문자열로 온다. */
export type LogEntryDto = { timestampNs: string; message: string; pod: string; container: string };
export type LogsDto = { entries: LogEntryDto[]; isTruncated: boolean };
/** 기간 안의 로그. 서버가 최신순으로 limit 줄까지만 준다(최대 1000). */
export const searchLogs = (serviceId: number | string, query: { targetId: number; start: string; end: string; limit?: number }) =>
  request<LogsDto>(`/services/${serviceId}/logs`, { query });
/**
 * 로그 SSE 주소. EventSource 는 fetch 가 아니라서 request() 를 못 쓰고 주소만 만들어 직접 연다.
 * cursor(나노초)를 주면 그 시각부터, 없으면 서버가 10초 전부터 보낸다.
 */
export const logStreamUrl = (serviceId: number | string, targetId: number, cursor?: string) => {
  const params = new URLSearchParams({ targetId: String(targetId) });
  if (cursor) params.set('cursor', cursor);
  return apiUrl(`/services/${serviceId}/logs/stream?${params}`);
};

/* metrics */
/** 지표 한 점. timestamp 는 Unix 초이고 소수일 수 있다. */
export type MetricPointDto = { timestamp: number; value: number };
/**
 * 지표 시리즈 하나. metric 은 cpu(cores)·memory(bytes)·network_receive(bytes/s)·network_transmit(bytes/s).
 * groupBy=total 이면 metric 당 하나이고 데이터가 없으면 points 가 빈 배열이다.
 * groupBy=pod 이면 (metric, pod) 마다 하나이고 pod 이 있다. 데이터가 없는 metric 은 항목이 없다.
 */
export type MetricSeriesDto = { metric: string; unit: string; pod?: string; points: MetricPointDto[] };
export type MetricsGroupBy = 'total' | 'pod';
/**
 * 기간 안의 서비스 지표. start·end 는 타임존이 있는 ISO 8601 이고 end 는 미래일 수 없다. 기간은 최대 7일,
 * step 은 15~86400초이고 (end-start)/step 이 1440 을 넘으면 서버가 422 를 준다. pod 이 metric 당 50개를 넘어도 422 다.
 * groupBy 를 모르는 서버(구버전)는 쿼리를 무시하고 total 형태(pod 필드 없음)를 돌려준다.
 */
export const getServiceMetrics = (
  serviceId: number | string,
  query: { targetId: number; start: string; end: string; step: number; groupBy?: MetricsGroupBy },
  signal?: AbortSignal,
) => request<MetricSeriesDto[]>(`/services/${serviceId}/metrics`, { query, signal });

/* targets */
export const listTargets = () => request<TargetDto[]>('/targets');

/* github */
export const listInstallations = () => request<InstallationDto[]>('/github/installations');
export const searchRepositories = (query: { q?: string; installationId?: number; page?: number; size?: number } = {}) =>
  request<Page<RepositoryDto>>('/github/repos', { query: { size: MAX_PAGE_SIZE, ...query } });
export const resolveRepository = (url: string) => request<RepositoryDto>('/github/repos/resolve', { query: { url } });
export const listBranches = (fullName: string) => {
  const [owner, repo] = fullName.split('/');
  return request<BranchDto[]>(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`);
};
