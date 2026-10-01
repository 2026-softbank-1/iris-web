import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { serviceStatusOf } from './deploymentModel';
import type { Project, Service } from './mock';

/* ------------------------------------------------------------------ */
/* was 응답 → 화면 모델                                                  */
/* ------------------------------------------------------------------ */

const repoFullName = (url: string) => url.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');

function toService(dto: api.ServiceDto, targets: api.TargetDto[]): Service {
  // 서비스가 배포되는 타깃(aws·local)을 지역 자리에 보여준다.
  const where = dto.targetIds.map((id) => targets.find((t) => t.id === id)?.name ?? `#${id}`).join(', ');
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
    platformVariables: [],
    deployments: [],
    remote: dto,
  };
}

function toProject(dto: api.ProjectDto, services: api.ServiceDto[], targets: api.TargetDto[]): Project {
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description,
    environment: 'production',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    serviceCount: dto.serviceCount,
    onlineServiceCount: dto.onlineServiceCount,
    services: services.map((s) => toService(s, targets)),
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
  reload: () => Promise<void>;
  /** 목록에 없는 프로젝트(다른 탭에서 만든 것 등)를 하나만 받아 합친다. 없으면 null. */
  loadProject: (id: string) => Promise<Project | null>;
  createProject: (body: api.ProjectCreate) => Promise<Project>;
  updateProject: (id: string, body: api.ProjectUpdate) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  createService: (projectId: string, body: api.ServiceCreate) => Promise<Service>;
  updateService: (projectId: string, serviceId: string, body: api.ServiceUpdate) => Promise<Service>;
  /** 서비스 하나를 다시 받아 상태(최근 배포)를 갱신한다. */
  refreshService: (projectId: string, serviceId: string) => Promise<Service>;
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
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;

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
      const [dtos, targetList] = await Promise.all([api.listProjects(), api.listTargets().catch(() => [] as api.TargetDto[])]);
      // 프로젝트마다 서비스를 따로 받는다(목록 API 에는 서비스가 없다).
      const withServices = await Promise.all(dtos.map(async (dto) => toProject(dto, dto.serviceCount > 0 ? await api.listServices(dto.id) : [], targetList)));
      setTargets(targetList);
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
      setStatus('idle');
    }
  }, [auth.status, reload]);

  const loadProject = useCallback(async (id: string) => {
    if (!/^\d+$/.test(id)) return null; // 서버 id 는 숫자다. 예전 주소(UUID)는 없는 프로젝트다.
    try {
      const dto = await api.getProject(id);
      const project = toProject(dto, await api.listServices(id), targetsRef.current);
      setProjects((list) => replaceProject(list, project));
      return project;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 422)) return null;
      throw e;
    }
  }, []);

  const createProject = useCallback(async (body: api.ProjectCreate) => {
    const project = toProject(await api.createProject(body), [], targetsRef.current);
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
    const service = toService(dto, targetsRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: [...p.services, service], serviceCount: (p.serviceCount ?? p.services.length) + 1 } : p)));
    return service;
  }, []);

  const updateService = useCallback((projectId: string, serviceId: string, body: api.ServiceUpdate) => serial(`service:${serviceId}`, async () => {
    const dto = await api.updateService(serviceId, body);
    const next = toService(dto, targetsRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: p.services.map((s) => (s.id === serviceId ? next : s)) } : p)));
    return next;
  }), [serial]);

  const refreshService = useCallback(async (projectId: string, serviceId: string) => {
    const dto = await api.getService(serviceId);
    const previous = projectsRef.current.find((p) => p.id === projectId)?.services.find((s) => s.id === serviceId);
    const next = toService(dto, targetsRef.current);
    setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, services: p.services.map((s) => (s.id === serviceId ? next : s)) } : p)));
    // 배포가 끝나면 프로젝트의 online 서비스 수도 달라질 수 있다.
    if (previous?.deploying && !next.deploying) {
      void api.getProject(projectId).then((project) => {
        setProjects((list) => list.map((p) => (p.id === projectId ? { ...p, serviceCount: project.serviceCount, onlineServiceCount: project.onlineServiceCount, updatedAt: project.updatedAt } : p)));
      }).catch(() => undefined);
    }
    return next;
  }, []);

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

  const value = useMemo<ProjectsApi>(
    () => ({ status, error, projects, targets, reload, loadProject, createProject, updateProject, removeProject, createService, updateService, refreshService, removeService }),
    [status, error, projects, targets, reload, loadProject, createProject, updateProject, removeProject, createService, updateService, refreshService, removeService],
  );
  return <ProjectsCtx.Provider value={value}>{children}</ProjectsCtx.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsCtx);
  if (!ctx) throw new Error('useProjects must be used inside <ProjectsProvider>');
  return ctx;
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
