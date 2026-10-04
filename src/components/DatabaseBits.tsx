import { TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n';
import type { DatabaseEngine } from '../lib/endpoints';

export const ENGINE_LABEL: Record<DatabaseEngine, string> = { postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', redis: 'Redis' };

/** 개발·데모용 DB 임을 알리는 경고. 삭제하면 데이터가 사라지고 백업이 없다. */
export function DataLossNotice() {
  const { t } = useI18n();
  return (
    <div className="db-warning" role="note">
      <TriangleAlert size={18} aria-hidden />
      <div>
        <h3>{t('stack.db.warnTitle')}</h3>
        <ul>
          <li>{t('stack.db.warn.demo')}</li>
          <li>{t('stack.db.warn.delete')}</li>
          <li>{t('stack.db.warn.backup')}</li>
          <li>{t('stack.db.warn.restart')}</li>
        </ul>
      </div>
    </div>
  );
}
