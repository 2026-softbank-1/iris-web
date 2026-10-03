import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { ApiError } from '../lib/api';
import * as api from '../lib/endpoints';
import { DIAGNOSIS_IDLE_POLL_MS, DIAGNOSIS_POLL_MS, MAX_POLL_FAILURES, describeStartError, isStaleRunning } from './diagnosisModel';

/**
 * 화면이 그릴 진단 상태.
 * loading: 처음 받는 중 · none: 진단이 아직 없음(404, 서버가 실패를 확정하면 스스로 시작한다) · error: 상태를 받지 못함 · ready: 가장 최근 진단(RUNNING·SUCCEEDED·FAILED 모두).
 * stale 은 RUNNING 이 4분을 넘겨 서버가 죽은 것으로 보는 경우다. 이때는 폴링을 멈추고 다시 시작하게 한다.
 */
export type DiagnosisView =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'ready'; diagnosis: api.DiagnosisDto; stale: boolean };

type Held = { key: string; view: { kind: 'none' } | { kind: 'error' } | { kind: 'ready'; diagnosis: api.DiagnosisDto } };

/**
 * 배포 하나의 AI 진단. 열면 가장 최근 진단을 받아 오고(탭을 닫았다 다시 열어도 이어서 보인다), RUNNING 이면 2~3초마다 다시 받아
 * SUCCEEDED·FAILED 가 되면 멈춘다. 진단이 아직 없으면(404) 10초마다 다시 확인해서, 서버가 자동으로 시작한 진단을 알아챈다. 화면을 떠나면(언마운트·다른 배포로 이동) 폴링과 진행 중인 조회를 취소한다.
 * 진단을 시작하는 POST 는 취소하지 않는다: 서버가 이미 받았을 수 있어서 결과를 버려도 진단은 계속된다.
 */
export function useDiagnosis(serviceId: string, deploymentId: string) {
  const { t } = useI18n();
  const key = `${serviceId}/${deploymentId}`;
  const [held, setHeld] = useState<Held | null>(null);
  // 바뀌면 효과가 다시 돌아 조회·폴링을 처음부터 한다.
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // 더블 클릭을 state 로는 못 막는다(같은 렌더 안에서 두 번 불릴 수 있다).
  const startingRef = useRef(false);
  // 다시 시도는 직전 시작과 같은 방식으로 한다. refresh 는 사용자가 확인을 거친 요청이라 그 확인을 이어 쓴다.
  const refreshRef = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: number | undefined;
    let failures = 0;
    let seen = false;
    const poll = async () => {
      try {
        const diagnosis = await api.getDeploymentDiagnosis(serviceId, deploymentId, ctrl.signal);
        if (ctrl.signal.aborted) return;
        failures = 0;
        seen = true;
        setHeld({ key, view: { kind: 'ready', diagnosis } });
        if (diagnosis.status === 'RUNNING' && !isStaleRunning(diagnosis)) timer = window.setTimeout(() => void poll(), DIAGNOSIS_POLL_MS);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        if (e instanceof ApiError && e.code === 'DIAGNOSIS_NOT_FOUND') {
          // 응답은 제대로 받았다. 아직 진단이 없을 뿐이라 느리게 계속 본다.
          failures = 0;
          seen = true;
          setHeld({ key, view: { kind: 'none' } });
          timer = window.setTimeout(() => void poll(), DIAGNOSIS_IDLE_POLL_MS);
          return;
        }
        // 처음부터 못 받으면 바로 알리고, 진행 중에 잠깐 끊긴 것은 몇 번 더 본다.
        failures += 1;
        if (!seen || failures >= MAX_POLL_FAILURES) {
          setHeld({ key, view: { kind: 'error' } });
          return;
        }
        timer = window.setTimeout(() => void poll(), DIAGNOSIS_POLL_MS);
      }
    };
    void poll();
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [serviceId, deploymentId, key, attempt]);

  const start = useCallback(async (refresh = false) => {
    if (startingRef.current) return;
    startingRef.current = true;
    refreshRef.current = refresh;
    setStarting(true);
    setStartError(null);
    try {
      const diagnosis = await api.startDeploymentDiagnosis(serviceId, deploymentId, refresh);
      setHeld({ key, view: { kind: 'ready', diagnosis } });
      // 조회·폴링을 처음부터 다시 한다. 202(RUNNING)면 폴링을 이어 가야 하고, 200(이미 성공)이어도 '진단 없음'을 다시 확인하던
      // 느린 타이머가 이 결과를 덮어쓰지 않게 정리한다.
      setAttempt((n) => n + 1);
    } catch (e) {
      // 이미 진단 중이면 새로 시작하지 않고 폴링으로 이어서 본다.
      if (e instanceof ApiError && e.code === 'DIAGNOSIS_IN_PROGRESS') setAttempt((n) => n + 1);
      else setStartError(describeStartError(e, t));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [serviceId, deploymentId, key, t]);

  const retry = useCallback(() => start(refreshRef.current), [start]);
  const reload = useCallback(() => {
    setHeld(null);
    setAttempt((n) => n + 1);
  }, []);

  // 다른 배포의 결과가 남아 있으면 아직 받는 중으로 본다.
  const view: DiagnosisView = !held || held.key !== key
    ? { kind: 'loading' }
    : held.view.kind === 'ready'
      ? { kind: 'ready', diagnosis: held.view.diagnosis, stale: isStaleRunning(held.view.diagnosis) }
      : held.view;

  return { view, starting, startError, start, retry, reload };
}
