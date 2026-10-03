import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';

export function EnvironmentVariablesNotice({ names, variablesUrl, compact = false }: { names: string[]; variablesUrl: string; compact?: boolean }) {
  const { t } = useI18n();
  const query = names.length ? `&keys=${encodeURIComponent(names.join(','))}` : '';
  const actions = <><Link className="btn btn-primary btn-sm" to={`${variablesUrl}?action=add${query}`}>{t('repair.environment.add')}</Link><Link className="btn btn-outline btn-sm" to={`${variablesUrl}?action=upload${query}`}>{t('repair.environment.upload')}</Link></>;
  if (compact) return <span className="failed-repair-action" onClick={e => e.stopPropagation()}>{actions}</span>;
  return <div className="repair-access" role="status"><b>{t('repair.environment.title')}</b>{names.length > 0 && <p className="mono">{names.join(', ')}</p>}<p>{t('repair.environment.note')}</p><div className="diag-brief-actions">{actions}</div></div>;
}
