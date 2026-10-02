import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { METRIC_RANGES, metricWindow, windowQuery, type MetricWindow } from './metricsModel';
import type { Service } from './mock';

/** live 가 켜져 있을 때 다시 조회하는 주기. */
const REFRESH_MS = 30_000;

/** 한 번의 조회 결과. 일시적인 오류로 갱신에 실패하면 이전 data 를 둔 채 error 를 붙인다. */
type Part = { data?: api.MetricSeriesDto[]; error?: string };
type State = { key: string; window?: MetricWindow; total: Part; pods: Part };

/** 카드 안에 보여줄 짧은 안내. 상태 코드로 가르므로 서버 메시지 문구에 기대지 않는다. */
export function describeMetricsError(error: unknown, groupBy: api.MetricsGroupBy): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return "Metrics aren't set up on the server yet.";
    if (error.status === 502) return "Couldn't load metrics from the monitoring backend. Try again in a moment.";
    // 기간·step 은 서버 제약에 맞춰 보내므로 합계에서 422 가 날 일은 없고, Pod 요청의 422 는 Pod 이 너무 많다는 뜻이다.
    if (error.status === 422) return groupBy === 'pod' ? 'Too many replicas to chart. Narrow the time range or switch to Sum.' : "These metrics can't be loaded for this time range.";
  }
  return describeError(error);
}

/** 4xx 는 같은 요청을 되풀이해도 소용없는 오류다. 이때는 이전 data 를 남기지 않는다. */
const isTransient = (reason: unknown) => !(reason instanceof ApiError) || reason.status >= 500;

const settled = <T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> => Promise.allSettled([promise]).then(([result]) => result);

function settle(prev: Part | undefined, result: PromiseSettledResult<api.MetricSeriesDto[]> | undefined, groupBy: api.MetricsGroupBy): Part {
  if (!result) return prev ?? {};
  if (result.status === 'fulfilled') return { data: result.value };
  return { data: isTransient(result.reason) ? prev?.data : undefined, error: describeMetricsError(result.reason, groupBy) };
}

/**
 * 서비스의 CPU·메모리·네트워크 지표. 항상 합계(groupBy=total)를 받고, replicas 가 켜져 있을 때만 Pod 별(groupBy=pod)을 더 받는다.
 * 기간·서비스·replicas 가 바뀌면 바로 다시 받고, live 면 30초마다 받는다. 이전 요청은 취소하고 늦게 온 응답은 버린다.
 */
export function useServiceMetrics(service: Service, { range, live, replicas }: { range: number; live: boolean; replicas: boolean }) {
  const serviceId = service.id;
  // 지표는 서비스에 배정된 타깃 단위로 조회한다. 여러 개면 첫 번째를 쓴다.
  const targetId = service.remote?.targetIds[0];
  const key = `${serviceId}:${targetId}:${range}`;
  const [state, setState] = useState<State | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (targetId === undefined) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const win = metricWindow(METRIC_RANGES[range], Date.now());
    const query = { targetId, ...windowQuery(win) };
    const [total, pods] = await Promise.all([
      settled(api.getServiceMetrics(serviceId, { ...query, groupBy: 'total' }, ctrl.signal)),
      replicas ? settled(api.getServiceMetrics(serviceId, { ...query, groupBy: 'pod' }, ctrl.signal)) : undefined,
    ]);
    if (ctrl.signal.aborted) return;
    setState((prev) => {
      const base = prev?.key === key ? prev : undefined;
      const anyFresh = total.status === 'fulfilled' || pods?.status === 'fulfilled';
      return {
        key,
        // 선은 점의 실제 시각으로 그리므로 축만 최신으로 옮겨 둔다. 갱신이 모두 실패했으면 그대로 둔다.
        window: anyFresh ? win : base?.window,
        total: settle(base?.total, total, 'total'),
        pods: settle(base?.pods, pods, 'pod'),
      };
    });
  }, [serviceId, targetId, range, replicas, key]);

  // 처음 열 때, 그리고 기간·서비스·replicas 가 바뀔 때 바로 받는다.
  useEffect(() => {
    void load();
  }, [load]);

  // live 동안 주기적으로 받는다. 일시정지했다가 다시 켜면 멈춰 있던 만큼 바로 따라잡는다.
  const pausedRef = useRef(false);
  useEffect(() => {
    if (!live) {
      pausedRef.current = true;
      return;
    }
    if (pausedRef.current) {
      pausedRef.current = false;
      void load();
    }
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // 다른 기간·서비스의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  const current = state?.key === key ? state : null;
  return {
    hasTarget: targetId !== undefined,
    loading: targetId !== undefined && !current,
    window: current?.window,
    total: current?.total ?? {},
    pods: current?.pods ?? {},
    /** replicas 를 켰는데 Pod 별 응답이 아직 오지 않았다. */
    podsLoading: replicas && !!current && !current.pods.data && !current.pods.error,
  };
}
