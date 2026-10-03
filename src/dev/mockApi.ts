// 개발용 가짜 was. `VITE_MOCK_API=1` 일 때 vite dev 서버(vite.config.ts)가 /api/v1 요청을 여기로 보낸다.
// 앱 번들에는 들어가지 않는다. 화면 디자인용이라 상태를 메모리에만 들고, dev 서버를 다시 띄우면 처음으로 돌아간다.
import type {
  BranchDto,
  DeploymentDetailDto,
  DeploymentDto,
  DeploymentHistoryDto,
  DeploymentStatus,
  DeploymentTrigger,
  FailureCode,
  InstallationDto,
  LogEntryDto,
  MetricSeriesDto,
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
/** auto 인 배포는 만든 뒤 시간이 지나면 QUEUED → BUILDING → DEPLOYING → SUCCEEDED 로 넘어간다. 시드 배포는 상태가 고정이다. */
type MockDeployment = Omit<DeploymentDto, 'isActive'> & { auto?: boolean };
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
  service(11, 1, 'web', 'likelion/web'),
  service(12, 1, 'api', 'likelion/api', { port: 8000, builder: 'dockerfile', dockerfilePath: 'Dockerfile' }),
  service(13, 1, 'worker', 'likelion/worker', { port: undefined }),
  service(21, 2, 'gateway', 'softbank/iris-gateway', { targetIds: [1, 2] }),
  service(22, 2, 'docs', 'softbank/iris-docs', { isAutoDeploy: false }),
];

let nextDeploymentId = 1000;
const deployment = (
  serviceId: number,
  ago: number,
  status: DeploymentStatus,
  triggerType: DeploymentTrigger,
  message: string,
  failureCode?: FailureCode,
): MockDeployment => {
  const at = t0 - ago;
  return {
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
  deployment(11, 2 * DAY, 'FAILED', 'PUSH', 'feat: 대시보드 차트', 'BUILD_FAILED'),
  deployment(11, 26 * HOUR, 'ROLLED_BACK', 'PUSH', 'fix: 차트 빌드 오류 수정'),
  deployment(11, 25 * HOUR, 'SUCCEEDED', 'ROLLBACK', 'chore: 초기 설정'),
  deployment(11, 2 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 랜딩 페이지 추가'),
  deployment(12, 5 * HOUR, 'SUCCEEDED', 'PUSH', 'feat: 프로젝트 API'),
  deployment(12, 40_000, 'BUILDING', 'MANUAL', 'feat: 배포 로그 SSE'),
  deployment(13, DAY, 'SUCCEEDED', 'PUSH', 'feat: 배포 큐 워커'),
  deployment(13, 20 * MIN, 'FAILED', 'PUSH', 'refactor: 재시도 정책', 'DEPLOY_FAILED'),
  deployment(21, 6 * HOUR, 'SUCCEEDED', 'CLI', 'feat: 게이트웨이 라우팅'),
  deployment(21, MIN, 'DEPLOYING', 'REDEPLOY', 'feat: 게이트웨이 라우팅'),
];

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
  const { auto: _auto, ...rest } = d;
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
  return { ...dto, stages, history };
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
      const source = deployments.find((d) => d.id === Number(body?.sourceDeploymentId));
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
  return fail(404, 'NOT_FOUND', `No mock for ${method} ${path}`);
}
