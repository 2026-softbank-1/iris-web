// 개발용 가짜 was. `VITE_MOCK_API=1` 일 때 vite dev 서버(vite.config.ts)가 /api/v1 요청을 여기로 보낸다.
// 앱 번들에는 들어가지 않는다. 화면 디자인용이라 상태를 메모리에만 들고, dev 서버를 다시 띄우면 처음으로 돌아간다.
import type {
  BranchDto,
  BuildLogsDto,
  BuildStatus,
  DeploymentDetailDto,
  DeploymentDto,
  DeploymentHistoryDto,
  DeploymentLogsDto,
  DeploymentReleaseDto,
  DeploymentStatus,
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
  ProjectDto,
  RepositoryDto,
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
const fail = (status: number, code: string, message: string): MockResponse => ({ status, body: { success: false, code, message } });

/* ------------------------------------------------------------------ */
/* 시드 데이터                                                           */
/* ------------------------------------------------------------------ */

const user: SessionUser = { id: 1, githubId: 1, login: 'kylo-dev' };
let loggedIn = true;

const targets: TargetDto[] = [
  { id: 1, name: 'aws-seoul', kind: 'AWS', region: 'ap-northeast-2', domainSuffix: 'likelion.uk' },
  { id: 2, name: 'local', kind: 'LOCAL' },
];

type MockProject = Omit<ProjectDto, 'serviceCount' | 'onlineServiceCount'>;
/**
 * AI 진단을 시작하면 어떤 결과가 나오는지. build·runtime 은 원인과 해결책이 있는 성공, insufficient·noFailure 는 근거 부족·실패 흔적
 * 없음(정상 응답), error 는 FAILED 이고 시작할 때마다 오류 코드가 바뀐다.
 */
type DiagnosisScenario = 'build' | 'runtime' | 'insufficient' | 'noFailure' | 'error';
/** auto 인 배포는 만든 뒤 시간이 지나면 QUEUED → BUILDING → DEPLOYING → SUCCEEDED 로 넘어간다. 시드 배포는 상태가 고정이다. */
type MockDeployment = Omit<DeploymentDto, 'isActive'> & { auto?: boolean; diagnosis?: DiagnosisScenario };
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
  createdAt: iso(t0 - 10 * DAY),
  updatedAt: iso(t0 - DAY),
  ...extra,
});

const services: MockService[] = [
  service(11, 1, 'web', 'likelion/web', { rootDirectory: 'apps/web', buildCommand: 'npm run build', startCommand: 'npm start' }),
  service(12, 1, 'api', 'likelion/api', { port: 8000, builder: 'dockerfile', dockerfilePath: 'Dockerfile' }),
  service(13, 1, 'worker', 'likelion/worker', { port: undefined }),
  service(21, 2, 'gateway', 'softbank/iris-gateway', { targetIds: [1, 2] }),
  service(22, 2, 'docs', 'softbank/iris-docs', { isAutoDeploy: false }),
  service(31, 3, 'sandbox', 'kylo-dev/playground'),
];

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
  deployment(22, 30 * MIN, 'MANUAL_INTERVENTION', 'MANUAL', 'docs: 배포 파이프라인 정리', undefined, 'runtime'), // 6분째 RUNNING 인 멈춘 진단이 있다
  deployment(31, 4 * MIN, 'FAILED', 'PUSH', 'feat: 샌드박스 초기 설정', 'DEPLOY_FAILED', 'build'), // 서비스의 가장 최근 배포가 실패했고 성공한 진단이 있다(실패 배너 아래에 진단 요약)
];

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
  if (!d.auto) return d.status;
  const elapsed = Date.now() - Date.parse(d.createdAt);
  if (elapsed < 3_000) return 'QUEUED';
  if (elapsed < 23_000) return 'BUILDING';
  if (elapsed < 33_000) return 'DEPLOYING';
  return 'SUCCEEDED';
}

function toDeploymentDto(d: MockDeployment): DeploymentDto {
  const status = statusOf(d);
  const { auto: _auto, diagnosis: _diagnosis, ...rest } = d;
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
          const target = targets.find((x) => x.id === id)!;
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
    const target = targets.find((tg) => tg.id === id)!;
    const host = target.domainSuffix ? `${s.name}-${s.id}.${target.domainSuffix}` : undefined;
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
/* 라우터                                                               */
/* ------------------------------------------------------------------ */

const page = <T>(items: T[], q: Query) => {
  const p = Number(q.page ?? 0);
  const size = Number(q.size ?? 20);
  return { items: items.slice(p * size, (p + 1) * size), total: items.length, page: p, size };
};

/** /api/v1 뒤의 경로를 처리한다. 모르는 경로는 404. */
export function handle(method: string, path: string, q: Query, body: Record<string, unknown> | undefined): MockResponse {
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
  if (path === '/targets') return ok(targets);

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
  if (seg[0] === 'projects' && seg[2] === 'services') {
    if (method === 'POST') {
      const url = String(body?.repositoryUrl ?? '').replace(/\.git$/, '');
      const repo = url.split('/').slice(-2).join('/');
      const s = service(Math.max(0, ...services.map((x) => x.id)) + 1, id(1), String(body?.name || repo.split('/')[1] || 'service'), repo, {
        sourceBranch: (body?.branch as string) || 'main',
        targetIds: (body?.targetIds as number[]) ?? [1],
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
    if (method === 'PATCH') Object.assign(s, body, { updatedAt: iso(Date.now()) });
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
  if (seg[2] === 'logs' && seg.length === 3) {
    const entries = logsBetween(s, Date.parse(q.start), Date.parse(q.end), Math.min(Number(q.limit ?? 500), 1000));
    return ok({ entries, isTruncated: entries.length >= Number(q.limit ?? 500) });
  }
  if (seg[2] === 'metrics') return ok(metricsFor(s, q));
  if (seg[2] === 'deployments' && seg.length === 3) {
    if (method === 'POST') {
      if (deploymentsOf(s.id).some((d) => IN_PROGRESS.includes(statusOf(d)))) {
        return fail(409, 'DEPLOYMENT_IN_PROGRESS', 'Deployment in progress');
      }
      // RESTART 는 원본을 보내지 않고, 서버가 지금 떠 있는(가장 최근에 성공한) 배포로 정한다.
      const source =
        body?.triggerType === 'RESTART'
          ? deploymentsOf(s.id).find((d) => statusOf(d) === 'SUCCEEDED')
          : deployments.find((d) => d.id === Number(body?.sourceDeploymentId));
      const d: MockDeployment = {
        ...deployment(s.id, 0, 'QUEUED', (body?.triggerType as DeploymentTrigger) ?? 'MANUAL', source?.sourceCommitMessage ?? '수동 배포'),
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
