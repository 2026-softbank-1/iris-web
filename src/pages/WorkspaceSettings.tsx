import { KeyRound, Plus } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { useUI } from '../components/ui';
import { useI18n, type MessageKey } from '../i18n';

const TITLES: Record<string, MessageKey> = {
  domains: 'nav.domains',
  'audit-logs': 'nav.auditLogs',
  developer: 'nav.developer',
};

function Empty({ title, desc, action }: { title: MessageKey; desc: MessageKey; action?: MessageKey }) {
  const { toast } = useUI();
  const { t } = useI18n();
  return (
    <div className="tpl-empty">
      <div className="tpl-empty-text">
        <p className="tpl-empty-title">{t(title)}</p>
        <p className="tpl-empty-sub">{t(desc)}</p>
      </div>
      {action && (
        <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => toast(t('create.notAvailable', { action: t(action) }))}>
          <Plus size={16} /> {t(action)}
        </button>
      )}
    </div>
  );
}

export function WorkspaceSettings() {
  const { section = '' } = useParams();
  const { toast } = useUI();
  const { t } = useI18n();
  if (!TITLES[section]) return <Navigate to="/dashboard" replace />;
  const title = t(TITLES[section]);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{title}</p>
        </div>
        <div className="ws-set">
          {section === 'domains' && <Empty title="create.noDomainsTitle" desc="create.noDomainsBody" action="create.addDomain" />}
          {section === 'audit-logs' && <Empty title="create.noAuditTitle" desc="create.noAuditBody" />}
          {section === 'developer' && (
            <div className="ws-set-card">
              <p className="ws-set-label">{t('create.tokens')}</p>
              <p className="set-muted">{t('create.tokensBody')}</p>
              <div className="ws-set-row">
                <input className="input" placeholder={t('create.tokenName')} />
                <button type="button" className="btn btn-primary" onClick={() => toast(t('create.tokenCreated'))}>
                  <KeyRound size={16} /> {t('create.createToken')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
