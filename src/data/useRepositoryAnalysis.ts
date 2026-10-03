import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, ApiError } from '../lib/api';
import * as api from '../lib/endpoints';

/** 분석 결과를 다시 받는 간격과 최대 대기 시간. Build Worker 가 큐에서 꺼내 분석기를 돌리는 데 보통 수 초면 끝난다. */
export const ANALYSIS_POLL_MS = 1500;
export const ANALYSIS_TIMEOUT_MS = 3 * 60_000;
/** 진행 중에 조회가 연달아 이만큼 실패하면 멈추고 실패로 보여 준다. */
const MAX_POLL_ERRORS = 3;

export type AnalysisState =
  | { phase: 'idle' }
  | { phase: 'starting'; mode: api.AnalysisMode }
  | { phase: 'running'; analysis: api.RepositoryAnalysisDto }
  /** SUCCEEDED(또는 이미 APPLIED). result 가 있다. */
  | { phase: 'done'; analysis: api.RepositoryAnalysisDto & { result: api.AnalysisGateResultDto } }
  /** 시작 요청이 거절됐거나, 서버가 FAILED 로 끝냈거나, 조회가 계속 실패했거나, 시간 안에 끝나지 않았다. */
  | { phase: 'failed'; reason: 'start' | 'analysis' | 'poll' | 'timeout'; message?: string; code?: string; analysis?: api.RepositoryAnalysisDto };

const isRunning = (status: api.AnalysisRunStatus) => status === 'QUEUED' || status === 'RUNNING';

/**
 * 레포 구성 확인(분석 게이트)을 시작하고 끝날 때까지 1.5초마다 다시 받는다. 언마운트·reset·새 start 에서는 폴링과 진행 중인
 * 조회를 취소한다(서버의 분석은 계속되지만 이 화면은 더 보지 않는다).
 */
export function useRepositoryAnalysis() {
  const [state, setState] = useState<AnalysisState>({ phase: 'idle' });
  // 실행마다 번호를 매겨, 취소된 실행의 늦은 응답이 화면을 덮지 않게 한다.
  const run = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    run.current += 1;
    window.clearTimeout(timer.current);
    abort.current?.abort();
    abort.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setState({ phase: 'idle' });
  }, [stop]);

  const start = useCallback(async (projectId: string, body: api.RepositoryAnalysisCreate) => {
    stop();
    const mine = run.current;
    const alive = () => run.current === mine;
    setState({ phase: 'starting', mode: body.mode });

    let analysis: api.RepositoryAnalysisDto;
    try {
      analysis = await api.startRepositoryAnalysis(projectId, body);
    } catch (e) {
      if (alive()) setState({ phase: 'failed', reason: 'start', message: describeError(e), code: e instanceof ApiError ? e.code : undefined });
      return;
    }
    if (!alive()) return;

    const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
    let errors = 0;
    const settle = (next: api.RepositoryAnalysisDto) => {
      if (isRunning(next.status)) {
        if (Date.now() >= deadline) {
          setState({ phase: 'failed', reason: 'timeout', analysis: next });
          return;
        }
        setState({ phase: 'running', analysis: next });
        timer.current = window.setTimeout(poll, ANALYSIS_POLL_MS);
      } else if ((next.status === 'SUCCEEDED' || next.status === 'APPLIED') && next.result) {
        setState({ phase: 'done', analysis: { ...next, result: next.result } });
      } else {
        setState({ phase: 'failed', reason: 'analysis', message: next.errorMessage ?? undefined, code: next.errorCode ?? undefined, analysis: next });
      }
    };
    const poll = async () => {
      if (!alive()) return;
      const controller = new AbortController();
      abort.current = controller;
      try {
        const next = await api.getRepositoryAnalysis(projectId, analysis.id, controller.signal);
        if (!alive()) return;
        errors = 0;
        analysis = next;
        settle(next);
      } catch (e) {
        if (!alive() || controller.signal.aborted) return;
        errors += 1;
        if (errors >= MAX_POLL_ERRORS) {
          setState({ phase: 'failed', reason: 'poll', message: describeError(e), analysis });
          return;
        }
        timer.current = window.setTimeout(poll, ANALYSIS_POLL_MS);
      }
    };
    settle(analysis);
  }, [stop]);

  return { state, start, reset };
}
