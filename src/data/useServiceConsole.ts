import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/endpoints';
import { consoleFailureOf, unavailableReasonOf, type ConsoleFailure } from './consoleModel';

type Availability = { key: string; available?: boolean; reason?: string; error?: ConsoleFailure };

/**
 * 콘솔을 열 수 있는지. 화면을 열 때 한 번 묻고, 토큰은 만들지 않는다.
 * 서비스에 배정된 타깃이 없으면(아직 배포 대상이 없는 서비스) 서버에 묻지 않고 "떠 있는 배포가 없음"으로 본다.
 */
export function useConsoleAvailability(serviceId: string, targetId: number | undefined) {
  const [loaded, setLoaded] = useState<Availability | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${serviceId}:${targetId}:${attempt}`;

  useEffect(() => {
    if (targetId === undefined) return;
    const ctrl = new AbortController();
    api.getConsoleAvailability(serviceId, targetId, ctrl.signal).then(
      (dto) => { if (!ctrl.signal.aborted) setLoaded({ key, available: dto.available, reason: dto.reason }); },
      (e) => { if (!ctrl.signal.aborted) setLoaded({ key, error: consoleFailureOf(e, 'api') }); },
    );
    return () => ctrl.abort();
  }, [serviceId, targetId, key]);

  // 다른 서비스·재시도 이전의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  const current = loaded?.key === key ? loaded : null;
  if (targetId === undefined) return { loading: false, error: null, available: false, reason: 'NO_RUNNING_DEPLOYMENT', retry: () => undefined };
  return {
    loading: !current,
    error: current?.error ?? null,
    available: current?.available ?? false,
    reason: current?.reason,
    retry: () => { setLoaded(null); setAttempt((n) => n + 1); },
  };
}

type PodsState = { pods: api.ConsolePodDto[] | null; error: ConsoleFailure | null; loading: boolean };

/**
 * 연결할 수 있는 Pod 목록. 세션(ticket)을 새로 받아 Gateway 에 묻는다.
 * refresh 는 목록만 다시 받고 화면 상태(열려 있는 터미널)는 건드리지 않는다.
 * 세션 발급이 "지금은 열 수 없음"(배포가 사라짐·온프레미스·미설정)으로 거절되면 onUnavailable 로 알린다.
 */
export function useConsolePods(serviceId: string, targetId: number, onUnavailable: (reason: string) => void) {
  const [state, setState] = useState<PodsState>({ pods: null, error: null, loading: true });
  const ctrlRef = useRef<AbortController | null>(null);
  // 콜백이 바뀌어도 불러오기를 다시 시작하지 않게 ref 로 들고 있는다.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const refresh = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    // 어느 서버를 부르던 중에 실패했는지로 네트워크 오류 문구가 갈린다.
    let source: 'api' | 'gateway' = 'api';
    try {
      const session = await api.createConsoleSession(serviceId, targetId, ctrl.signal);
      source = 'gateway';
      const pods = await api.listConsolePods(session, ctrl.signal);
      if (!ctrl.signal.aborted) setState({ pods, error: null, loading: false });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const reason = unavailableReasonOf(e);
      if (reason) onUnavailableRef.current(reason);
      setState((prev) => ({ ...prev, error: consoleFailureOf(e, source), loading: false }));
    }
  }, [serviceId, targetId]);

  useEffect(() => {
    void refresh();
    return () => ctrlRef.current?.abort();
  }, [refresh]);

  return { ...state, refresh };
}
