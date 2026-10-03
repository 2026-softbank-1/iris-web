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
 * 웹이 직접 요청하는 것은 MANUAL·REDEPLOY·ROLLBACK·RESTART 뿐이다(DeploymentCreate).
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
  triggerType: 'MANUAL' | 'REDEPLOY' | 'ROLLBACK' | 'RESTART';
  /**
   * REDEPLOY·ROLLBACK 에서 필수. ROLLBACK 은 SUCCEEDED 인 배포여야 한다.
   * RESTART 는 지금 떠 있는(마지막으로 성공한) 배포의 이미지를 빌드 없이 다시 배포하며 보내지 않는다.
   * 성공한 배포가 없거나 내려간(REMOVE) 서비스면 409 NO_SUCCEEDED_DEPLOYMENT, 진행 중인 배포가 있으면 409 DEPLOYMENT_IN_PROGRESS 다.
   */
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

/* diagnosis */
export type DiagnosisStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
/** diagnosed 가 아니어도 정상 응답이다. 원인·해결책이 비어 있을 수 있다. */
export type AnalysisStatus = 'diagnosed' | 'insufficient_evidence' | 'no_failure_evidence';
/** direct 는 로그에 직접 나온 것, supported 는 근거로 추정한 것이다. 서버가 값을 늘려도 화면이 죽지 않아야 한다. */
export type SupportLevel = 'direct' | 'supported';
export type RemediationStatus = 'proposed' | 'needs_more_evidence' | 'not_needed';
export type DiagnosisHypothesisDto = {
  id: string;
  category?: string;
  supportLevel: SupportLevel;
  statement: string;
  evidenceIds?: string[];
  /** 반대 근거. 화면에서는 아직 쓰지 않는다. */
  counterEvidenceIds?: string[];
  uncertainty?: string;
};
export type DiagnosisPlaceholderDto = { name: string; description: string };
export type DiagnosisChangeDto = {
  kind?: 'code' | 'configuration' | 'command';
  target: string;
  /** 수정 대상 문자열이 로그에 있었다는 뜻일 뿐 맞다는 보장이 아니다. */
  targetKnown?: boolean;
  instruction: string;
  language?: string;
  /** 항상 template. snippet 의 `{{NAME}}` 자리표시자를 채워 써야 하고 실제 코드를 열어 만든 패치가 아니다. */
  snippetKind?: string;
  snippet?: string;
  placeholders?: DiagnosisPlaceholderDto[];
};
export type DiagnosisVerificationDto = { instruction: string; expectedResult: string };
export type DiagnosisPlanDto = {
  id: string;
  title: string;
  evidenceIds?: string[];
  applyWhen?: string[];
  changes?: DiagnosisChangeDto[];
  verification?: DiagnosisVerificationDto[];
  rollback?: string[];
  risks?: string[];
};
export type DiagnosisNextCheckDto = { id: string; target: string; method: string; purpose: string };
export type DiagnosisMissingInfoDto = { requestedData: string; reason: string };
export type DiagnosisAnalysisDto = {
  analysisStatus: AnalysisStatus;
  summary: string;
  hypotheses?: DiagnosisHypothesisDto[];
  nextChecks?: DiagnosisNextCheckDto[];
  missingInformation?: DiagnosisMissingInfoDto[];
  limitations?: string[];
  remediation: { status: RemediationStatus; reason?: string; plans?: DiagnosisPlanDto[] };
};
/** 진단이 근거로 쓴 로그 한 줄(서버가 비밀값 패턴을 이미 가렸다). */
export type DiagnosisEvidenceDto = { id: string; stage: string; timestamp?: string; text: string };
/**
 * AI 진단 1회. 해결책은 제안일 뿐 서버가 실행하지 않고, 진단으로 배포 상태도 바뀌지 않는다.
 * SUCCEEDED 면 analysis·evidence 가 있고, FAILED 면 errorCode 가 있다. 값이 없는 필드는 응답에서 빠진다.
 */
export type DiagnosisDto = {
  id: number;
  deploymentId: number;
  status: DiagnosisStatus;
  analysis?: DiagnosisAnalysisDto;
  evidence?: DiagnosisEvidenceDto[];
  /** 로그 누락·잘림·마스킹 같은 진단 입력의 한계. */
  inputLimitations?: string[];
  /** FAILED 일 때만 있다. 서버 코드(DIAGNOSIS_LOGS_UNAVAILABLE 등)나 에이전트 코드(MODEL_TIMEOUT 등)다. */
  errorCode?: string;
  createdAt: string;
  finishedAt?: string;
};
/**
 * 가장 최근 진단. 진단한 적이 없으면 404 DIAGNOSIS_NOT_FOUND 다(화면은 AI 진단 버튼을 보여 준다).
 * RUNNING 이면 2~3초마다 다시 받아 SUCCEEDED·FAILED 가 될 때까지 본다.
 */
export const getDeploymentDiagnosis = (serviceId: number | string, deploymentId: number | string, signal?: AbortSignal) =>
  request<DiagnosisDto>(`/services/${serviceId}/deployments/${deploymentId}/diagnosis`, { signal });
/**
 * 실패한 배포(FAILED·ROLLED_BACK·MANUAL_INTERVENTION)의 진단을 시작한다. 본문은 없다.
 * 202 면 status=RUNNING 이고, 성공한 진단이 이미 있으면 모델을 다시 부르지 않고 200 으로 그 결과(SUCCEEDED)를 준다.
 * refresh=true 는 성공한 진단이 있어도 새로 진단한다(모델 비용이 드니 사용자 확인을 받고 쓴다).
 * 실패하지 않은 배포는 409 DEPLOYMENT_NOT_FAILED, 이미 진단 중이면 409 DIAGNOSIS_IN_PROGRESS, 에이전트 설정이 없으면 503 NOT_CONFIGURED 다.
 */
export const startDeploymentDiagnosis = (serviceId: number | string, deploymentId: number | string, refresh = false, signal?: AbortSignal) =>
  request<DiagnosisDto>(`/services/${serviceId}/deployments/${deploymentId}/diagnose`, { method: 'POST', query: { refresh: refresh || undefined }, signal });

/* scaling */
/** Kubernetes 수량 문자열. cpu 는 `"1"`·`"0.5"`·`"250m"`, memory 는 `"536870912"`·`"512Mi"`·`"1Gi"` 같은 표기다. */
export type ResourceQuantityDto = { cpu: string; memory: string };
export type ScalingUpdate = {
  /** 0~10. 0 이면 Pod 이 없어 요청을 처리하지 못한다. */
  replicas: number;
  /** Pod 하나의 자원. requests 는 limits 이하여야 하고 네 값을 모두 보내야 한다. */
  resources: { requests: ResourceQuantityDto; limits: ResourceQuantityDto };
};
/** 저장된 **원하는** 설정이다. 실제 Pod 수나 적용 완료를 뜻하지 않는다. 설정한 적 없는 서비스는 서버 기본값이 온다. */
export type ScalingDto = ScalingUpdate & {
  serviceId: number;
  /** PUT 응답에만 있다. 적용하려고 만든 RESTART 배포 요청이다. */
  deploymentRequestId?: number;
};
export const getServiceScaling = (serviceId: number | string, signal?: AbortSignal) => request<ScalingDto>(`/services/${serviceId}/scaling`, { signal });
/**
 * 설정 전체를 바꾼다. 202 로 접수하고 성공한 현재 이미지로 RESTART 배포를 만들어 빌드 없이 적용하니 Pod 이 새로 시작된다.
 * 배포가 진행 중이면 409 DEPLOYMENT_IN_PROGRESS, 성공한 배포가 없으면 409 NO_SUCCEEDED_DEPLOYMENT 다.
 * idempotencyKey 가 같고 설정도 같으면 서버가 새로 만들지 않고 처음 만든 요청을 돌려준다.
 */
export const updateServiceScaling = (serviceId: number | string, json: ScalingUpdate, idempotencyKey?: string) =>
  request<ScalingDto>(`/services/${serviceId}/scaling`, { method: 'PUT', json, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });

/* variables */
/** 사용자가 등록한 환경변수. 값은 소유자에게 평문으로 온다. */
export type VariableDto = { key: string; value: string };
/** 플랫폼이 배포할 때 앱에 넣는 변수. 서비스만으로 값이 정해지는 것만 value 가 있다. 사용자가 바꿀 수 없다. */
export type SystemVariableDto = { key: string; description: string; value?: string };
export type ServiceVariablesDto = {
  /** 키 순. */
  variables: VariableDto[];
  systemVariables: SystemVariableDto[];
};
/**
 * 변수를 바꿔도 실행 중인 앱은 그대로이고, 다음 배포(Deploy·Redeploy)나 Restart 가 그 시점의 변수를 가져간다.
 * 서버는 키(영문·숫자·밑줄, 숫자로 시작 불가, 128자 이하, PORT·IRIS_ 접두어 예약)와 개수(100개)·값 크기(32KiB)를 검증하고
 * 어기면 422 INVALID_INPUT 을 준다. 암호화 키가 없는 서버는 503 NOT_CONFIGURED 다.
 */
export const getServiceVariables = (serviceId: number | string, signal?: AbortSignal) =>
  request<ServiceVariablesDto>(`/services/${serviceId}/variables`, { signal });
/** 이미 있는 키면 409 VARIABLE_CONFLICT. */
export const createServiceVariable = (serviceId: number | string, json: VariableDto) =>
  request<VariableDto>(`/services/${serviceId}/variables`, { method: 'POST', json });
/** 없는 키면 404 VARIABLE_NOT_FOUND. */
export const updateServiceVariable = (serviceId: number | string, key: string, value: string) =>
  request<VariableDto>(`/services/${serviceId}/variables/${encodeURIComponent(key)}`, { method: 'PUT', json: { value } });
/** 없는 키면 404 VARIABLE_NOT_FOUND. */
export const deleteServiceVariable = (serviceId: number | string, key: string) =>
  request<void>(`/services/${serviceId}/variables/${encodeURIComponent(key)}`, { method: 'DELETE' });
/**
 * `.env` 텍스트(`KEY=VALUE` 한 줄에 하나)로 서비스의 변수 전체를 바꾼다. 텍스트에 없는 키는 지워진다.
 * 파싱은 서버가 하고, 형식이 틀린 줄이 있으면 422 INVALID_INPUT 으로 아무것도 바뀌지 않는다(응답에 줄 번호는 없다).
 */
export const replaceServiceVariables = (serviceId: number | string, raw: string) =>
  request<ServiceVariablesDto>(`/services/${serviceId}/variables`, { method: 'PUT', json: { raw } });

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
