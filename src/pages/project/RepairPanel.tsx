import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { ApiError, describeError } from '../../lib/api';
import { getLatestRepair, getRepair, getRepairAccess, githubInstallUrl, mergeRepair, publishRepair, repairArtifactUrl, startRepair, type DiagnosisDto, type RepairAccessDto, type RepairDto } from '../../lib/endpoints';

export function RepairPanel({ serviceId, deploymentId, diagnosis }: { serviceId: string; deploymentId: string; diagnosis: DiagnosisDto }) {
  const { t } = useI18n();
  const eligible = (diagnosis.analysis?.remediation.plans ?? []).filter((p) => (p.changes?.length ?? 0) > 0 && p.changes!.every((c) => c.kind === 'code'));
  const [selected, setSelected] = useState<string[]>(eligible.map((p) => p.id));
  const [repair, setRepair] = useState<RepairDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [access, setAccess] = useState<RepairAccessDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [patch, setPatch] = useState<string | null>(null);
  const [patchError, setPatchError] = useState(false);
  const [reload, setReload] = useState(0);
  const pendingKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const publication = repair?.publication;
  const candidate = repair?.status === 'SUCCEEDED' && repair.result?.status === 'candidate_ready';
  const generating = repair?.status === 'RUNNING';
  const keyName = `iris-repair:${serviceId}:${deploymentId}:${diagnosis.id}:${[...selected].sort().join(',')}`;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    getLatestRepair(serviceId, deploymentId, diagnosis.id, controller.signal).then((r) => { setRepair(r); setSelected(r.planIds); setLoaded(true); setError(''); }).catch((e) => {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 404) { setRepair(null); setLoaded(true); setError(''); }
      else setError(describeError(e));
    });
    return () => controller.abort();
  }, [serviceId, deploymentId, diagnosis.id, reload]);

  useEffect(() => {
    if (window.location.hash === '#repair') document.getElementById('repair')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!repair || !['RUNNING', 'UNKNOWN_OUTCOME'].includes(repair.status)) return;
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
        if (next.status === 'RUNNING' || (next.status === 'UNKNOWN_OUTCOME' && attempts < 4)) timer = setTimeout(poll, next.status === 'RUNNING' ? 2500 : 10000);
      } catch (e) { if (!controller.signal.aborted) setError(describeError(e)); }
    };
    timer = setTimeout(poll, 2500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [serviceId, repair?.id, repair?.status, reload]);

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

  async function execute(action: 'generate' | 'publish' | 'merge') {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      let next: RepairDto;
      if (action === 'generate') {
        let key = pendingKey.current;
        try { key ??= sessionStorage.getItem(keyName); } catch { /* Storage may be unavailable. */ }
        key ??= crypto.randomUUID(); pendingKey.current = key;
        try { sessionStorage.setItem(keyName, key); } catch { /* The current attempt still retains its key. */ }
        next = await startRepair(serviceId, deploymentId, diagnosis.id, selected, key);
      } else {
        const permission = await getRepairAccess(serviceId);
        if (mounted.current) setAccess(permission);
        if (!permission.canWrite || !repair) return;
        next = await (action === 'publish' ? publishRepair(serviceId, repair.id) : mergeRepair(serviceId, repair.id));
      }
      if (mounted.current) { setRepair(next); setConfirmMerge(false); }
    } catch (e) {
      if (!mounted.current) return;
      setError(describeError(e));
      if (e instanceof ApiError && e.status === 403) { try { setAccess(await getRepairAccess(serviceId)); } catch { setAccess(null); } }
      // A lost mutation response is recovered by reading the same repair, never another generation.
      if (repair) { try { setRepair(await getRepair(serviceId, repair.id)); } catch { /* Keep the previous state and explicit retry. */ } }
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  const state = publication?.status === 'MERGED' ? 'merged' : publication?.pullUrl ? 'published' : repair?.status === 'UNKNOWN_OUTCOME' ? 'unknown' : generating ? 'running' : candidate ? 'candidate' : repair?.status === 'FAILED' ? 'failed' : repair?.status === 'SUCCEEDED' ? 'noChange' : 'ready';
  return (
    <section id="repair" className="diag-summary repair-panel" aria-label={t('repair.title')}>
      <div className="diag-bar"><b><Sparkles size={16} /> {t('repair.title')}</b><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} />{t('repair.refresh')}</button></div>
      <p className="diag-muted">{t('repair.note')}</p>
      <p role="status">{t(`repair.state.${state}`)}</p>
      {repair && <p className="diag-muted mono">#{repair.id} · {repair.sourceSha.slice(0, 7)}</p>}
      {!repair && eligible.length > 0 && <fieldset disabled={busy || !loaded} className="repair-plans"><legend>{t('repair.select')}</legend>{eligible.map((plan) => <label key={plan.id}><input type="checkbox" checked={selected.includes(plan.id)} onChange={(e) => { pendingKey.current = null; setSelected((ids) => e.target.checked ? [...ids, plan.id] : ids.filter((id) => id !== plan.id)); }} />{plan.title}</label>)}</fieldset>}
      {!repair && eligible.length === 0 && <p>{t('repair.noCode')}</p>}
      {error && <p role="alert" className="diag-text">{error}</p>}
      {repair?.errorCode && <p role="alert" className="diag-muted">{repair.errorCode}</p>}
      {publication?.errorCode && <p role="alert">{t(publication.errorCode === 'MERGE_BLOCKED' ? 'repair.blocked' : publication.errorCode === 'SOURCE_HEAD_CHANGED' ? 'repair.changed' : 'repair.publishFailed')} <span className="mono">({publication.errorCode})</span></p>}
      {candidate && <details><summary>{t('repair.review')}</summary>{patch !== null ? <pre className="details-code mono repair-patch">{patch}</pre> : <p>{t(patchError ? 'repair.patchError' : 'repair.loading')}</p>}{repair.result?.changedFiles?.map((f) => <p key={f.path} className="mono">{f.path}</p>)}</details>}
      {(eligible.length > 0 || candidate) && publication?.status !== 'MERGED' && <div className="repair-access">
        <p>{t(access?.canWrite ? 'repair.authorized' : 'repair.permissions')}</p>
        {access && !access.canWrite && <p className="diag-muted">{t('repair.adminNote')}</p>}
        {(!access || !access.canWrite) && <><a className="btn btn-outline" href={access?.installationUrl ?? githubInstallUrl()} target="_blank" rel="noreferrer">{t('repair.grant')}<ExternalLink size={14} /></a><a className="btn btn-outline" href={githubInstallUrl()} target="_blank" rel="noreferrer">{t('repair.connect')}</a></>}
        <button type="button" className="btn btn-outline" disabled={checking || busy} onClick={() => void checkAccess()}>{t(checking ? 'repair.loading' : 'repair.check')}</button>
      </div>}
      <div className="diag-brief-actions">
        {repair?.status === 'FAILED' && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { const key = crypto.randomUUID(); pendingKey.current = key; try { sessionStorage.setItem(keyName, key); } catch { /* Retain in memory. */ } void execute('generate'); }}>{t('diag.retry')}</button>}
        {!repair && <button type="button" className="btn btn-primary" disabled={!loaded || busy || selected.length === 0} onClick={() => void execute('generate')}>{t(busy ? 'repair.loading' : 'repair.generate')}</button>}
        {candidate && !publication?.pullUrl && <button type="button" className="btn btn-primary" disabled={busy || checking} onClick={() => void execute('publish')}>{t(busy ? 'repair.loading' : 'repair.publish')}</button>}
        {publication?.pullUrl && <a className="btn btn-outline" href={publication.pullUrl} target="_blank" rel="noreferrer">{t('repair.viewPr')}<ExternalLink size={14} /></a>}
        {publication?.pullUrl && publication.status !== 'MERGED' && !confirmMerge && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirmMerge(true)}>{t('repair.merge')}</button>}
      </div>
      {confirmMerge && <div className="diag-notice" role="group" aria-label={t('repair.merge')}><div><p>{t('repair.mergeConfirm')}</p><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void execute('merge')}>{t(busy ? 'repair.loading' : 'repair.merge')}</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setConfirmMerge(false)}>{t('diag.cancel')}</button></div></div>}
    </section>
  );
}
