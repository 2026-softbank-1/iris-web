import { PanelsTopLeft, Plus } from 'lucide-react';
import { useUI } from '../components/ui';
import { useI18n } from '../i18n';

export function Templates() {
  const { toast } = useUI();
  const { t } = useI18n();
  const soon = () => toast(t('create.templatesSoon'));
  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{t('create.templates')}</p>
          <button type="button" className="btn btn-primary dash-new" onClick={soon}>
            <div className="side-icon">
              <Plus size={16} strokeWidth={2.25} />
            </div>
            <span>{t('dash.new')}</span>
          </button>
        </div>
        <div className="tpl-body">
          <div className="tpl-sub">
            <p>{t('create.templatesSub')}</p>
          </div>
          <div className="tpl-empty">
            <div className="tool-icon">
              <PanelsTopLeft size={24} />
            </div>
            <div className="tpl-empty-text">
              <p className="tpl-empty-title">{t('create.noTemplatesTitle')}</p>
              <p className="tpl-empty-sub">
                {t('create.noTemplatesBefore')}
                <button type="button" onClick={soon}>
                  {t('create.noTemplatesLink')}
                </button>
                {t('create.noTemplatesAfter')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
