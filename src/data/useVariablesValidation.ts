import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/endpoints';

type Loaded = { serviceId: string; data?: api.VariablesValidationDto; failed?: boolean };

/**
 * 서비스 환경변수 검증 결과. 변수를 바꾸면(version 이 달라지면) 다시 받는다.
 * 검증 API 가 없는 서버(404)나 받지 못한 경우는 패널을 숨기고 배포는 막지 않는다(서버가 배포 때 다시 검증한다).
 */
export function useVariablesValidation(serviceId: string, version: unknown) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.getVariablesValidation(serviceId, ctrl.signal).then(
      (data) => { if (!ctrl.signal.aborted) setLoaded({ serviceId, data }); },
      () => { if (!ctrl.signal.aborted) setLoaded({ serviceId, failed: true }); },
    );
    return () => ctrl.abort();
  }, [serviceId, version, nonce]);

  const current = loaded?.serviceId === serviceId ? loaded : null;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { loading: !current, failed: !!current?.failed, issues: current?.data?.issues ?? [], ok: current?.data?.ok ?? true, reload };
}
