import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../lib/api';
import type { AnalysisMode } from '../lib/analysisApi';
import * as api from '../lib/pipelineApi';

export function usePipeline(serviceId: string) {
  const [job, setJob] = useState<api.PipelineDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const reading = useRef(false);
  const mutating = useRef(false);

  const reload = useCallback(async (preserveError = false) => {
    if (reading.current || mutating.current) return;
    reading.current = true;
    const requestRevision = ++revision.current;
    try {
      const latest = await api.getPipeline(serviceId);
      if (mounted.current && requestRevision === revision.current) { setJob(latest); if (!preserveError) setError(null); }
    } catch (e) {
      if (!mounted.current || requestRevision !== revision.current) return;
      if (e instanceof ApiError && e.status === 404 && e.code === 'PIPELINE_NOT_FOUND') { setJob(null); if (!preserveError) setError(null); }
      else setError(describeError(e));
    } finally {
      reading.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    mounted.current = true;
    setJob(null); setLoading(true); setError(null);
    void reload();
    return () => { mounted.current = false; ++revision.current; reading.current = false; };
  }, [reload]);

  const active = !!job && api.isPipelineActive(job.status);
  const open = !!job && api.isPipelineOpen(job.status);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(true); }, active ? 3000 : 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, reload]);

  const mutate = useCallback(async (task: () => Promise<api.PipelineDto>) => {
    if (mutating.current) return false;
    mutating.current = true;
    const requestRevision = ++revision.current;
    setBusy(true); setError(null);
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
      void reload(true);
    }
  }, [reload]);

  return {
    job, loading, busy, error, active, open, reload,
    start: (mode: AnalysisMode) => mutate(() => api.startPipeline(serviceId, mode)),
    answer: (answers: api.PipelineAnswers) => job ? mutate(() => api.answerPipeline(serviceId, job.id, answers)) : Promise.resolve(false),
    cancel: () => job ? mutate(() => api.cancelPipeline(serviceId, job.id)) : Promise.resolve(false),
  };
}
