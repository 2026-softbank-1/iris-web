import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { serviceStatusOf } from './deploymentModel';
import type { Project, Service } from './mock';
import { shouldPollServer, targetLabel } from './targetModel';

/* ------------------------------------------------------------------ */
/* was 응답 → 화면 모델                                                  */
/* ------------------------------------------------------------------ */

const repoFullName = (url: string) => url.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');

function toService(dto: api.ServiceDto, targets: api.TargetDto[], servers: api.OnpremServerDto[]): Service {
  // 서비스가 배포되는 타깃(aws·onprem·내 서버 이름)을 지역 자리에 보여준다.
  const where = dto.targetIds.map((id) => { const target = targets.find((t) => t.id === id); return target ? targetLabel(target, servers) : `#${id}`; }).join(', ');
  return {
    id: String(dto.id),
    shortId: String(dto.id),
    name: dto.name,
    repo: repoFullName(dto.sourceRepositoryUrl),
    port: dto.port,
    region: where,
    regionLong: where,
    replicas: 0, // 서버에 없는 값이라 화면에서 숨긴다
    // 서비스 응답의 latestDeployment(가장 최근 배포 요청)로 상태를 정한다.
    ...serviceStatusOf(dto.latestDeployment),
    deployments: [],
    remote: dto,
  };
}

/** was 의 도메인 조회 결과를 서비스에 붙인다. 접속되는 주소가 있으면 그것을 대표 주소로 쓴다. */
function withDomains(service: Service, dtos: api.ServiceDomainDto[] | undefined): Service {
  if (!dtos) return service;
  const domains = dtos.flatMap((d) => (d.host ? [{ host: d.host, targetName: d.targetName, isConnected: d.isConnected }] : []));
  return { ...service, domains, domain: (domains.find((d) => d.isConnected) ?? domains[0])?.host };
}

function toProject(dto: api.ProjectDto, services: api.ServiceDto[], targets: api.TargetDto[], servers: api.OnpremServerDto[]): Project {
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description,
    environment: 'production',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    serviceCount: dto.serviceCount,
    onlineServiceCount: dto.onlineServiceCount,
    services: services.map((s) => toService(s, targets, servers)),
  };
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

type Status = 'idle' | 'loading' | 'ready' | 'error';

type ProjectsApi = {
  status: Status;
  error: string | null;
  projects: Project[];
  targets: api.TargetDto[];
  /** 내 온프레미스 서버. 서버 타깃의 이름을 보여 줄 때 쓴다. */
  servers: api.OnpremServerDto[];
  reload: () => Promise<void>;
  /** 타깃과 내 서버를 다시 받는다(서버를 추가·삭제했거나 연결 상태가 바뀌었을 때). */
  reloadTargets: () => Promise<void>;
  /** 목록에 없는 프로젝트(다른 탭에서 만든 것 등)를 하나만 받아 합친다. 없으면 null. */
  loadProject: (id: string) => Promise<Project | null>;
  createProject: (body: api.ProjectCreate) => Promise<Project>;
  updateProject: (id: string, body: api.ProjectUpdate) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  createService: (projectId: string, body: api.ServiceCreate) => Promise<Service>;
  updateService: (projectId: string, serviceId: string, body: api.ServiceUpdate) => Promise<Service>;
  /** 프로젝트에 있는 서비스마다 공개 주소(도메인)를 받아 서비스에 붙인다. */
  loadDomains: (projectId: string) => Promise<void>;
  /** 서비스 하나를 다시 받아 상태(최근 배포)를 갱신한다. */
  refreshService: (projectId: string, serviceId: string) => Promise<Service>;
  /** 프로젝트의 서비스 목록을 다시 받는다. 바뀐 게 없으면 화면 상태를 건드리지 않는다. */
  refreshProject: (projectId: string) => Promise<void>;
  removeService: (projectId: string, serviceId: string) => Promise<void>;
};

const ProjectsCtx = createContext<ProjectsApi | null>(null);

const replaceProject = (list: Project[], next: Project) => (list.some((p) => p.id === next.id) ? list.map((p) => (p.id === next.id ? next : p)) : [next, ...list]);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [targets, setTargets] = useState<api.TargetDto[]>([]);
  // 변경 함수가 최신 값을 읽도록 ref 로도 쥔다(setState 업데이터 안에서 값을 꺼내 쓰지 않으려는 것).
  const targetsRef = useRef<api.TargetDto[]>([]);
  targetsRef.current = targets;
  const [servers, setServers] = useState<api.OnpremServerDto[]>([]);
  const serversRef = useRef<api.OnpremServerDto[]>([]);
  serversRef.current = servers;
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;
  // 도메인은 서비스 응답에 없어서 따로 받아 서비스 id 별로 쥐고, 화면에는 서비스에 붙여서 내보낸다.
  const [domains, setDomains] = useState<Record<string, api.ServiceDomainDto[]>>({});
  const domainSeq = useRef(new Map<string, number>());

  // 같은 대상의 수정은 한 번에 하나씩 보낸다. 서버가 GitHub 확인 등으로 느리게 답하는 수정이 있으면 뒤에 보낸
  // 수정의 응답보다 늦게 도착해서 오래된 값으로 화면을 덮어쓰기 때문이다.
  const queues = useRef(new Map<string, Promise<unknown>>());
  const serial = useCallback(<T,>(key: string, task: () => Promise<T>): Promise<T> => {
    const result = (queues.current.get(key) ?? Promise.resolve()).then(task);
    queues.current.set(key, result.catch(() => undefined));
    return result;
  }, []);

  const reload = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const [dtos, targetList, serverList] = await Promise.all([
        api.listProjects(),
        api.listTargets().catch(() => [] as api.TargetDto[]),
        // 서버 등록 API 가 없는 was 에서도 화면이 뜨게 한다. 그때는 서버 타깃이 없으니 이름도 필요 없다.
        api.listOnpremServers().catch(() => [] as api.OnpremServerDto[]),
      ]);
      // 프로젝트마다 서비스를 따로 받는다(목록 API 에는 서비스가 없다).
      const withServices = await Promise.all(dtos.map(async (dto) => toProject(dto, dto.serviceCount > 0 ? await api.listServices(dto.id) : [], targetList, serverList)));
      setTargets(targetList);
      setServers(serverList);
      setProjects(withServices);
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(describeError(e));
      setStatus('error');
    }
  }, []);

  // 로그인하면 불러오고, 로그아웃하면 비운다(다음 사용자에게 이전 데이터가 보이지 않게).
  useEffect(() => {
    if (auth.status === 'authenticated') void reload();
    else if (auth.status === 'logged-out') {
      setProjects([]);
      setTargets([]);
      setServers([]);
      setDomains({});
      domainSeq.current.clear();
      setStatus('idle');
    }
  }, [auth.status, reload]);

  const loadProject = useCallback(async (id: string) => {
    if (!/^\d+$/.test(id)) return null; // 서버 id 는 숫자다. 예전 주소(UUID)는 없는 프로젝트다.
    try {
      const dto = await api.getProject(id);
      const project = toProject(dto, await api.listServices(id), targetsRef.current, serversRef.current);
      setProjects((list) => replaceProject(list, project));
      return project;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 422)) return null;
      throw e;
    }
  }, []);

  const createProject = useCallback(async (body: api.ProjectCreate) => {
    const project = toProject(await api.createProject(body), [], targetsRef.current, serversRef.current);
    setProjects((list) => replaceProject(list, project));
    return project;
  }, []);

  const updateProject = useCallback((id: string, body: api.ProjectUpdate) => serial(`project:${id}`, async () => {
    const dto = await api.updateProject(id, body);
    const current = projectsRef.current.find((p) => p.id === id);
    const next = { ...(current as Project), name: dto.name, description: dto.description, updatedAt: dto.updatedAt };
    setProjects((list) => replaceProject(list, next));
    return next;
  }), [serial]);

  const removeProject = useCallback(async (id: string) => {
    await api.deleteProject(id);
    setProjects((list) => list.filter((p) => p.id !== id));
  }, []);

  const createService = useCallback(async (projectId: string, body: api.ServiceCreate) => {
    const dto = await api.createService(projectId, body);
    const service = toService(dto, targetsRef.current, serversRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: [...p.services, service], serviceCount: (p.serviceCount ?? p.services.length) + 1 } : p)));
    return service;
  }, []);

  const updateService = useCallback((projectId: string, serviceId: string, body: api.ServiceUpdate) => serial(`service:${serviceId}`, async () => {
    const dto = await api.updateService(serviceId, body);
    const next = toService(dto, targetsRef.current, serversRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: p.services.map((s) => (s.id === serviceId ? next : s)) } : p)));
    return next;
  }), [serial]);

  const refreshService = useCallback(async (projectId: string, serviceId: string) => {
    const dto = await api.getService(serviceId);
    const previous = projectsRef.current.find((p) => p.id === projectId)?.services.find((s) => s.id === serviceId);
    const next = toService(dto, targetsRef.current, serversRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: p.services.map((s) => (s.id === serviceId ? next : s)) } : p)));
    // 배포가 끝나면 프로젝트의 online 서비스 수도 달라질 수 있다.
    if (previous?.deploying && !next.deploying) {
      void api.getProject(projectId).then((project) => {
        setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, serviceCount: project.serviceCount, onlineServiceCount: project.onlineServiceCount, updatedAt: project.updatedAt } : p)));
      }).catch(() => undefined);
    }
    return next;
  }, []);

  const refreshProject = useCallback(async (projectId: string) => {
    const services = (await api.listServices(projectId)).map((dto) => toService(dto, targetsRef.current, serversRef.current));
    const current = projectsRef.current.find((p) => p.id === projectId)?.services ?? [];
    const same = current.length === services.length && current.every((s, i) => s.id === services[i].id && JSON.stringify(s.remote) === JSON.stringify(services[i].remote));
    if (same) return;
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services } : p)));
  }, []);

  const loadDomains = useCallback(async (projectId: string) => {
    const services = projectsRef.current.find((p) => p.id === projectId)?.services ?? [];
    await Promise.all(services.map(async (service) => {
      const seq = (domainSeq.current.get(service.id) ?? 0) + 1;
      domainSeq.current.set(service.id, seq);
      let list: api.ServiceDomainDto[] | undefined;
      try {
        list = await api.listServiceDomains(service.id);
      } catch {
        // 못 받아도 화면은 그대로 둔다. 처음부터 못 받았으면 열린 주소가 없는 것으로 보여준다.
      }
      if (domainSeq.current.get(service.id) !== seq) return; // 더 나중에 보낸 요청의 결과가 우선이다
      setDomains((prev) => {
        const next = list ?? prev[service.id] ?? [];
        return JSON.stringify(prev[service.id]) === JSON.stringify(next) ? prev : { ...prev, [service.id]: next };
      });
    }));
  }, []);

  const reloadTargets = useCallback(async () => {
    const [targetList, serverList] = await Promise.all([api.listTargets(), api.listOnpremServers()]);
    setTargets(targetList);
    setServers(serverList);
    // 서버 이름이 바뀌었거나 서버가 새로 생겼으면 서비스에 보이는 배포 위치도 바뀐다.
    setProjects((list) => list.map((p) => ({
      ...p,
      services: p.services.map((s) => {
        if (!s.remote) return s;
        const { region, regionLong } = toService(s.remote, targetList, serverList);
        return region === s.region ? s : { ...s, region, regionLong };
      }),
    })));
  }, []);

  // 서버마다 지금 상태를 처음 본 시각. 응답에 상태가 바뀐 시각이 없는 REGISTERING 의 폴링 기한을 여기서 센다.
  const observedAt = useRef(new Map<number, { status: api.OnpremServerStatus; at: number }>());
  useEffect(() => {
    const now = Date.now();
    for (const server of servers) {
      if (observedAt.current.get(server.id)?.status !== server.status) observedAt.current.set(server.id, { status: server.status, at: now });
    }
  }, [servers]);

  // 연결을 기다리는 서버가 있으면 5초마다 다시 받아 배포 버튼이 연결되는 대로 풀리게 한다.
  // 토큰이 만료됐거나 한 상태에서 20분이 지난 서버는 기다리지 않는다(목록 화면에 들어오면 다시 받는다).
  useEffect(() => {
    const isPollable = () => {
      const now = Date.now();
      return serversRef.current.some((server) => shouldPollServer(server, observedAt.current.get(server.id)?.at ?? now, now));
    };
    if (!isPollable()) return;
    const timer = window.setInterval(() => {
      if (!isPollable()) {
        window.clearInterval(timer);
        return;
      }
      if (document.visibilityState === 'visible') void reloadTargets().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [servers, reloadTargets]);

  // 배포가 진행 중인 서비스는 3초마다 다시 받아서 캔버스·Dashboard 의 상태가 바뀌게 한다.
  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const project of projectsRef.current) {
        for (const service of project.services) {
          if (service.deploying) void refreshService(project.id, service.id).catch(() => undefined);
        }
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshService]);

  const removeService = useCallback(async (projectId: string, serviceId: string) => {
    await api.deleteService(serviceId);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: p.services.filter((s) => s.id !== serviceId), serviceCount: Math.max(0, (p.serviceCount ?? p.services.length) - 1) } : p)));
  }, []);

  const shown = useMemo(
    () => projects.map((p) => ({ ...p, services: p.services.map((s) => withDomains(s, domains[s.id])) })),
    [projects, domains],
  );

  const value = useMemo<ProjectsApi>(
    () => ({ status, error, projects: shown, targets, servers, reload, reloadTargets, loadProject, createProject, updateProject, removeProject, createService, updateService, loadDomains, refreshService, refreshProject, removeService }),
    [status, error, shown, targets, servers, reload, reloadTargets, loadProject, createProject, updateProject, removeProject, createService, updateService, loadDomains, refreshService, refreshProject, removeService],
  );
  return <ProjectsCtx.Provider value={value}>{children}</ProjectsCtx.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsCtx);
  if (!ctx) throw new Error('useProjects must be used inside <ProjectsProvider>');
  return ctx;
}

/**
 * 프로젝트 안에 있는 동안 서비스의 공개 주소를 받아 둔다. 주소는 서비스 이름과 연결한 타깃으로 정해지고, 접속 여부는 배포
 * 결과로 바뀐다. 그래서 이름·타깃·최근 배포가 달라지면 다시 받는다.
 */
export function useProjectDomains(project?: Project) {
  const { loadDomains } = useProjects();
  const projectId = project?.id;
  const signature = project?.services
    .map((s) => [s.id, s.name, s.remote?.targetIds.join('.'), s.remote?.latestDeployment?.id, s.remote?.latestDeployment?.status].join(':'))
    .join(',');
  useEffect(() => {
    if (projectId) void loadDomains(projectId);
  }, [projectId, signature, loadDomains]);
}

/** 프로젝트 하나. 목록에 없으면 한 번 직접 받아보고, 그래도 없으면 notfound. */
export function useProject(id?: string): { state: 'loading' | 'ready' | 'notfound' | 'error'; project?: Project; error: string | null } {
  const { status, error, projects, loadProject } = useProjects();
  const project = projects.find((p) => p.id === id);
  // 결과가 어느 id 에 대한 것인지 함께 쥔다(id 가 바뀌면 이전 결과는 무시된다).
  const [lookup, setLookup] = useState<{ id: string; found: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (project || !id || status !== 'ready') return;
    let cancelled = false;
    loadProject(id).then(
      (found) => { if (!cancelled) setLookup({ id, found: !!found }); },
      (e) => { if (!cancelled) setLookup({ id, found: false, error: describeError(e) }); },
    );
    return () => { cancelled = true; };
  }, [id, project, status, loadProject]);

  if (project) return { state: 'ready', project, error: null };
  if (status === 'error') return { state: 'error', error };
  const mine = lookup && lookup.id === id ? lookup : null;
  if (mine?.error) return { state: 'error', error: mine.error };
  if (mine && !mine.found) return { state: 'notfound', error: null };
  return { state: 'loading', error: null };
}
