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
  createdAt: string;
  updatedAt: string;
};

export type TargetDto = { id: number; name: string; kind: string; region?: string; domainSuffix?: string };
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
