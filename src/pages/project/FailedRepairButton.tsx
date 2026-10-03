import { environmentVariableNames, environmentVariablesUrl } from '../../data/environmentConfiguration';
import { useDiagnosis } from '../../data/useDiagnosis';
import { EnvironmentVariablesNotice } from './EnvironmentVariablesNotice';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { ApiError, describeError } from '../../lib/api';
import { isAutomaticRepairPending, triggerAutomaticRepair } from '../../lib/automaticRepair';
import { getRepair, type RepairDto } from '../../lib/endpoints';

/** Available on every failed deployment, including history and failures without a diagnosis yet. */
export function FailedRepairButton({ serviceId, deploymentId, to }: { serviceId: string; deploymentId: string; to: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { view } = useDiagnosis(serviceId, deploymentId);
  const [requiredNames, setRequiredNames] = useState<string[] | null>(null);
  const environmentNames = environmentVariableNames(view.kind === 'ready' ? view.diagnosis : undefined);
  const [repair, setRepair] = useState<RepairDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!repair || !isAutomaticRepairPending(repair)) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await getRepair(serviceId, repair.id, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setRepair(next);
        if (isAutomaticRepairPending(next)) timer = setTimeout(poll, 2500);
      } catch { if (!ctrl.signal.aborted) timer = setTimeout(poll, 5000); }
    };
    timer = setTimeout(poll, 2500);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [serviceId, repair?.id, repair?.status, repair?.publication?.status, repair?.publication?.redeploymentId]);
  async function start() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const next = await triggerAutomaticRepair(serviceId, deploymentId);
      if (mounted.current) { setRepair(next); navigate(`${to}#repair`); }
    } catch (e) { if (e instanceof ApiError && e.code === 'CONFIGURATION_VALUES_REQUIRED') { if (mounted.current) setRequiredNames(e.details.map(d => d.field)); return; } if (mounted.current) setError(e instanceof ApiError && e.code === 'SOURCE_HEAD_CHANGED' ? t('repair.changed') : describeError(e)); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  if (requiredNames !== null || environmentNames.length > 0) return <EnvironmentVariablesNotice compact names={requiredNames ?? environmentNames} variablesUrl={environmentVariablesUrl(to)} />;
  return <span className="failed-repair-action"><button type="button" className="btn btn-primary btn-sm" disabled={busy || !!isAutomaticRepairPending(repair)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void start(); }}><Sparkles size={14} />{t(busy || isAutomaticRepairPending(repair) ? 'repair.loading' : 'repair.fixRedeploy')}</button>{error && <span role="alert" className="failed-repair-error">{error}</span>}</span>;
}
