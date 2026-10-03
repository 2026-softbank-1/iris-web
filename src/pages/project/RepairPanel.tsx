import { environmentVariableNames, environmentVariablesUrl } from '../../data/environmentConfiguration';
import { EnvironmentVariablesNotice } from './EnvironmentVariablesNotice';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { ApiError, describeError } from '../../lib/api';
import { triggerAutomaticRepair, isAutomaticRepairPending } from '../../lib/automaticRepair';
import { getLatestRepair, getRepair, getRepairAccess, githubInstallUrl, repairArtifactUrl, type DiagnosisDto, type RepairAccessDto, type RepairDto } from '../../lib/endpoints';

export function RepairPanel({ serviceId, deploymentId, diagnosis }: { serviceId: string; deploymentId: string; diagnosis: DiagnosisDto }) {
  const { t } = useI18n();
  const eligible = (diagnosis.analysis?.remediation.plans ?? []).filter((p) => (p.changes?.length ?? 0) > 0 && p.changes!.every((c) => c.kind === 'code'));
  const [requiredNames, setRequiredNames] = useState<string[] | null>(null);
  const environmentNames = environmentVariableNames(diagnosis);
  const [repair, setRepair] = useState<RepairDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [access, setAccess] = useState<RepairAccessDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [patch, setPatch] = useState<string | null>(null);
  const [patchError, setPatchError] = useState(false);
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const publication = repair?.publication;
  const needsEnvironment = requiredNames !== null || environmentNames.length > 0 || repair?.result?.status === 'configuration_required';
  const candidate = repair?.status === 'SUCCEEDED' && repair.result?.status === 'candidate_ready';
  const generating = isAutomaticRepairPending(repair);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    getLatestRepair(serviceId, deploymentId, diagnosis.id, controller.signal).then((r) => { setRepair(r); setLoaded(true); setError(''); }).catch((e) => {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 404) { setRepair(null); setLoaded(true); setError(''); }
      else setError(describeError(e));
    });
    getRepairAccess(serviceId, controller.signal).then(setAccess).catch(() => { /* Server preflight checks access before starting. */ });
    return () => controller.abort();
  }, [serviceId, deploymentId, diagnosis.id, reload]);

  useEffect(() => {
    if (window.location.hash === '#repair') document.getElementById('repair')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!repair || !generating) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const poll = async () => {
      try {
        const next = await getRepair(serviceId, repair.id, controller.signal);
        if (controller.signal.aborted) return;
        setRepair(next);
        setError('');
        attempts++;
        if (isAutomaticRepairPending(next)) timer = setTimeout(poll, next.status === 'RUNNING' ? 2500 : 10000);
      } catch (e) { if (!controller.signal.aborted) setError(describeError(e)); }
    };
    timer = setTimeout(poll, 2500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [serviceId, repair?.id, repair?.status, generating, reload]);

  useEffect(() => {
    setPatch(null); setPatchError(false);
    if (!candidate || !repair) return;
    const controller = new AbortController();
    fetch(repairArtifactUrl(serviceId, repair.id, 'patch.diff'), { credentials: 'include', signal: controller.signal }).then(async (r) => {
      if (!r.ok) throw new Error();
      return r.text();
    }).then(setPatch).catch(() => { if (!controller.signal.aborted) setPatchError(true); });
    return () => controller.abort();
  }, [serviceId, repair?.id, candidate, reload]);

  async function checkAccess() {
    setChecking(true); setError('');
    try { const next = await getRepairAccess(serviceId); if (mounted.current) setAccess(next); }
    catch (e) { if (mounted.current) { setAccess(null); setError(describeError(e)); } }
    finally { if (mounted.current) setChecking(false); }
  }

  async function execute() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { const next = await triggerAutomaticRepair(serviceId, deploymentId, diagnosis.id); if (mounted.current) setRepair(next); }
    catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.code === 'CONFIGURATION_VALUES_REQUIRED') { setRequiredNames(e.details.map(d => d.field)); return; }
      setError(e instanceof ApiError && e.code === 'SOURCE_HEAD_CHANGED' ? t('repair.changed') : describeError(e));
      if (e instanceof ApiError && e.status === 403) { try { setAccess(await getRepairAccess(serviceId)); } catch { setAccess(null); } }
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  const state = publication?.status === 'REDEPLOY_REQUESTED' ? 'redeployRequested' : publication?.status === 'DIAGNOSING' ? 'diagnosing' : publication?.status === 'MERGED' ? 'merged' : publication?.status === 'ERROR' ? 'failed' : publication?.status === 'WAITING_CHECKS' ? 'waitingChecks' : publication?.pullUrl && generating ? 'merging' : candidate && generating ? 'publishing' : repair?.status === 'UNKNOWN_OUTCOME' ? 'unknown' : repair?.status === 'RUNNING' ? 'running' : candidate ? 'candidate' : repair?.status === 'FAILED' ? 'failed' : repair?.status === 'SUCCEEDED' ? 'noChange' : 'ready';
  return (
    <section id="repair" className="diag-summary repair-panel" aria-label={t('repair.title')}>
      <div className="diag-bar"><b><Sparkles size={16} /> {t('repair.title')}</b><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} />{t('repair.refresh')}</button></div>
      {needsEnvironment ? <EnvironmentVariablesNotice names={requiredNames ?? environmentNames} variablesUrl={environmentVariablesUrl(window.location.pathname)} /> : <p className="diag-muted">{t('repair.note')}</p>}
      {!needsEnvironment && <p role="status">{t(`repair.state.${state}`)}</p>}
      {repair && <p className="diag-muted mono">#{repair.id} · {repair.sourceSha.slice(0, 7)}</p>}
      {!needsEnvironment && !repair && eligible.length === 0 && <p>{t('repair.noCode')}</p>}
      {error && <p role="alert" className="diag-text">{error}</p>}
      {repair?.errorCode && <p role="alert" className="diag-muted">{repair.errorCode}</p>}
      {publication?.errorCode && publication.status === 'ERROR' && <p role="alert">{t(publication.errorCode === 'MERGE_BLOCKED' ? 'repair.blocked' : publication.errorCode === 'SOURCE_HEAD_CHANGED' ? 'repair.changed' : 'repair.publishFailed')} <span className="mono">({publication.errorCode})</span></p>}
      {candidate && <details><summary>{t('repair.review')}</summary>{patch !== null ? <pre className="details-code mono repair-patch">{patch}</pre> : <p>{t(patchError ? 'repair.patchError' : 'repair.loading')}</p>}{repair.result?.changedFiles?.map((f) => <p key={f.path} className="mono">{f.path}</p>)}</details>}
      {!needsEnvironment && access && !access.canWrite && publication?.status !== 'MERGED' && <div className="repair-access">
        <p>{t('repair.authorizationNote')}</p>
        {access && !access.canWrite && <p className="diag-muted">{t('repair.adminNote')}</p>}
        {(!access || !access.canWrite) && <><a className="btn btn-outline" href={access?.installationUrl ?? githubInstallUrl()} target="_blank" rel="noreferrer">{t('repair.grant')}<ExternalLink size={14} /></a><a className="btn btn-outline" href={githubInstallUrl()} target="_blank" rel="noreferrer">{t('repair.connect')}</a></>}
        <button type="button" className="btn btn-outline" disabled={checking || busy} onClick={() => void checkAccess()}>{t(checking ? 'repair.loading' : 'repair.check')}</button>
      </div>}
      <div className="diag-brief-actions">
        {!needsEnvironment && publication?.status !== 'MERGED' && publication?.status !== 'REDEPLOY_REQUESTED' && <button type="button" className="btn btn-primary" disabled={!loaded || busy || !!generating || eligible.length === 0 || access?.canWrite === false} onClick={() => void execute()}><Sparkles size={16} />{t(busy || generating ? 'repair.loading' : 'repair.title')}</button>}
        {publication?.redeploymentId && <a className="btn btn-outline" href={window.location.pathname.replace(/deployment\/[^/]+.*$/, `deployment/${publication.redeploymentId}`)}>{t('repair.viewDeployment')}</a>}
        {publication?.pullUrl && <a className="btn btn-outline" href={publication.pullUrl} target="_blank" rel="noreferrer">{t('repair.viewPr')}<ExternalLink size={14} /></a>}
      </div>
    </section>
  );
}
