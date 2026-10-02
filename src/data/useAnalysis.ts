import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/analysisApi';

export function useAnalysis(serviceId: string) {
  const [job, setJob] = useState<api.AnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const mutating = useRef(false);
  const reading = useRef(false);

  const reload = useCallback(async (preserveError = false) => {
    if (mutating.current || reading.current) return;
    reading.current = true;
    const requestRevision = ++revision.current;
    try {
      const latest = await api.getAnalysis(serviceId);
      if (mounted.current && requestRevision === revision.current) { setJob(latest); if (!preserveError) setError(null); }
    } catch (e) {
      if (!mounted.current || requestRevision !== revision.current) return;
      if (e instanceof ApiError && e.status === 404 && e.code === 'ANALYSIS_NOT_FOUND') { setJob(null); if (!preserveError) setError(null); }
      else setError(describeError(e));
    } finally {
      reading.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; ++revision.current; reading.current = false; };
  }, [reload]);

  const active = !!job && api.isAnalysisActive(job.status);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, reload]);

  const mutate = useCallback(async (task: () => Promise<api.AnalysisDto>): Promise<boolean> => {
    if (mutating.current) return false;
    mutating.current = true;
    const requestRevision = ++revision.current;
    setBusy(true);
    setError(null);
    try {
      const latest = await task();
      if (mounted.current && requestRevision === revision.current) setJob(latest);
      return true;
    } catch (e) {
      if (mounted.current && requestRevision === revision.current) setError(describeError(e));
      return false;
    } finally {
      mutating.current = false;
      if (mounted.current) setBusy(false);
      // Includes conflicts caused by another browser, and starts polling a job it created.
      void reload(true);
    }
  }, [reload]);

  return {
    job, loading, busy, active, error, reload,
    start: (mode: api.AnalysisMode) => mutate(() => api.startAnalysis(serviceId, mode)),
    cancel: () => job ? mutate(() => api.cancelAnalysis(serviceId, job.id)) : Promise.resolve(false),
    answer: (answers: api.AnalysisAnswers) => mutate(() => api.answerAnalysis(serviceId, answers)),
  };
}
