import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/endpoints';
import { LOG_LIMIT, buildLogLine } from './deploymentLogModel';
import type { LogLine } from './mock';

/** 진행 중인 빌드의 새 로그를 기다리는 주기. 서버(CloudWatch)를 두드리는 것이라 짧게 잡지 않는다. */
export const BUILD_POLL_MS = 3000;
/** 진행 중인 배포의 앱 로그를 다시 받는 주기. */
export const DEPLOY_POLL_MS = 5000;
/**
 * 빌드 로그를 이어 읽다가 멈추는 줄 수. 끝난 빌드는 1000줄씩 쉬지 않고 읽어 오는데 표는 가상화하지 않으니, 한없이 긴 로그가 메모리와 화면을 먹지 않게 막는다.
 * 넘기면 앞쪽 줄만 보이고, 다운로드도 받아 둔 줄까지다.
 */
export const MAX_BUILD_LINES = 10_000;

export type BuildLogsState = {
  lines: LogLine[];
  /** 첫 응답을 받기 전. */
  loading: boolean;
  /** 빌드가 아직 끝나지 않아 새 로그를 기다리며 이어 읽는 중. */
  following: boolean;
  /** MAX_BUILD_LINES 에서 멈췄다. */
  capped: boolean;
  /** 앞부분이 빠지고 저장된 끝부분만 있다(실패한 빌드). */
  isPartial: boolean;
  /** 로그를 만든 빌드가 속한 배포. 롤백·재시작은 원본 배포의 로그를 준다. 로그가 없으면 없다. */
  loggedDeploymentId?: number;
  error: unknown;
};
const INITIAL_BUILD: BuildLogsState = { lines: [], loading: true, following: false, capped: false, isPartial: false, error: null };

/**
 * 배포의 빌드 로그. 처음부터 1000줄씩 이어 읽고, 끝난 빌드는 서버가 isComplete 를 줄 때까지 쉬지 않고 읽는다.
 * 빌드가 진행 중이면 3초마다 새 로그를 기다린다. 그러다 배포(active)가 끝났는데도 빌드가 시작하지 않았다면(빌드 전에 실패) 멈춘다.
 * 화면을 떠나거나 다른 배포로 가면 읽던 요청을 취소한다. 오류가 나면 멈추고 retry 로 처음부터 다시 읽는다.
 */
export function useBuildLogs(serviceId: string, deploymentId: string, active: boolean) {
  const key = `${serviceId}/${deploymentId}`;
  const [state, setState] = useState<BuildLogsState & { key: string }>({ key, ...INITIAL_BUILD });
  const [attempt, setAttempt] = useState(0);
  // 읽는 도중에 배포가 끝났는지 알아야 해서 최신 값을 ref 로 들고 있는다(바뀐다고 처음부터 다시 읽지는 않는다).
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: number | undefined;
    let cursor: string | undefined;
    let count = 0;
    setState({ key, ...INITIAL_BUILD });

    const read = async () => {
      try {
        const res = await api.getBuildLogs(serviceId, deploymentId, { cursor, limit: LOG_LIMIT }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        cursor = res.nextCursor ?? cursor;
        count += res.entries.length;
        const fresh = res.entries.map(buildLogLine);
        const finished = api.isBuildFinished(res.buildStatus);
        const capped = count >= MAX_BUILD_LINES;
        // 빌드가 끝났는데 읽을 게 없으면 서버가 isComplete 를 준다. 안 줘도 더 읽을 게 없으니 멈춘다(빠르게 반복하지 않도록).
        const done = res.isComplete || capped || (finished && res.entries.length === 0);
        // 한 페이지를 꽉 채웠거나 빌드가 끝났으면 바로 이어 읽는다(남은 페이지, 또는 끝났음을 알려 주는 빈 페이지).
        const again = !done && (res.entries.length >= LOG_LIMIT || finished);
        // 그 밖에는 빌드가 진행 중(또는 아직 시작 전)이다. 배포가 진행 중일 때만 기다린다.
        const wait = !done && !again && activeRef.current;
        setState((prev) => ({
          key,
          lines: prev.key === key ? [...prev.lines, ...fresh] : fresh,
          loading: false,
          following: wait,
          capped,
          isPartial: res.isPartial,
          loggedDeploymentId: res.loggedDeploymentId ?? prev.loggedDeploymentId,
          error: null,
        }));
        if (again) void read();
        else if (wait) timer = window.setTimeout(tick, BUILD_POLL_MS);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState((prev) => ({ ...(prev.key === key ? prev : { key, ...INITIAL_BUILD }), loading: false, following: false, error: e }));
      }
    };
    // 숨겨진 탭에서는 요청하지 않고 기다린다.
    const tick = () => {
      if (document.visibilityState === 'visible') void read();
      else timer = window.setTimeout(tick, BUILD_POLL_MS);
    };
    void read();
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [key, serviceId, deploymentId, attempt]);

  const shown = state.key === key ? state : { key, ...INITIAL_BUILD };
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...shown, retry };
}

type Snapshot<T> = { key: string; data?: T; error?: unknown };

/**
 * 한 번 받아 오는 조회(Deploy·Network Logs). key 가 바뀌면 다시 받고(그동안 이전 key 의 값은 보여 주지 않는다),
 * pollMs 가 있으면 그 주기로 다시 받는다. 다시 받다 실패해도 받아 둔 값은 남긴다. enabled 가 false 면 기다린다.
 */
function useSnapshot<T>(key: string, load: (signal: AbortSignal) => Promise<T>, { enabled, pollMs }: { enabled: boolean; pollMs?: number }) {
  const [snap, setSnap] = useState<Snapshot<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    let timer: number | undefined;
    const run = async () => {
      try {
        const data = await loadRef.current(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setSnap({ key, data });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setSnap((prev) => ({ key, data: prev?.key === key ? prev.data : undefined, error: e }));
      }
      if (pollMs && !ctrl.signal.aborted) timer = window.setTimeout(tick, pollMs);
    };
    const tick = () => {
      if (document.visibilityState === 'visible') void run();
      else timer = window.setTimeout(tick, pollMs);
    };
    void run();
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [key, enabled, pollMs, attempt]);

  const shown = snap?.key === key ? snap : null;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data: shown?.data, error: shown?.error ?? null, loading: !shown, reload };
}

/**
 * 이 배포의 release 가 붙은 앱 컨테이너 로그(최근 1000줄). 배포가 진행 중이면(active) 5초마다 다시 받는다.
 * targetId 가 정해질 때까지(enabled=false) 기다린다.
 */
export function useDeployLogs(serviceId: string, deploymentId: string, targetId: number | undefined, { enabled, active }: { enabled: boolean; active: boolean }) {
  return useSnapshot(
    `${serviceId}/${deploymentId}/${targetId}`,
    (signal) => api.getDeploymentLogs(serviceId, deploymentId, { targetId, limit: LOG_LIMIT }, signal),
    { enabled, pollMs: active ? DEPLOY_POLL_MS : undefined },
  );
}

/**
 * 이 배포가 서비스한 구간의 ALB 접근 로그(최근 1000건). ALB 가 5분 안팎으로 늦게 올리는 로그라서 자동으로 다시 받지 않는다(새로고침 버튼으로 받는다).
 * statusClass 를 바꾸면 다시 받는다.
 */
export function useNetworkLogs(serviceId: string, deploymentId: string, targetId: number | undefined, statusClass: api.StatusClass | undefined, { enabled }: { enabled: boolean }) {
  return useSnapshot(
    `${serviceId}/${deploymentId}/${targetId}/${statusClass ?? ''}`,
    (signal) => api.getNetworkLogs(serviceId, deploymentId, { targetId, statusClass, limit: LOG_LIMIT }, signal),
    { enabled },
  );
}
