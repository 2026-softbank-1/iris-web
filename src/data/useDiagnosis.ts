import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/diagnosisApi';

const diagnosisError = (error: unknown) => error instanceof ApiError && error.code === 'MODEL_NOT_CONFIGURED'
  ? 'Failure log diagnosis is unavailable because its model is not configured. Ask the operator to configure the diagnosis worker. The deployment keeps its original status.'
  : describeError(error);

export function useDiagnosis(serviceId: string, deploymentId: string) {
  const [job, setJob] = useState<api.DiagnosisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const requestRevision = ++revision.current;
    try {
      const result = await api.getDiagnosis(serviceId, deploymentId);
      if (mounted.current && requestRevision === revision.current) { setJob(result); setError(null); }
    } catch (e) {
      if (mounted.current && requestRevision === revision.current) {
        if (e instanceof ApiError && e.status === 404 && e.code === 'DIAGNOSIS_NOT_FOUND') { setJob(null); setError(null); }
        else setError(diagnosisError(e));
      }
    } finally { pending.current = false; if (mounted.current) setLoading(false); }
  }, [serviceId, deploymentId]);
  useEffect(() => {
    mounted.current = true; setJob(null); setLoading(true); setError(null); void reload();
    return () => { mounted.current = false; ++revision.current; pending.current = false; };
  }, [reload]);
  const active = !!job && api.isDiagnosisActive(job.status);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, active ? 3000 : 10000);
    return () => window.clearInterval(timer);
  }, [active, reload]);
  const start = async () => {
    if (pending.current || busy) return;
    pending.current = true; setBusy(true); setError(null);
    const requestRevision = ++revision.current;
    try {
      const result = await api.startDiagnosis(serviceId, deploymentId);
      if (mounted.current && requestRevision === revision.current) setJob(result);
    } catch (e) { if (mounted.current && requestRevision === revision.current) setError(diagnosisError(e)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return { job, active, loading, busy, error, start, reload };
}
