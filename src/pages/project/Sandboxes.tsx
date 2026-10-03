import { Box, Plus } from 'lucide-react';
import { useUI } from '../../components/ui';
import { useI18n } from '../../i18n';

export function Sandboxes() {
  const { toast } = useUI();
  const { t } = useI18n();
  return (
    <div className="proj-page-region">
      <div className="proj-frame sandboxes">
        <div className="sb-empty">
          <div className="sb-icon">
            <Box size={22} />
          </div>
          <p className="obs-title">{t('project.sandbox.emptyTitle')}</p>
          <p className="obs-desc">{t('project.sandbox.emptyDesc')}</p>
          <button type="button" className="btn btn-primary" onClick={() => toast(t('project.sandbox.toast'))}>
            <Plus size={16} /> {t('project.sandbox.new')}
          </button>
        </div>
      </div>
    </div>
  );
}
