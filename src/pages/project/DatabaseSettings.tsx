import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../components/ui';
import type { Project, Service } from '../../data/mock';
import { useProjects } from '../../data/ProjectsContext';
import { useI18n } from '../../i18n';
import { ApiError, describeError } from '../../lib/api';
import { DataLossNotice } from '../../components/DatabaseBits';
import { Item, ValueSetting } from './ServiceSettings';

/** 관리형 DB 의 설정: 이름과 삭제뿐이다(저장소·빌드·배포 방식 같은 앱 설정은 해당 없음). */
export function DatabaseSettings({ project, service }: { project: Project; service: Service }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const navigate = useNavigate();
  const { updateService, removeService } = useProjects();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const rename = async (name: string) => {
    try {
      await updateService(project.id, service.id, { name });
      toast(t('svcSettings.saved'));
      return true;
    } catch (e) {
      toast(describeError(e));
      return false;
    }
  };
  const remove = async () => {
    setDeleting(true);
    try {
      await removeService(project.id, service.id);
      toast(t('svcSettings.deleted'));
      navigate(`/project/${project.id}`, { replace: true });
    } catch (e) {
      toast(e instanceof ApiError && e.code === 'DEPLOYMENT_IN_PROGRESS' ? t('svcSettings.delete.inProgress') : describeError(e));
      setDeleting(false);
    }
  };

  return (
    <div className="db-settings">
      <Item title={t('svcSettings.serviceName.title')} desc={t('svcSettings.serviceName.desc')} id="db-name">
        <ValueSetting
          label={t('svcSettings.serviceName.label')}
          value={service.name}
          inputProps={{ required: true, maxLength: 63, pattern: '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?', title: t('svcSettings.serviceName.hint') }}
          onSave={(v) => (v ? rename(v) : Promise.resolve(false))}
        />
      </Item>
      <section className="st-section danger" id="set-Danger">
        <Item title={t('stack.db.deleteTitle')} desc={t('stack.db.deleteDesc')} id="db-delete">
          <DataLossNotice />
          <div className="st-delete-box">
            <label className="st-muted" htmlFor="db-delete-confirm">
              {t('svcSettings.delete.confirmBefore')}<b>{service.name}</b>{t('svcSettings.delete.confirmAfter')}
            </label>
            <input id="db-delete-confirm" className="st-delete-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button type="button" className="btn st-delete" disabled={confirm !== service.name || deleting} onClick={() => void remove()}>
              <TriangleAlert size={16} /> {t('stack.db.deleteButton')}
            </button>
          </div>
        </Item>
      </section>
    </div>
  );
}
