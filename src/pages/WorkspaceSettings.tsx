import { Hourglass } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n';

// 워크스페이스 설정은 아직 서버 기능이 없어서 모두 '준비 중'으로 보여준다.
const SECTIONS: Record<string, { title: MessageKey; desc: MessageKey }> = {
  domains: { title: 'nav.domains', desc: 'create.soon.domains' },
  'audit-logs': { title: 'nav.auditLogs', desc: 'create.soon.auditLogs' },
  developer: { title: 'nav.developer', desc: 'create.soon.developer' },
};

export function WorkspaceSettings() {
  const { section = '' } = useParams();
  const { t } = useI18n();
  const current = SECTIONS[section];
  if (!current) return <Navigate to="/dashboard" replace />;

  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{t(current.title)}</p>
        </div>
        <div className="soon">
          <div className="soon-icon">
            <Hourglass size={22} />
          </div>
          <p className="soon-title">{t('create.soon.title')}</p>
          <p className="soon-desc">{t(current.desc)}</p>
          <Link to="/dashboard" className="btn btn-secondary soon-back">
            {t('project.backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
