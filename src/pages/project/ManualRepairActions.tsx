import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { ApiError, describeError } from '../../lib/api';
import { createDeployment } from '../../lib/endpoints';

/** Human remediation creates a fresh deployment with current settings and the latest branch head. */
export function ManualRepairActions({ serviceId, names, variablesUrl, compact = false }: { serviceId: string; names: string[]; variablesUrl: string; compact?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const requestKey = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function redeploy() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    requestKey.current ??= crypto.randomUUID();
    try {
      const deployment = await createDeployment(serviceId, { triggerType: 'MANUAL' }, requestKey.current);
      if (mounted.current) navigate(`${variablesUrl.replace(/\/variables$/, '')}/deployment/${deployment.id}/details`);
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError && e.code === 'DEPLOYMENT_IN_PROGRESS' ? t('repair.manual.inProgress') : describeError(e));
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  const actions = <>
    <button type="button" className="btn btn-outline btn-sm" disabled title={t('repair.manual.reason')}><Sparkles size={14} />{t('repair.title')}</button>
    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={e => { e.preventDefault(); e.stopPropagation(); void redeploy(); }}><RefreshCw size={14} />{t(busy ? 'repair.loading' : 'repair.manual.redeploy')}</button>
  </>;
  if (compact) return <span className="failed-repair-action" onClick={e => e.stopPropagation()}>{actions}{error && <span className="failed-repair-error" role="alert">{error}</span>}</span>;
  return <div className="repair-access" role="status"><b>{t('repair.manual.title')}</b>{names.length > 0 && <p className="mono">{names.join(', ')}</p>}<p>{t('repair.manual.note')}</p><div className="diag-brief-actions">{actions}{names.length > 0 && <Link className="btn btn-outline btn-sm" to={variablesUrl}>{t('repair.manual.variables')}</Link>}</div>{error && <p role="alert">{error}</p>}</div>;
}
