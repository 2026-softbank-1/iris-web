// was(Control API) 엔드포인트와 요청·응답 타입. 필드는 서버 JSON 그대로(camelCase)다.
// 값이 null 인 필드는 서버가 응답에서 빼므로 모두 optional 이다.
import { ApiError, apiUrl, request } from './api';

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
export type FailureCode = 'BUILD_CONFIG_REQUIRED' | 'BUILD_FAILED' | 'DEPLOY_FAILED' | 'VARIABLES_INVALID' | 'DEPENDENCY_FAILED';
/**
 * 새 버전의 Pod 를 띄우는 방식. CANARY·BLUE_GREEN 은 저장된 레플리카가 2개 이상일 때만 저장할 수 있고(아니면 422 INVALID_INPUT),
 * 저장해도 배포를 만들지 않고 다음 배포부터 쓴다. 배포할 때 레플리카가 2개 미만이면 서버가 ROLLING 으로 대체한다.
 */
export type DeploymentStrategy = 'ROLLING' | 'CANARY' | 'BLUE_GREEN';

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
  /** 요청 시점에 서비스에 저장돼 있던 배포 방식. 배포 방식 도입 전 요청과 REMOVE 요청에는 없다. */
  requestedDeploymentStrategy?: DeploymentStrategy;
  /** 실제로 쓴 배포 방식. 레플리카가 2개 미만이었으면 요청과 달리 ROLLING 이다. requestedDeploymentStrategy 와 함께 있거나 함께 없다. */
  deploymentStrategy?: DeploymentStrategy;
};
export type DeploymentStageDto = { status: DeploymentStatus; startedAt: string; finishedAt?: string; durationSeconds?: number };
export type DeploymentHistoryDto = { fromStatus?: DeploymentStatus; toStatus: DeploymentStatus; failureCode?: FailureCode; createdAt: string };
/** 배포가 쓴 소스. 브랜치는 배포 시점이 아니라 서비스의 지금 설정이다. */
export type DeploymentSourceDto = { repository: string; branch: string };
export type DeploymentTargetDto = { id: number; name: string; kind: string };
/**
 * 배포 상세에 보여 줄 설정. 값은 배포 시점의 스냅샷이 아니라 서비스의 **지금** 설정이다(startCommand 는 빌드가 기록한 값이 있으면 그 값).
 * builder 가 없으면 아직 확정되지 않은 것이라 화면은 Auto-detect 로 보인다. targets 는 실제로 반영한 타깃이고, 반영 전이면 서비스에 지정된 타깃이다.
 */
export type DeploymentConfigurationDto = {
  build: { builder?: Builder; rootDirectory?: string; buildCommand?: string };
  deploy: { targets: DeploymentTargetDto[]; port?: number; startCommand?: string };
};
export type BuildStatus = 'PENDING' | 'SNAPSHOTTING' | 'BUILDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
/** 빌드가 끝난 상태. 로그를 더 기다리지 않는다. */
export const isBuildFinished = (status?: BuildStatus) => status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED';
export type DeploymentBuildDto = {
  status: BuildStatus;
  builder?: Builder;
  imageDigest?: string;
  startedAt?: string;
  finishedAt?: string;
  failureCode?: FailureCode;
};
export type ReleaseStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'ROLLING_BACK' | 'ROLLED_BACK';
/** 타깃 하나에 배포한 결과. 배포까지 가지 못한 요청은 releases 가 빈 배열이다. */
export type DeploymentReleaseDto = {
  id: number;
  targetId: number;
  status: ReleaseStatus;
  argoSyncStatus?: string;
  argoHealthStatus?: string;
  gitopsCommitSha?: string;
  failureCode?: FailureCode;
  finishedAt?: string;
};
/** 성공했던 배포를 더 새로운 성공 배포가 대신했을 때만 있다(화면의 Removed). */
export type DeploymentReplacedByDto = { deploymentId: number; at: string };
export type DeploymentDetailDto = DeploymentDto & {
  stages: DeploymentStageDto[];
  history: DeploymentHistoryDto[];
  source: DeploymentSourceDto;
  configuration: DeploymentConfigurationDto;
  /** 빌드를 시작하기 전에 끝난 요청은 없다. */
  build?: DeploymentBuildDto;
  releases: DeploymentReleaseDto[];
  replacedBy?: DeploymentReplacedByDto;
};
export type DeploymentCreate = {
  triggerType: 'MANUAL' | 'REDEPLOY' | 'ROLLBACK' | 'RESTART';
  /** true 면 환경변수 검증 error 가 있어도 요청한다(MANUAL·REDEPLOY·RESTART 의 오탐 우회). */
  skipVariableValidation?: boolean;
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
  /** 배포 방식을 모르는 서버(구버전)는 보내지 않는다. 그때는 ROLLING 으로 본다. */
  deploymentStrategy?: DeploymentStrategy;
  /** 가장 최근 배포 요청. 배포한 적이 없으면 없다. */
  latestDeployment?: LatestDeploymentDto;
  /** 레포 구성 확인(분석 게이트)을 거쳐 만든 서비스면 그 결과. 거치지 않았거나 모르는 서버(구버전)면 null·없음. */
  analysisGate?: AnalysisGateDto | null;
  /** APP(기본) 또는 DATABASE(플랫폼이 고정 이미지로 띄우는 관리형 DB). 구버전 서버는 보내지 않는다. */
  kind?: ServiceKind;
  /** kind=DATABASE 일 때 엔진. */
  databaseEngine?: DatabaseEngine;
  /** 같은 프로젝트의 다른 서비스가 쓰는 클러스터 내부 주소(`app.svc-{id}.svc.cluster.local`). */
  internalHost?: string;
  internalPort?: number;
  /** DB 서비스의 연결 정보. 비밀번호는 마스킹돼 있다. */
  connection?: DatabaseConnectionDto;
  /** 같은 레포 분석에서 함께 만들어진 스택. 단일 서비스는 없다. */
  stack?: { id: number; unitId: string | null } | null;
  /** 관리형 DB 설정. 저장 공간은 만든 뒤 바꿀 수 없다. */
  database?: { image?: string; storageGi?: number; user?: string; database?: string; initScripts?: DatabaseInitScriptDto[] | null } | null;
  /** 이 서비스를 참조 변수로 가리킬 때 고를 수 있는 속성(DB 는 엔진별, 앱은 url·host·port). */
  referenceProperties?: ReferenceProperty[];
  /** 같은 프로젝트 서비스로의 DNS 별칭(compose 호스트명). 수정은 PATCH /services/{id} 의 hostAliases(전체 교체). */
  hostAliases?: HostAliasDto[] | null;
  createdAt: string;
  updatedAt: string;
};

/** DB 가 처음 만들어질 때 한 번 실행된 초기화 스크립트 메타데이터. */
export type DatabaseInitScriptDto = { name: string; path?: string; sha256: string; size: number };
export type HostAliasDto = { name: string; targetServiceId: number; port?: number | null };
export type ServiceKind = 'APP' | 'DATABASE';
export type DatabaseEngine = 'postgres' | 'mysql' | 'mongodb' | 'redis';
export const DATABASE_ENGINES: DatabaseEngine[] = ['postgres', 'mysql', 'mongodb', 'redis'];
/** 참조 변수가 가리킬 수 있는 연결 정보 속성. */
export type ReferenceProperty = 'url' | 'host' | 'port' | 'user' | 'password' | 'database';
export const REFERENCE_PROPERTIES: ReferenceProperty[] = ['url', 'host', 'port', 'user', 'password', 'database'];
export type DatabaseConnectionDto = { urlTemplate: string; properties: ReferenceProperty[] };

/**
 * 서비스가 한 타깃에서 열리는 공개 주소. 서비스가 연결한 타깃마다 한 건이다.
 * 도메인 규칙이 없는 타깃은 host·url 이 없다.
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

/**
 * 사용자가 등록한 온프레미스 서버의 연결 상태. PENDING(명령 실행 전) → REGISTERING(서버가 연결을 보냄, 확인 중) →
 * CONNECTED(배포 가능) / FAILED(15분 안에 연결되지 않음, 토큰을 다시 발급해 명령을 다시 실행한다).
 */
export type OnpremServerStatus = 'PENDING' | 'REGISTERING' | 'CONNECTED' | 'FAILED';
export type OnpremServerFailureCode = 'CONNECT_TIMED_OUT' | 'GITOPS_COMMIT_FAILED';

/**
 * 공용 타깃(AWS·기존 onprem)과 내 서버 타깃. 내 서버 타깃은 onpremServerId·connectionStatus 가 있고 이름이 `onprem-{serverKey}` 다.
 * 공용 타깃은 둘 다 없고 항상 배포할 수 있다.
 */
export type TargetDto = {
  id: number;
  name: string;
  kind: 'AWS' | 'ONPREM';
  region?: string;
  domainSuffix?: string;
  onpremServerId?: number;
  /** 내 서버 타깃의 서버 이름(사용자가 붙인 이름). 화면은 타깃 이름 대신 이것을 보여 준다. */
  onpremServerName?: string;
  connectionStatus?: OnpremServerStatus;
};
/** 서버가 제공하는 AWS·온프레미스 타깃을 서비스 생성과 설정에서 선택할 수 있다. */
export const isTargetSupported = (target: TargetDto) => target.kind === 'AWS' || target.kind === 'ONPREM';
/** 지금 이 타깃으로 배포할 수 있는지. 내 서버 타깃은 연결(CONNECTED)된 뒤에만 된다(아니면 서버가 409 TARGET_NOT_CONNECTED). */
export const isTargetDeployable = (target: TargetDto) => target.connectionStatus == null || target.connectionStatus === 'CONNECTED';

export type OnpremServerDto = {
  id: number;
  name: string;
  /** 8자 무작위 키. 타깃 이름(`onprem-{serverKey}`)과 서비스 주소에 쓰인다. 비밀이 아니다. */
  serverKey: string;
  status: OnpremServerStatus;
  targetId: number;
  tailnetFqdn?: string;
  failureCode?: OnpremServerFailureCode;
  /** 등록 토큰 만료 시각(발급 후 24시간). 지나면 토큰을 다시 발급해야 한다. */
  registrationExpiresAt?: string;
  connectedAt?: string;
  createdAt: string;
};
/** 서버 등록·토큰 재발급 응답. registrationToken·installCommand 는 이 응답에서만 받을 수 있다. */
export type OnpremServerRegistrationDto = { server: OnpremServerDto; registrationToken: string; installCommand: string };
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
  /** 레포 구성 확인이 skip 으로 끝났을 때 그 분석 id. 서버가 결과를 서비스에 남기고 빌더 기본값으로 쓴다. */
  analysisId?: number;
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
  deploymentStrategy?: DeploymentStrategy;
  hostAliases?: HostAliasDto[];
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

/* repository analyses (레포 구성 확인 · 분석 게이트) */
export type AnalysisRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'APPLIED';
export type AnalysisDecision = 'skip' | 'analyze';
export type AnalysisComplexity = 'simple' | 'complex' | 'unsupported';
export type AnalysisMode = 'auto' | 'force';
export type AnalysisRole = 'web' | 'api' | 'worker' | 'app';
export type AnalysisEvidenceDto = { path: string; line?: number | null };
export type AnalysisReasonDto = { code: string; message: string; paths?: string[] };
/** env 값이 다른 unit/의존성의 연결 정보에서 온다는 분석기의 추정. 확인하지 못했으면 null. */
export type AnalysisBindingDto =
  | { kind: 'dependency'; targetId: string; property: ReferenceProperty }
  | { kind: 'unit'; targetId: string; property: 'url' | 'host' | 'port' };
export type AnalysisEnvDto = { key: string; stage: 'runtime' | 'build'; required: boolean; binding?: AnalysisBindingDto | null };
/** 코드가 호스트명으로 쓰는 다른 unit/의존성(예: `api:3000`). apply 가 같은 이름의 호스트 별칭을 만든다. */
export type AnalysisHostAliasDto = { host: string; port?: number | null; targetId: string; evidence?: AnalysisEvidenceDto[] };
export type AnalysisUnitDto = {
  id: string;
  name: string;
  /** 레포 루트 기준. */
  rootDirectory: string;
  builder: Builder;
  /** 이 unit 의 rootDirectory 기준. */
  dockerfilePath?: string | null;
  port?: number | null;
  startCommand?: string | null;
  buildCommand?: string | null;
  role: AnalysisRole;
  public: boolean;
  env: AnalysisEnvDto[];
  hostAliases?: AnalysisHostAliasDto[];
  dependsOn: string[];
  evidence?: AnalysisEvidenceDto[];
};
/** compose 가 `/docker-entrypoint-initdb.d` 에 넣는 초기화 스크립트(내용은 오지 않는다). supported=false(.sh·너무 큼)는 플랫폼이 실행하지 않는다. */
export type AnalysisInitScriptDto = { path: string; kind: string; sha256?: string | null; size: number; order: number; supported?: boolean };
export type AnalysisDependencyDto = {
  id: string;
  engine: DatabaseEngine | 'other';
  image?: string | null;
  port?: number | null;
  database?: string | null;
  user?: string | null;
  /** compose 에 비밀번호가 하드코딩돼 있다는 표시뿐이다. 값은 오지 않는다. */
  passwordInSource?: boolean;
  initScripts?: AnalysisInitScriptDto[];
  evidence?: AnalysisEvidenceDto[];
};
export type AnalysisQuestionDto = { code: string; unitId?: string | null; message: string };
/** 분석기 gate CLI 응답 원문(`iris.analysis-gate.v1`). */
export type AnalysisGateResultDto = {
  schemaVersion: string;
  sourceSha?: string | null;
  rootDirectory: string;
  decision: AnalysisDecision;
  complexity: AnalysisComplexity;
  reasons: AnalysisReasonDto[];
  signals?: Record<string, unknown>;
  simpleBuild?: { builder: Builder; dockerfilePath?: string | null } | null;
  units: AnalysisUnitDto[];
  dependencies: AnalysisDependencyDto[];
  questions: AnalysisQuestionDto[];
  analysis?: { engine: string; durationMs?: number; modelCalls?: number };
};
export type RepositoryAnalysisDto = {
  id: number;
  projectId: number;
  status: AnalysisRunStatus;
  decision?: AnalysisDecision | null;
  complexity?: AnalysisComplexity | null;
  sourceRepositoryUrl: string;
  sourceBranch: string;
  sourceSha?: string | null;
  rootDirectory?: string | null;
  mode: AnalysisMode;
  /** SUCCEEDED·APPLIED 일 때 분석기 응답 원문. */
  result?: AnalysisGateResultDto | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  appliedServiceIds?: number[] | null;
  createdAt: string;
  updatedAt: string;
};
export type RepositoryAnalysisCreate = {
  sourceRepositoryUrl: string;
  githubInstallationId?: number;
  sourceBranch: string;
  rootDirectory?: string;
  mode: AnalysisMode;
};
export type AnalysisUnitApply = {
  unitId: string;
  name: string;
  rootDirectory?: string;
  builder?: Builder;
  dockerfilePath?: string;
  port?: number;
  startCommand?: string;
  buildCommand?: string;
};
/** 분석된 의존성(DB)을 플랫폼이 만들지. 보내지 않으면 서버 기본값(지원 엔진은 전부 provision)을 쓴다. */
export type AnalysisDependencyApply = { dependencyId: string; provision: boolean; name?: string; storageGi?: number };
export type RepositoryAnalysisApply = {
  units: AnalysisUnitApply[];
  dependencies?: AnalysisDependencyApply[];
  deploy: boolean;
  /** true 면 환경변수 error 가 있어도 배포를 접수한다. */
  skipVariableValidation?: boolean;
  /** 배포 타깃 id. 정확히 1개다. 생략하면 서버가 `aws` 타깃을 쓴다. */
  targetIds?: number[];
};
export type RepositoryAnalysisApplyDto = {
  analysisId: number;
  services: ServiceDto[];
  /** 이 분석으로 만들었거나 이어 쓰는 관리형 DB 서비스. */
  databases?: ServiceDto[];
  stackId?: number | null;
  /** 의존 순서 배포를 접수했으면 그 스택 배포 id. */
  stackDeploymentId?: number | null;
  /** 환경변수 error 로 배포를 접수하지 않았으면 서비스별 검증 결과. 서비스는 만들어져 있으니 고친 뒤 스택 재배포를 한다. */
  variableIssues?: (VariablesValidationDto & { serviceId: number })[] | null;
  /** 증분 apply 에서 이미 있는 DB 의 초기화 스크립트가 달라졌으면 DEPENDENCY_CHANGED. 다시 실행하지 않는다. */
  changes?: StackChangeDto[] | null;
};
/** 서비스에 남은 분석 게이트 결과. */
export type AnalysisGateDto = { analysisId: number; decision: AnalysisDecision; complexity?: AnalysisComplexity | null; unitId?: string | null };

export const startRepositoryAnalysis = (projectId: number | string, json: RepositoryAnalysisCreate) =>
  request<RepositoryAnalysisDto>(`/projects/${projectId}/repository-analyses`, { method: 'POST', json });
export const getRepositoryAnalysis = (projectId: number | string, analysisId: number | string, signal?: AbortSignal) =>
  request<RepositoryAnalysisDto>(`/projects/${projectId}/repository-analyses/${analysisId}`, { signal });
export const applyRepositoryAnalysis = (projectId: number | string, analysisId: number | string, json: RepositoryAnalysisApply) =>
  request<RepositoryAnalysisApplyDto>(`/projects/${projectId}/repository-analyses/${analysisId}/apply`, { method: 'POST', json });

/* deployments */
export const isDeploymentInProgress = (status: DeploymentStatus) => status === 'QUEUED' || status === 'BUILDING' || status === 'DEPLOYING';
export const listDeployments = (serviceId: number | string, page = 0, size = 20) =>
  request<Page<DeploymentDto>>(`/services/${serviceId}/deployments`, { query: { page, size } });
/** idempotencyKey 가 같으면 서버가 새로 만들지 않고 처음 만든 요청을 돌려준다(더블 클릭·재시도 대비). */
export const createDeployment = (serviceId: number | string, json: DeploymentCreate, idempotencyKey?: string) =>
  request<DeploymentDto>(`/services/${serviceId}/deployments`, { method: 'POST', json, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });
export const getDeployment = (serviceId: number | string, deploymentId: number | string) =>
  request<DeploymentDetailDto>(`/services/${serviceId}/deployments/${deploymentId}`);

/* deployment logs */
/** 빌드 로그 한 줄. timestampNs 는 Unix 나노초 문자열이다. 같은 시각의 줄이 여럿일 수 있다. */
export type BuildLogEntryDto = { timestampNs: string; message: string };
export type BuildLogsDto = {
  /** 시간 오름차순. */
  entries: BuildLogEntryDto[];
  /** 다음 호출의 cursor. 읽을 로그 스트림이 없으면 보낸 cursor 가 그대로 오고, 저장된 끝부분으로 대신한 응답에는 없다. */
  nextCursor?: string;
  buildStatus?: BuildStatus;
  /** 빌드가 끝났고 이번 호출에서 읽은 로그가 없다. true 이면 폴링을 멈춘다. */
  isComplete: boolean;
  /** 저장된 끝부분만 있고 앞부분이 빠졌다(실패한 빌드). */
  isPartial: boolean;
  /** 로그를 만든 빌드가 속한 배포. 롤백·재시작은 빌드를 새로 하지 않아 원본 배포다. 읽을 로그가 없으면 없다. */
  loggedDeploymentId?: number;
};
/**
 * 배포의 빌드 로그. 처음부터 limit(1~1000, 기본 500)줄을 주고, nextCursor 를 cursor 로 다시 불러 이어 읽는다.
 * 진행 중인 빌드는 isComplete 가 true 가 될 때까지 이어 읽는다. CloudWatch 설정이 없는데 저장된 끝부분도 없으면 503 NOT_CONFIGURED 다.
 */
export const getBuildLogs = (serviceId: number | string, deploymentId: number | string, query: { cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
  request<BuildLogsDto>(`/services/${serviceId}/deployments/${deploymentId}/build-logs`, { query, signal });

/** 배포 하나의 로그 응답이 함께 주는 기간. 조회할 것이 없으면(release 가 없는 배포 등) 없다. */
export type DeploymentLogsDto = LogsDto & { start?: string; end?: string };
/**
 * 이 배포의 release 가 붙은 앱 컨테이너 로그. 최근 limit(1~1000, 기본 200)줄을 시간 **오름차순**으로 준다(서비스 로그와 달리).
 * targetId 를 안 주면 배포가 반영된 첫 타깃이고, 배포가 쓰지 않은 타깃이면 422 다.
 * start·end 를 안 주면 DEPLOYING 이 된 때부터 교체될 때까지(최대 7일)다. 주려면 타임존이 있는 ISO 8601 이고 최대 7일, 미래는 422 다.
 * search 는 대소문자를 구분하는 부분 문자열이다.
 */
export const getDeploymentLogs = (
  serviceId: number | string,
  deploymentId: number | string,
  query: { targetId?: number; start?: string; end?: string; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) => request<DeploymentLogsDto>(`/services/${serviceId}/deployments/${deploymentId}/deploy-logs`, { query, signal });

export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx';
export const STATUS_CLASSES: StatusClass[] = ['2xx', '3xx', '4xx', '5xx'];
/**
 * ALB 접근 로그 한 건. URL·메서드·IP 는 수집하지 않아 없다.
 * status 는 사용자에게 돌려준 코드, targetStatus 는 서비스(Pod)가 돌려준 코드(ALB 가 직접 응답했으면 없다).
 */
export type NetworkLogEntryDto = {
  timestampNs: string;
  status: number;
  targetStatus?: number;
  receivedBytes: number;
  sentBytes: number;
  /** ALB 가 서비스에 요청을 보내고 응답 헤더를 받기까지(초). 클라이언트 체감 시간이 아니다. 없으면 측정되지 않은 것이다. */
  responseTimeSeconds?: number;
};
export type NetworkLogsDto = { entries: NetworkLogEntryDto[]; isTruncated: boolean; start?: string; end?: string };
/**
 * 이 배포가 서비스한 구간(SUCCEEDED 가 된 때부터 교체될 때까지)의 ALB 접근 로그. 최근 limit(1~1000, 기본 200)건을 시간 오름차순으로 준다.
 * 서비스한 적 없는 배포는 빈 entries 다. ALB 가 약 5분 주기로 로그를 올려서 최근 몇 분은 비어 있을 수 있다.
 */
export const getNetworkLogs = (
  serviceId: number | string,
  deploymentId: number | string,
  query: { targetId?: number; start?: string; end?: string; limit?: number; statusClass?: StatusClass } = {},
  signal?: AbortSignal,
) => request<NetworkLogsDto>(`/services/${serviceId}/deployments/${deploymentId}/network-logs`, { query, signal });

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
/** 참조 변수가 가리키는 같은 프로젝트 서비스의 연결 정보. */
export type VariableReferenceDto = { serviceId: number; property: ReferenceProperty };
/**
 * 사용자가 등록한 환경변수. 값은 소유자에게 평문으로 온다.
 * 참조 변수는 value 대신 reference 를 갖고, resolved 는 배포 때 들어갈 값의 미리보기(비밀은 마스킹)다.
 */
export type VariableDto = { key: string; value?: string; reference?: VariableReferenceDto; resolved?: string };
/** 쓰기 요청 본문: 값 또는 참조 중 하나. */
export type VariableWrite = { value: string } | { reference: VariableReferenceDto };
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
export const createServiceVariable = (serviceId: number | string, json: { key: string } & VariableWrite) =>
  request<VariableDto>(`/services/${serviceId}/variables`, { method: 'POST', json });
/** 없는 키면 404 VARIABLE_NOT_FOUND. */
export const updateServiceVariable = (serviceId: number | string, key: string, write: VariableWrite) =>
  request<VariableDto>(`/services/${serviceId}/variables/${encodeURIComponent(key)}`, { method: 'PUT', json: write });
/** 없는 키면 404 VARIABLE_NOT_FOUND. */
export const deleteServiceVariable = (serviceId: number | string, key: string) =>
  request<void>(`/services/${serviceId}/variables/${encodeURIComponent(key)}`, { method: 'DELETE' });
/**
 * `.env` 텍스트(`KEY=VALUE` 한 줄에 하나)로 서비스의 변수 전체를 바꾼다. 텍스트에 없는 키는 지워진다.
 * 파싱은 서버가 하고, 형식이 틀린 줄이 있으면 422 INVALID_INPUT 으로 아무것도 바뀌지 않는다(응답에 줄 번호는 없다).
 */
export const replaceServiceVariables = (serviceId: number | string, raw: string) =>
  request<ServiceVariablesDto>(`/services/${serviceId}/variables`, { method: 'PUT', json: { raw } });

/* variables validation */
export type VariableIssueCode = 'REQUIRED_MISSING' | 'LOCALHOST_ADDRESS' | 'UNRESOLVABLE_HOST' | 'SCHEME_MISMATCH' | 'REFERENCE_BROKEN';
export type VariableIssueDto = {
  /** 스택 배포 거절처럼 여러 서비스가 섞인 응답에서 어느 서비스의 이슈인지. 서비스 하나의 검증에서는 없다. */
  serviceId?: number;
  key: string;
  severity: 'error' | 'warning';
  /** 모르는 코드가 와도 화면이 죽지 않아야 한다. */
  code: VariableIssueCode | (string & {});
  message: string;
  /** 같은 프로젝트에 맞는 DB·서비스가 있으면 이 변수를 그쪽 참조로 바꾸자는 제안. */
  suggestion?: { reference: VariableReferenceDto };
};
export type VariablesValidationDto = { ok: boolean; issues: VariableIssueDto[] };
/** 422 VARIABLES_INVALID 의 details(`{field: 키, reason: 코드}`)만 있을 때 이슈 목록으로 바꾼다. */
const issuesFromDetails = (details: { field: string; reason: string }[]): VariableIssueDto[] =>
  details.map((d) => ({ key: d.field, severity: 'error', code: d.reason, message: '' }));
/** 배포하기 전에 환경변수가 맞는지 본다. 배포 요청은 error 가 있으면 422 VARIABLES_INVALID 로 거절된다. */
export const getVariablesValidation = (serviceId: number | string, signal?: AbortSignal) =>
  request<VariablesValidationDto>(`/services/${serviceId}/variables/validation`, { signal });
/** 422 VARIABLES_INVALID 응답에서 issues 를 꺼낸다. 위치는 서버 구현에 따라 data.issues 또는 details 다. */
export function variablesInvalidIssues(error: unknown): VariableIssueDto[] {
  if (!(error instanceof ApiError) || error.code !== 'VARIABLES_INVALID') return [];
  const data = error.data as { issues?: VariableIssueDto[]; serviceId?: number } | undefined;
  const issues = Array.isArray(data?.issues) ? data.issues.filter((i) => i.severity === 'error') : issuesFromDetails(error.details);
  return data?.serviceId ? issues.map((i) => ({ serviceId: data.serviceId, ...i })) : issues;
}

/* databases */
export type DatabaseCreate = { name: string; engine: DatabaseEngine; storageGi?: number; targetIds?: number[] };
/** 관리형 DB 서비스를 만들고 자동 배포를 접수한다(201). */
export const createDatabase = (projectId: number | string, json: DatabaseCreate) =>
  request<ServiceDto>(`/projects/${projectId}/databases`, { method: 'POST', json });

/* stacks (한 레포 분석에서 나온 서비스 묶음의 반복 운영) */
export type StackStepStatus = DeploymentStatus | 'HELD' | 'NOT_DEPLOYED';
export type StackServiceDto = {
  serviceId: number;
  name: string;
  unitId: string | null;
  kind: ServiceKind;
  /** 배포 순서(1 = DB, 2 = 의존 대상이 있는 앱, 3 = 나머지). */
  order: number;
  /** 이 서비스가 쓰는 같은 스택의 unitId. */
  dependsOn: string[];
  /** 이 스택 배포에서 이 서비스의 진행. 앞 단계가 실패해 시작하지 않았으면 HELD. */
  status: StackStepStatus;
  deploymentId?: number;
  /** status=HELD 일 때 어느 서비스(unitId)가 막았는지. */
  heldBy?: string;
  /** QUEUED 로 앞 단계를 기다리는 중이면 기다리는 unitId. */
  waitingFor?: string[];
  failureCode?: FailureCode;
};
/** 레포 구성이 바뀐 것으로 감지된 항목. 분석기 결과와 현재 스택을 서버가 비교한다. */
export type StackChangeDto = {
  type: 'UNIT_ADDED' | 'UNIT_REMOVED' | 'UNIT_CHANGED' | 'DEPENDENCY_ADDED' | 'DEPENDENCY_REMOVED' | 'DEPENDENCY_CHANGED';
  unitId: string;
  /** UNIT_CHANGED 에서 바뀐 필드(port, rootDirectory …). */
  field?: string;
  from?: unknown;
  to?: unknown;
  /** DEPENDENCY_CHANGED 의 사유. init_scripts_changed = 초기화 스크립트가 바뀜. */
  reason?: string | null;
  /** 서버의 안내(영문). 초기화 스크립트는 DB 를 처음 만들 때만 실행된다. */
  message?: string | null;
  serviceId?: number | null;
};
export type StackPendingChangesDto = { analysisId: number; sourceSha?: string | null; detectedAt: string; changes: StackChangeDto[] };
export type StackDto = {
  id: number;
  projectId: number;
  repositoryUrl: string;
  sourceBranch: string;
  services: StackServiceDto[];
  rootDirectory?: string | null;
  analysisId?: number;
  /** 스택 배포가 진행 중이다. */
  isDeploying?: boolean;
  latestStackDeploymentId?: number | null;
  pendingChanges?: StackPendingChangesDto | null;
};
export const listStacks = (projectId: number | string, signal?: AbortSignal) => request<StackDto[]>(`/projects/${projectId}/stacks`, { signal });
export const getStack = (projectId: number | string, stackId: number, signal?: AbortSignal) => request<StackDto>(`/projects/${projectId}/stacks/${encodeURIComponent(String(stackId))}`, { signal });
/** 스택 전체(또는 serviceIds 만)를 DB → 앱 → 나머지 순서로 다시 배포한다. 환경변수에 error 가 있으면 422 VARIABLES_INVALID. */
export const deployStack = (projectId: number | string, stackId: number, json: { serviceIds?: number[]; skipVariableValidation?: boolean } = {}) =>
  request<StackDto>(`/projects/${projectId}/stacks/${encodeURIComponent(String(stackId))}/deployments`, { method: 'POST', json, headers: { 'Idempotency-Key': crypto.randomUUID() } });

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

/**
 * 트래픽 지표(ALB 접근 로그 기반). series 는 항상 같은 순서로 8개이고 데이터가 없는 지표는 points 가 빈 배열이다.
 * metric 은 requests(requests)·error_rate_4xx·error_rate_5xx(ratio, 0~1)·public_network_receive·public_network_transmit(bytes/s)·
 * response_time_avg·response_time_p50·response_time_p95(seconds).
 * 각 점의 timestamp(Unix 초)는 step 길이 버킷이 끝나는 이벤트 시각이다. 요청이 없는 구간에는 점이 없다(0 이 아니다).
 */
export type TrafficMetricsDto = {
  /** 이 시각(Unix 초)까지만 집계가 끝났다. 이후는 비어 있는 것이 아니라 아직 모르는 구간이다(약 15분 지연). */
  availableUntil: number;
  series: MetricSeriesDto[];
};
/**
 * 기간 안의 서비스 트래픽 지표. start·end 는 요청이 일어난 이벤트 시각이고 end 는 미래일 수 없다.
 * step 은 60~86400초이고(30 이면 422) (end-start)/step 이 1440 을 넘으면 422 다. 아직 이 API 가 없는 서버는 404 를 준다.
 */
export const getServiceTrafficMetrics = (
  serviceId: number | string,
  query: { targetId: number; start: string; end: string; step: number },
  signal?: AbortSignal,
) => request<TrafficMetricsDto>(`/services/${serviceId}/traffic-metrics`, { query, signal });

/* targets */
/** 공용 타깃과 내 서버 타깃. */
export const listTargets = () => request<TargetDto[]>('/targets');

/* on-prem servers */
/**
 * 이름은 1~63자이고 내 서버 안에서 유일해야 한다(409 ONPREM_SERVER_NAME_CONFLICT). 같은 트랜잭션에서 서버 타깃도 만든다.
 * 한 사용자는 서버를 5개까지 둘 수 있다(409 ONPREM_SERVER_LIMIT_EXCEEDED). 서버 등록 설정이 없는 was 는 503 NOT_CONFIGURED 다.
 */
export const createOnpremServer = (name: string) => request<OnpremServerRegistrationDto>('/onprem-servers', { method: 'POST', json: { name } });
/** 내 서버. 최신순. */
export const listOnpremServers = (signal?: AbortSignal) => request<OnpremServerDto[]>('/onprem-servers', { signal });
/** 남의 서버나 없는 서버는 404. */
export const getOnpremServer = (id: number, signal?: AbortSignal) => request<OnpremServerDto>(`/onprem-servers/${id}`, { signal });
/**
 * PENDING·REGISTERING·FAILED 일 때만(CONNECTED 는 409 INVALID_STATUS_TRANSITION). 이전 토큰은 무효가 되고 상태는 PENDING 이 된다.
 * 서버 등록 설정이 없는 was 는 503 NOT_CONFIGURED 다.
 */
export const reissueRegistrationToken = (id: number) => request<OnpremServerRegistrationDto>(`/onprem-servers/${id}/registration-token`, { method: 'POST' });
/** 서비스가 이 서버를 쓰고 있으면 409 ONPREM_SERVER_IN_USE. */
export const deleteOnpremServer = (id: number) => request<void>(`/onprem-servers/${id}`, { method: 'DELETE' });

/* github */
export const listInstallations = () => request<InstallationDto[]>('/github/installations');
export const searchRepositories = (query: { q?: string; installationId?: number; page?: number; size?: number } = {}) =>
  request<Page<RepositoryDto>>('/github/repos', { query: { size: MAX_PAGE_SIZE, ...query } });
export const resolveRepository = (url: string) => request<RepositoryDto>('/github/repos/resolve', { query: { url } });
export const listBranches = (fullName: string) => {
  const [owner, repo] = fullName.split('/');
  return request<BranchDto[]>(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`);
};

/* code repair: credentials stay in WAS; candidate generation never publishes by itself. */
export type RepairAccessDto = { repository: string; canWrite: boolean; installationUrl: string; reason?: string };
export type RepairPublicationDto = { status: 'REDEPLOY_REQUESTED' | 'DIAGNOSING' | 'QUEUED' | 'PR_OPENED' | 'MERGED' | 'ERROR' | 'WAITING_CHECKS' | 'RECOVERING' | 'SKIPPED'; branch?: string; commitSha?: string; pullUrl?: string; mergeCommitSha?: string; redeploymentId?: number; errorCode?: string };
export type RepairDto = {
  id: number; deploymentId: number; diagnosisId: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN_OUTCOME'; sourceSha: string;
  planIds: string[]; errorCode?: string; createdAt: string; finishedAt?: string;
  result?: { status?: string; changedFiles?: { path: string }[]; artifacts?: { name: string }[] };
  publication?: RepairPublicationDto; autoMerge?: boolean; autoRedeploy?: boolean;
};
export const getRepairAccess = (serviceId: string, signal?: AbortSignal) => request<RepairAccessDto>(`/services/${serviceId}/repair-access`, { signal });
export const getLatestRepair = (serviceId: string, deploymentId: string, diagnosisId: number, signal?: AbortSignal) => request<RepairDto>(`/services/${serviceId}/deployments/${deploymentId}/repairs/latest`, { query: { diagnosisId }, signal });
export const startRepair = (serviceId: string, deploymentId: string, diagnosisId: number, planIds: string[], key: string) => request<RepairDto>(`/services/${serviceId}/deployments/${deploymentId}/repairs`, { method: 'POST', json: { diagnosisId, planIds }, headers: { 'Idempotency-Key': key } });
export const getRepair = (serviceId: string, repairId: number, signal?: AbortSignal) => request<RepairDto>(`/services/${serviceId}/repairs/${repairId}`, { signal });
export const publishRepair = (serviceId: string, repairId: number) => request<RepairDto>(`/services/${serviceId}/repairs/${repairId}/publish`, { method: 'POST' });
export const mergeRepair = (serviceId: string, repairId: number) => request<RepairDto>(`/services/${serviceId}/repairs/${repairId}/merge`, { method: 'POST' });
export const repairArtifactUrl = (serviceId: string, repairId: number, name: string) => apiUrl(`/services/${serviceId}/repairs/${repairId}/artifacts/${encodeURIComponent(name)}`);

export const requestAutomaticRepair = (serviceId: string, deploymentId: string, diagnosisId: number | undefined, key: string) => request<RepairDto>(`/services/${serviceId}/deployments/${deploymentId}/auto-repair`, { method: 'POST', json: { diagnosisId }, headers: { 'Idempotency-Key': key } });
export const resumeAutomaticRepair = (serviceId: string, repairId: number) => request<RepairDto>(`/services/${serviceId}/repairs/${repairId}/auto`, { method: 'POST' });
