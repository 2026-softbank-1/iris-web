import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useUI } from '../components/ui';
import { describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { isRemoved, toDeployments } from './deploymentModel';
import type { Deployment, Service } from './mock';
import { useProjects } from './ProjectsContext';

const POLL_MS = 3000;
/** 진행 중인 배포가 없을 때의 확인 주기. push 웹훅이 서버에서 만든 배포를 알아채려는 것이다. */
const IDLE_POLL_MS = 10_000;

type ListState = { serviceId: string; dtos: api.DeploymentDto[]; error: string | null };

/**
 * 서비스 하나의 배포 요청 목록. 진행 중인 배포가 있으면 3초마다 다시 받고, 끝나면 멈춘다.
 * 배포·재배포·롤백·재시작 요청도 여기서 보낸다(서버가 Idempotency-Key 로 중복을 막는다).
 */
export function useDeployments(service?: Service) {
  const { user } = useAuth();
  const { refreshService } = useProjects();
  const serviceId = service?.id;
  const projectId = service?.remote ? String(service.remote.projectId) : undefined;
  const [state, setState] = useState<ListState | null>(null);

  const load = useCallback(async () => {
    if (!serviceId) return;
    try {
      const page = await api.listDeployments(serviceId, 0, 30);
      setState({ serviceId, dtos: page.items, error: null });
    } catch (e) {
      setState((prev) => ({ serviceId, dtos: prev?.serviceId === serviceId ? prev.dtos : [], error: describeError(e) }));
    }
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  // 다른 서비스의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  const current = state && state.serviceId === serviceId ? state : null;
  const inProgress = !!current?.dtos.some((d) => d.isActive);
  useEffect(() => {
    if (!serviceId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, inProgress ? POLL_MS : IDLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [serviceId, inProgress, load]);

  // 배포가 시작되거나 끝나면(직접 요청한 것이 아니어도) 서비스 상태도 다시 받는다.
  useEffect(() => {
    if (!current || !projectId || !serviceId) return;
    void refreshService(projectId, serviceId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, !!current]);

  const items = useMemo<Deployment[]>(() => (service && current ? toDeployments(current.dtos, service, user) : []), [service, current, user]);
  // 가장 최근에 성공한 요청이 REMOVE 면 서비스가 내려간 것이다. 목록을 받기 전에는 알 수 없으니 false 다.
  const removed = !!current && isRemoved(current.dtos);

  const request = useCallback(async (body: api.DeploymentCreate) => {
    if (!serviceId) throw new Error('No service selected');
    const dto = await api.createDeployment(serviceId, body, crypto.randomUUID());
    await load();
    // 캔버스의 서비스 상태도 바로 바뀌게 한다.
    if (projectId) void refreshService(projectId, serviceId).catch(() => undefined);
    return dto;
  }, [serviceId, projectId, load, refreshService]);

  return {
    items,
    removed,
    loading: !current,
    error: current?.error ?? null,
    reload: load,
    deploy: () => request({ triggerType: 'MANUAL' }),
    redeploy: (deploymentId: string) => request({ triggerType: 'REDEPLOY', sourceDeploymentId: Number(deploymentId) }),
    rollback: (deploymentId: string) => request({ triggerType: 'ROLLBACK', sourceDeploymentId: Number(deploymentId) }),
    /** 지금 떠 있는(마지막으로 성공한) 배포의 이미지를 빌드 없이 다시 배포해 Pod 을 새로 시작한다. 원본 배포는 서버가 정한다. */
    restart: () => request({ triggerType: 'RESTART' }),
  };
}

export type DeploymentsApi = ReturnType<typeof useDeployments>;

/** 요청을 보내고 결과(성공 문구 또는 오류)를 토스트로 알린다. 요청 중에는 busy 가 true 다. */
export function useRunner() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (task: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await task();
      toast(message);
    } catch (e) {
      toast(describeError(e));
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return { busy, run };
}

/**
 * 배포 하나의 상세(상태 이력·단계별 소요 시간·소스·구성·빌드·release·대체한 배포). 진행 중이면 3초마다 다시 받는다.
 * error 는 보여줄 문장(영어)이고, failure 는 코드를 풀어 다른 문장으로 바꿀 때 쓰는 원래 오류다.
 */
export function useDeploymentDetail(serviceId?: string, deploymentId?: string) {
  const [detail, setDetail] = useState<api.DeploymentDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!serviceId || !deploymentId) return;
    try {
      const next = await api.getDeployment(serviceId, deploymentId);
      setDetail(next);
      setError(null);
      setFailure(null);
    } catch (e) {
      setError(describeError(e));
      setFailure(e);
    }
  }, [serviceId, deploymentId]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setFailure(null);
    void load();
  }, [load]);

  const shown = detail && String(detail.id) === deploymentId ? detail : null;
  const active = !!shown?.isActive;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, load]);

  return { detail: shown, error, failure };
}
