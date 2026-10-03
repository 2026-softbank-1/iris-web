import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import * as api from '../lib/endpoints';
import { METRIC_RANGES, trafficWindow, windowQuery, type MetricWindow } from './metricsModel';
import type { Service } from './mock';
import { describeMetricsError } from './useServiceMetrics';

/** live 가 켜져 있을 때 다시 조회하는 주기. */
const REFRESH_MS = 30_000;

type State = {
  key: string;
  window?: MetricWindow;
  series?: api.MetricSeriesDto[];
  /** 이 시각(Unix 초)까지만 집계가 끝났다. 응답에 없으면 모른다. */
  availableUntil?: number;
  /** 일시적인 오류로 갱신에 실패하면 이전 series 를 둔 채 error 를 붙인다. */
  error?: string;
  /** 서버에 이 API 가 아직 없다(404). 오류가 아니라 데이터 없음으로 보여준다. */
  notFound?: boolean;
};

const isNotFound = (reason: unknown) => reason instanceof ApiError && reason.status === 404;
/** 4xx 는 같은 요청을 되풀이해도 소용없는 오류다. 이때는 이전 값을 남기지 않는다. */
const isTransient = (reason: unknown) => !(reason instanceof ApiError) || reason.status >= 500;

/**
 * 서비스의 트래픽 지표(요청 수·오류율·응답 시간·공개 네트워크). 첫 번째 타깃의 ALB 접근 로그 기반 지표다.
 * useServiceMetrics 와 요청·로딩·오류가 따로라서 이쪽이 실패해도 CPU·Memory 는 그대로 그려진다.
 * 기간·서비스가 바뀌면 바로 다시 받고, live 면 30초마다 받는다. 이전 요청은 취소하고 늦게 온 응답은 버린다.
 */
export function useServiceTrafficMetrics(service: Service, { range, live }: { range: number; live: boolean }) {
  const serviceId = service.id;
  const targetId = service.remote?.targetIds[0];
  const key = `${serviceId}:${targetId}:${range}`;
  const [state, setState] = useState<State | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (targetId === undefined) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const win = trafficWindow(METRIC_RANGES[range], Date.now());
    const [result] = await Promise.allSettled([api.getServiceTrafficMetrics(serviceId, { targetId, ...windowQuery(win) }, ctrl.signal)]);
    if (ctrl.signal.aborted) return;
    setState((prev) => {
      const base = prev?.key === key ? prev : undefined;
      if (result.status === 'fulfilled') {
        const { availableUntil, series } = result.value ?? {};
        return { key, window: win, series: Array.isArray(series) ? series : [], availableUntil: typeof availableUntil === 'number' ? availableUntil : undefined };
      }
      if (isNotFound(result.reason)) return { key, window: win, notFound: true };
      const keep = isTransient(result.reason) ? base : undefined;
      return { key, window: keep?.window, series: keep?.series, availableUntil: keep?.availableUntil, error: describeMetricsError(result.reason, 'total') };
    });
  }, [serviceId, targetId, range, key]);

  // 처음 열 때, 그리고 기간·서비스가 바뀔 때 바로 받는다.
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
    series: current?.series,
    availableUntil: current?.availableUntil,
    error: current?.error,
    notFound: !!current?.notFound,
  };
}
