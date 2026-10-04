// 개발용 가짜 was. `VITE_MOCK_API=1` 일 때 vite dev 서버(vite.config.ts)가 /api/v1 요청을 여기로 보낸다.
// 앱 번들에는 들어가지 않는다. 화면 디자인용이라 상태를 메모리에만 들고, dev 서버를 다시 띄우면 처음으로 돌아간다.
import type {
  AnalysisBindingDto,
  AnalysisDependencyDto,
  AnalysisDependencyApply,
  AnalysisGateResultDto,
  AnalysisInitScriptDto,
  DatabaseEngine,
  ReferenceProperty,
  StackChangeDto,
  StackDto,
  StackServiceDto,
  StackStepStatus,
  VariableDto,
  VariableIssueDto,
  VariableReferenceDto,
  VariablesValidationDto,
  AnalysisMode,
  AnalysisUnitApply,
  BranchDto,
  BuildLogsDto,
  BuildStatus,
  DeploymentDetailDto,
  DeploymentDto,
  DeploymentHistoryDto,
  DeploymentLogsDto,
  DeploymentReleaseDto,
  DeploymentStatus,
  DeploymentStrategy,
  DeploymentTrigger,
  DiagnosisAnalysisDto,
  DiagnosisDto,
  DiagnosisEvidenceDto,
  FailureCode,
  InstallationDto,
  LogEntryDto,
  MetricSeriesDto,
  NetworkLogEntryDto,
  NetworkLogsDto,
  OnpremServerDto,
  OnpremServerRegistrationDto,
  OnpremServerStatus,
  ProjectDto,
  RepositoryAnalysisDto,
  RepositoryDto,
  ScalingDto,
  ServiceDomainDto,
  ServiceDto,
  SessionUser,
  TargetDto,
} from '../lib/endpoints';

export type MockResponse = { status: number; body?: unknown; redirect?: string };
type Query = Record<string, string>;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();
const ok = (data: unknown, status = 200): MockResponse => ({ status, body: { success: true, data } });
const fail = (status: number, code: string, message: string, details?: { field: string; reason: string }[], data?: unknown): MockResponse => ({ status, body: { success: false, code, message, details, data } });

/* ------------------------------------------------------------------ */
/* 시드 데이터                                                           */
/* ------------------------------------------------------------------ */

const user: SessionUser = { id: 1, githubId: 1, login: 'kylo-dev' };
let loggedIn = true;

const sharedTargets: TargetDto[] = [
  { id: 1, name: 'aws-seoul', kind: 'AWS', region: 'ap-northeast-2', domainSuffix: 'likelion.uk' },
  { id: 2, name: 'onprem', kind: 'ONPREM', domainSuffix: 'internal.likelion.uk' },
];

/**
 * 사용자가 등록한 온프레미스 서버. status 가 정해진 시드 서버는 상태가 고정이고, 새로 만들거나 토큰을 다시 발급한 서버는
 * 명령을 실행했다고 치고 시간이 지나면 PENDING(10초) → REGISTERING(12초) → CONNECTED 로 넘어간다.
 */
type MockServer = Omit<OnpremServerDto, 'status'> & { fixedStatus?: OnpremServerStatus; startedAt?: number; isDeleted?: boolean };
const seededAt = Date.now();
const servers: MockServer[] = [
  { id: 1, name: 'home-lab', serverKey: 'k3x9q2ma', targetId: 3, fixedStatus: 'CONNECTED', tailnetFqdn: 'iris-k3x9q2ma.tailb046e8.ts.net', connectedAt: iso(seededAt - 3 * DAY), createdAt: iso(seededAt - 3 * DAY - 10 * MIN) },
  { id: 2, name: 'office-nuc', serverKey: 'n7p2w8fd', targetId: 4, fixedStatus: 'PENDING', registrationExpiresAt: iso(seededAt + 20 * HOUR), createdAt: iso(seededAt - 4 * HOUR) },
  { id: 3, name: 'old-pi', serverKey: 'q4m8z1ra', targetId: 5, fixedStatus: 'FAILED', failureCode: 'CONNECT_TIMED_OUT', registrationExpiresAt: iso(seededAt - HOUR), createdAt: iso(seededAt - 2 * DAY) },
  // 명령 다시 받기가 503 NOT_CONFIGURED 로 실패하는 서버(아래 NOT_CONFIGURED_NAMES).
  { id: 4, name: 'legacy-vm', serverKey: 'v2c7h5ke', targetId: 6, fixedStatus: 'FAILED', failureCode: 'GITOPS_COMMIT_FAILED', registrationExpiresAt: iso(seededAt - 3 * HOUR), createdAt: iso(seededAt - 5 * DAY) },
  // 연결됐다가 7분째 신호가 없는 서버(DISCONNECTED). 서비스 metrics 가 이 서버에 배포돼 있어 배포 버튼이 막힌다.
  // 시드가 5개라 서버를 더 추가하면 409 ONPREM_SERVER_LIMIT_EXCEEDED 다(old-pi 를 지우면 추가할 수 있다).
  { id: 5, name: 'rack-01', serverKey: 'r8d3n6wt', targetId: 7, fixedStatus: 'DISCONNECTED', tailnetFqdn: 'iris-r8d3n6wt.tailb046e8.ts.net', connectedAt: iso(seededAt - 10 * DAY), lastSeenAt: iso(seededAt - 7 * MIN), createdAt: iso(seededAt - 10 * DAY - 10 * MIN) },
];
/** was 와 같다: 사용자 한 명이 둘 수 있는 서버 수. 시드가 4개라 하나 더 추가한 뒤 다음 추가가 409 다. */
const MAX_SERVERS = 5;
/** 서버 등록 설정이 없는 was 를 흉내 내는 이름. 이 이름으로 추가하거나 이 서버의 명령을 다시 받으면 503 NOT_CONFIGURED 다. */
const NOT_CONFIGURED_NAMES = ['not-configured', 'legacy-vm'];
const SERVER_PENDING_MS = 10_000;
const SERVER_REGISTERING_MS = 12_000;

/** was 의 서버 이름 규칙(2026-10-04 반영). 앞뒤 공백을 자른 이름이 이 정규식을 지켜야 하고, 이름은 만들 때만 검사한다. */
const SERVER_NAME_RULE = /^(?![0-9]+$)[A-Za-z0-9가-힣][A-Za-z0-9가-힣._-]{0,62}$/;
/**
 * 규칙을 어긴 이름의 이유. was 가 details[].reason 으로 보내는 고정 영어 문구이고, 비어 있음 → 너무 김 → 숫자만 → 첫 글자 → 문자 순으로 판정한다.
 * 규칙을 지키면 null 이다. 웹의 검증(src/data/serverNameModel.ts)과 일부러 따로 쓴다: 웹이 서버와 어긋나면 mock 에서 드러나야 한다.
 */
function serverNameViolation(name: string): string | null {
  if (SERVER_NAME_RULE.test(name)) return null;
  if (name === '') return 'must not be blank';
  if (name.length > 63) return 'must be at most 63 characters';
  if (/^[0-9]+$/.test(name)) return 'must not be only digits';
  if (!/^[A-Za-z0-9가-힣]/.test(name)) return 'must start with a letter, digit or Hangul syllable';
  return "may contain only letters, digits, Hangul syllables, '.', '_' and '-' (no spaces)";
}

function serverStatusOf(m: MockServer): OnpremServerStatus {
  if (m.fixedStatus) return m.fixedStatus;
  const elapsed = Date.now() - (m.startedAt ?? 0);
  if (elapsed < SERVER_PENDING_MS) return 'PENDING';
  if (elapsed < SERVER_PENDING_MS + SERVER_REGISTERING_MS) return 'REGISTERING';
  return 'CONNECTED';
}

function toServerDto(m: MockServer): OnpremServerDto {
  const { fixedStatus: _f, startedAt, isDeleted: _d, ...rest } = m;
  const status = serverStatusOf(m);
  const connected = status === 'CONNECTED' && startedAt !== undefined;
  return {
    ...rest,
    status,
    ...(status !== 'PENDING' && { tailnetFqdn: m.tailnetFqdn ?? `iris-${m.serverKey}.tailb046e8.ts.net` }),
    ...(connected && { connectedAt: iso(startedAt + SERVER_PENDING_MS + SERVER_REGISTERING_MS) }),
    // 연결된 서버는 신호를 계속 보낸다고 친다.
    ...(status === 'CONNECTED' && { lastSeenAt: iso(Date.now() - 20_000) }),
  };
}

const liveServers = () => servers.filter((m) => !m.isDeleted);
/** 공용 타깃 + 내 서버 타깃. 서버 타깃은 서버의 지금 연결 상태를 싣는다. */
const targetsNow = (): TargetDto[] => [
  ...sharedTargets,
  ...liveServers().map((m) => ({ id: m.targetId, name: `onprem-${m.serverKey}`, kind: 'ONPREM' as const, domainSuffix: 'internal.likelion.uk', onpremServerId: m.id, onpremServerName: m.name, connectionStatus: serverStatusOf(m) })),
];

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b % 64]).join('').slice(0, 43);
/** 등록 토큰을 새로 발급한다. 이전 토큰은 무효가 되고, 명령을 실행했다고 치고 연결을 다시 시작한다. */
function issueToken(m: MockServer): OnpremServerRegistrationDto {
  m.fixedStatus = undefined;
  m.failureCode = undefined;
  m.startedAt = Date.now();
  m.registrationExpiresAt = iso(Date.now() + DAY);
  const registrationToken = randomToken();
  return {
    server: toServerDto(m),
    registrationToken,
    installCommand: `curl -fsSL https://api.likelion.uk/api/v1/onprem-servers/install.sh | sudo bash -s -- --token ${registrationToken}`,
  };
}

type MockProject = Omit<ProjectDto, 'serviceCount' | 'onlineServiceCount'>;
/**
 * AI 진단을 시작하면 어떤 결과가 나오는지. build·runtime 은 원인과 해결책이 있는 성공, insufficient·noFailure 는 근거 부족·실패 흔적
 * 없음(정상 응답), error 는 FAILED 이고 시작할 때마다 오류 코드가 바뀐다.
 */
type DiagnosisScenario = 'build' | 'runtime' | 'insufficient' | 'noFailure' | 'error';
/** auto 인 배포는 만든 뒤 시간이 지나면 QUEUED → BUILDING → DEPLOYING → SUCCEEDED 로 넘어간다. 시드 배포는 상태가 고정이다. */
type MockDeployment = Omit<DeploymentDto, 'isActive'> & { auto?: boolean; diagnosis?: DiagnosisScenario; /** 스택 배포가 만든 요청이면 스택 타임라인(DB → 앱 → 나머지)이 상태를 정한다. */ stackRun?: { stackId: number; unitId: string } };
type MockService = Omit<ServiceDto, 'latestDeployment'>;

const t0 = Date.now();
const projects: MockProject[] = [
  { id: 1, name: 'likelion-web', description: 'LikeLion 웹 서비스', createdAt: iso(t0 - 30 * DAY), updatedAt: iso(t0 - 2 * HOUR) },
  { id: 2, name: 'softbank-iris', description: 'IRIS 게이트웨이와 문서', createdAt: iso(t0 - 12 * DAY), updatedAt: iso(t0 - MIN) },
  { id: 3, name: 'playground', createdAt: iso(t0 - 2 * DAY), updatedAt: iso(t0 - 2 * DAY) },
];

const service = (id: number, projectId: number, name: string, repo: string, extra: Partial<MockService> = {}): MockService => ({
  id,
  projectId,
  name,
  sourceRepositoryUrl: `https://github.com/${repo}`,
  sourceBranch: 'main',
  isAutoDeploy: true,
  builder: 'railpack',
  platform: 'linux/amd64',
  port: 3000,
  targetIds: [1],
  deploymentStrategy: 'ROLLING',
  createdAt: iso(t0 - 10 * DAY),
  updatedAt: iso(t0 - DAY),
  ...extra,
});

const services: MockService[] = [
  service(11, 1, 'web', 'likelion/web', { rootDirectory: 'apps/web', buildCommand: 'npm run build', startCommand: 'npm start', deploymentStrategy: 'CANARY' }),
  service(12, 1, 'api', 'likelion/api', { port: 8000, builder: 'dockerfile', dockerfilePath: 'Dockerfile' }),
  service(13, 1, 'worker', 'likelion/worker', { port: undefined }),
  // 블루그린으로 저장한 뒤 레플리카를 1개로 줄여 다음 배포부터 롤링으로 대체되는 서비스.
  service(21, 2, 'gateway', 'softbank/iris-gateway', { targetIds: [1], deploymentStrategy: 'BLUE_GREEN' }),
  service(22, 2, 'docs', 'softbank/iris-docs', { isAutoDeploy: false }),
  // 온프레미스 타깃이라 레플리카가 2개여도 롤링만 쓴다.
  service(23, 2, 'edge', 'softbank/iris-edge', { targetIds: [2] }),
  service(31, 3, 'sandbox', 'kylo-dev/playground'),
  // 아직 연결되지 않은 내 서버(office-nuc)에 배포하는 서비스. 배포 버튼이 막힌다.
  service(32, 3, 'edge-api', 'kylo-dev/playground', { targetIds: [4], createdAt: iso(t0 - 3 * HOUR) }),
  // 연결이 끊긴 내 서버(rack-01)에 배포돼 있는 서비스. 배포·재배포·재시작이 막힌다.
  service(33, 3, 'metrics', 'kylo-dev/playground', { targetIds: [7], createdAt: iso(t0 - 9 * DAY) }),
];

/** 저장된 Pod 수·자원. 설정한 적 없는 서비스는 서버 기본값(레플리카 1)이다. */
const scalings = new Map<number, Omit<ScalingDto, 'serviceId' | 'deploymentRequestId'>>([
  [11, { replicas: 2, resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } } }],
  [23, { replicas: 2, resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } } }],
  [21, { replicas: 1, resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } } }],
]);
const scalingOf = (s: MockService): ScalingDto => ({
  serviceId: s.id,
  ...(scalings.get(s.id) ?? { replicas: 1, resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } } }),
});
const STRATEGIES: DeploymentStrategy[] = ['ROLLING', 'CANARY', 'BLUE_GREEN'];
const isOnPrem = (s: MockService) => targetsNow().find((x) => x.id === s.targetIds[0])?.kind === 'ONPREM';
/** was 와 같다: 요청 시점의 방식을 남기고, 온프레미스 타깃이거나 레플리카가 2개 미만이면 실제로는 롤링으로 배포한다. */
const strategySnapshot = (s: MockService) => {
  const requested = s.deploymentStrategy ?? 'ROLLING';
  return { requestedDeploymentStrategy: requested, deploymentStrategy: isOnPrem(s) || scalingOf(s).replicas < 2 ? 'ROLLING' : requested } satisfies Pick<DeploymentDto, 'requestedDeploymentStrategy' | 'deploymentStrategy'>;
};

const isSingleTarget = (v: unknown): v is number[] => Array.isArray(v) && v.length === 1 && targetsNow().some((x) => x.id === v[0]);

let nextDeploymentId = 1000;
const deployment = (
  serviceId: number,
  ago: number,
  status: DeploymentStatus,
  triggerType: DeploymentTrigger,
  message: string,
  failureCode?: FailureCode,
  diagnosis?: DiagnosisScenario,
): MockDeployment => {
  const at = t0 - ago;
  return {
    diagnosis,
    id: nextDeploymentId++,
    serviceId,
    status,
    triggerType,
    sourceSha: Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
    sourceCommitMessage: message,
    failureCode,
    requestedBy: triggerType === 'PUSH' ? undefined : user.id,
    createdAt: iso(at),
    updatedAt: iso(at + 90_000),
  };
};

// 서비스마다 다른 상태가 보이게 둔다: 성공 / 빌드 중 / 실패 / 배포 중 / 배포 이력 없음.
const deployments: MockDeployment[] = [
  deployment(11, 3 * DAY, 'SUCCEEDED', 'PUSH', 'chore: 초기 설정'),
  deployment(11, 2 * DAY, 'FAILED', 'PUSH', 'feat: 대시보드 차트', 'BUILD_FAILED', 'build'), // ① 오래된 실패라 자동 진단이 없다 → 시작 버튼 → 진행 중 → 성공
  deployment(11, 26 * HOUR, 'ROLLED_BACK', 'PUSH', 'fix: 차트 빌드 오류 수정', undefined, 'runtime'), // ④ 이미 성공한 진단이 있다
  deployment(11, 25 * HOUR, 'SUCCEEDED', 'ROLLBACK', 'chore: 초기 설정'),
  deployment(11, 2 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 랜딩 페이지 추가'),
  deployment(12, 5 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 프로젝트 API'),
  deployment(12, 40_000, 'BUILDING', 'MANUAL', 'feat: 배포 로그 SSE'),
  deployment(13, DAY, 'SUCCEEDED', 'PUSH', 'feat: 배포 큐 워커'),
  deployment(13, 3 * MIN, 'FAILED', 'PUSH', 'refactor: 재시도 정책', 'DEPLOY_FAILED', 'error'), // 방금 실패해 서버가 자동 시작(③ 시작할 때마다 다른 오류로 실패). dev 서버를 켠 지 10분이 지나면 오래된 실패가 된다
  deployment(13, 3 * HOUR, 'FAILED', 'PUSH', 'chore: 의존성 정리', 'BUILD_FAILED', 'insufficient'), // ② 근거 부족
  deployment(13, 5 * HOUR, 'FAILED', 'PUSH', 'fix: 헬스체크 경로 변경', 'DEPLOY_FAILED', 'noFailure'), // 로그에 실패 흔적 없음
  deployment(21, 6 * HOUR, 'SUCCEEDED', 'CLI', 'feat: 게이트웨이 라우팅'),
  deployment(21, MIN, 'DEPLOYING', 'REDEPLOY', 'feat: 게이트웨이 라우팅'),
  deployment(23, 4 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 엣지 캐시 설정'),
  deployment(22, 30 * MIN, 'MANUAL_INTERVENTION', 'MANUAL', 'docs: 배포 파이프라인 정리', undefined, 'runtime'), // 6분째 RUNNING 인 멈춘 진단이 있다
  deployment(33, 2 * DAY, 'SUCCEEDED', 'PUSH', 'feat: 지표 수집기'),
  deployment(31, 4 * MIN, 'FAILED', 'PUSH', 'feat: 샌드박스 초기 설정', 'DEPLOY_FAILED', 'build'), // 서비스의 가장 최근 배포가 실패했고 성공한 진단이 있다(실패 배너 아래에 진단 요약)
];

// 배포 방식 도입 뒤의 요청만 방식을 남긴다. web 의 최근 배포는 카나리로 배포했고, gateway 는 레플리카가 1개라 블루그린 대신 롤링으로 배포 중이다.
for (const d of deployments) {
  if (d.serviceId === 11 && d.sourceCommitMessage === 'feat: 랜딩 페이지 추가') Object.assign(d, { requestedDeploymentStrategy: 'CANARY', deploymentStrategy: 'CANARY' });
  if (d.serviceId === 23) Object.assign(d, { requestedDeploymentStrategy: 'ROLLING', deploymentStrategy: 'ROLLING' });
  if (d.serviceId === 21 && d.status === 'DEPLOYING') Object.assign(d, { requestedDeploymentStrategy: 'BLUE_GREEN', deploymentStrategy: 'ROLLING' });
}

// 롤백은 빌드를 새로 하지 않고 원본 배포가 만든 이미지를 쓴다(빌드 로그도 원본 배포의 것이다).
{
  const rollback = deployments.find((d) => d.serviceId === 11 && d.triggerType === 'ROLLBACK')!;
  rollback.sourceDeploymentId = deployments.find((d) => d.serviceId === 11 && d.sourceCommitMessage === rollback.sourceCommitMessage && d.triggerType === 'PUSH')!.id;
}

const installations: InstallationDto[] = [
  { installationId: 1, accountLogin: 'likelion', accountType: 'Organization' },
  { installationId: 2, accountLogin: 'kylo-dev', accountType: 'User' },
];
const repositories: RepositoryDto[] = [
  { fullName: 'likelion/web', url: 'https://github.com/likelion/web', defaultBranch: 'main', isPrivate: false, installationId: 1 },
  { fullName: 'likelion/api', url: 'https://github.com/likelion/api', defaultBranch: 'main', isPrivate: true, installationId: 1 },
  { fullName: 'likelion/worker', url: 'https://github.com/likelion/worker', defaultBranch: 'main', isPrivate: true, installationId: 1 },
  { fullName: 'kylo-dev/playground', url: 'https://github.com/kylo-dev/playground', defaultBranch: 'main', isPrivate: false, installationId: 2 },
  // 레포 구성 확인(분석 게이트) 시나리오: single-app 은 skip, multi-image-shop 은 analyze(3 units + postgres/redis), broken-repo 는 FAILED.
  { fullName: 'kylo-dev/single-app', url: 'https://github.com/kylo-dev/single-app', defaultBranch: 'main', isPrivate: false, installationId: 2 },
  { fullName: 'kylo-dev/multi-image-shop', url: 'https://github.com/kylo-dev/multi-image-shop', defaultBranch: 'main', isPrivate: false, installationId: 2 },
  // Temp_log 같은 시나리오: app + mongo, 자동 생성 비밀값, archlog 사용자 URL.
  { fullName: 'kylo-dev/temp-log', url: 'https://github.com/kylo-dev/temp-log', defaultBranch: 'main', isPrivate: false, installationId: 2 },
  { fullName: 'kylo-dev/broken-repo', url: 'https://github.com/kylo-dev/broken-repo', defaultBranch: 'main', isPrivate: true, installationId: 2 },
];
const branches: BranchDto[] = [
  { name: 'main', isDefault: true },
  { name: 'develop', isDefault: false },
  { name: 'feat/landing', isDefault: false },
];

/* ------------------------------------------------------------------ */
/* 파생 값                                                              */
/* ------------------------------------------------------------------ */

const IN_PROGRESS: DeploymentStatus[] = ['QUEUED', 'BUILDING', 'DEPLOYING'];

/** auto 배포가 지금 어느 단계인지. 큐 3초 → 빌드 20초 → 배포 10초. */
function statusOf(d: MockDeployment): DeploymentStatus {
  if (d.stackRun) return stackStepStatus(d.stackRun.stackId, d.stackRun.unitId, Date.parse(d.createdAt)) as DeploymentStatus;
  if (!d.auto) return d.status;
  const elapsed = Date.now() - Date.parse(d.createdAt);
  if (elapsed < 3_000) return 'QUEUED';
  if (elapsed < 23_000) return 'BUILDING';
  if (elapsed < 33_000) return 'DEPLOYING';
  return 'SUCCEEDED';
}

function toDeploymentDto(d: MockDeployment): DeploymentDto {
  const status = statusOf(d);
  const { auto: _auto, diagnosis: _diagnosis, stackRun: _stackRun, ...rest } = d;
  return { ...rest, status, isActive: IN_PROGRESS.includes(status), updatedAt: d.auto ? iso(Date.now()) : d.updatedAt };
}

const deploymentsOf = (serviceId: number) =>
  deployments.filter((d) => d.serviceId === serviceId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

function toServiceDto(s: MockService): ServiceDto {
  const latest = deploymentsOf(s.id)[0];
  if (!latest) return s;
  const { serviceId: _s, requestedBy: _r, sourceDeploymentId: _src, isActive: _a, ...latestDeployment } = toDeploymentDto(latest);
  return { ...s, latestDeployment };
}

function toProjectDto(p: MockProject): ProjectDto {
  const own = services.filter((s) => s.projectId === p.id).map(toServiceDto);
  return { ...p, serviceCount: own.length, onlineServiceCount: own.filter((s) => s.latestDeployment?.status === 'SUCCEEDED').length };
}

/** 상태까지 거쳐 온 단계와 전이 이력. */
function toDetailDto(d: MockDeployment): DeploymentDetailDto {
  const dto = toDeploymentDto(d);
  const start = Date.parse(d.createdAt);
  const order: DeploymentStatus[] = ['QUEUED', 'BUILDING', 'DEPLOYING'];
  const reached = IN_PROGRESS.includes(dto.status) ? order.indexOf(dto.status) : dto.failureCode === 'BUILD_FAILED' ? 1 : 2;
  const spans = [3, 50, 25]; // 초
  const stages = order.slice(0, reached + 1).map((status, i) => {
    const startedAt = start + spans.slice(0, i).reduce((a, b) => a + b, 0) * 1000;
    const running = i === reached && dto.isActive;
    return {
      status,
      startedAt: iso(startedAt),
      ...(!running && { finishedAt: iso(startedAt + spans[i] * 1000), durationSeconds: spans[i] }),
    };
  });
  const history: DeploymentHistoryDto[] = stages.map((s, i) => ({ fromStatus: i ? stages[i - 1].status : undefined, toStatus: s.status, createdAt: s.startedAt }));
  if (!dto.isActive) history.push({ fromStatus: stages.at(-1)!.status, toStatus: dto.status, failureCode: dto.failureCode, createdAt: dto.updatedAt });
  return { ...dto, stages, history, ...detailExtras(d, dto, reached, stages) };
}

const repoOf = (s: MockService) => s.sourceRepositoryUrl.replace(/^https?:\/\/github\.com\//, '');

/** 성공했던 배포를 더 새로운 성공 배포가 대신했으면 그 배포와 시각. */
function replacedByOf(d: MockDeployment): DeploymentDetailDto['replacedBy'] {
  if (statusOf(d) !== 'SUCCEEDED' || d.triggerType === 'REMOVE') return undefined;
  const newer = deploymentsOf(d.serviceId)
    .filter((x) => Date.parse(x.createdAt) > Date.parse(d.createdAt) && statusOf(x) === 'SUCCEEDED')
    .at(-1); // 최신순 목록의 마지막 = 가장 먼저 대신한 배포
  return newer && { deploymentId: newer.id, at: toDeploymentDto(newer).updatedAt };
}

/** 이 요청이 만든 빌드의 상태. 빌드를 시작하기 전(QUEUED)에는 없다. */
function buildStatusOf(d: MockDeployment): BuildStatus | undefined {
  const status = statusOf(d);
  if (status === 'QUEUED') return undefined;
  if (status === 'BUILDING') return 'BUILDING';
  return d.failureCode === 'BUILD_FAILED' || d.failureCode === 'BUILD_CONFIG_REQUIRED' ? 'FAILED' : 'SUCCEEDED';
}

/** 상세 응답에 더해진 필드: 소스·구성·빌드·release·대체한 배포. reached 는 요청이 닿은 단계(0 QUEUED, 1 BUILDING, 2 DEPLOYING)다. */
function detailExtras(d: MockDeployment, dto: DeploymentDto, reached: number, stages: { startedAt: string; finishedAt?: string }[]) {
  const s = services.find((x) => x.id === d.serviceId)!;
  const buildStatus = buildStatusOf(d);
  const releaseStatus: Record<string, DeploymentReleaseDto['status']> = { DEPLOYING: 'PENDING', SUCCEEDED: 'SUCCEEDED', ROLLED_BACK: 'ROLLED_BACK' };
  const releases: DeploymentReleaseDto[] =
    reached < 2
      ? []
      : [
          {
            id: d.id,
            targetId: s.targetIds[0],
            status: releaseStatus[dto.status] ?? 'FAILED',
            ...(dto.status === 'SUCCEEDED' && { argoSyncStatus: 'Synced', argoHealthStatus: 'Healthy' }),
            ...(dto.status === 'DEPLOYING' && { argoSyncStatus: 'OutOfSync', argoHealthStatus: 'Progressing' }),
            gitopsCommitSha: Math.abs(d.id * 2654435761).toString(16).padStart(40, '0').slice(0, 40),
            failureCode: dto.status === 'FAILED' ? 'DEPLOY_FAILED' : undefined,
            finishedAt: dto.isActive ? undefined : dto.updatedAt,
          },
        ];
  return {
    source: { repository: repoOf(s), branch: s.sourceBranch },
    configuration: {
      build: { builder: s.builder, rootDirectory: s.rootDirectory, buildCommand: s.buildCommand },
      deploy: {
        targets: s.targetIds.map((id) => {
          const target = targetsNow().find((x) => x.id === id)!;
          return { id, name: target.name, kind: target.kind };
        }),
        port: s.port,
        startCommand: s.startCommand,
      },
    },
    build: buildStatus && {
      status: buildStatus,
      builder: s.builder,
      imageDigest: buildStatus === 'SUCCEEDED' ? `sha256:${Math.abs(d.id * 40503).toString(16).padStart(64, 'c').slice(0, 64)}` : undefined,
      startedAt: stages[Math.min(1, stages.length - 1)].startedAt,
      finishedAt: buildStatus === 'BUILDING' ? undefined : stages[Math.min(1, stages.length - 1)].finishedAt ?? dto.updatedAt,
      failureCode: buildStatus === 'FAILED' ? dto.failureCode : undefined,
    },
    releases,
    replacedBy: replacedByOf(d),
  };
}

function domainsOf(s: MockService): ServiceDomainDto[] {
  const connected = deploymentsOf(s.id).some((d) => statusOf(d) === 'SUCCEEDED');
  return s.targetIds.map((id) => {
    const target = targetsNow().find((tg) => tg.id === id)!;
    // was 와 같다: 내 서버 타깃은 라벨 뒤에 서버 키를 붙여 게이트웨이가 서버를 고르게 한다.
    const serverKey = servers.find((m) => m.targetId === id)?.serverKey;
    const label = serverKey ? `${s.name}-${s.id}-${serverKey}` : `${s.name}-${s.id}`;
    const host = target.domainSuffix ? `${label}.${target.domainSuffix}` : undefined;
    return { targetId: id, targetName: target.name, targetKind: target.kind, host, url: host && `https://${host}`, isConnected: connected && !!host };
  });
}

/* ------------------------------------------------------------------ */
/* 로그·지표                                                             */
/* ------------------------------------------------------------------ */

const LOG_LINES = [
  'INFO  server listening on :3000',
  'GET /api/health 200 2ms',
  'GET /api/v1/projects 200 41ms',
  'POST /api/v1/services/12/deployments 201 88ms',
  'WARN  slow query 812ms (projects.list)',
  'GET /api/v1/projects/1 200 17ms',
  'Error: connect ECONNREFUSED 10.0.3.12:5432',
  '    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)',
  '    at Pool.connect (/app/node_modules/pg-pool/index.js:45:11)',
  'INFO  retrying database connection (attempt 2/5)',
  'INFO  database connected',
  'npm ERR! code ELIFECYCLE',
  'DEBUG cache hit key=project:1',
];
const ns = (ms: number, extra = 0) => (BigInt(Math.floor(ms)) * 1_000_000n + BigInt(extra)).toString();
const podOf = (s: MockService) => `${s.name}-7c9d8f6b5-x2k4q`;

/** 기간 안의 로그. 12초에 한 줄, 최신순으로 limit 줄까지. */
function logsBetween(s: MockService, startMs: number, endMs: number, limit: number): LogEntryDto[] {
  const out: LogEntryDto[] = [];
  for (let at = endMs, i = Math.floor(endMs / 12_000); at >= startMs && out.length < limit; at -= 12_000, i--) {
    out.push({ timestampNs: ns(at), message: LOG_LINES[((i % LOG_LINES.length) + LOG_LINES.length) % LOG_LINES.length], pod: podOf(s), container: s.name });
  }
  return out;
}

/** SSE 로 한 번에 보낼 새 로그 몇 줄. */
export function liveLogs(serviceId: number): LogEntryDto[] {
  const s = services.find((x) => x.id === serviceId);
  if (!s) return [];
  const now = Date.now();
  const n = 1 + Math.floor(Math.random() * 3);
  return Array.from({ length: n }, (_, i) => ({
    timestampNs: ns(now, i),
    message: LOG_LINES[Math.floor(Math.random() * LOG_LINES.length)],
    pod: podOf(s),
    container: s.name,
  }));
}

/* ------------------------------------------------------------------ */
/* 배포 상세의 로그: 빌드 · 배포(앱) · 네트워크(ALB)                           */
/* ------------------------------------------------------------------ */

const BUILD_LOG_MS = 400; // 진행 중인 빌드가 줄을 늘리는 속도
const SNAPSHOT_MAX = 1000;

/** 빌드 로그를 만든 배포. 롤백·재시작은 빌드를 새로 하지 않아 원본 배포의 로그다(원본이 없으면 자기 자신). */
function builtBy(d: MockDeployment): MockDeployment {
  if ((d.triggerType === 'ROLLBACK' || d.triggerType === 'RESTART') && d.sourceDeploymentId !== undefined) {
    const source = deployments.find((x) => x.id === d.sourceDeploymentId);
    if (source) return builtBy(source);
  }
  return d;
}

/** CodeBuild 가 남기는 모양의 빌드 로그 전체. 실패한 빌드는 끝에 오류가 붙는다. */
function buildLogMessages(d: MockDeployment): string[] {
  const s = services.find((x) => x.id === d.serviceId)!;
  const stamp = (n: number) => `2026/10/02 12:16:${String(12 + Math.floor(n / 4)).padStart(2, '0')}.${String(100000 + n * 7919).slice(-6)}`;
  let n = 0;
  const agent = (text: string) => `[Container] ${stamp(n++)} ${text}`;
  const lines = [
    agent('Running on CodeBuild On-demand'),
    agent('Waiting for agent ping'),
    agent('Waiting for DOWNLOAD_SOURCE'),
    agent('Phase is DOWNLOAD_SOURCE'),
    agent('CODEBUILD_SRC_DIR=/codebuild/output/src1488065541/src'),
    agent('Phase complete: DOWNLOAD_SOURCE State: SUCCEEDED'),
    agent('Phase is INSTALL'),
    agent(`Running command cd ${s.rootDirectory ?? '.'} && railpack prepare`),
    '',
    '↳ Detected Node',
    '↳ Using npm package manager',
    agent('Phase complete: INSTALL State: SUCCEEDED'),
    agent('Phase is BUILD'),
    agent(`Running command ${s.buildCommand ?? 'npm run build'}`),
    '',
    `> ${s.name}@1.0.0 build`,
    '> vite build',
    'vite v8.3.2 building for production...',
    ...Array.from({ length: 36 }, (_, i) => `transforming (${i * 4 + 1}) src/components/Part${i}.tsx`),
    '✓ 142 modules transformed.',
    'dist/index.html                  0.46 kB │ gzip:  0.30 kB',
    'dist/assets/index-DiwrgTda.css  14.20 kB │ gzip:  3.71 kB',
    'dist/assets/index-BHEvMaTc.js  231.07 kB │ gzip: 74.12 kB',
    '✓ built in 4.81s',
  ];
  if (d.failureCode === 'BUILD_FAILED') {
    lines.push(
      'npm error code ELIFECYCLE',
      'npm error errno 1',
      `npm error ${s.name}@1.0.0 build: \`vite build\``,
      'npm error Exit status 1',
      agent('Command did not exit successfully npm run build exit status 1'),
      agent('Phase complete: BUILD State: FAILED'),
      agent('Phase context status code: COMMAND_EXECUTION_ERROR Message: Error while executing command: npm run build. Reason: exit status 1'),
    );
  } else {
    lines.push(agent('Phase complete: BUILD State: SUCCEEDED'), agent('Phase is POST_BUILD'), agent('Running command docker push'), agent('Phase complete: POST_BUILD State: SUCCEEDED'));
  }
  return lines;
}

/** GET /build-logs. cursor 는 다음에 읽을 줄 번호이고, 같은 시각의 줄이 여럿이다(CloudWatch 처럼 묶음으로 들어온다). */
function buildLogs(d: MockDeployment, q: Query): MockResponse {
  const status = statusOf(d);
  const source = builtBy(d);
  const buildStatus = status === 'QUEUED' ? undefined : source === d ? buildStatusOf(d) : 'SUCCEEDED';
  const empty: BuildLogsDto = { entries: [], nextCursor: q.cursor, buildStatus, isComplete: false, isPartial: false };
  if (!buildStatus) return ok(empty);

  const all = buildLogMessages(source);
  const startMs = Date.parse(source.createdAt) + 3000;
  const sourceBuilding = statusOf(source) === 'BUILDING';
  const visible = sourceBuilding ? Math.min(all.length, Math.max(0, Math.floor((Date.now() - startMs) / BUILD_LOG_MS))) : all.length;
  const at = (i: number) => ns(startMs + Math.floor(i / 3) * 1000);
  const entry = (i: number) => ({ timestampNs: at(i), message: all[i] });

  // 실패한 지 하루가 지난 빌드는 로그 스트림이 만료되어 Build Worker 가 남긴 끝부분(12줄)만 있다.
  if (source.failureCode === 'BUILD_FAILED' && Date.now() - Date.parse(source.createdAt) > DAY) {
    const tail = Array.from({ length: 12 }, (_, k) => all.length - 12 + k);
    return ok({ entries: tail.map(entry), buildStatus, isComplete: true, isPartial: true, loggedDeploymentId: source.id } satisfies BuildLogsDto);
  }

  const from = Math.max(0, Number(q.cursor?.replace(/^c:/, '')) || 0);
  const limit = Math.min(Math.max(Number(q.limit ?? 500), 1), 1000);
  const slice = Array.from({ length: Math.max(0, Math.min(from + limit, visible) - from) }, (_, k) => from + k);
  const finished = buildStatus !== 'BUILDING';
  return ok({
    entries: slice.map(entry),
    nextCursor: `c:${from + slice.length}`,
    buildStatus,
    isComplete: finished && slice.length === 0,
    isPartial: false,
    loggedDeploymentId: source.id,
  } satisfies BuildLogsDto);
}

/** 이 배포가 서비스한(DEPLOYING 이 된 때부터 교체될 때까지) 구간. release 가 없는 배포는 없다. */
function deployWindow(d: MockDeployment): { start: number; end: number } | undefined {
  const dto = toDeploymentDto(d);
  if (dto.failureCode === 'BUILD_FAILED' || dto.status === 'QUEUED' || dto.status === 'BUILDING') return undefined;
  const start = Date.parse(d.createdAt) + 53_000;
  return { start, end: Date.parse(replacedByOf(d)?.at ?? '') || Date.now() };
}

// 앞 줄에 이어지는 줄(`    at ...`)은 앞 줄과 거의 같은 시각에 찍힌다. LOG_LINES 의 7·8번째가 6번째에 이어진다.
const logTime = (i: number) => {
  const m = ((i % LOG_LINES.length) + LOG_LINES.length) % LOG_LINES.length;
  const head = m === 7 || m === 8 ? i - (m - 6) : i;
  return head * 12_000 + (i - head);
};
const logPods = (s: MockService, d: MockDeployment) => (s.id === 12 ? [`${s.name}-${d.id}-6f8c9-aaa11`, `${s.name}-${d.id}-6f8c9-bbb22`] : [`${s.name}-${d.id}-6f8c9-aaa11`]);

/** 앱 컨테이너 로그를 시간 오름차순으로. 최근 limit 줄만 주고 search 는 대소문자를 구분한다. */
function deployLogs(d: MockDeployment, q: Query): MockResponse {
  const s = services.find((x) => x.id === d.serviceId)!;
  const win = deployWindow(d);
  if (!win) return ok({ entries: [], isTruncated: false } satisfies DeploymentLogsDto);
  const start = q.start ? Date.parse(q.start) : win.start;
  const end = q.end ? Date.parse(q.end) : win.end;
  const limit = Math.min(Math.max(Number(q.limit ?? 200), 1), SNAPSHOT_MAX);
  const pods = logPods(s, d);
  const out: LogEntryDto[] = [];
  let truncated = false;
  for (let i = Math.floor(end / 12_000), guard = 0; logTime(i) >= start && guard < 20_000; i--, guard++) {
    if (logTime(i) > end) continue;
    const message = LOG_LINES[((i % LOG_LINES.length) + LOG_LINES.length) % LOG_LINES.length];
    if (q.search && !message.includes(q.search)) continue;
    if (out.length === limit) {
      truncated = true;
      break;
    }
    out.push({ timestampNs: ns(logTime(i)), message, pod: pods[((i % pods.length) + pods.length) % pods.length], container: 'app' });
  }
  return ok({ entries: out.reverse(), isTruncated: truncated, start: iso(start), end: iso(end) } satisfies DeploymentLogsDto);
}

const STATUS_PATTERN = [200, 200, 200, 200, 200, 404, 200, 301, 200, 200, 500, 200, 304, 200, 200, 502];

/** ALB 접근 로그. 성공한 배포가 서비스한 구간만 있고, 약 5분 늦게 올라와서 끝에서 5분은 비어 있다. */
function networkLogs(d: MockDeployment, q: Query): MockResponse {
  const dto = toDeploymentDto(d);
  if (dto.status !== 'SUCCEEDED' || dto.triggerType === 'REMOVE') return ok({ entries: [], isTruncated: false } satisfies NetworkLogsDto);
  const start = q.start ? Date.parse(q.start) : Date.parse(dto.updatedAt);
  const end = q.end ? Date.parse(q.end) : Date.parse(replacedByOf(d)?.at ?? '') || Date.now();
  const limit = Math.min(Math.max(Number(q.limit ?? 200), 1), SNAPSHOT_MAX);
  const ingestedUntil = Math.min(end, Date.now() - 5 * MIN);
  const all: NetworkLogEntryDto[] = [];
  for (let at = Math.ceil(start / 90_000) * 90_000, i = Math.ceil(start / 90_000); at <= ingestedUntil && all.length < 20_000; at += 90_000, i++) {
    const status = STATUS_PATTERN[i % STATUS_PATTERN.length];
    const direct = status === 502; // ALB 가 직접 응답한 것은 서비스 응답과 응답 시간이 없다
    all.push({
      timestampNs: ns(at, (i * 7919) % 1_000_000),
      status,
      targetStatus: direct ? undefined : status,
      receivedBytes: 40 + ((i * 7) % 80),
      sentBytes: status === 200 ? 800 + ((i * 977) % 20_000) : 291,
      responseTimeSeconds: direct ? undefined : 0.001 + ((i * 13) % 200) / 1000,
    });
  }
  const matched = q.statusClass ? all.filter((e) => String(e.status).startsWith(q.statusClass[0])) : all;
  return ok({ entries: matched.slice(-limit), isTruncated: matched.length > limit, start: iso(start), end: iso(end) } satisfies NetworkLogsDto);
}

const METRICS = [
  { metric: 'cpu', unit: 'cores', base: 0.18, amp: 0.12 },
  { metric: 'memory', unit: 'bytes', base: 220e6, amp: 40e6 },
  { metric: 'network_receive', unit: 'bytes/s', base: 48e3, amp: 30e3 },
  { metric: 'network_transmit', unit: 'bytes/s', base: 120e3, amp: 80e3 },
];

function metricsFor(s: MockService, q: Query): MetricSeriesDto[] {
  const start = Date.parse(q.start) / 1000;
  const end = Date.parse(q.end) / 1000;
  const step = Number(q.step) || 60;
  const pods = q.groupBy === 'pod' ? [`${s.name}-7c9d8f6b5-x2k4q`, `${s.name}-7c9d8f6b5-m8wz1`] : [undefined];
  if (!deploymentsOf(s.id).some((d) => statusOf(d) === 'SUCCEEDED')) return q.groupBy === 'pod' ? [] : METRICS.map(({ metric, unit }) => ({ metric, unit, points: [] }));
  return METRICS.flatMap(({ metric, unit, base, amp }) =>
    pods.map((pod, p) => {
      const points = [];
      for (let ts = Math.ceil(start / step) * step; ts <= end; ts += step) {
        const wave = Math.sin(ts / 900 + p) * 0.6 + Math.sin(ts / 137 + s.id) * 0.3 + Math.random() * 0.1;
        points.push({ timestamp: ts, value: Math.max(0, (base + amp * wave) / pods.length) });
      }
      return { metric, unit, ...(pod && { pod }), points };
    }),
  );
}

/* ------------------------------------------------------------------ */
/* AI 진단                                                              */
/* ------------------------------------------------------------------ */

const DIAGNOSIS_RUN_MS = 8_000; // 진짜는 20~60초지만 화면을 보려고 짧게 한다
/**
 * 서버는 실패가 확정된 지 10분 안인 배포만 진단을 스스로 시작하고, 오래된 실패는 진단 행이 없는 채로 둔다(사용자가 POST 로 시작한다).
 * 최근 실패는 처음 조회한 지 이만큼 지나면 그렇게 시작한 것으로 친다(그 전에는 404).
 */
const DIAGNOSIS_AUTO_START_MS = 4_000;
const DIAGNOSIS_AUTO_WINDOW_MS = 10 * MIN;
const firstSeen = new Map<number, number>();
const DIAGNOSIS_STALE_MS = 4 * MIN;
const DIAGNOSIS_FAIL_CODES = ['MODEL_TIMEOUT', 'DIAGNOSIS_LOGS_UNAVAILABLE', 'INTERNAL_ERROR', 'MODEL_RATE_LIMIT', 'BUSY', 'EXTERNAL_ERROR'];
let failCursor = 0;
let nextDiagnosisId = 1;

/** stuck 은 서버가 죽어 RUNNING 으로 남은 진단, abandoned 는 그것을 다시 시작할 때 서버가 닫은 진단이다. */
type MockDiagnosis = { id: number; deploymentId: number; startedAt: number; outcome: DiagnosisScenario | 'stuck' | 'abandoned'; errorCode?: string };
const diagnoses: MockDiagnosis[] = [];
const latestDiagnosis = (deploymentId: number) => diagnoses.filter((d) => d.deploymentId === deploymentId).at(-1);

const ev = (n: number, stage: string, at: number, text: string): DiagnosisEvidenceDto => ({ id: `EV${String(n).padStart(6, '0')}`, stage, timestamp: iso(at), text });

const BUILD_ANALYSIS: DiagnosisAnalysisDto = {
  analysisStatus: 'diagnosed',
  summary: '빌드가 recharts 를 찾지 못해 BUILD 단계가 실패했어요. package.json 에 의존성이 빠졌거나, 서비스의 루트 디렉터리가 package.json 위치와 맞지 않는 것으로 보여요.',
  hypotheses: [
    {
      id: 'H1',
      category: 'dependency',
      supportLevel: 'direct',
      statement: '소스가 recharts 를 import 하지만 package.json 의 dependencies 에 없어서, 빌드가 모듈을 해석하지 못했습니다.',
      evidenceIds: ['EV000006', 'EV000008'],
      uncertainty: '소스를 보지 못해서, package.json 은 맞는데 lockfile 만 갱신되지 않았을 가능성은 가려내지 못했습니다.',
    },
    {
      id: 'H2',
      category: 'configuration',
      supportLevel: 'supported',
      statement: '모노레포라면 루트 디렉터리가 package.json 이 있는 위치와 달라서 의존성이 다른 곳에 설치됐을 수 있습니다.',
      evidenceIds: ['EV000002', 'EV000003'],
      uncertainty: '로그에 작업 디렉터리가 나오지 않아 추정일 뿐입니다.',
    },
  ],
  nextChecks: [
    { id: 'C1', target: 'package.json 의 dependencies', method: 'recharts 가 dependencies 에 있는지, lockfile 에도 있는지 확인합니다.', purpose: '의존성 누락과 lockfile 불일치를 구분합니다.' },
    { id: 'C2', target: '서비스 설정의 루트 디렉터리', method: 'package.json 이 있는 디렉터리와 같은지 비교합니다.', purpose: '서비스 설정 문제와 코드 문제를 구분합니다.' },
  ],
  missingInformation: [{ requestedData: 'package.json 과 package-lock.json', reason: '소스를 보지 못해 의존성 목록을 직접 확인할 수 없어요.' }],
  limitations: ['소스를 보지 못했어요.', '빌드 로그의 마지막 부분만 분석했어요.'],
  remediation: {
    status: 'proposed',
    reason: '첫 번째 원인이 로그에 직접 나와서 의존성 추가를 먼저 제안해요. 모노레포라면 두 번째 해결책을 보세요.',
    plans: [
      {
        id: 'R1',
        title: '의존성을 추가하고 lockfile 까지 커밋하기',
        evidenceIds: ['EV000006'],
        applyWhen: ['package.json 의 dependencies 에 해당 패키지가 없을 때', '로컬에서는 되는데 배포 빌드에서만 모듈을 못 찾을 때'],
        changes: [
          {
            kind: 'command',
            target: '로컬 저장소',
            targetKnown: true,
            instruction: '로컬에서 패키지를 설치해 package.json 과 lockfile 을 함께 갱신하고 커밋합니다.',
            language: 'bash',
            snippetKind: 'template',
            snippet: 'npm install {{PACKAGE}}@{{VERSION}}\ngit add package.json package-lock.json\ngit commit -m "chore: add {{PACKAGE}}"',
            placeholders: [
              { name: 'PACKAGE', description: '로그에서 찾지 못한 모듈 이름 (예: recharts)' },
              { name: 'VERSION', description: '쓸 버전. 정하지 않았다면 latest' },
            ],
          },
          {
            kind: 'configuration',
            target: 'package.json',
            targetKnown: false,
            instruction: 'dependencies 에 항목이 들어갔는지 확인합니다.',
            language: 'json',
            snippetKind: 'template',
            snippet: '"dependencies": {\n  "{{PACKAGE}}": "^{{VERSION}}"\n}',
            placeholders: [
              { name: 'PACKAGE', description: '추가한 패키지 이름' },
              { name: 'VERSION', description: '설치된 버전' },
            ],
          },
        ],
        verification: [
          { instruction: '로컬에서 빌드를 실행합니다.', expectedResult: 'Rollup 이 import 를 해석하지 못했다는 오류 없이 빌드가 끝나요.' },
          { instruction: '커밋을 push 하거나 이 배포를 재배포합니다.', expectedResult: 'BUILD 단계가 성공으로 끝나요.' },
        ],
        rollback: ['커밋을 되돌립니다(git revert). 그러면 이전 빌드 오류가 다시 나요.'],
        risks: ['메이저 버전이 맞지 않으면 다른 오류가 날 수 있어요.', '의존성이 늘면 이미지 크기와 빌드 시간이 늘어요.'],
      },
      {
        id: 'R2',
        title: '서비스의 루트 디렉터리 확인하기',
        evidenceIds: ['EV000002'],
        applyWhen: ['저장소가 모노레포이고, 서비스의 루트 디렉터리가 package.json 위치와 다를 때'],
        changes: [
          {
            kind: 'configuration',
            target: '서비스 설정 › 루트 디렉터리',
            targetKnown: false,
            instruction: 'package.json 이 있는 디렉터리를 루트 디렉터리로 지정합니다.',
            language: 'text',
            snippetKind: 'template',
            snippet: '{{ROOT_DIRECTORY}}',
            placeholders: [{ name: 'ROOT_DIRECTORY', description: 'package.json 이 들어 있는 디렉터리 (예: apps/web)' }],
          },
        ],
        verification: [{ instruction: '설정을 저장하고 다시 배포합니다.', expectedResult: '빌드가 올바른 디렉터리에서 의존성을 설치해요.' }],
        rollback: ['루트 디렉터리를 원래 값으로 되돌립니다.'],
        risks: ['같은 저장소를 쓰는 다른 서비스가 있다면 영향이 없는지 확인해야 해요.'],
      },
    ],
  },
};

const RUNTIME_ANALYSIS: DiagnosisAnalysisDto = {
  analysisStatus: 'diagnosed',
  summary: 'DATABASE_URL 이 없어서 앱이 시작하지 못했어요.',
  hypotheses: [
    {
      id: 'H1',
      category: 'configuration',
      supportLevel: 'direct',
      statement: 'DATABASE_URL 환경변수가 설정되지 않았습니다.',
      evidenceIds: ['EV000001', 'EV000002'],
      uncertainty: '다른 변수도 빠졌을 수 있습니다.',
    },
  ],
  nextChecks: [{ id: 'C1', target: '서비스 변수', method: 'DATABASE_URL 이 등록됐는지 봅니다.', purpose: '누락을 확인합니다.' }],
  missingInformation: [],
  limitations: ['소스를 보지 못했어요.'],
  remediation: {
    status: 'proposed',
    reason: '원인이 로그에 직접 나와요.',
    plans: [
      {
        id: 'R1',
        title: 'DATABASE_URL 변수 추가하기',
        evidenceIds: ['EV000001'],
        applyWhen: ['DATABASE_URL 이 서비스 변수에 없을 때'],
        changes: [
          {
            kind: 'configuration',
            target: '서비스 변수',
            targetKnown: true,
            instruction: 'Variables 탭에서 DATABASE_URL 을 추가합니다.',
            language: 'dotenv',
            snippetKind: 'template',
            snippet: 'DATABASE_URL={{DATABASE_URL}}',
            placeholders: [{ name: 'DATABASE_URL', description: 'DB 접속 문자열' }],
          },
        ],
        verification: [{ instruction: '변수를 저장한 뒤 다시 배포합니다.', expectedResult: '앱이 시작하고 헬스체크가 통과해요.' }],
        rollback: ['추가한 변수를 삭제합니다.'],
        risks: ['값이 틀리면 DB 연결에 실패해요.'],
      },
    ],
  },
};

const INSUFFICIENT_ANALYSIS: DiagnosisAnalysisDto = {
  analysisStatus: 'insufficient_evidence',
  summary: '로그가 짧아서 실패 원인을 정하기 어려워요. 빌드가 시작된 직후 끝난 것으로만 보여요.',
  nextChecks: [
    { id: 'C1', target: '빌드 단계의 앞쪽 로그', method: '의존성 설치 단계에서 오류가 났는지 봅니다.', purpose: '실패가 시작된 단계를 좁힙니다.' },
    { id: 'C2', target: '서비스 설정의 빌더·빌드 명령', method: '빌드 명령이 저장소와 맞는지 확인합니다.', purpose: '설정 문제를 가려냅니다.' },
  ],
  missingInformation: [{ requestedData: '빌드 단계 전체 로그', reason: '남은 로그가 마지막 두 줄뿐이에요.' }],
  limitations: ['로그가 마지막 몇 줄만 남아 있어요.'],
  remediation: { status: 'needs_more_evidence', reason: '원인 후보를 좁히려면 빌드 중간 로그와 설정 정보가 더 필요해요.' },
};

const NO_FAILURE_ANALYSIS: DiagnosisAnalysisDto = {
  analysisStatus: 'no_failure_evidence',
  summary: '진단에 쓴 로그에서 오류나 실패한 흔적을 찾지 못했어요.',
  hypotheses: [],
  nextChecks: [],
  missingInformation: [],
  limitations: ['이미지 pull 이나 스케줄링처럼 앱 로그가 생기기 전에 실패했을 수 있어요.'],
  remediation: { status: 'not_needed', reason: '로그에 실패 흔적이 없어서 고칠 대상을 정하지 못했어요.', plans: [] },
};

const evidenceFor = (outcome: DiagnosisScenario, at: number): DiagnosisEvidenceDto[] => {
  switch (outcome) {
    case 'build':
      return [
        ev(1, 'build', at, '#9 [builder 4/6] RUN npm ci'),
        ev(2, 'build', at + 12_000, '#9 12.4 added 412 packages in 11s'),
        ev(3, 'build', at + 12_000, '#10 [builder 5/6] RUN npm run build'),
        ev(4, 'build', at + 15_000, '#10 3.1 > vite build'),
        ev(5, 'build', at + 18_000, '#10 5.8 error during build:'),
        ev(6, 'build', at + 18_000, '#10 5.8 Error: Rollup failed to resolve import "recharts" from "/app/src/components/Chart.tsx".'),
        ev(7, 'build', at + 18_000, '#10 5.8 This is most likely unintended because it can break your application at runtime.'),
        ev(8, 'build', at + 19_000, '#10 ERROR: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1'),
        ev(9, 'build', at + 19_000, '[Container] Phase complete: BUILD State: FAILED'),
      ];
    case 'runtime':
      return [
        ev(1, 'runtime', at, 'ERROR Missing required configuration: DATABASE_URL'),
        ev(2, 'runtime', at + 1_000, 'Error: process exited with code 1'),
        ev(3, 'runtime', at + 31_000, 'Back-off restarting failed container app in pod api-7c9d8f6b5-x2k4q'),
      ];
    case 'insufficient':
      return [ev(1, 'build', at, '#7 [builder 2/6] WORKDIR /app'), ev(2, 'build', at, '[Container] Phase complete: BUILD State: FAILED')];
    case 'noFailure':
      return [ev(1, 'runtime', at, 'INFO  server listening on :3000'), ev(2, 'runtime', at + 5_000, 'GET /healthz 200 1ms'), ev(3, 'runtime', at + 10_000, 'GET /healthz 200 1ms')];
    default:
      return [];
  }
};

function toDiagnosisDto(m: MockDiagnosis): DiagnosisDto {
  const base = { id: m.id, deploymentId: m.deploymentId, createdAt: iso(m.startedAt) };
  if (m.outcome === 'stuck' || (m.outcome !== 'abandoned' && Date.now() - m.startedAt < DIAGNOSIS_RUN_MS)) return { ...base, status: 'RUNNING' };
  const finishedAt = iso(m.outcome === 'abandoned' ? m.startedAt + DIAGNOSIS_STALE_MS : m.startedAt + DIAGNOSIS_RUN_MS);
  if (m.outcome === 'abandoned') return { ...base, status: 'FAILED', errorCode: 'DIAGNOSIS_ABANDONED', finishedAt };
  if (m.outcome === 'error') return { ...base, status: 'FAILED', errorCode: m.errorCode, finishedAt };
  const analysis = { build: BUILD_ANALYSIS, runtime: RUNTIME_ANALYSIS, insufficient: INSUFFICIENT_ANALYSIS, noFailure: NO_FAILURE_ANALYSIS }[m.outcome];
  return {
    ...base,
    status: 'SUCCEEDED',
    analysis,
    evidence: evidenceFor(m.outcome, m.startedAt - 40_000),
    inputLimitations: m.outcome === 'build' ? ['로그가 길어서 가장 최근 줄만 보냈어요.'] : undefined,
    finishedAt,
  };
}

/** 진단 행을 하나 만든다. 서버가 자동으로 시작할 때와 POST 로 시작할 때 모두 이것을 쓴다. */
function newDiagnosis(d: MockDeployment): MockDiagnosis {
  const scenario = d.diagnosis ?? 'build';
  const m: MockDiagnosis = { id: nextDiagnosisId++, deploymentId: d.id, startedAt: Date.now(), outcome: scenario };
  if (scenario === 'error') m.errorCode = DIAGNOSIS_FAIL_CODES[failCursor++ % DIAGNOSIS_FAIL_CODES.length];
  diagnoses.push(m);
  return m;
}

const isFailedStatus = (d: MockDeployment) => d.triggerType !== 'REMOVE' && ['FAILED', 'ROLLED_BACK', 'MANUAL_INTERVENTION'].includes(toDeploymentDto(d).status);

/** 조회. 방금 실패한 배포에 진단이 아직 없으면 서버가 스스로 시작한 것처럼, 처음 조회한 지 몇 초 뒤부터 진단이 생긴다. */
function getDiagnosis(d: MockDeployment): MockResponse {
  let latest = latestDiagnosis(d.id);
  const recent = Date.now() - Date.parse(toDeploymentDto(d).updatedAt) <= DIAGNOSIS_AUTO_WINDOW_MS;
  if (!latest && d.diagnosis && isFailedStatus(d) && recent) {
    const seen = firstSeen.get(d.id) ?? Date.now();
    firstSeen.set(d.id, seen);
    if (Date.now() - seen >= DIAGNOSIS_AUTO_START_MS) latest = newDiagnosis(d);
  }
  return latest ? ok(toDiagnosisDto(latest)) : fail(404, 'DIAGNOSIS_NOT_FOUND', 'Diagnosis not found');
}

/** 진단을 시작한다. 성공한 진단이 있으면 모델을 다시 부르지 않고 200 으로 돌려주고, refresh 면 새로 한다. */
function startDiagnosis(d: MockDeployment, refresh: boolean): MockResponse {
  const dto = toDeploymentDto(d);
  if (dto.triggerType === 'REMOVE' || !['FAILED', 'ROLLED_BACK', 'MANUAL_INTERVENTION'].includes(dto.status)) {
    return fail(409, 'DEPLOYMENT_NOT_FAILED', 'Deployment is not failed');
  }
  const latest = latestDiagnosis(d.id);
  const current = latest && toDiagnosisDto(latest);
  if (latest && current?.status === 'RUNNING') {
    // 4분을 넘긴 RUNNING 은 서버가 죽은 것이라 먼저 닫고 새로 시작한다.
    if (Date.now() - latest.startedAt <= DIAGNOSIS_STALE_MS) return fail(409, 'DIAGNOSIS_IN_PROGRESS', 'Diagnosis in progress');
    latest.outcome = 'abandoned';
  }
  if (current?.status === 'SUCCEEDED' && !refresh) return ok(current);
  return ok(toDiagnosisDto(newDiagnosis(d)), 202);
}

// 시드: 이미 성공한 진단(④)과 서버가 죽어 멈춘 진단.
const seeded = (message: string) => deployments.find((d) => d.sourceCommitMessage === message)!;
diagnoses.push({ id: nextDiagnosisId++, deploymentId: seeded('fix: 차트 빌드 오류 수정').id, startedAt: t0 - 3 * HOUR, outcome: 'runtime' });
diagnoses.push({ id: nextDiagnosisId++, deploymentId: seeded('docs: 배포 파이프라인 정리').id, startedAt: t0 - 6 * MIN, outcome: 'stuck' });
diagnoses.push({ id: nextDiagnosisId++, deploymentId: seeded('feat: 샌드박스 초기 설정').id, startedAt: t0 - 3 * MIN, outcome: 'build' });

/* ------------------------------------------------------------------ */
/* 레포 구성 확인(분석 게이트) — was 계약 2 의 repository-analyses                */
/* ------------------------------------------------------------------ */

const SHA = '3f9c2a1b7d4e5f60718293a4b5c6d7e8f9012345';
const gateBase = (root: string): Omit<AnalysisGateResultDto, 'decision' | 'complexity' | 'reasons' | 'units' | 'dependencies' | 'questions'> => ({
  schemaVersion: 'iris.analysis-gate.v1',
  sourceSha: SHA,
  rootDirectory: root,
  simpleBuild: null,
  analysis: { engine: 'static', durationMs: 84, modelCalls: 0 },
});

/** 단일 Dockerfile 레포. auto 면 skip, force 면 unit 하나로 분석한다. */
function singleAppResult(root: string, mode: AnalysisMode): AnalysisGateResultDto {
  const reasons = [{ code: 'single_dockerfile', message: 'Dockerfile 1개', paths: ['Dockerfile'] }];
  if (mode === 'auto') {
    return {
      ...gateBase(root), decision: 'skip', complexity: 'simple', reasons,
      signals: { dockerfiles: ['Dockerfile'], composeFiles: [], composeBuildServices: [], composeImageServices: [], workspaceManifests: [], runtimeManifests: [{ path: 'package.json', runtime: 'node' }] },
      simpleBuild: { builder: 'dockerfile', dockerfilePath: 'Dockerfile' }, units: [], dependencies: [], questions: [],
    };
  }
  return {
    ...gateBase(root), decision: 'analyze', complexity: 'simple', reasons: [...reasons, { code: 'forced', message: '사용자가 분석을 요청함' }],
    units: [{ id: 'app', name: 'single-app', rootDirectory: '.', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: 8080, startCommand: null, buildCommand: null, role: 'app', public: true, env: [], dependsOn: [], evidence: [{ path: 'Dockerfile', line: 12 }] }],
    dependencies: [], questions: [],
  };
}

const SHOP_INIT_SCRIPTS: AnalysisInitScriptDto[] = [
  { path: 'db/schema.sql', kind: 'sql', sha256: 'a3f1c9d2e87b4a6150c3d9e2f4b7a8c1d5e6f70123456789abcdef0123456789', size: 2840, order: 0, supported: true },
  { path: 'db/seed.sql', kind: 'sql', sha256: '7be04d1a92c3f58e6a0b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f607', size: 1190, order: 1, supported: true },
  { path: 'db/migrate.sh', kind: 'sh', sha256: '0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091', size: 310, order: 2, supported: false },
];
const PG_URL: AnalysisBindingDto = { kind: 'dependency', targetId: 'postgres', property: 'url' };
const REDIS_URL: AnalysisBindingDto = { kind: 'dependency', targetId: 'redis', property: 'url' };

/** web/api/worker 3개 이미지 + postgres/redis compose 레포. */
function multiImageShopResult(root: string, mode: AnalysisMode): AnalysisGateResultDto {
  return {
    ...gateBase(root),
    decision: 'analyze',
    complexity: 'complex',
    reasons: [
      { code: 'multiple_dockerfiles', message: '서로 다른 디렉터리에 Dockerfile 3개', paths: ['web/Dockerfile', 'api/Dockerfile', 'worker/Dockerfile'] },
      { code: 'compose_multi_build', message: 'compose 빌드 서비스 3개', paths: ['compose.yaml'] },
      ...(mode === 'force' ? [{ code: 'forced', message: '사용자가 분석을 요청함' }] : []),
    ],
    signals: { dockerfiles: ['api/Dockerfile', 'web/Dockerfile', 'worker/Dockerfile'], composeFiles: ['compose.yaml'], composeBuildServices: ['api', 'web', 'worker'], composeImageServices: ['postgres', 'redis'], workspaceManifests: [], runtimeManifests: [] },
    units: [
      { id: 'web', name: 'web', rootDirectory: 'web', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: 3000, startCommand: null, buildCommand: null, role: 'web', public: true, env: [{ key: 'API_BASE_URL', stage: 'build', required: true, binding: { kind: 'unit', targetId: 'api', property: 'url' } }], hostAliases: [{ host: 'api', port: 8000, targetId: 'api', evidence: [{ path: 'web/nginx.conf', line: 9 }] }], dependsOn: ['api'], evidence: [{ path: 'compose.yaml', line: 4 }] },
      { id: 'api', name: 'api', rootDirectory: 'api', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: 8000, startCommand: null, buildCommand: null, role: 'api', public: true, env: [{ key: 'DATABASE_URL', stage: 'runtime', required: true, binding: PG_URL }, { key: 'REDIS_URL', stage: 'runtime', required: true, binding: REDIS_URL }], dependsOn: ['postgres', 'redis'], evidence: [{ path: 'compose.yaml', line: 12 }] },
      { id: 'worker', name: 'worker', rootDirectory: 'worker', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: null, startCommand: null, buildCommand: null, role: 'worker', public: false, env: [{ key: 'DATABASE_URL', stage: 'runtime', required: true, binding: PG_URL }, { key: 'REDIS_URL', stage: 'runtime', required: true, binding: REDIS_URL }], hostAliases: [{ host: 'postgres', port: 5432, targetId: 'postgres' }], dependsOn: ['postgres', 'redis'], evidence: [{ path: 'compose.yaml', line: 22 }] },
    ],
    dependencies: [
      { id: 'postgres', engine: 'postgres', image: 'postgres:16-alpine', port: 5432, database: 'shop', user: 'shop', passwordInSource: true, initScripts: SHOP_INIT_SCRIPTS, evidence: [{ path: 'compose.yaml', line: 30 }] },
      { id: 'redis', engine: 'redis', image: 'redis:7-alpine', port: 6379, evidence: [{ path: 'compose.yaml', line: 38 }] },
    ],
    questions: [{ code: 'port_unknown', unitId: 'worker', message: 'worker 의 포트를 찾지 못했어요. 외부 요청을 받지 않는 워커면 비워 두세요.' }, { code: 'init_script_unsupported', message: 'db/migrate.sh 는 .sh 라서 실행하지 않아요.' }],
  };
}

/** Temp_log: app + mongo(compose 이미지 8.0.32, 플랫폼은 mongo:7). 비밀값 3개, URL 은 archlog 사용자. */
function tempLogResult(root: string): AnalysisGateResultDto {
  return {
    ...gateBase(root),
    decision: 'analyze',
    complexity: 'complex',
    reasons: [{ code: 'compose_multi_service', message: 'compose 서비스 2개 (app, mongo)', paths: ['compose.yaml'] }],
    units: [
      {
        id: 'app', name: 'app', rootDirectory: '.', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: 3000, startCommand: null, buildCommand: null, role: 'app', public: true,
        env: [
          { key: 'MONGO_URI', stage: 'runtime', required: true, binding: { kind: 'dependency', targetId: 'mongo', property: 'url', user: 'archlog', passwordSecretId: 'MONGO_APP_PASSWORD' } },
          { key: 'SESSION_SECRET', stage: 'runtime', required: true, secretId: 'SESSION_SECRET' },
        ],
        dependsOn: ['mongo'], evidence: [{ path: 'compose.yaml', line: 3 }],
      },
    ],
    dependencies: [
      { id: 'mongo', engine: 'mongodb', image: 'mongo:8.0.32', port: 27017, database: 'archlog', env: [{ key: 'MONGO_APP_PASSWORD', secretId: 'MONGO_APP_PASSWORD' }], initScripts: [{ path: 'db/init-mongo.js', kind: 'js', sha256: 'c0ffee', size: 640, order: 0, supported: true }], evidence: [{ path: 'compose.yaml', line: 20 }] },
    ],
    secrets: [
      { id: 'MONGO_APP_PASSWORD', generate: 'random', consumers: [{ kind: 'unit', targetId: 'app', key: 'MONGO_APP_PASSWORD', via: 'url_password' }, { kind: 'dependency', targetId: 'mongo', key: 'MONGO_APP_PASSWORD', via: 'env' }] },
      { id: 'SESSION_SECRET', generate: 'random', consumers: [{ kind: 'unit', targetId: 'app', key: 'SESSION_SECRET', via: 'env' }] },
      { id: 'MONGO_ROOT_PASSWORD', generate: null, platformManaged: { dependencyId: 'mongo', property: 'password' }, consumers: [{ kind: 'dependency', targetId: 'mongo', key: 'MONGO_INITDB_ROOT_PASSWORD', via: 'env' }] },
    ],
    questions: [{ code: 'custom_database_image', message: '플랫폼 개발용 DB는 공식 이미지를 쓰므로 Dockerfile.mongo의 커스텀 설정은 적용되지 않습니다.' }],
  };
}

type MockAnalysis = Omit<RepositoryAnalysisDto, 'status' | 'decision' | 'complexity' | 'result'> & { startedAt: number; applied: boolean };
const analyses: MockAnalysis[] = [];
/** 접수 → 1.2초 QUEUED → 3초까지 RUNNING → 결과. broken-repo 는 FAILED 로 끝난다. */
function toAnalysisDto(mock: MockAnalysis): RepositoryAnalysisDto {
  const { startedAt, applied, ...a } = mock;
  const withProvisioning = (dto: RepositoryAnalysisDto): RepositoryAnalysisDto => {
    const deps = dto.result?.dependencies ?? [];
    if (deps.length === 0) return dto;
    return { ...dto, provisioning: Object.fromEntries(deps.filter((d) => d.engine !== 'other').map((d) => [d.id, { engine: d.engine, image: ENGINE_DEFAULTS[d.engine as DatabaseEngine].image }])) };
  };
  const elapsed = Date.now() - startedAt;
  const repo = a.sourceRepositoryUrl.split('/').slice(-1)[0];
  const root = a.rootDirectory ?? '.';
  if (elapsed < 1200) return { ...a, status: 'QUEUED' };
  if (elapsed < 3000) return { ...a, status: 'RUNNING' };
  if (repo === 'broken-repo') {
    return { ...a, status: 'FAILED', errorCode: 'ANALYZER_FAILED', errorMessage: 'analysis gate exited with status 2' };
  }
  const result = a.id === PENDING_ANALYSIS_ID ? pendingShopResult(root) : repo === 'temp-log' ? tempLogResult(root) : repo === 'multi-image-shop' ? multiImageShopResult(root, a.mode) : singleAppResult(root, a.mode);
  return withProvisioning({ ...a, sourceSha: SHA, status: applied ? 'APPLIED' : 'SUCCEEDED', decision: result.decision, complexity: result.complexity, result });
}

function gateFieldsFor(analysisId: unknown): Partial<MockService> {
  const a = analyses.find((x) => x.id === Number(analysisId));
  if (!a) return {};
  const dto = toAnalysisDto(a);
  if (!dto.result || dto.decision !== 'skip') return {};
  return {
    builder: dto.result.simpleBuild?.builder,
    dockerfilePath: dto.result.simpleBuild?.dockerfilePath ?? undefined,
    analysisGate: { analysisId: a.id, decision: 'skip', complexity: dto.complexity, unitId: null },
  };
}

function handleAnalyses(method: string, seg: string[], body: Record<string, unknown> | undefined): MockResponse {
  const projectId = Number(seg[1]);
  if (!projects.some((p) => p.id === projectId)) return fail(404, 'NOT_FOUND', 'Project not found');
  if (seg.length === 3 && method === 'POST') {
    const url = String(body?.sourceRepositoryUrl ?? '').replace(/\.git$/, '');
    if (!repositories.some((r) => r.url === url)) return fail(403, 'REPOSITORY_NOT_ACCESSIBLE', 'Repository not accessible');
    const mode = body?.mode === 'force' ? 'force' : 'auto';
    const now = Date.now();
    const a: MockAnalysis = {
      id: analyses.length + 1, projectId, sourceRepositoryUrl: url, sourceBranch: String(body?.sourceBranch ?? 'main'), sourceSha: null,
      rootDirectory: (body?.rootDirectory as string | undefined) ?? '.', mode, errorCode: null, errorMessage: null, appliedServiceIds: [],
      createdAt: iso(now), updatedAt: iso(now), startedAt: now, applied: false,
    };
    analyses.push(a);
    return ok(toAnalysisDto(a), 202);
  }
  const a = analyses.find((x) => x.id === Number(seg[3]) && x.projectId === projectId);
  if (!a) return fail(404, 'REPOSITORY_ANALYSIS_NOT_FOUND', 'Repository analysis not found');
  if (seg.length === 4) return ok(toAnalysisDto(a));
  if (seg[4] === 'apply' && method === 'POST') {
    const dto = toAnalysisDto(a);
    if (a.applied) return ok({ analysisId: a.id, services: services.filter((s) => a.appliedServiceIds?.includes(s.id)).map(toServiceDto) }, 201);
    if (dto.status !== 'SUCCEEDED' || dto.decision !== 'analyze' || !dto.result) return fail(409, 'ANALYSIS_NOT_APPLICABLE', 'Analysis is not ready to apply');
    const picks = (body?.units as AnalysisUnitApply[] | undefined) ?? [];
    if (picks.length === 0) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'units', reason: 'select at least one unit' }]);
    const depChoices = (body?.dependencies as AnalysisDependencyApply[] | undefined) ?? [];
    const apTargets = isSingleTarget(body?.targetIds) ? body.targetIds : [1];
    if (depChoices.some((d) => d.provision) || dto.result.units.some((u) => u.hostAliases?.length)) {
      const rejected = networkingRejected(apTargets);
      if (rejected && depChoices.some((d) => d.provision)) return rejected;
    }
    const stackId = stackOfAnalysis(a, projectId);
    const existingUnits = new Set(stackMembers(stackId).map((m) => m.unitId));
    for (const pick of picks) {
      if (!dto.result.units.some((u) => u.id === pick.unitId)) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'units', reason: `unknown unit ${pick.unitId}` }]);
      // 증분 apply: 스택에 이미 있는 unit 은 새로 만들지 않으니 이름이 겹쳐도 된다.
      if (!existingUnits.has(pick.unitId) && services.some((s) => s.projectId === projectId && s.name === pick.name)) return fail(409, 'SERVICE_NAME_CONFLICT', 'Service name conflict');
    }
    const result = applyToStack(a, dto.result, picks, depChoices, apTargets, body?.deploy !== false, stackId, body?.skipVariableValidation === true);
    a.applied = true;
    a.appliedServiceIds = result.services.map((s) => s.id);
    a.updatedAt = iso(Date.now());
    return ok({ analysisId: a.id, services: result.services.map(toServiceDto), databases: result.databases.map(toServiceDto), stackId, stackDeploymentId: result.deployed ? stackId * 100 : null, variableIssues: result.variableIssues, changes: result.changes.length ? result.changes : null, generatedSecrets: result.generatedSecrets.length ? result.generatedSecrets : null }, 201);
  }
  return fail(404, 'NOT_FOUND', `No mock for ${method} /${seg.join('/')}`);
}

/* ------------------------------------------------------------------ */
/* 라우터                                                               */
/* ------------------------------------------------------------------ */

const page = <T>(items: T[], q: Query) => {
  const p = Number(q.page ?? 0);
  const size = Number(q.size ?? 20);
  return { items: items.slice(p * size, (p + 1) * size), total: items.length, page: p, size };
};

/** /api/v1 뒤의 경로를 처리한다. 모르는 경로는 404. */
export function handle(method: string, path: string, q: Query, body: Record<string, unknown> | undefined, origin = 'http://localhost:5173'): MockResponse {
  const seg = path.split('/').filter(Boolean);
  const id = (i: number) => Number(seg[i]);

  if (path === '/auth/github') {
    loggedIn = true;
    return { status: 302, redirect: '/dashboard' };
  }
  if (path === '/auth/logout') {
    loggedIn = false;
    return { status: 204 };
  }
  if (!loggedIn) return fail(401, 'UNAUTHORIZED', 'Not logged in');
  if (path === '/me') return ok(user);
  if (path === '/targets') return ok(targetsNow());

  // on-prem servers
  if (path === '/onprem-servers' && method === 'GET') return ok(liveServers().map(toServerDto).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  if (path === '/onprem-servers' && method === 'POST') {
    const name = String(body?.name ?? '').trim();
    const violation = serverNameViolation(name);
    if (violation) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'name', reason: violation }]);
    if (NOT_CONFIGURED_NAMES.includes(name)) return fail(503, 'NOT_CONFIGURED', 'On-prem server registration is not configured.');
    if (liveServers().some((m) => m.name === name)) return fail(409, 'ONPREM_SERVER_NAME_CONFLICT', 'A server with this name already exists.');
    if (liveServers().length >= MAX_SERVERS) return fail(409, 'ONPREM_SERVER_LIMIT_EXCEEDED', `You can register up to ${MAX_SERVERS} servers.`);
    const id = Math.max(0, ...servers.map((m) => m.id)) + 1;
    const m: MockServer = {
      id,
      name,
      serverKey: `s${Math.random().toString(36).slice(2, 9).padEnd(7, '0')}`,
      targetId: Math.max(0, ...sharedTargets.map((x) => x.id), ...servers.map((x) => x.targetId)) + 1,
      createdAt: iso(Date.now()),
    };
    servers.push(m);
    return ok(issueToken(m), 201);
  }
  if (seg[0] === 'onprem-servers' && seg.length >= 2) {
    const m = liveServers().find((x) => x.id === id(1));
    if (!m) return fail(404, 'NOT_FOUND', 'Server not found');
    if (seg.length === 2 && method === 'GET') return ok(toServerDto(m));
    if (seg.length === 2 && method === 'DELETE') {
      if (services.some((x) => x.targetIds.includes(m.targetId))) return fail(409, 'ONPREM_SERVER_IN_USE', 'A service still uses this server.');
      m.isDeleted = true;
      return { status: 204 };
    }
    if (seg[2] === 'registration-token' && method === 'POST') {
      const status = serverStatusOf(m);
      if (status === 'CONNECTED') return fail(409, 'INVALID_STATUS_TRANSITION', `Cannot reissue a token for a ${status} server.`);
      if (NOT_CONFIGURED_NAMES.includes(m.name)) return fail(503, 'NOT_CONFIGURED', 'On-prem server registration is not configured.');
      return ok(issueToken(m));
    }
  }

  // github
  if (path === '/github/installations') return ok(installations);
  if (path === '/github/repos') {
    const term = (q.q ?? '').toLowerCase();
    return ok(page(repositories.filter((r) => (!q.installationId || r.installationId === Number(q.installationId)) && r.fullName.toLowerCase().includes(term)), q));
  }
  if (path === '/github/repos/resolve') {
    const repo = repositories.find((r) => q.url?.replace(/\.git$/, '').replace(/\/$/, '') === r.url);
    return repo ? ok(repo) : fail(404, 'REPOSITORY_NOT_ACCESSIBLE', 'Repository not accessible');
  }
  if (seg[0] === 'github' && seg[1] === 'repos' && seg[4] === 'branches') return ok(branches);

  // projects
  if (path === '/projects' && method === 'GET') return ok(page(projects.map(toProjectDto), q));
  if (path === '/projects' && method === 'POST') {
    const name = String(body?.name ?? '');
    if (projects.some((p) => p.name === name)) return fail(409, 'PROJECT_NAME_CONFLICT', 'Project name conflict');
    const now = iso(Date.now());
    const p: MockProject = { id: Math.max(0, ...projects.map((x) => x.id)) + 1, name, description: body?.description as string | undefined, createdAt: now, updatedAt: now };
    projects.push(p);
    return ok(toProjectDto(p), 201);
  }
  if (seg[0] === 'projects' && seg.length === 2) {
    const p = projects.find((x) => x.id === id(1));
    if (!p) return fail(404, 'NOT_FOUND', 'Project not found');
    if (method === 'PATCH') Object.assign(p, body, { updatedAt: iso(Date.now()) });
    if (method === 'DELETE') {
      // was 와 같다: 소속 서비스 중 하나라도 배포가 진행 중이면 아무것도 지우지 않는다.
      if (services.some((x) => x.projectId === p.id && deploymentsOf(x.id).some((d) => IN_PROGRESS.includes(statusOf(d))))) {
        return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
      }
      projects.splice(projects.indexOf(p), 1);
      return { status: 204 };
    }
    return ok(toProjectDto(p));
  }
  if (seg[0] === 'projects' && seg[2] === 'repository-analyses') return handleAnalyses(method, seg, body);
  if (seg[0] === 'projects' && seg[2] === 'databases' && method === 'POST') return createDatabase(id(1), body);
  if (seg[0] === 'projects' && seg[2] === 'stacks') return handleStacks(method, seg, body);
  if (seg[0] === 'projects' && seg[2] === 'services') {
    if (method === 'POST') {
      if (body?.targetIds !== undefined && !isSingleTarget(body.targetIds)) return fail(422, 'INVALID_INPUT', 'a service needs exactly one target');
      const url = String(body?.repositoryUrl ?? '').replace(/\.git$/, '');
      const repo = url.split('/').slice(-2).join('/');
      const s = service(Math.max(0, ...services.map((x) => x.id)) + 1, id(1), String(body?.name || repo.split('/')[1] || 'service'), repo, {
        sourceBranch: (body?.branch as string) || 'main',
        targetIds: (body?.targetIds as number[]) ?? [1],
        // was 와 같다: skip 으로 끝난 분석 id 를 받으면 결과를 서비스에 남기고 simpleBuild 를 빌더 기본값으로 쓴다.
        ...gateFieldsFor(body?.analysisId),
        createdAt: iso(Date.now()),
        updatedAt: iso(Date.now()),
      });
      services.push(s);
      return ok(toServiceDto(s), 201);
    }
    return ok(services.filter((s) => s.projectId === id(1)).map(toServiceDto));
  }

  // services
  if (seg[0] !== 'services') return fail(404, 'NOT_FOUND', `No mock for ${method} ${path}`);
  const s = services.find((x) => x.id === id(1));
  if (!s) return fail(404, 'NOT_FOUND', 'Service not found');

  if (seg.length === 2) {
    if (method === 'PATCH') {
      if (body?.targetIds !== undefined) {
        if (!isSingleTarget(body.targetIds)) return fail(422, 'INVALID_INPUT', 'a service needs exactly one target');
        if (body.targetIds[0] !== s.targetIds[0] && deploymentsOf(s.id).length > 0) return fail(409, 'CONFLICT', 'target cannot change after deployment');
      }
      if (body?.deploymentStrategy !== undefined) {
        const strategy = body.deploymentStrategy as DeploymentStrategy;
        if (!STRATEGIES.includes(strategy)) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'deploymentStrategy', reason: 'unknown deployment strategy' }]);
        if (strategy !== 'ROLLING' && isOnPrem(s)) {
          return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'deploymentStrategy', reason: 'on-prem targets support ROLLING only' }]);
        }
        if (strategy !== 'ROLLING' && scalingOf(s).replicas < 2) {
          return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'deploymentStrategy', reason: 'requires at least 2 replicas' }]);
        }
      }
      Object.assign(s, body, { updatedAt: iso(Date.now()) });
    }
    if (method === 'DELETE') {
      if (deploymentsOf(s.id).some((d) => IN_PROGRESS.includes(statusOf(d)))) {
        return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
      }
      services.splice(services.indexOf(s), 1);
      return { status: 204 };
    }
    return ok(toServiceDto(s));
  }
  if (seg[2] === 'domains') return ok(domainsOf(s));
  if (seg[2] === 'variables') return handleVariables(s, method, seg, body);
  if (seg[2] === 'logs' && seg.length === 3) {
    const entries = logsBetween(s, Date.parse(q.start), Date.parse(q.end), Math.min(Number(q.limit ?? 500), 1000));
    return ok({ entries, isTruncated: entries.length >= Number(q.limit ?? 500) });
  }
  if (seg[2] === 'metrics') return ok(metricsFor(s, q));
  if (seg[2] === 'console') return handleConsole(s, method, seg, q, body, origin);
  if (seg[2] === 'scaling' && seg.length === 3) {
    if (method === 'PUT') {
      const replicas = Number(body?.replicas);
      if (!Number.isInteger(replicas) || replicas < 0 || replicas > 10) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'replicas', reason: 'must be from 0 to 10' }]);
      if (deploymentsOf(s.id).some((d) => IN_PROGRESS.includes(statusOf(d)))) return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
      const source = deploymentsOf(s.id).find((d) => statusOf(d) === 'SUCCEEDED');
      if (!source || source.triggerType === 'REMOVE') return fail(409, 'NO_SUCCEEDED_DEPLOYMENT', 'No succeeded deployment');
      scalings.set(s.id, { replicas, resources: body?.resources as ScalingDto['resources'] });
      // 적용은 지금 떠 있는 이미지로 RESTART 배포를 만든다. 방식은 바뀐 레플리카로 정한다.
      const d: MockDeployment = {
        ...deployment(s.id, 0, 'QUEUED', 'RESTART', source.sourceCommitMessage ?? '재시작'),
        ...strategySnapshot(s),
        createdAt: iso(Date.now()),
        sourceDeploymentId: source.id,
        auto: true,
      };
      deployments.push(d);
      return ok({ ...scalingOf(s), deploymentRequestId: d.id } satisfies ScalingDto, 202);
    }
    return ok(scalingOf(s));
  }
  if (seg[2] === 'deployments' && seg.length === 3) {
    if (method === 'POST') {
      if (deploymentsOf(s.id).some((d) => IN_PROGRESS.includes(statusOf(d)))) {
        return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
      }
      // was 와 같다: 연결되지 않은 내 서버로는 배포하지 않는다.
      if (targetsNow().some((tg) => s.targetIds.includes(tg.id) && tg.connectionStatus && tg.connectionStatus !== 'CONNECTED')) {
        return fail(409, 'TARGET_NOT_CONNECTED', 'Target server is not connected');
      }
      // 환경변수에 error 가 있으면 배포 요청을 만들기 전에 거절한다(RESTART 포함).
      const invalid = validate(s.id).issues.filter((i) => i.severity === 'error');
      if (invalid.length > 0 && body?.skipVariableValidation !== true && body?.triggerType !== 'ROLLBACK') return variablesInvalid(s.id, invalid);
      // RESTART 는 원본을 보내지 않고, 서버가 지금 떠 있는(가장 최근에 성공한) 배포로 정한다.
      const source =
        body?.triggerType === 'RESTART'
          ? deploymentsOf(s.id).find((d) => statusOf(d) === 'SUCCEEDED')
          : deployments.find((d) => d.id === Number(body?.sourceDeploymentId));
      const d: MockDeployment = {
        ...deployment(s.id, 0, 'QUEUED', (body?.triggerType as DeploymentTrigger) ?? 'MANUAL', source?.sourceCommitMessage ?? '수동 배포'),
        ...strategySnapshot(s),
        createdAt: iso(Date.now()),
        sourceDeploymentId: source?.id,
        auto: true,
      };
      deployments.push(d);
      return ok(toDeploymentDto(d), 201);
    }
    return ok(page(deploymentsOf(s.id).map(toDeploymentDto), q));
  }
  if (seg[2] === 'deployments' && seg.length === 4) {
    const d = deployments.find((x) => x.id === id(3) && x.serviceId === s.id);
    return d ? ok(toDetailDto(d)) : fail(404, 'DEPLOYMENT_REQUEST_NOT_FOUND', 'Deployment not found');
  }
  if (seg[2] === 'deployments' && seg.length === 5 && ['build-logs', 'deploy-logs', 'network-logs'].includes(seg[4])) {
    const d = deployments.find((x) => x.id === id(3) && x.serviceId === s.id);
    if (!d) return fail(404, 'DEPLOYMENT_REQUEST_NOT_FOUND', 'Deployment not found');
    // 배포가 쓰지 않은 타깃을 고르면 422 다.
    if (seg[4] !== 'build-logs' && q.targetId && !s.targetIds.includes(Number(q.targetId))) return fail(422, 'INVALID_INPUT', 'target is not used by this deployment');
    return seg[4] === 'build-logs' ? buildLogs(d, q) : seg[4] === 'deploy-logs' ? deployLogs(d, q) : networkLogs(d, q);
  }
  if (seg[2] === 'deployments' && seg.length === 5 && (seg[4] === 'diagnose' || seg[4] === 'diagnosis')) {
    const d = deployments.find((x) => x.id === id(3) && x.serviceId === s.id);
    if (!d) return fail(404, 'DEPLOYMENT_REQUEST_NOT_FOUND', 'Deployment not found');
    if (seg[4] === 'diagnose' && method === 'POST') return startDiagnosis(d, q.refresh === 'true');
    if (seg[4] === 'diagnosis' && method === 'GET') return getDiagnosis(d);
  }
  return fail(404, 'NOT_FOUND', `No mock for ${method} ${path}`);
}

/* ------------------------------------------------------------------ */
/* 콘솔                                                                  */
/* ------------------------------------------------------------------ */

/** vite.config.ts 가 같은 경로에 가짜 Console Gateway(dev/mockConsoleGateway.ts)를 붙인다. */
const MOCK_GATEWAY_PATH = '/mock-console-gateway';
let consoleSessionCount = 0;

/**
 * 콘솔 가능 여부와 세션 발급. was 와 같은 규칙이다: 그 타깃에 떠 있는 배포(가장 최근에 성공했고 REMOVE 가 아닌 것)가 없으면 열 수 없고,
 * 온프레미스 타깃은 아직 지원하지 않는다. ticket(token)은 `mock-{serviceId}-{n}` 이고 가짜 Gateway 가 이 모양만 확인한다.
 */
function handleConsole(s: MockService, method: string, seg: string[], q: Query, body: Record<string, unknown> | undefined, origin: string): MockResponse {
  const targetId = Number(method === 'GET' ? q.targetId : body?.targetId);
  if (!s.targetIds.includes(targetId)) return fail(404, 'NOT_FOUND', 'Target not found');
  const running = deploymentsOf(s.id).find((d) => statusOf(d) === 'SUCCEEDED');
  const reason = isOnPrem(s) ? 'TARGET_NOT_SUPPORTED' : !running || running.triggerType === 'REMOVE' ? 'NO_RUNNING_DEPLOYMENT' : undefined;
  if (method === 'GET' && seg.length === 3) return ok(reason ? { available: false, reason } : { available: true });
  if (method === 'POST' && seg[3] === 'sessions' && seg.length === 4) {
    if (reason === 'TARGET_NOT_SUPPORTED') return fail(409, 'CONSOLE_TARGET_NOT_SUPPORTED', 'Console is not supported for this target');
    if (reason) return fail(409, 'NO_RUNNING_DEPLOYMENT', 'No running deployment');
    return ok(
      {
        sessionId: crypto.randomUUID(),
        token: `mock-${s.id}-${++consoleSessionCount}`,
        expiresAt: iso(Date.now() + MIN),
        gateway: { httpUrl: `${origin}${MOCK_GATEWAY_PATH}`, wsUrl: `${origin.replace(/^http/, 'ws')}${MOCK_GATEWAY_PATH}` },
      },
      201,
    );
  }
  return fail(404, 'NOT_FOUND', `No mock for ${method} ${seg.join('/')}`);
}

/* ------------------------------------------------------------------ */
/* 관리형 DB · 스택 · 참조 변수 · 환경변수 검증 (phase 2)                         */
/* ------------------------------------------------------------------ */

const ENGINE_DEFAULTS: Record<DatabaseEngine, { image: string; port: number; scheme: string; user: string }> = {
  postgres: { image: 'postgres:16-alpine', port: 5432, scheme: 'postgres', user: 'app' },
  mysql: { image: 'mysql:8.4', port: 3306, scheme: 'mysql', user: 'app' },
  mongodb: { image: 'mongo:7', port: 27017, scheme: 'mongodb', user: 'app' },
  redis: { image: 'redis:7-alpine', port: 6379, scheme: 'redis', user: '' },
};
const internalHostOf = (id: number) => `app.svc-${id}.svc.cluster.local`;

/** 관리형 DB 서비스. 소스 저장소가 없어서 sourceRepositoryUrl 에는 고정 이미지를 둔다. */
function dbService(id: number, projectId: number, name: string, engine: DatabaseEngine, stack?: { id: number; unitId: string }): MockService {
  const d = ENGINE_DEFAULTS[engine];
  return service(id, projectId, name, `docker.io/library/${d.image.split(':')[0]}`, {
    kind: 'DATABASE',
    databaseEngine: engine,
    internalHost: internalHostOf(id),
    internalPort: d.port,
    connection: {
      urlTemplate: `${d.scheme}://${d.user ? `${d.user}:` : ':'}****@${internalHostOf(id)}:${d.port}${engine === 'redis' ? '' : '/app'}`,
      properties: engine === 'redis' ? ['url', 'host', 'port', 'password'] : ['url', 'host', 'port', 'user', 'password', 'database'],
    },
    database: { image: d.image, storageGi: 5, user: d.user || undefined, database: engine === 'redis' ? undefined : 'app' },
    referenceProperties: engine === 'redis' ? ['url', 'host', 'port', 'password'] : ['url', 'host', 'port', 'user', 'password', 'database'],
    builder: undefined,
    port: d.port,
    isAutoDeploy: false,
    stack,
    // 관리형 DB 는 소스가 없어 저장소 주소·브랜치가 빈 문자열이다.
    sourceRepositoryUrl: '',
    sourceBranch: '',
    createdAt: iso(Date.now() - DAY),
  });
}

/* --- 스택 -------------------------------------------------------- */

type StackMember = { serviceId: number; unitId: string; order: number; dependsOn: string[] };
type MockStack = {
  id: number;
  projectId: number;
  repositoryUrl: string;
  sourceBranch: string;
  members: StackMember[];
  /** 마지막 스택 배포 시작 시각. 없으면 서비스별 최근 배포로 상태를 정한다. */
  runStartedAt?: number;
  /** 마지막 스택 배포에 포함된 서비스. 없으면 전부. */
  runMembers?: number[];
  /** 이 unit 의 빌드는 항상 실패한다(실패·보류 시나리오). */
  failUnit?: string;
  pending?: { analysisId: number; sourceSha: string; detectedAt: string; changes: StackChangeDto[] };
};
const stacks: MockStack[] = [];
const stackById = (id: number) => stacks.find((x) => x.id === id);
const stackMembers = (id: number) => stackById(id)?.members ?? [];

/** 스택 배포 타임라인: 단계(order)마다 5초. 대기 1.5초 → 빌드(DB 는 배포) 4.5초 → 5초에 성공(또는 실패). */
const PHASE_MS = 5_000;
function stackStepStatus(stackId: number, unitId: string, startedAt: number): StackStepStatus {
  const st = stackById(stackId);
  const member = st?.members.find((m) => m.unitId === unitId);
  if (!st || !member) return 'SUCCEEDED';
  const elapsed = Date.now() - startedAt;
  const svc = services.find((x) => x.id === member.serviceId);
  const isDb = svc?.kind === 'DATABASE';
  const failMember = st.failUnit ? st.members.find((m) => m.unitId === st.failUnit) : undefined;
  const failedAt = failMember ? (failMember.order - 1) * PHASE_MS + 4_500 : Infinity;
  if (failMember && member.order > failMember.order) return elapsed >= failedAt ? 'HELD' : 'QUEUED';
  const begin = (member.order - 1) * PHASE_MS;
  if (elapsed < begin + 1_500) return 'QUEUED';
  if (member.unitId === st.failUnit) return elapsed >= failedAt ? 'FAILED' : 'BUILDING';
  if (elapsed < begin + 4_500) return isDb ? 'DEPLOYING' : 'BUILDING';
  if (elapsed < begin + PHASE_MS) return 'DEPLOYING';
  return 'SUCCEEDED';
}

/** 분석 unit 의 위상 순서: DB(1) → DB 에 기대는 앱(2) → 앱에 기대는 앱(3)… */
function levelOf(id: string, deps: Map<string, string[]>, dbs: Set<string>, seen = new Set<string>()): number {
  if (dbs.has(id)) return 1;
  if (seen.has(id)) return 2;
  seen.add(id);
  return 1 + Math.max(1, ...(deps.get(id) ?? []).map((d) => levelOf(d, deps, dbs, seen)));
}

function toStackDto(st: MockStack): StackDto {
  const run = st.runStartedAt;
  const members: StackServiceDto[] = st.members.map((m) => {
    const svc = services.find((x) => x.id === m.serviceId);
    const own = deploymentsOf(m.serviceId);
    // 이번 스택 배포에 포함되지 않은 서비스(떠 있어서 건너뛴 DB)는 자기 최근 배포 상태 그대로다.
    const inRun = run !== undefined && (!st.runMembers || st.runMembers.includes(m.serviceId));
    const status: StackStepStatus = inRun ? stackStepStatus(st.id, m.unitId, run!) : own[0] ? (statusOf(own[0]) as StackStepStatus) : 'NOT_DEPLOYED';
    const dep = inRun ? own.find((d) => d.stackRun?.stackId === st.id && Date.parse(d.createdAt) === run) : own[0];
    const waitingFor = inRun && status === 'QUEUED' ? st.members.filter((x) => x.order < m.order && st.runMembers?.includes(x.serviceId) !== false).filter((x) => stackStepStatus(st.id, x.unitId, run!) !== 'SUCCEEDED').map((x) => x.unitId) : [];
    return {
      serviceId: m.serviceId,
      name: svc?.name ?? `#${m.serviceId}`,
      unitId: m.unitId,
      kind: svc?.kind ?? 'APP',
      order: m.order,
      dependsOn: m.dependsOn,
      status,
      deploymentId: dep?.id,
      ...(status === 'HELD' && st.failUnit && { heldBy: st.failUnit }),
      ...(waitingFor.length > 0 && { waitingFor }),
      ...(status === 'FAILED' && { failureCode: 'BUILD_FAILED' as const }),
    };
  });
  return {
    id: st.id,
    projectId: st.projectId,
    repositoryUrl: st.repositoryUrl,
    sourceBranch: st.sourceBranch,
    rootDirectory: null,
    analysisId: st.pending?.analysisId ?? 0,
    services: members.sort((a, b) => a.order - b.order),
    isDeploying: members.some((m) => IN_PROGRESS.includes(m.status as DeploymentStatus)),
    latestStackDeploymentId: run !== undefined ? st.id * 100 : null,
    pendingChanges: st.pending ?? null,
  };
}

const variablesInvalid = (serviceId: number, issues: VariableIssueDto[]) =>
  fail(422, 'VARIABLES_INVALID', 'environment variables are invalid', issues.map((i) => ({ field: i.key, reason: i.code })), { ok: false, issues, serviceId });

/**
 * 스택(또는 일부)을 의존 순서로 다시 배포한다. serviceIds 를 생략하면 전체지만 이미 떠 있는 DB 는 다시 띄우지 않는다.
 * 환경변수에 error 가 있으면 422 VARIABLES_INVALID(skip 이면 건너뜀). 진행 중이면 409.
 */
function deployStackCore(st: MockStack, serviceIds: number[] | undefined, skip: boolean): MockResponse {
  const chosen = st.members.filter((m) => {
    if (serviceIds) return serviceIds.includes(m.serviceId);
    const svc = services.find((x) => x.id === m.serviceId);
    return !(svc?.kind === 'DATABASE' && deploymentsOf(m.serviceId).some((d) => statusOf(d) === 'SUCCEEDED'));
  });
  if (!skip) {
    for (const m of chosen) {
      const issues = validate(m.serviceId).issues.filter((i) => i.severity === 'error');
      if (issues.length > 0) return variablesInvalid(m.serviceId, issues);
    }
  }
  if (toStackDto(st).isDeploying) return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
  const now = Date.now();
  st.runStartedAt = now;
  st.runMembers = chosen.map((m) => m.serviceId);
  const failMember = st.failUnit ? st.members.find((m) => m.unitId === st.failUnit) : undefined;
  for (const m of chosen) {
    if (failMember && m.order > failMember.order) continue; // 보류: 요청을 만들지 않는다
    const svc = services.find((x) => x.id === m.serviceId)!;
    deployments.push({
      ...deployment(m.serviceId, 0, 'QUEUED', 'MANUAL', svc.kind === 'DATABASE' ? ENGINE_DEFAULTS[svc.databaseEngine!].image : '스택 재배포', m.unitId === st.failUnit ? 'BUILD_FAILED' : undefined),
      ...strategySnapshot(svc),
      createdAt: iso(now),
      auto: true,
      stackRun: { stackId: st.id, unitId: m.unitId },
    });
  }
  return ok(toStackDto(st), 202);
}

function handleStacks(method: string, seg: string[], body: Record<string, unknown> | undefined): MockResponse {
  const projectId = Number(seg[1]);
  const own = stacks.filter((x) => x.projectId === projectId);
  if (seg.length === 3) return ok(own.map(toStackDto));
  const st = own.find((x) => x.id === Number(seg[3]));
  if (!st) return fail(404, 'NOT_FOUND', 'Stack not found');
  if (seg.length === 4) return ok(toStackDto(st));
  if (seg[4] === 'deployments' && method === 'POST') return deployStackCore(st, body?.serviceIds as number[] | undefined, body?.skipVariableValidation === true);
  return fail(404, 'NOT_FOUND', `No mock for ${method} /${seg.join('/')}`);
}

/* --- 변수 · 참조 · 검증 --------------------------------------------- */

type MockVar = { key: string; value?: string; reference?: VariableReferenceDto };
const variables = new Map<number, MockVar[]>();
/** 분석으로 만든 서비스가 필요로 하는 변수(분석기의 unit.env). 분석 정보가 없는 서비스는 REQUIRED_MISSING 검사를 하지 않는다. */
const requiredEnv = new Map<number, { key: string; binding?: AnalysisBindingDto | null }[]>();
const varsOf = (id: number) => variables.get(id) ?? (variables.set(id, []), variables.get(id)!);

function resolvePreview(ref: VariableReferenceDto): string | undefined {
  const target = services.find((x) => x.id === ref.serviceId);
  if (!target) return undefined;
  if (target.kind === 'DATABASE') {
    const d = ENGINE_DEFAULTS[target.databaseEngine!];
    const host = target.internalHost!;
    switch (ref.property) {
      case 'url': return target.connection!.urlTemplate;
      case 'host': return host;
      case 'port': return String(target.internalPort);
      case 'user': return d.user || undefined;
      case 'password': return '********';
      case 'database': return 'app';
    }
  }
  const host = internalHostOf(target.id);
  return ref.property === 'url' ? `http://${host}:${target.port ?? 80}` : ref.property === 'host' ? host : String(target.port ?? 80);
}
const toVariableDto = (v: MockVar): VariableDto => (v.reference ? { key: v.key, reference: v.reference, resolved: resolvePreview(v.reference) } : { key: v.key, value: v.value ?? '' });

const ENGINE_BY_KEY: [RegExp, DatabaseEngine][] = [[/(DATABASE|POSTGRES|PG)/, 'postgres'], [/REDIS/, 'redis'], [/MONGO/, 'mongodb'], [/MYSQL/, 'mysql']];
function suggestionFor(s: MockService, key: string, binding?: AnalysisBindingDto | null): { reference: VariableReferenceDto } | undefined {
  const siblings = services.filter((x) => x.projectId === s.projectId && x.id !== s.id);
  if (binding) {
    const target = siblings.find((x) => x.stack?.unitId === binding.targetId);
    if (target) return { reference: { serviceId: target.id, property: binding.property } };
  }
  const engine = ENGINE_BY_KEY.find(([re]) => re.test(key.toUpperCase()))?.[1];
  const target = engine && siblings.find((x) => x.kind === 'DATABASE' && x.databaseEngine === engine);
  return target ? { reference: { serviceId: target.id, property: 'url' } } : undefined;
}

/** 배포 전 환경변수 검증(계약 C 의 코드들). */
function validate(serviceId: number): VariablesValidationDto {
  const s = services.find((x) => x.id === serviceId);
  if (!s || s.kind === 'DATABASE') return { ok: true, issues: [] };
  const vars = varsOf(serviceId);
  const issues: VariableIssueDto[] = [];
  for (const need of requiredEnv.get(serviceId) ?? []) {
    if (!vars.some((v) => v.key === need.key)) {
      issues.push({ key: need.key, severity: 'error', code: 'REQUIRED_MISSING', message: `${need.key} is required by the analyzed service but is not set.`, suggestion: suggestionFor(s, need.key, need.binding) });
    }
  }
  for (const v of vars) {
    if (v.reference) {
      if (!services.some((x) => x.id === v.reference!.serviceId && x.projectId === s.projectId)) {
        issues.push({ key: v.key, severity: 'error', code: 'REFERENCE_BROKEN', message: 'The referenced service was deleted or belongs to another project.' });
      }
      continue;
    }
    const value = v.value ?? '';
    if (/(_URL|_URI|_HOST|_ADDR)$/.test(v.key) && /(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(value)) {
      issues.push({ key: v.key, severity: 'error', code: 'LOCALHOST_ADDRESS', message: 'localhost points at the container itself, not at another service.', suggestion: suggestionFor(s, v.key) });
      continue;
    }
    const host = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^:/?#]+)/i.exec(value)?.[1] ?? (/_HOST$/.test(v.key) ? value : undefined);
    if (host && !host.includes('.') && !services.some((x) => x.projectId === s.projectId && x.name === host)) {
      issues.push({ key: v.key, severity: 'warning', code: 'UNRESOLVABLE_HOST', message: `Host "${host}" is not a service alias in this project, an FQDN or an external domain.` });
    }
    const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value)?.[1]?.toLowerCase();
    const keyEngine = ENGINE_BY_KEY.find(([re]) => re.test(v.key.toUpperCase()))?.[1];
    if (scheme && keyEngine && scheme !== ENGINE_DEFAULTS[keyEngine].scheme && Object.values(ENGINE_DEFAULTS).some((d) => d.scheme === scheme)) {
      issues.push({ key: v.key, severity: 'warning', code: 'SCHEME_MISMATCH', message: `${v.key} looks like a ${keyEngine} URL but uses the ${scheme}:// scheme.` });
    }
  }
  return { ok: !issues.some((i) => i.severity === 'error'), issues };
}

const SYSTEM_VARIABLES = [
  { key: 'PORT', description: 'Port the platform expects your app to listen on.', value: '3000' },
  { key: 'IRIS_SERVICE_ID', description: 'Id of this service.' },
  { key: 'IRIS_PROJECT_ID', description: 'Id of the project this service belongs to.' },
];

function handleVariables(s: MockService, method: string, seg: string[], body: Record<string, unknown> | undefined): MockResponse {
  const list = varsOf(s.id);
  // 관리형 DB 의 자격 증명은 변수 목록이 아니라 읽기 전용 systemVariables 에 이름만 보인다(비밀번호는 값 없음).
  const dbSystem = s.kind === 'DATABASE'
    ? [{ key: s.databaseEngine === 'postgres' ? 'POSTGRES_USER' : 'DB_USER', description: 'Managed by the platform. Read only.', value: s.database?.user ?? '' }, { key: s.databaseEngine === 'postgres' ? 'POSTGRES_PASSWORD' : 'DB_PASSWORD', description: 'Managed by the platform. The value is never shown.' }]
    : [];
  const all = () => ({ variables: [...list].sort((a, b) => (a.key < b.key ? -1 : 1)).map(toVariableDto), systemVariables: [...dbSystem, ...SYSTEM_VARIABLES] });
  if (seg[3] === 'validation') return ok(validate(s.id));
  if (seg.length === 3) {
    if (method === 'PUT') {
      // Raw 저장: 텍스트에 없는 변수는 지워진다(참조 변수도, 그래서 화면이 되살려야 한다).
      const raw = String(body?.raw ?? '');
      list.length = 0;
      for (const line of raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
        const eq = line.indexOf('=');
        if (eq < 1) return fail(422, 'INVALID_INPUT', 'invalid variable line', [{ field: 'raw', reason: 'line 1: invalid variable line' }]);
        let value = line.slice(eq + 1);
        if (value.startsWith('"')) { try { value = JSON.parse(value); } catch { /* 그대로 */ } }
        list.push({ key: line.slice(0, eq), value });
      }
      return ok(all());
    }
    if (method === 'POST') {
      const key = String(body?.key ?? '');
      if (list.some((v) => v.key === key)) return fail(409, 'VARIABLE_CONFLICT', 'Variable already exists');
      const v: MockVar = body?.reference ? { key, reference: body.reference as VariableReferenceDto } : { key, value: String(body?.value ?? '') };
      list.push(v);
      return ok(toVariableDto(v), 201);
    }
    return ok(all());
  }
  const key = decodeURIComponent(seg[3]);
  const v = list.find((x) => x.key === key);
  if (!v) return fail(404, 'VARIABLE_NOT_FOUND', 'Variable not found');
  if (method === 'DELETE') { list.splice(list.indexOf(v), 1); return { status: 204 }; }
  if (method === 'PUT') {
    if (body?.reference) { delete v.value; v.reference = body.reference as VariableReferenceDto; }
    else { delete v.reference; v.value = String(body?.value ?? ''); }
  }
  return ok(toVariableDto(v));
}

/* --- DB 생성 · apply(스택) ------------------------------------------- */

const networkingRejected = (targetIds: number[] | undefined) =>
  (targetIds ?? [1]).some((id) => targetsNow().find((x) => x.id === id)?.kind === 'ONPREM')
    ? fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'targetIds', reason: 'networking_unsupported_target' }])
    : null;

const nextServiceId = () => Math.max(0, ...services.map((x) => x.id)) + 1;
const queueDeploy = (s: MockService, message: string) => {
  deployments.push({ ...deployment(s.id, 0, 'QUEUED', 'MANUAL', message), ...strategySnapshot(s), createdAt: iso(Date.now()), auto: true });
};

function createDatabase(projectId: number, body: Record<string, unknown> | undefined): MockResponse {
  const name = String(body?.name ?? '');
  const engine = body?.engine as DatabaseEngine;
  if (!ENGINE_DEFAULTS[engine]) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'engine', reason: 'unsupported database engine' }]);
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) return fail(422, 'INVALID_INPUT', 'invalid input', [{ field: 'name', reason: 'must be a DNS label' }]);
  if (services.some((x) => x.projectId === projectId && x.name === name)) return fail(409, 'SERVICE_NAME_CONFLICT', 'Service name conflict');
  const rejected = networkingRejected(body?.targetIds as number[] | undefined);
  if (rejected) return rejected;
  const s = dbService(nextServiceId(), projectId, name, engine);
  s.database = { ...s.database, storageGi: Number(body?.storageGi ?? 5) };
  services.push(s);
  queueDeploy(s, ENGINE_DEFAULTS[engine].image);
  return ok(toServiceDto(s), 201);
}

const stackOfAnalysis = (a: MockAnalysis, projectId: number) =>
  a.id === PENDING_ANALYSIS_ID ? 1 : (stacks.find((x) => x.projectId === projectId && x.repositoryUrl === a.sourceRepositoryUrl)?.id ?? 100 + a.id);

/**
 * 분석 apply(증분 포함): 스택에 이미 있는 unit 은 unitId 로 맞춰 중복 생성하지 않고 바뀐 필드만 갱신한다.
 * provision 인 의존성은 DB 서비스로 만들고, env binding 은 참조 변수로, hostAliases 는 서비스 host_aliases 로 남긴다.
 * 사라진 unit 은 건드리지 않는다.
 */
function applyToStack(a: MockAnalysis, result: AnalysisGateResultDto, picks: AnalysisUnitApply[], depChoices: AnalysisDependencyApply[], targetIds: number[], deploy: boolean, stackId: number, skip: boolean) {
  let st = stackById(stackId);
  if (!st) {
    st = { id: stackId, projectId: a.projectId, repositoryUrl: a.sourceRepositoryUrl, sourceBranch: a.sourceBranch, members: [] };
    stacks.push(st);
  }
  const projectId = a.projectId;
  const repo = a.sourceRepositoryUrl.split('/').slice(-2).join('/');
  const tag = (unitId: string) => ({ id: stackId, unitId });
  const databases: MockService[] = [];
  const created: MockService[] = [];
  const serviceOfUnit = new Map<string, MockService>(st.members.flatMap((m) => { const x = services.find((y) => y.id === m.serviceId); return x ? [[m.unitId, x] as const] : []; }));

  // 1) DB 서비스(선택한 의존성만, 기본은 지원 엔진 전부)
  for (const dep of result.dependencies as AnalysisDependencyDto[]) {
    if (serviceOfUnit.has(dep.id) || dep.engine === 'other') continue;
    const choice = depChoices.find((c) => c.dependencyId === dep.id);
    if (choice && !choice.provision) continue;
    const s = dbService(nextServiceId(), projectId, choice?.name ?? dep.id, dep.engine, tag(dep.id));
    s.targetIds = targetIds;
    const scripts = (dep.initScripts ?? []).filter((x) => x.supported !== false);
    if (scripts.length > 0) s.database = { ...s.database, initScripts: scripts.map((x) => ({ name: `${String(x.order).padStart(2, '0')}-${x.path.split('/').pop()}`, path: x.path, sha256: x.sha256 ?? '', size: x.size })) };
    services.push(s);
    serviceOfUnit.set(dep.id, s);
    databases.push(s);
  }
  // 2) 앱 서비스
  for (const pick of picks) {
    const unit = result.units.find((u) => u.id === pick.unitId)!;
    const known = serviceOfUnit.get(unit.id);
    if (known) {
      // 바뀐 필드만 갱신한다.
      Object.assign(known, { port: pick.port ?? unit.port ?? known.port, updatedAt: iso(Date.now()) });
      continue;
    }
    const s = service(nextServiceId(), projectId, pick.name, repo, {
      sourceBranch: a.sourceBranch,
      rootDirectory: pick.rootDirectory ?? unit.rootDirectory,
      builder: pick.builder ?? unit.builder,
      dockerfilePath: pick.dockerfilePath ?? unit.dockerfilePath ?? undefined,
      port: pick.port ?? unit.port ?? undefined,
      targetIds,
      analysisGate: { analysisId: a.id, decision: 'analyze', complexity: 'complex', unitId: unit.id },
      stack: tag(unit.id),
      createdAt: iso(Date.now()),
      updatedAt: iso(Date.now()),
    });
    services.push(s);
    serviceOfUnit.set(unit.id, s);
    created.push(s);
  }
  // 3a) 자동 생성 비밀값: random 은 consumer 서비스마다 같은 키로 저장한다(값은 응답에 싣지 않는다).
  const generatedSecrets: { id: string; serviceIds: number[] }[] = [];
  for (const sec of result.secrets ?? []) {
    if (sec.generate !== 'random') continue;
    const value = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const ids: number[] = [];
    for (const c of sec.consumers) {
      const svc = serviceOfUnit.get(c.targetId);
      if (!svc || ![...created, ...databases].includes(svc)) continue;
      // url_password 는 참조 변수의 passwordVariable 로 쓰이므로 키를 따로 만들지 않아도 서비스에 값이 저장된 것으로 본다.
      const vars = varsOf(svc.id);
      if (!vars.some((v) => v.key === c.key)) vars.push({ key: c.key, value });
      ids.push(svc.id);
    }
    if (ids.length > 0) generatedSecrets.push({ id: sec.id, serviceIds: [...new Set(ids)] });
  }
  // 3) 참조 변수와 필수 변수, 호스트 별칭(마지막으로 만든 서비스들에 대해)
  for (const s of [...created]) {
    const unit = result.units.find((u) => u.id === s.analysisGate?.unitId)!;
    requiredEnv.set(s.id, unit.env.filter((e) => e.required).map((e) => ({ key: e.key, binding: e.binding })));
    for (const e of unit.env) {
      const b = e.binding;
      const target = b && serviceOfUnit.get(b.targetId);
      if (b && target) varsOf(s.id).push({ key: e.key, reference: { serviceId: target.id, property: b.property as ReferenceProperty } });
    }
  }
  // 4) 스택 구성원(순서는 위상 정렬)
  const deps = new Map(result.units.map((u) => [u.id, u.dependsOn]));
  const dbIds = new Set(result.dependencies.map((d) => d.id));
  st.members = [...serviceOfUnit.entries()].map(([unitId, svc]) => ({
    serviceId: svc.id,
    unitId,
    order: levelOf(unitId, deps, dbIds),
    dependsOn: (deps.get(unitId) ?? []).filter((d) => serviceOfUnit.has(d)),
  }));
  const changes = (st.pending?.changes ?? []).filter((c) => c.type === 'DEPENDENCY_CHANGED');
  st.pending = undefined;
  // 의존 순서 스택 배포. 새로 만든 서비스만 대상으로 하고, 환경변수 error 가 있으면 배포 없이 이슈를 돌려준다.
  const fresh = [...databases, ...created].map((x) => x.id);
  let deployed = false;
  let variableIssues: { serviceId: number; ok: boolean; issues: VariableIssueDto[] }[] | null = null;
  if (deploy && fresh.length > 0) {
    const res = deployStackCore(st, fresh, skip);
    deployed = res.status === 202;
    if (!deployed) {
      const failed = fresh.map((id) => ({ serviceId: id, ...validate(id) })).filter((v) => !v.ok);
      variableIssues = failed.length ? failed : null;
    }
  }
  return { services: created, databases, deployed, variableIssues, changes, generatedSecrets };
}

/* --- 시드 -------------------------------------------------------- */

const PENDING_ANALYSIS_ID = 900;
/** push 뒤 자동 분석: multi-image-shop 에 scheduler 가 생기고 api 포트가 바뀌고 mongo 가 늘었다. */
function pendingShopResult(root: string): AnalysisGateResultDto {
  const base = multiImageShopResult(root, 'auto');
  return {
    ...base,
    sourceSha: 'b81e0c4d92a7f3561d0e8a9b7c4f2e1d3a5b6c7d',
    units: [
      ...base.units.map((u) => (u.id === 'api' ? { ...u, port: 8080 } : u)),
      { id: 'scheduler', name: 'scheduler', rootDirectory: 'scheduler', builder: 'dockerfile', dockerfilePath: 'Dockerfile', port: null, startCommand: null, buildCommand: null, role: 'worker', public: false, env: [{ key: 'DATABASE_URL', stage: 'runtime', required: true, binding: PG_URL }], dependsOn: ['postgres'], evidence: [{ path: 'compose.yaml', line: 48 }] },
    ],
    dependencies: [...base.dependencies, { id: 'mongo', engine: 'mongodb', image: 'mongo:7', port: 27017, database: 'events', evidence: [{ path: 'compose.yaml', line: 55 }] }],
  };
}

function seedStack(opts: { stackId: number; projectId: number; repo: string; ids: { postgres: number; redis: number; api: number; worker?: number; web?: number }; failUnit?: string; names?: Partial<Record<string, string>> }) {
  const { stackId, projectId, ids } = opts;
  const tag = (unitId: string) => ({ id: stackId, unitId });
  const url = `https://github.com/${opts.repo}`;
  const deps = [
    dbService(ids.postgres, projectId, 'postgres', 'postgres', tag('postgres')),
    dbService(ids.redis, projectId, 'redis', 'redis', tag('redis')),
  ];
  const mk = (id: number, name: string, unit: string, port: number | undefined, extra: Partial<MockService> = {}) =>
    service(id, projectId, name, opts.repo, { rootDirectory: unit, builder: 'dockerfile', dockerfilePath: 'Dockerfile', port, analysisGate: { analysisId: 800 + projectId, decision: 'analyze', complexity: 'complex', unitId: unit }, stack: tag(unit), ...extra });
  const apps = [mk(ids.api, 'api', 'api', 8000), ...(ids.worker ? [mk(ids.worker, 'worker', 'worker', undefined)] : []), ...(ids.web ? [mk(ids.web, 'web', 'web', 3000)] : [])];
  services.push(...deps, ...apps);
  const members: StackMember[] = [
    { serviceId: ids.postgres, unitId: 'postgres', order: 1, dependsOn: [] },
    { serviceId: ids.redis, unitId: 'redis', order: 1, dependsOn: [] },
    { serviceId: ids.api, unitId: 'api', order: 2, dependsOn: ['postgres', 'redis'] },
    ...(ids.worker ? [{ serviceId: ids.worker, unitId: 'worker', order: 2, dependsOn: ['postgres', 'redis'] }] : []),
    ...(ids.web ? [{ serviceId: ids.web, unitId: 'web', order: 3, dependsOn: ['api'] }] : []),
  ];
  stacks.push({ id: stackId, projectId, repositoryUrl: url, sourceBranch: 'main', members, failUnit: opts.failUnit });
  return { deps, apps };
}

{
  const iaddRef = (id: number, key: string, serviceId: number, property: ReferenceProperty) => varsOf(id).push({ key, reference: { serviceId, property } });
  const projectsAdd = (id: number, name: string, description: string) => projects.push({ id, name, description, createdAt: iso(t0 - 4 * DAY), updatedAt: iso(t0 - 5 * MIN) });

  // 프로젝트 4: 멀티 이미지 스택이 postgres·redis 와 함께 배포된 상태 + push 로 감지된 구성 변경(pendingChanges).
  projectsAdd(4, 'multi-image-shop', 'web · api · worker 와 postgres · redis 를 한 스택으로 운영');
  seedStack({ stackId: 1, projectId: 4, repo: 'kylo-dev/multi-image-shop', ids: { postgres: 41, redis: 42, api: 43, worker: 44, web: 45 } });
  services.find((x) => x.id === 41)!.database = { ...services.find((x) => x.id === 41)!.database, initScripts: [
    { name: '00-schema.sql', path: 'db/schema.sql', sha256: SHOP_INIT_SCRIPTS[0].sha256 ?? '', size: SHOP_INIT_SCRIPTS[0].size },
    { name: '01-seed.sql', path: 'db/seed.sql', sha256: SHOP_INIT_SCRIPTS[1].sha256 ?? '', size: SHOP_INIT_SCRIPTS[1].size },
  ] };
  for (const id of [41, 42, 43, 44, 45]) {
    const isDb = id <= 42;
    deployments.push(deployment(id, isDb ? 3 * DAY : 3 * DAY - 5 * MIN, 'SUCCEEDED', isDb ? 'MANUAL' : 'MANUAL', isDb ? (id === 41 ? 'postgres:16-alpine' : 'redis:7-alpine') : '레포 구성 확인으로 생성'));
  }
  deployments.push(deployment(43, 4 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 주문 API 페이지네이션'));
  for (const id of [43, 44]) {
    iaddRef(id, 'DATABASE_URL', 41, 'url');
    iaddRef(id, 'REDIS_URL', 42, 'url');
    requiredEnv.set(id, [{ key: 'DATABASE_URL', binding: PG_URL }, { key: 'REDIS_URL', binding: REDIS_URL }]);
  }
  varsOf(43).push({ key: 'LOG_LEVEL', value: 'info' });
  varsOf(45).push({ key: 'API_BASE_URL', value: 'http://api:8000' });
  requiredEnv.set(45, [{ key: 'API_BASE_URL', binding: { kind: 'unit', targetId: 'api', property: 'url' } }]);
  analyses.push({
    id: PENDING_ANALYSIS_ID, projectId: 4, sourceRepositoryUrl: 'https://github.com/kylo-dev/multi-image-shop', sourceBranch: 'main', sourceSha: null,
    rootDirectory: '.', mode: 'auto', errorCode: null, errorMessage: null, appliedServiceIds: [], createdAt: iso(t0 - 20 * MIN), updatedAt: iso(t0 - 20 * MIN), startedAt: 0, applied: false,
  });
  stackById(1)!.pending = {
    analysisId: PENDING_ANALYSIS_ID,
    sourceSha: 'b81e0c4d92a7f3561d0e8a9b7c4f2e1d3a5b6c7d',
    detectedAt: iso(t0 - 20 * MIN),
    changes: [
      { type: 'UNIT_ADDED', unitId: 'scheduler' },
      { type: 'UNIT_CHANGED', unitId: 'api', field: 'port', from: 8000, to: 8080 },
      { type: 'DEPENDENCY_ADDED', unitId: 'mongo' },
      { type: 'DEPENDENCY_CHANGED', unitId: 'postgres', field: 'initScripts', reason: 'init_scripts_changed', serviceId: 41, message: 'Init scripts run only when the database is first created and are not run again on an existing database.', from: [{ path: 'db/schema.sql', sha256: 'a3f1c9d2' }], to: [{ path: 'db/schema.sql', sha256: 'e0b44c71' }, { path: 'db/seed.sql', sha256: '7be04d1a' }] },
    ],
  };

  // 프로젝트 5: 환경변수 검증 실패(localhost, 필수 변수 누락, 해석 불가 호스트, 스킴 불일치).
  projectsAdd(5, 'shop-validation', '배포 전 환경변수 검증이 막는 스택');
  const lab = seedStack({ stackId: 3, projectId: 5, repo: 'kylo-dev/shop-validation', ids: { postgres: 52, redis: 53, api: 51 } });
  for (const s of [...lab.deps, ...lab.apps]) deployments.push(deployment(s.id, 2 * DAY, 'SUCCEEDED', 'MANUAL', s.kind === 'DATABASE' ? ENGINE_DEFAULTS[s.databaseEngine!].image : '초기 배포'));
  varsOf(51).push(
    { key: 'DATABASE_URL', value: 'postgres://shop:secret@localhost:5432/shop' },
    { key: 'CACHE_HOST', value: 'cache' },
    { key: 'MONGO_URL', value: 'redis://redis:6379/0' },
  );
  requiredEnv.set(51, [{ key: 'DATABASE_URL', binding: PG_URL }, { key: 'REDIS_URL', binding: REDIS_URL }]);

  // 프로젝트 6: api 빌드가 실패해 같은 단계의 worker 는 끝나고 web 은 보류된 스택 배포.
  projectsAdd(6, 'shop-stack-failing', 'api 빌드가 실패해 web 이 보류된 스택 배포');
  const bad = seedStack({ stackId: 2, projectId: 6, repo: 'kylo-dev/shop-stack-failing', ids: { postgres: 61, redis: 62, api: 63, worker: 64, web: 65 }, failUnit: 'api' });
  stackById(2)!.runStartedAt = Date.now() - 10 * MIN;
  for (const s of [...bad.deps, ...bad.apps]) {
    if (s.id === 65) continue; // 보류: 배포 요청이 없다
    const failed = s.id === 63;
    deployments.push({ ...deployment(s.id, 10 * MIN, failed ? 'FAILED' : 'SUCCEEDED', 'MANUAL', s.kind === 'DATABASE' ? ENGINE_DEFAULTS[s.databaseEngine!].image : '스택 전체 재배포', failed ? 'BUILD_FAILED' : undefined, failed ? 'build' : undefined) });
  }
  for (const id of [63, 64]) {
    iaddRef(id, 'DATABASE_URL', 61, 'url');
    iaddRef(id, 'REDIS_URL', 62, 'url');
  }
  varsOf(65).push({ key: 'API_BASE_URL', value: 'http://api:8000' });
}
